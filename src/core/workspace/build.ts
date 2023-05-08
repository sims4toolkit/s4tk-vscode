import * as fs from "fs";
import * as path from "path";
import { sync as globSync } from "glob";
import * as vscode from "vscode";
import { Package, RawResource, SimDataResource } from "@s4tk/models";
import { ResourceKey, ResourceKeyPair } from "@s4tk/models/types";
import { S4TKConfig } from "#models/s4tk-config";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { BuildMode, BuildPackageInfo, BuildSummary, ValidatedPath } from "#models/build-summary";
import { getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
import { BinaryResourceType, SimDataGroup } from "@s4tk/models/enums";

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

    // performing build
    _buildValidatedFiles(summary);
  } catch (err) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = (err as Error).message;
  }

  return summary;
}

//#endregion

//#region Constants

const _SUPPORTED_EXTENSIONS = [
  ".package",
  ".stbl",
  ".stbl.json",
  ".xml",
];

const _TGI_REGEX = /(?<t>[0-9a-f]{8}).(?<g>[0-9a-f]{8}).(?<i>[0-9a-f]{16})/i;

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
      filename: _guaranteeExtension(pkg.filename, ".package"),
      include: [],
      exclude: [],
    });

    if (!pkg.filename) throw FatalBuildError(
      `${propName}[${i}].filename cannot be empty`, {
      addWarning: validatedPkg
    });

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
    filename: _guaranteeExtension(releaseSettings.filename, ".zip"),
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

//#region Build Helpers

interface ResourcePaths {
  packages: string[];
  simdata: string[];
  stblJson: string[];
  stblBinary: string[];
  tuning: string[];
  tgi: string[];
}

function _buildValidatedFiles(summary: BuildSummary) {
  const builtPackages: Package[] = []; // only for use with release mode
  const tunings = new Map<string, ResourceKey>(); // for use with SimData

  // FIXME: subtle bug, if a package contains a simdata paired with a tuning
  // that is written in a later package, it will fail with fatal error... no
  // easy way around this until I parse ALL of the tuning first, which has
  // pretty nasty memory overhead

  summary.config.packages.forEach(packageInfo => {
    const pkg = _buildPackage(summary, packageInfo, tunings);

    if (summary.buildInfo.mode === "build") {
      // TODO: write package
    } else if (summary.buildInfo.mode === "release") {
      builtPackages.push(pkg);
    }
  });

  if (summary.buildInfo.mode === "release") {
    // TODO: create and write ZIP
  }
}

function _buildPackage(summary: BuildSummary, packageInfo: BuildPackageInfo, tunings: Map<string, ResourceKey>): Package {
  const pkg = new Package();
  const matches = _findGlobMatches(packageInfo.include, packageInfo.exclude);
  let resourcePaths = _getResourcePaths(matches);

  resourcePaths.tuning.forEach(filepath => {
    const tuning = _parseXmlTuning(summary, filepath);
    const filename = path.basename(filepath).replace(/\.xml$/i, "");
    tunings.set(filename, tuning.key);
    pkg.add(tuning.key, tuning.value);
  });

  resourcePaths.simdata.forEach(filepath => {
    const { key, value } = _parseXmlSimData(summary, filepath, tunings);
    pkg.add(key, value);
  });

  // FIXME: merge stbls if setting is true

  resourcePaths.stblJson.forEach(filepath => {
    const { key, value } = _parseStblJson(summary, filepath);
    pkg.add(key, value);
  });

  resourcePaths.stblBinary.forEach(filepath => {
    const { key, value } = _parseStblBinary(summary, filepath);
    pkg.add(key, value);
  });

  resourcePaths.tgi.forEach(filepath => {
    const { key, value } = _parseTgiFile(summary, filepath);
    pkg.add(key, value);
  });

  resourcePaths.packages.forEach(filepath => {
    const entries = _parsePackage(summary, filepath);
    pkg.addAll(entries);
  });

  // FIXME: generate missing string tables if setting is true

  return pkg;
}

