import * as fs from "fs";
import * as path from "path";
import { sync as globSync } from "glob";
import * as vscode from "vscode";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { BuildMode, BuildSummary, ValidatedPath } from "#models/build-summary";
import { S4TKConfig } from "#models/s4tk-config";

//#region Constants

const _SUPPORTED_EXTENSIONS = [
  ".package",
  ".stbl",
  ".stbl.json",
  ".xml",
];

const _TGI_REGEX = /(?<t>[0-9a-f]{8}).(?<g>[0-9a-f]{8}).(?<i>[0-9a-f]{16})/i;

//#endregion

//#region Exported Functions

/**
 * Builds the project and returns a BuildSummary object 
 * 
 * @param mode Mode to build for
 */
export async function buildProject(mode: BuildMode): Promise<BuildSummary> {
  const summary = BuildSummary.create(mode);

  if (!S4TKWorkspace.active) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = "S4TK config is not loaded";
    return summary;
  }

  try {
    // validating build
    _validateBuildSource(summary);
    _validateBuildDestinations(summary);
    _validateBuildPackages(summary);
    if (mode === "release") _validateBuildRelease(summary);

    // TODO: actually build
  } catch (err) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = (err as Error).message;
  }

  return summary;
}

//#endregion

//#region Validation Helpers

function FatalBuildError(message: string, kwargs?: {
  addWarning?: {
    warning?: string;
  };
}): Error {
  if (kwargs?.addWarning) kwargs.addWarning.warning = message;
  return new Error(message);
}

function _addAndGetItem<T>(array: T[], item: T): T {
  array.push(item);
  return item;
}

function _validateBuildSource(summary: BuildSummary) {
  const original = S4TKWorkspace.config.buildInstructions.source;

  const resolved = (original
    ? S4TKConfig.resolvePath(original)
    : vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath) ?? '';

  summary.config.source.original = original;
  summary.config.source.resolved = resolved;

  if (!resolved) throw FatalBuildError(
    "buildInstructions.source could not be resolved to a valid path", {
    addWarning: summary.config.source
  });

  if (!_isExistingDirectory(resolved)) throw FatalBuildError(
    "buildInstructions.source does not lead to a folder", {
    addWarning: summary.config.source
  });
}

function _validateBuildDestinations(summary: BuildSummary) {
  const { destinations } = S4TKWorkspace.config.buildInstructions;
  const { overrideDestinations } = S4TKWorkspace.config.releaseSettings;
  const useOverrides = summary.buildInfo.mode === "release" && overrideDestinations.length >= 1;
  const originals = useOverrides ? overrideDestinations : destinations;
  const propName = useOverrides ? 'releaseSettings.overrideDestinations' : 'buildInstructions.destinations';

  if (originals.length < 1) throw FatalBuildError(
    `${propName} cannot be empty`
  );

  const { allowFolderCreation } = S4TKWorkspace.config.buildSettings;
  const seenPaths = new Set<string>();
  originals.forEach((original, i) => {
    const resolved = S4TKConfig.resolvePath(original) ?? '';

    const destination = _addAndGetItem(summary.config.destinations, { original, resolved });

    if (!resolved) throw FatalBuildError(
      `${propName}[${i}] could not be resolved to a valid path (${original})`, {
      addWarning: destination
    });

    if (!allowFolderCreation && !_isExistingDirectory(resolved)) throw FatalBuildError(
      `${propName}[${i}] does not lead to an existing directory, and buildSettings.allowFolderCreation is false (${original})`, {
      addWarning: destination
    });

    if (seenPaths.has(resolved)) {
      destination.warning = `${propName}[${i}] is listed more than once`;
      destination.ignore = true;
      summary.buildInfo.problems++;
    } else {
      seenPaths.add(resolved);
    }
  });
}

