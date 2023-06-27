import * as fs from "fs";
import * as vscode from "vscode";
import { S4TKConfig } from "#models/s4tk-config";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { FatalBuildError, addAndGetItem } from "./helpers";
import { findGlobMatches } from "./resources";
import { BuildSummary } from "./summary";

//#region Exported Functions

/**
 * Validates the current loaded S4TK config and workspace files and prepares the
 * given summary for use during the build process.
 * 
 * @param summary BuildSummary to update during validation
 */
export function prevalidateBuild(summary: BuildSummary) {
  _validateBuildSource(summary);
  _validateBuildDestinations(summary);
  _validateBuildPackages(summary);
  if (summary.buildInfo.mode === "release")
    _validateBuildRelease(summary);
}

//#endregion

//#region Validation Helpers

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

    const destination = addAndGetItem(summary.config.destinations, { original, resolved });

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
    const validatedPkg = addAndGetItem(summary.config.packages, {
      filename: _guaranteeExtension(pkg.filename, ".package"),
      duplicateFilesFrom: pkg.duplicateFilesFrom?.map(name => _guaranteeExtension(name, ".package")) ?? [],
      include: [],
      exclude: [],
      doNotGenerate: pkg.doNotGenerate ?? false,
      doNotWrite: pkg.doNotWrite ?? false,
    });

    if (!pkg.filename) throw FatalBuildError(
      `${propName}[${i}].filename cannot be empty`, {
      addWarning: validatedPkg
    });

    for (let j = 0; j < validatedPkg.duplicateFilesFrom.length; ++j) {
      const name = validatedPkg.duplicateFilesFrom[j];
      if (!seenFilenames.has(name)) throw FatalBuildError(
        `${propName}[${i}].duplicateFilesFrom[${j}] is "${name}", but no package with this filename exists yet; perhaps this is a typo, or you have ordered your ${propName} incorrectly?`, {
        addWarning: validatedPkg
      });
    }

    if (seenFilenames.has(validatedPkg.filename)) throw FatalBuildError(
      `${propName}[${i}].filename is already in use by another package`, {
      addWarning: validatedPkg
    });
    seenFilenames.add(validatedPkg.filename);

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

        const added = addAndGetItem(validatedPkg[arrName], { original, resolved });

        if (!resolved) throw FatalBuildError(
          `${propName}[${i}].${arrName}[${j}] could not be resolved as a valid path`, {
          addWarning: added
        });
      }
    }

    pkg.include.forEach(resolveGlobArray("include"));
    pkg.exclude?.forEach(resolveGlobArray("exclude"));
    const matches = findGlobMatches(validatedPkg.include, validatedPkg.exclude, "supported");

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

  summary.written.ignoredSourceFiles.push(
    ...findGlobMatches([allGlob], undefined, "unsupported")
      .filter(_isExistingFile)
      .map(fp => fp.replace(summary.config.source.resolved, ""))
  );

  const allMatches = findGlobMatches([allGlob], undefined, "supported");
  const numMissingFiles = allMatches.length - seenGlobMatches.size;
  if (numMissingFiles > 0) {
    allMatches.forEach(match => {
      if (!seenGlobMatches.has(match)) summary.written.missingSourceFiles.push(
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
    filename: _guaranteeExtension(releaseSettings.filename, ".zip"),
    internalFolder: releaseSettings.internalFolder,
    otherFiles: []
  };

  if (!releaseSettings.filename) throw FatalBuildError(
    `releaseSettings.filename cannot be empty when building in release mode`, {
    addWarning: summary.config.zip
  });

  function resolveGlobs(arrName: "include" | "exclude"): string[] {
    if (!releaseSettings.otherFiles[arrName]?.length) return [];

    return releaseSettings.otherFiles[arrName]!.map((original, i) => {
      const resolved = S4TKConfig.resolvePath(original, { isGlob: true }) ?? '';

      if (!resolved) throw FatalBuildError(
        `releaseSettings.otherFiles.${arrName}[${i}] could not be resolved as a valid path (${original})`, {
        addWarning: summary.config.zip,
      });

      return resolved;
    });
  }

  const resolvedIncludes = resolveGlobs("include");
  if (resolvedIncludes.length) {
    const resolvedExcludes = resolveGlobs("exclude");
    const matches = findGlobMatches(resolvedIncludes, resolvedExcludes, "all");
    if (!matches.length) throw FatalBuildError(
      `releaseSettings.otherFiles.include has at least one item, but no files were matched by the include/exclude patterns`, {
      addWarning: summary.config.zip!
    });
    summary.config.zip.otherFiles = matches;
  }
}

//#endregion

//#region Other Helpers

function _guaranteeExtension(filepath: string, ext: string): string {
  return filepath.endsWith(ext) ? filepath : filepath + ext;
}

function _isExistingDirectory(sysPath: string): boolean {
  return fs.existsSync(sysPath) && fs.lstatSync(sysPath).isDirectory();
}

function _isExistingFile(sysPath: string): boolean {
  return fs.existsSync(sysPath) && fs.lstatSync(sysPath).isFile();
}

//#endregion
