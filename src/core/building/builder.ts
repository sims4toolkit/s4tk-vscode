import * as fs from "fs";
import * as path from "path";
import * as JSZip from "jszip";
import * as models from "@s4tk/models";
import * as enums from "@s4tk/models/enums";
import * as types from "@s4tk/models/types";
import * as hashFormat from "@s4tk/hashing/formatting";
import { S4TKLink } from "#constants";
import { randomFnv64 } from "#helpers/hashing";
import { S4TKSettings } from "#helpers/settings";
import StringTableJson from "#stbls/stbl-json";
import * as inference from "#indexing/inference";
import type S4TKWorkspace from "#workspace/s4tk-workspace";
import { FatalBuildError, addAndGetItem } from "./helpers";
import { parseKeyFromTgi } from "./resources";
import { BuildMode, BuildSummary } from "./summary";
import { BuildContext, PackageBuildContext, StringTableReference } from "./context";
import { prevalidateBuild } from "./prevalidation";

//#region Exported Functions

/**
 * Builds the project and returns a BuildSummary object. If any errors occur,
 * they will not be thrown, but will be logged in the BuildSummary.
 * 
 * @param workspace Workspace being built
 * @param mode Mode to build for
 */
export async function buildProject(workspace: S4TKWorkspace, mode: BuildMode): Promise<BuildSummary> {
  const summary = BuildSummary.create(workspace, mode);
  const context = BuildContext.create(workspace, summary);

  if (!workspace.active) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = "S4TK config is not loaded";
    return summary;
  }

  try {
    prevalidateBuild(context);
    await _buildValidatedProject(context);
  } catch (err) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = (err as Error).message;
  }

  return summary;
}

//#endregion

//#region Build Helpers

async function _buildValidatedProject(context: BuildContext) {
  const summary = context.summary;
  const existingPackages = new Map<string, models.Package>();

  const shouldTrackPackages = summary.buildInfo.mode === "release"
    || summary.config.packages.some(p => p.duplicateFilesFrom.length > 0);

  summary.config.packages.forEach(pkgConfig => {
    if (pkgConfig.doNotGenerate) return;

    const pkgContext = BuildContext.forPackage(context, pkgConfig);
    if (pkgConfig.duplicateFilesFrom.length > 0)
      _insertDuplicatedFiles(pkgContext, existingPackages);
    const pkg = _buildPackage(pkgContext);
    if (shouldTrackPackages) existingPackages.set(pkgConfig.filename, pkg);

    if (pkgConfig.doNotWrite) return;
    if (summary.buildInfo.mode === "build") {
      summary.config.destinations.forEach(({ resolved }) => {
        // if validation passed, folder either exists or we're allowed to create
        if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
        const outPath = path.join(resolved, pkgConfig.filename);
        fs.writeFileSync(outPath, pkg.getBuffer());
      });
    }
  });

  if (summary.buildInfo.mode === "release") {
    await _zipPackagesAndWrite(context, existingPackages);
  }
}

function _insertDuplicatedFiles(context: PackageBuildContext, existingPackages: Map<string, models.Package>) {
  // FIXME: if a stbl has the same ID as another stbl in the base package and is
  // not marked as a fragment, it will replace the base stbl in that locale only,
  // but all other locales generated in the first package will not be overridden,
  // they will be added to. this is technically a non-issue as it will never
  // actually cause a problem, but it is unexpected behavior
  context.pkgConfig.duplicateFilesFrom.forEach(pkgName => {
    const pkg = existingPackages.get(pkgName);
    if (!pkg) throw FatalBuildError(`${context.pkgInfo.filename} depends on ${pkgName}, but ${pkgName} was not found at runtime. This is expected if ${pkgName}'s 'doNotGenerate' property is true, but if it isn't, please report this error immediately (${S4TKLink.issues}).`);
    pkg.entries.forEach((entry, i) => {
      if (entry.key.type === enums.BinaryResourceType.StringTable) {
        context.stbls.push({
          filepath: `Duplicated: ${pkgName}[${i}]`,
          fragment: false,
          stbl: (entry.clone() as unknown as types.ResourceKeyPair<models.StringTableResource>)
        });
      } else {
        _addOrReplaceInPackage(context, entry.key, entry.value);
      }
    });
  });
}

