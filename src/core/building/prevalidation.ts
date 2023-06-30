import * as fs from "fs";
import * as vscode from "vscode";
import { resolveGlobPattern } from "#helpers/fs";
import { FatalBuildError, addAndGetItem } from "./helpers";
import { findGlobMatches } from "./resources";
import { BuildContext } from "./context";

//#region Exported Functions

/**
 * Validates the current loaded S4TK config and workspace files and prepares the
 * given summary for use during the build process.
 * 
 * @param context BuildContext to update during validation
 */
export function prevalidateBuild(context: BuildContext) {
  _validateBuildSource(context);
  _validateBuildDestinations(context);
  _validateBuildPackages(context);
  if (context.summary.buildInfo.mode === "release")
    _validateBuildRelease(context);
}

//#endregion

//#region Validation Helpers

function _validateBuildSource(context: BuildContext) {
  const original = context.workspace.config.buildInstructions.source;

  const resolved = (original
    ? context.workspace.resolvePath(original)
    : context.workspace.rootUri.fsPath) ?? '';

  context.summary.config.source.original = original;
  context.summary.config.source.resolved = resolved;

  if (!resolved) throw FatalBuildError(
    "buildInstructions.source could not be resolved to a valid path", {
    addWarning: context.summary.config.source
  });

  if (!_isExistingDirectory(resolved)) throw FatalBuildError(
    "buildInstructions.source does not lead to a folder", {
    addWarning: context.summary.config.source
  });
}

function _validateBuildDestinations(context: BuildContext) {
  const { destinations } = context.workspace.config.buildInstructions;
  const { overrideDestinations } = context.workspace.config.releaseSettings;
  const useOverrides = context.summary.buildInfo.mode === "release" && overrideDestinations.length >= 1;
  const originals = useOverrides ? overrideDestinations : destinations;
  const propName = useOverrides ? 'releaseSettings.overrideDestinations' : 'buildInstructions.destinations';

  if (originals.length < 1) throw FatalBuildError(
    `${propName} cannot be empty`
  );

  const { allowFolderCreation } = context.workspace.config.buildSettings;
  const seenPaths = new Set<string>();
  originals.forEach((original, i) => {
    const resolved = context.workspace.resolvePath(original);
    const destination = addAndGetItem(context.summary.config.destinations, { original, resolved });

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
      context.summary.buildInfo.problems++;
    } else {
      seenPaths.add(resolved);
    }
  });
}

function _validateBuildPackages(context: BuildContext) {
  const summary = context.summary;
  const { packages } = context.workspace.config.buildInstructions;
  const { buildSettings } = context.workspace.config;
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
        const resolved = resolveGlobPattern(summary.config.source.resolved, original);
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

  const allGlob = resolveGlobPattern(summary.config.source.resolved, "**/*");

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

function _validateBuildRelease(context: BuildContext) {
  const summary = context.summary;
  const { releaseSettings } = context.workspace.config;

  const seenZipNames = new Set<string>();
  const availablePkgs = new Set<string>(
    summary.config.packages
      .filter(p => !p.doNotGenerate)
      .map(p => p.filename)
  );

  summary.config.zips ??= [];
  releaseSettings.zips.forEach((zipInfo, i) => {
    const zipIndex = `releaseSettings.zips[${i}]`;

    const zip = addAndGetItem(summary.config.zips!, {
      filename: _guaranteeExtension(zipInfo.filename, ".zip"),
      internalFolder: zipInfo.internalFolder,
      doNotGenerate: zipInfo.doNotGenerate ?? false,
      packages: zipInfo.packages.map(pkgName => _guaranteeExtension(pkgName, ".package")),
      otherFiles: [], // will add to
    });

    if (zipInfo.doNotGenerate) {
      zip.warning = "This ZIP is not being generated, so further validation is being skipped.";
      // intentionally not incrementing problems since this isn't actually an issue
      return;
    }

    if (!zipInfo.filename) throw FatalBuildError(
      `${zipIndex}.filename cannot be empty when building in release mode`, {
      addWarning: zip,
    });

    if (seenZipNames.has(zip.filename)) throw FatalBuildError(
      `${zipIndex}.filename resolves to "${zip.filename}", which is already in used by another ZIP.`, {
      addWarning: zip
    });
    seenZipNames.add(zip.filename);

    zip.packages.forEach((pkgName, j) => {
      if (!availablePkgs.has(pkgName)) throw FatalBuildError(
        `${zipIndex}.packages[${j}] resolves to "${pkgName}", which either does not exist or is not being generated.`, {
        addWarning: zip,
      });
    });

    function resolveGlobs(arrName: "include" | "exclude"): string[] {
      if (!zipInfo.otherFiles?.[arrName]?.length) return [];

      return zipInfo.otherFiles[arrName]!.map((original, j) => {
        const resolved = context.workspace.resolvePath(original, true) ?? '';

        if (!resolved) throw FatalBuildError(
          `${zipIndex}.otherFiles.${arrName}[${j}] could not be resolved as a valid path (${original})`, {
          addWarning: zip,
        });

        return resolved;
      });
    }

    const resolvedIncludes = resolveGlobs("include");
    if (resolvedIncludes.length) {
      const resolvedExcludes = resolveGlobs("exclude");
      const matches = findGlobMatches(resolvedIncludes, resolvedExcludes, "all");
      if (!matches.length) throw FatalBuildError(
        `${zipIndex}.otherFiles.include has at least one item, but no files were matched by the include/exclude patterns`, {
        addWarning: zip
      });
      zip.otherFiles = matches;
    }
  });
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
