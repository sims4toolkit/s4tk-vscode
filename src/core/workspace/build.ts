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

function _validateBuildSource(summary: BuildSummary) {
  const original = S4TKWorkspace.config.buildInstructions.source;

  const resolved = original
    ? S4TKConfig.resolvePath(original)
    : vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

  if (!resolved)
    throw new Error(`buildInstructions.source could not be resolved to a valid path (${original})`);

  if (!_isExistingDirectory(resolved))
    throw new Error(`buildInstructions.source does not lead to a folder (${original})`);

  summary.config.source = { original, resolved };
}

function _validateBuildDestinations(summary: BuildSummary) {
  const { destinations } = S4TKWorkspace.config.buildInstructions;
  const { overrideDestinations } = S4TKWorkspace.config.releaseSettings;
  const useOverrides = summary.buildInfo.mode === "release" && overrideDestinations.length >= 1;
  const originals = useOverrides ? overrideDestinations : destinations;
  const propName = useOverrides ? 'releaseSettings.overrideDestinations' : 'buildInstructions.destinations';

  if (originals.length < 1)
    throw new Error(`${propName} cannot be empty`);

  const { allowFolderCreation } = S4TKWorkspace.config.buildSettings;
  const seenPaths = new Set<string>();
  originals.forEach((original, i) => {
    const resolved = S4TKConfig.resolvePath(original);

    if (!resolved)
      throw new Error(`${propName}[${i}] could not be resolved to a valid path (${original})`);

    if (!allowFolderCreation && !_isExistingDirectory(resolved))
      throw new Error(`${propName}[${i}] does not lead to an existing directory, and buildSettings.allowFolderCreation is false (${original})`);

    if (seenPaths.has(resolved)) {
      summary.config.destinations.push({
        original,
        resolved,
        warning: `${propName}[${i}] is listed more than once`,
        ignore: true
      });

      summary.buildInfo.problems++;
    } else {
      summary.config.destinations.push({ original, resolved });
      seenPaths.add(resolved);
    }
  });
}

function _validateBuildPackages(summary: BuildSummary) {
  const { packages } = S4TKWorkspace.config.buildInstructions;
  const { buildSettings } = S4TKWorkspace.config;
  const propName = "buildInstructions.packages";

  if (packages.length < 1)
    throw new Error(`${propName} cannot be empty`);

  const seenFilenames = new Set<string>();
  const seenGlobMatches = new Set<string>();
  packages.forEach((pkg, i) => {
    if (!pkg.filename)
      throw new Error(`${propName}[${i}].filename cannot be empty`);

    if (seenFilenames.has(pkg.filename))
      throw new Error(`${propName}[${i}].filename is already in use by another package`);
    seenFilenames.add(pkg.filename);

    if (pkg.include.length < 1 && !buildSettings.allowEmptyPackages)
      throw new Error(`${propName}[${i}].include is empty, and buildSettings.allowEmptyPackages is false`);

    function resolveGlobArray(arrName: string) {
      return function resolveGlob(original: string, j: number): ValidatedPath {
        const resolved = S4TKConfig.resolvePath(original, {
          relativeTo: summary.config.source.resolved,
          isGlob: true
        });

        if (!resolved)
          throw new Error(`${propName}[${i}].${arrName}[${j}] could not be resolved as a valid path (${original})`);

        return { original, resolved };
      }
    }

    const validatedIncludes = pkg.include.map(resolveGlobArray("include"));
    const validatedExcludes = pkg.exclude?.map(resolveGlobArray("exclude"));
    const matches = _findGlobMatches(validatedIncludes, validatedExcludes);
    let packageWarning: string | undefined;

    if (matches.length < 1) {
      if (buildSettings.allowEmptyPackages) {
        packageWarning = `${propName}[${i}]'s glob patterns do not match any supported file types, so it will be empty`;
        summary.buildInfo.problems++;
      } else {
        throw new Error(`${propName}[${i}]'s glob patterns do not match any supported file types, and buildSettings.allowEmptyPackages is false`);
      }
    } else if (matches.some(match => seenGlobMatches.has(match))) {
      if (buildSettings.allowPackageOverlap) {
        packageWarning = `${propName}[${i}]'s glob patterns match files that are already included in other packages, so there will be overlap`;
        summary.buildInfo.problems++;
      } else {
        throw new Error(`${propName}[${i}]'s glob patterns match files that are already included in other packages, and buildSettings.allowPackageOverlap is false`);
      }
    }

    matches.forEach(match => seenGlobMatches.add(match));

    summary.config.packages.push({
      filename: pkg.filename,
      include: validatedIncludes,
      exclude: validatedExcludes,
      warning: packageWarning,
    });
  });
}

function _validateBuildRelease(summary: BuildSummary) {
  const { releaseSettings } = S4TKWorkspace.config;

  if (!releaseSettings.filename)
    throw new Error(`releaseSettings.filename cannot be empty when building in release mode`);

  const validatedOtherFiles = releaseSettings.otherFilesToInclude?.map((original, i) => {
    const resolved = S4TKConfig.resolvePath(original);
    const propName = `releaseSettings.otherFilesToInclude[${i}]`;
    if (!resolved)
      throw new Error(`${propName} could not be resolved as a valid path (${original})`);
    if (!_isExistingFile(resolved))
      throw new Error(`${propName} does not lead to an existing file (${original})`);
    return { original, resolved };
  });

  summary.config.zip = {
    filename: releaseSettings.filename,
    otherFiles: validatedOtherFiles,
  };
}

//#endregion

//#region Other Helpers

function _findGlobMatches(include: ValidatedPath[], exclude: ValidatedPath[] | undefined): string[] {
  return globSync(include.map(v => v.resolved), {
    ignore: exclude?.map(v => v.resolved)
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