function _validateBuildPackages(summary: BuildSummary) {
  const { packages } = S4TKWorkspace.config.buildInstructions;
  const { buildSettings } = S4TKWorkspace.config;
  const propName = "buildInstructions.packages";

  if (packages.length < 1) throw FatalBuildError(
    `${propName} cannot be empty`
  );

  const seenFilenames = new Set<string>();
  const seenGlobMatches = new Set<string>();
  packages.forEach((pkg, i) => {
    const validatedPkg = _addAndGetItem(summary.config.packages, {
      filename: pkg.filename,
      include: [],
      exclude: [],
    });

    if (!pkg.filename) throw FatalBuildError(
      `${propName}[${i}].filename cannot be empty`, {
      addWarning: validatedPkg
    });

    if (seenFilenames.has(pkg.filename)) throw FatalBuildError(
      `${propName}[${i}].filename is already in use by another package`, {
      addWarning: validatedPkg
    });

    seenFilenames.add(pkg.filename);

    if (pkg.include.length < 1 && !buildSettings.allowEmptyPackages) throw FatalBuildError(
      `${propName}[${i}].include is empty, and buildSettings.allowEmptyPackages is false`, {
      addWarning: validatedPkg
    });

    function resolveGlobArray(arrName: "include" | "exclude") {
      return function resolveGlob(original: string, j: number) {
        const resolved = S4TKConfig.resolvePath(original, {
          relativeTo: summary.config.source.resolved,
          isGlob: true
        }) ?? '';

        const added = _addAndGetItem(validatedPkg[arrName], { original, resolved });

        if (!resolved) throw FatalBuildError(
          `${propName}[${i}].${arrName}[${j}] could not be resolved as a valid path`, {
          addWarning: added
        });
      }
    }

    pkg.include.forEach(resolveGlobArray("include"));
    pkg.exclude?.forEach(resolveGlobArray("exclude"));
    const matches = _findGlobMatches(validatedPkg.include, validatedPkg.exclude);

    if (matches.length < 1) {
      if (buildSettings.allowEmptyPackages) {
        validatedPkg.warning = `${propName}[${i}]'s glob patterns do not match any supported file types, so it will be empty`;
        summary.buildInfo.problems++;
      } else {
        throw FatalBuildError(
          `${propName}[${i}]'s glob patterns do not match any supported file types, and buildSettings.allowEmptyPackages is false`, {
          addWarning: validatedPkg
        });
      }
    } else if (matches.some(match => seenGlobMatches.has(match))) {
      if (buildSettings.allowPackageOverlap) {
        validatedPkg.warning = `${propName}[${i}]'s glob patterns match files that are already included in other packages, so there will be overlap`;
        summary.buildInfo.problems++;
      } else {
        throw FatalBuildError(
          `${propName}[${i}]'s glob patterns match files that are already included in other packages, and buildSettings.allowPackageOverlap is false`, {
          addWarning: validatedPkg
        });
      }
    }

    matches.forEach(match => seenGlobMatches.add(match));
  });

  const allGlob = S4TKConfig.resolvePath("**/*", {
    relativeTo: summary.config.source.resolved,
    isGlob: true
  })!;

  const allMatches = _findGlobMatches([allGlob], undefined);
  const numMissingFiles = allMatches.length - seenGlobMatches.size;
  if (numMissingFiles > 0) {
    allMatches.forEach(match => {
      if (!seenGlobMatches.has(match)) summary.missingSourceFiles.push(
        match.replace(summary.config.source.resolved, "")
      );
    });

    if (!buildSettings.allowMissingSourceFiles) throw FatalBuildError(
      `${numMissingFiles} file(s) within the source folder is/are not captured by any package's glob patterns, and buildSettings.allowMissingSourceFiles is false`
    );
  }
}

function _validateBuildRelease(summary: BuildSummary) {
  const { releaseSettings } = S4TKWorkspace.config;

  summary.config.zip = {
    filename: releaseSettings.filename,
    otherFiles: []
  };

  if (!releaseSettings.filename) throw FatalBuildError(
    `releaseSettings.filename cannot be empty when building in release mode`, {
    addWarning: summary.config.zip
  });

  releaseSettings.otherFilesToInclude.forEach((original, i) => {
    const resolved = S4TKConfig.resolvePath(original) ?? '';
    const propName = `releaseSettings.otherFilesToInclude[${i}]`;
    const otherFile = _addAndGetItem(summary.config.zip!.otherFiles, { original, resolved });

    if (!resolved) throw FatalBuildError(
      `${propName} could not be resolved as a valid path (${original})`, {
      addWarning: otherFile
    });

    if (!_isExistingFile(resolved)) throw FatalBuildError(
      `${propName} does not lead to an existing file (${original})`, {
      addWarning: otherFile
    });
  });
}

//#endregion

//#region Other Helpers

function _findGlobMatches(
  include: ValidatedPath[] | string[],
  exclude: ValidatedPath[] | string[] | undefined
): string[] {
  const toAbsPath = (p: string | ValidatedPath) =>
    typeof p === "string" ? p : p.resolved;
  return globSync(include.map(toAbsPath), {
    ignore: exclude?.map(toAbsPath)
  }).filter(_isSupportedFileType);
}

function _isExistingDirectory(sysPath: string): boolean {
  return fs.existsSync(sysPath) && fs.lstatSync(sysPath).isDirectory();
}

function _isExistingFile(sysPath: string): boolean {
  return fs.existsSync(sysPath) && fs.lstatSync(sysPath).isFile();
}

function _isSupportedFileType(filepath: string): boolean {
  const filename = path.basename(filepath);
  if (_SUPPORTED_EXTENSIONS.some(ext => filename.endsWith(ext))) return true;
  return _TGI_REGEX.test(filename);
}

//#endregion