function _buildPackage(context: PackageBuildContext): models.Package {
  context.filepaths.forEach(filepath => {
    const buffer = fs.readFileSync(filepath);

    if (_tryAddPackage(context, filepath, buffer)) return;
    if (_tryAddTgiFile(context, filepath, buffer)) return;
    if (_tryAddSupportedFile(context, filepath, buffer)) return;

    const warning = "File could not be resolved as a TS4 resource. This error should never occur. If you are reading this, please report it.";
    context.summary.written.fileWarnings.push({
      file: BuildSummary.makeRelative(context.summary, filepath),
      warnings: [warning],
    });
    throw FatalBuildError(warning);
  });

  _resolveStringTables(context);

  return context.pkg;
}

function _tryAddPackage(context: PackageBuildContext, filepath: string, buffer: Buffer): boolean {
  try {
    if (path.extname(filepath) !== ".package") return false;

    models.Package.extractResources(buffer, {
      keepDeletedRecords: true
    }).forEach((entry, i) => {
      let inPackageName = i.toString();

      if (entry.key.type === enums.BinaryResourceType.StringTable) {
        context.stbls.push({
          filepath: `${filepath}[${inPackageName}]`,
          fragment: false,
          stbl: entry as types.ResourceKeyPair<models.StringTableResource>
        });
      } else {
        if (entry.value instanceof models.SimDataResource) {
          inPackageName = entry.value.instance.name;
        } else if (entry.value instanceof models.XmlResource) {
          const filename = inference.inferTuningMetadata(entry.value.content).attrs?.n;
          if (filename) inPackageName = filename;
        }

        _addToPackageInfo(context, filepath, entry.key, { inPackageName });
        _addOrReplaceInPackage(context, entry.key, entry.value);
      }
    });

    return true;
  } catch (e) {
    throw FatalBuildError(
      `Failed to extract resources from package (${BuildSummary.makeRelative(context.summary, filepath)}) [${e}]`
    );
  }
}

function _tryAddTgiFile(context: PackageBuildContext, filepath: string, buffer: Buffer): boolean {
  let fileType = "TGI file";

  try {
    const tgiKey = parseKeyFromTgi(filepath);
    if (!tgiKey) return false;

    if (filepath.endsWith(".deleted")) {
      _addOrReplaceInPackage(context, tgiKey, new models.DeletedResource());
      return true;
    }

    if (tgiKey.type === enums.BinaryResourceType.SimData) {
      fileType = "SimData";
      _addToPackageInfo(context, filepath, tgiKey);
      const resource = (buffer.slice(0, 4).toString() === "DATA")
        ? models.RawResource.from(buffer)
        : models.SimDataResource.fromXml(buffer);
      resource.getBuffer(true); // just to catch serialization errors
      _addOrReplaceInPackage(context, tgiKey, resource);
    } else if (tgiKey.type === enums.BinaryResourceType.StringTable) {
      fileType = "string table";
      const resource = (buffer.slice(0, 4).toString() === "STBL")
        ? models.StringTableResource.from(buffer)
        : StringTableJson.parse(buffer.toString()).toBinaryResource();
      context.stbls.push({ filepath, fragment: false, stbl: { key: tgiKey, value: resource } });
    } else {
      _addToPackageInfo(context, filepath, tgiKey);
      _addOrReplaceInPackage(context, tgiKey, models.RawResource.from(buffer));
    }

    return true;
  } catch (e) {
    throw FatalBuildError(
      `Failed to add ${fileType} to package (${BuildSummary.makeRelative(context.summary, filepath)}) [${e}]`
    );
  }
}

function _tryAddSupportedFile(context: PackageBuildContext, filepath: string, buffer: Buffer): boolean {
  let filetype = "TS4 resource";

  try {
    const extname = path.extname(filepath);

    if (extname === ".xml") {
      if (filepath.endsWith(".SimData.xml")) {
        filetype = "SimData";
        _addXmlSimData(context, filepath, buffer);
      } else {
        filetype = "tuning";
        _addXmlTuning(context, filepath, buffer);
      }
    } else if (extname === ".json") {
      filetype = "string table";
      _addStringTable(context, filepath, buffer, true);
    } else if (extname === ".stbl") {
      filetype = "string table";
      _addStringTable(context, filepath, buffer, false);
    } else {
      return false;
    }

    return true;
  } catch (e) {
    throw FatalBuildError(
      `Failed to add ${filetype} to package (${BuildSummary.makeRelative(context.summary, filepath)}) [${e}]`
    );
  }
}