function _getResourcePaths(filepaths: string[]): ResourcePaths {
  const resourcePaths: ResourcePaths = {
    packages: [],
    simdata: [],
    stblJson: [],
    stblBinary: [],
    tuning: [],
    tgi: [],
  };

  filepaths.forEach(filepath => {
    const ext = path.extname(filepath);

    switch (ext) {
      case ".xml":
        if (filepath.endsWith(".SimData.xml"))
          resourcePaths.simdata.push(filepath);
        else
          resourcePaths.tuning.push(filepath);
        break;
      case ".package":
        resourcePaths.packages.push(filepath);
        break;
      case ".json":
        if (filepath.endsWith(".stbl.json"))
          resourcePaths.stblJson.push(filepath);
        break;
      case ".stbl":
        resourcePaths.stblBinary.push(filepath);
        break;
      default:
        resourcePaths.tgi.push(filepath);
        break;
    }
  });

  return resourcePaths;
}

function _parsePackage(summary: BuildSummary, filepath: string): ResourceKeyPair[] {
  // TODO: update summary
}

function _parseStblBinary(summary: BuildSummary, filepath: string): ResourceKeyPair {
  // TODO: update summary
}

function _parseStblJson(summary: BuildSummary, filepath: string): ResourceKeyPair {
  // TODO: update summary
}

function _parseTgiFile(summary: BuildSummary, filepath: string): ResourceKeyPair {
  // TODO: update summary
}

function _parseXmlSimData(summary: BuildSummary, filepath: string, tunings: Map<string, ResourceKey>): ResourceKeyPair {
  // TODO: update summary
  const buffer = fs.readFileSync(filepath);
  const content = buffer.toString();

  const key: Partial<ResourceKey> = getXmlKeyOverrides(content) ?? {};
  key.type ??= BinaryResourceType.SimData;
  const filename = path.basename(filepath).replace(/\.SimData\.xml$/i, "");
  const tuningKey = tunings.get(filename);
  if (key.group == undefined && tuningKey?.type)
    key.group = SimDataGroup.getForTuning(tuningKey.type);
  if (key.instance == undefined && tuningKey?.instance)
    key.instance = tuningKey.instance;

  if (!key.group) throw FatalBuildError(
    `Unable to infer group for SimData because it does not have a paired tuning, and no group override was found (${filepath})`
  );

  if (!key.instance) throw FatalBuildError(
    `Unable to infer instance ID for SimData because it does not have a paired tuning, and no instance override was found (${filepath})`
  );

  try {
    return {
      key: key as ResourceKey,
      value: SimDataResource.fromXml(content),
    };
  } catch (e) {
    throw FatalBuildError(
      `Failed to serialize SimData, it is likely malformed (${filepath}) [${e}]`
    );
  }
}

function _parseXmlTuning(summary: BuildSummary, filepath: string): ResourceKeyPair {
  // TODO: update summary
  const buffer = fs.readFileSync(filepath);
  const content = buffer.toString();

  const key: Partial<ResourceKey> = getXmlKeyOverrides(content) ?? {};
  const inferredKey = inferXmlMetaData(content).key;
  key.type ??= inferredKey.type;
  key.group ??= inferredKey.group ?? 0;
  key.instance ??= inferredKey.instance;

  if (!key.type) throw FatalBuildError(
    `Unable to infer tuning type from \`i\` attribute, and no type override was found (${filepath})`
  );

  if (!key.instance) throw FatalBuildError(
    `Unable to infer tuning ID from \`s\` attribute, and no instance override was found (${filepath})`
  );

  return {
    key: key as ResourceKey,
    value: RawResource.from(buffer)
  };
}

//#endregion

//#region Other Helpers

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

function _guaranteeExtension(filepath: string, ext: string): string {
  return filepath.endsWith(ext) ? filepath : filepath + ext;
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