function _addStringTable(context: PackageBuildContext, filepath: string, buffer: Buffer, json: boolean) {
  if (json) {
    const stblJson = StringTableJson.parse(buffer.toString());

    if (stblJson.instanceBase == undefined || stblJson.locale == undefined) {
      const fileWarnings = addAndGetItem(context.summary.written.fileWarnings, {
        file: BuildSummary.makeRelative(context.summary, filepath),
        warnings: []
      });

      if (stblJson.instanceBase == undefined) {
        fileWarnings.warnings.push("No instance is set in this STBL's meta data; using a random FNV56. This may cause problems if you are attempting to build the same STBL in multiple languages.");
        context.summary.buildInfo.problems++;
      }

      if (stblJson.locale == undefined) {
        fileWarnings.warnings.push(`No locale is set in this STBL's meta data; assuming default of '${S4TKSettings.get("defaultStringTableLocale")}'.`);
        context.summary.buildInfo.problems++;
      }

      if (stblJson.fragment) {
        const warning = "STBL is a fragment, but is missing either a locale or instance base. Fragments require both values to be explicitly set in order to know which STBL they are a part of.";
        fileWarnings.warnings.push(warning);
        throw FatalBuildError(warning);
      }
    }

    context.stbls.push({
      filepath,
      fragment: Boolean(stblJson.fragment),
      stbl: {
        key: stblJson.getResourceKey(),
        value: stblJson.toBinaryResource()
      }
    });
  } else {
    context.summary.written.fileWarnings.push({
      file: BuildSummary.makeRelative(context.summary, filepath),
      warnings: [
        "Binary STBLs without TGI in filename have no known instance; using a random FNV56. This may cause problems if you are attempting to build the same STBL in multiple languages.",
        `Binary STBLs without TGI in filename have no known locale; assuming default of '${S4TKSettings.get("defaultStringTableLocale")}'.`
      ]
    });

    context.stbls.push({
      filepath,
      fragment: false,
      stbl: {
        key: {
          type: enums.BinaryResourceType.StringTable,
          group: 0x80000000,
          instance: enums.StringTableLocale.setHighByte(
            enums.StringTableLocale[S4TKSettings.get("defaultStringTableLocale")],
            randomFnv64()
          )
        },
        value: models.StringTableResource.from(buffer),
      }
    });
  }
}

function _addXmlSimData(context: PackageBuildContext, filepath: string, buffer: Buffer) {
  const content = buffer.toString();
  const key = _getSimDataKey(context, filepath, content);
  _addToPackageInfo(context, filepath, key);
  const simdata = models.SimDataResource.fromXml(content);
  simdata.getBuffer(true); // just to catch serialization errors
  _addOrReplaceInPackage(context, key, simdata);
}

function _addXmlTuning(context: PackageBuildContext, filepath: string, buffer: Buffer) {
  const content = buffer.toString();
  const key = _getTuningKey(context, filepath, content);
  _addToPackageInfo(context, filepath, key);
  // raw is more memory efficient than XML, just stores a buffer
  _addOrReplaceInPackage(context, key, models.RawResource.from(buffer));
}

function _resolveStringTables(context: PackageBuildContext) {
  if (context.stbls.length < 1) return;

  _flattenStringTables(context);

  if (context.workspace.config.stringTableSettings.generateMissingLocales)
    _generateStringTables(context);

  if (context.workspace.config.stringTableSettings.mergeStringTablesInSamePackage)
    _mergeStringTables(context);

  const { allowStringKeyOverrides } = context.workspace.config.stringTableSettings;

  context.stbls.forEach(stblRef => {
    _addToPackageInfo(context, stblRef.filepath, stblRef.stbl.key);

    if (!allowStringKeyOverrides) {
      const repeatedKeys = stblRef.stbl.value.findRepeatedKeys();
      if (repeatedKeys.length > 0) throw FatalBuildError(
        `STBL at '${stblRef.filepath}' has ${repeatedKeys.length} repeated key(s): [${repeatedKeys.map(key => hashFormat.formatStringKey(key)).join(", ")}], and stringTableSettings.allowStringKeyOverrides is false`
      );
      // TODO: associate with file?
    }

    _addOrReplaceInPackage(context, stblRef.stbl.key, stblRef.stbl.value);
  });
}

function _mergeStringTables(context: PackageBuildContext) {
  const stblsByLocale = _orderStblsByLocale(context.stbls);
  const mergedStbls: StringTableReference[] = [];

  stblsByLocale.forEach((stbls) => {
    const filenames = stbls.length === 1
      ? stbls[0].filepath
      : ("Merged: " + stbls
        .map(({ filepath }) => `(${BuildSummary.makeRelative(context.summary, filepath)})`)
        .join(" | "));

    const merged = stbls.pop()!;
    merged.filepath = filenames;
    stbls.forEach(({ stbl }) => merged.stbl.value.addAll(stbl.value.entries));
    mergedStbls.push(merged);
  });

  //@ts-expect-error It's readonly, but this is one of only two spots where this
  // value can be set, the other is in _flattenStringTables()
  context.stbls = mergedStbls;
}

function _generateStringTables(context: PackageBuildContext) {
  const stblsByLocale = _orderStblsByLocale(context.stbls);
  const primaryLocale = enums.StringTableLocale[S4TKSettings.get("defaultStringTableLocale")];
  const primaryStbls = stblsByLocale.get(primaryLocale);
  if (!primaryStbls) return; // can't generate if no primary
  stblsByLocale.delete(primaryLocale);

  enums.StringTableLocale.all().forEach(locale => {
    if (locale === primaryLocale) return;
    const localeStbls = stblsByLocale.get(locale);

    function pushClonedStbl(primaryStbl: StringTableReference) {
      context.stbls.push({
        filepath: `Generated from: ${primaryStbl.filepath}`,
        fragment: false,
        stbl: {
          key: {
            type: primaryStbl.stbl.key.type,
            group: primaryStbl.stbl.key.group,
            instance: enums.StringTableLocale.setHighByte(
              locale,
              primaryStbl.stbl.key.instance
            )
          },
          value: primaryStbl.stbl.value.clone(),
        }
      });
    }

    if (localeStbls) {
      primaryStbls.forEach(primaryStbl => {
        const instanceBase = enums.StringTableLocale.getInstanceBase(primaryStbl.stbl.key.instance);

        const matchingStbl = localeStbls.find(({ stbl }) =>
          enums.StringTableLocale.getInstanceBase(stbl.key.instance) === instanceBase);

        if (matchingStbl) {
          primaryStbl.stbl.value.entries.forEach(entry => {
            if (!matchingStbl.stbl.value.hasKey(entry.key))
              matchingStbl.stbl.value.add(entry.key, entry.value);
          });
        } else {
          pushClonedStbl(primaryStbl);
        }
      });
    } else {
      primaryStbls.forEach(pushClonedStbl);
    }
  });
}

function _flattenStringTables(context: PackageBuildContext) {
  // FIXME: logic is off here, it's possible we're in an override context, but
  // that doesn't mean that stbls with repeated res keys are always able to be
  // overridden, i.e. if they are both in the new `include` list, so this will
  // not catch all possible errors
  const isInOverrideContext = context.pkgConfig.duplicateFilesFrom.length > 0;
  const { allowResourceKeyOverrides } = context.workspace.config.buildSettings;
  const overridesAllowed = isInOverrideContext || allowResourceKeyOverrides;

  const baseStbls = context.stbls.filter(stbl => !stbl.fragment);
  const fragmentStbls = context.stbls.filter(stbl => stbl.fragment);

  // mapping of stringified res keys to stbls to use for them
  const flattenedStbls = new Map<string, StringTableReference>();
  baseStbls.forEach(baseStbl => {
    const keyString = hashFormat.formatResourceKey(baseStbl.stbl.key, "-");

    if (flattenedStbls.has(keyString) && !overridesAllowed) {
      throw FatalBuildError(`More than one STBL is using the resource key ${keyString} in package '${context.pkgInfo.filename}', and buildSettings.allowResourceKeyOverrides is false. If you're trying to edit or add values to a base string table, you must set the other one(s) as fragments, otherwise they will override the entire string table resource.`);
      // TODO: associate with a file?
    }

    flattenedStbls.set(keyString, baseStbl);
  });

  fragmentStbls.forEach(fragmentStbl => {
    const keyString = hashFormat.formatResourceKey(fragmentStbl.stbl.key, "-");
    if (flattenedStbls.has(keyString)) {
      const baseStbl = flattenedStbls.get(keyString)!.stbl.value;
      fragmentStbl.stbl.value.entries.forEach(entry => {
        if (baseStbl.hasKey(entry.key)) {
          baseStbl.getByKey(entry.key).value = entry.value;
        } else {
          baseStbl.add(entry.key, entry.value);
        }
      });
    } else {
      flattenedStbls.set(keyString, fragmentStbl);
    }
  });

  //@ts-expect-error It's readonly, but this is one of only two spots where this
  // value can be set, the other is in _mergeStringTables()
  context.stbls = [...flattenedStbls.values()];
}

async function _zipPackagesAndWrite(context: BuildContext, packages: Map<string, models.Package>) {
  if (!context.summary.config.zips?.length) return;

  for (const zipInfo of context.summary.config.zips) {
    if (zipInfo.doNotGenerate) continue;

    const zip = new JSZip();

    const resolveWithFolder = (filename: string) => {
      return zipInfo.internalFolder
        ? path.join(zipInfo.internalFolder, filename)
        : filename;
    }

    if (zipInfo.internalFolder) zip.folder(zipInfo.internalFolder);

    for (const pkgName of zipInfo.packages) {
      if (!packages.has(pkgName)) throw FatalBuildError(
        `${zipInfo.filename} depends on ${pkgName}, but no package with this name was found at runtime. This error should never occur, please report it immediately (${S4TKLink.issues})`
      );
    }

    zipInfo.packages.forEach(pkgName => {
      const buffer = packages.get(pkgName)!.getBuffer();
      zip.file(resolveWithFolder(pkgName), buffer);
    });

    zipInfo.otherFiles.forEach(filepath => {
      const buffer = fs.readFileSync(filepath);
      zip.file(resolveWithFolder(path.basename(filepath)), buffer);
    });

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    context.summary.config.destinations.forEach(({ resolved }) => {
      // if validation passed, we're allowed to write missing destinations
      if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
      const filepath = path.join(resolved, zipInfo.filename);
      fs.writeFileSync(filepath, buffer);
    });
  }
}

//#endregion

//#region Other Helpers

function _addToPackageInfo(
  context: PackageBuildContext,
  filepath: string,
  key: types.ResourceKey,
  kwargs?: {
    inPackageName?: string;
  }) {
  if (context.workspace.config.buildSettings.outputBuildSummary === "full") {
    let filename = BuildSummary.makeRelative(context.summary, filepath);
    if (kwargs?.inPackageName) filename += `[${kwargs.inPackageName}]`;
    context.pkgInfo.resources?.push({
      filename: filename,
      key: hashFormat.formatResourceKey(key, "-"),
      type: _getFileTypeString(key),
    });
  }
}

function _addOrReplaceInPackage(context: PackageBuildContext, key: types.ResourceKey, value: types.Resource) {
  if (context.pkg.hasKey(key)) {
    // FIXME: potential issue with this logic, since it's possible that we are
    // in an override context, but the file being overridden right now was not
    // declared in one of the base packages, and even if it was, it's possible
    // that it's being overridden more than once by files in `include`, in which
    // case a fatal error should also be reported
    if (context.pkgConfig.duplicateFilesFrom.length < 1) {
      if (!context.workspace.config.buildSettings.allowResourceKeyOverrides) {
        throw FatalBuildError(`More than one file is using the resource key ${hashFormat.formatResourceKey(key, "-")} in package '${context.pkgInfo.filename}', and buildSettings.allowResourceKeyOverrides is false. To see which files have the same keys, make sure your build summary type is set to "full".`, {
          addWarning: context.pkgConfig
        });
      }
    }

    const entry = context.pkg.getByKey(key);
    entry.value = value;
  } else {
    context.pkg.add(key, value);
  }
}

function _getFileTypeString(key: types.ResourceKey): string {
  if (key.type === enums.BinaryResourceType.SimData) {
    return `SimData (${enums.SimDataGroup[key.group] ?? "Unknown"})`;
  } else if (key.type === enums.BinaryResourceType.StringTable) {
    const locale = enums.StringTableLocale.getLocale(key.instance);
    return (locale in enums.StringTableLocale)
      ? `String Table (${enums.StringTableLocale[locale]})`
      : "String Table (Unknown Locale)";
  } else if (key.type in enums.BinaryResourceType) {
    return enums.BinaryResourceType[key.type];
  } else if (key.type === enums.TuningResourceType.Tuning) {
    return "Tuning (Generic)";
  } else if (key.type in enums.TuningResourceType) {
    return `Tuning (${enums.TuningResourceType[key.type]})`;
  } else {
    return "Unknown";
  }
}

function _getTuningKey(context: BuildContext, filepath: string, content: string): types.ResourceKey {
  const metadata = inference.inferTuningMetadata(content);
  const key = inference.inferKeyFromMetadata(metadata).key;

  if (key.type != undefined && key.instance != undefined) {
    key.group ??= 0;
    return key as types.ResourceKey;
  }

  const fileWarnings = addAndGetItem(context.summary.written.fileWarnings, {
    file: BuildSummary.makeRelative(context.summary, filepath),
    warnings: []
  });

  if (key.type == undefined)
    fileWarnings.warnings.push("Tuning does not contain a recognized `i` attribute, and no type override was found.");

  if (key.instance == undefined)
    fileWarnings.warnings.push("Tuning does not contain a valid `s` attribute, and no instance override was found.");

  throw FatalBuildError(fileWarnings.warnings.join(" "));
}

function _getSimDataKey(context: BuildContext, filepath: string, content: string): types.ResourceKey {
  const metadata = inference.inferSimDataMetadata(content);
  const key = inference.inferKeyFromMetadata(metadata).key;

  key.type ??= enums.BinaryResourceType.SimData;

  if (key.group == undefined || key.instance == undefined) {
    const tuningPath = filepath.replace(/\.SimData\.xml$/, ".xml");

    let tuningKey: types.ResourceKey;
    if (context.tuningKeys.has(tuningPath)) {
      tuningKey = context.tuningKeys.get(tuningPath)!;
    } else {
      let tuningContent: string;
      try {
        tuningContent = fs.readFileSync(tuningPath).toString();
      } catch (_) {
        const warning = `SimData group and/or instance cannot be inferred because it does not have a paired tuning and no sufficient overrides were found.`;

        context.summary.written.fileWarnings.push({
          file: BuildSummary.makeRelative(context.summary, filepath),
          warnings: [warning]
        });

        throw FatalBuildError(warning);
      }

      tuningKey = _getTuningKey(context, filepath, tuningContent);
      context.tuningKeys.set(tuningPath, tuningKey);
    }

    if (key.group == undefined) {
      key.group = enums.SimDataGroup.getForTuning(tuningKey.type);

      if (key.group == undefined) {
        const warning = `SimData group could not be inferred for tuning type '${hashFormat.formatResourceType(tuningKey.type)}'. If you are certain that your tuning type is correct, you must manually set this SimData's group.`;

        context.summary.written.fileWarnings.push({
          file: BuildSummary.makeRelative(context.summary, filepath),
          warnings: [warning]
        });

        throw FatalBuildError(warning);
      }
    }

    // guaranteed to be defined b/c _getTuningKey() would've thrown if not
    key.instance ??= tuningKey.instance;
  }

  return key as types.ResourceKey;
}

type StringTableLocaleMap = Map<enums.StringTableLocale, StringTableReference[]>;
function _orderStblsByLocale(stbls: StringTableReference[]): StringTableLocaleMap {
  const stblsByLocale: StringTableLocaleMap = new Map();

  stbls.forEach(stbl => {
    const locale = enums.StringTableLocale.getLocale(stbl.stbl.key.instance);
    if (stblsByLocale.has(locale)) {
      stblsByLocale.get(locale)!.push(stbl);
    } else {
      stblsByLocale.set(locale, [stbl]);
    }
  });

  return stblsByLocale;
}

//#endregion
