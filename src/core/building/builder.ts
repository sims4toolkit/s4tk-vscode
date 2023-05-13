import * as fs from "fs";
import * as path from "path";
import * as JSZip from "jszip";
import * as models from "@s4tk/models";
import * as enums from "@s4tk/models/enums";
import * as types from "@s4tk/models/types";
import * as hashFormat from "@s4tk/hashing/formatting";
import { randomFnv64 } from "#helpers/hashing";
import { getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { FatalBuildError, addAndGetItem } from "./helpers";
import { parseKeyFromTgi } from "./resources";
import { BuildMode, BuildSummary } from "./summary";
import { BuildContext, PackageBuildContext, StringTableReference } from "./context";
import { prevalidateBuild } from "./prevalidation";
import { postvalidateBuild } from "./postvalidation";

//#region Exported Functions

/**
 * Builds the project and returns a BuildSummary object. If any errors occur,
 * they will not be thrown, but will be logged in the BuildSummary.
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
    prevalidateBuild(summary);
    await _buildValidatedProject(summary);
    postvalidateBuild(summary);
  } catch (err) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = (err as Error).message;
  }

  return summary;
}

//#endregion

//#region Build Helpers

async function _buildValidatedProject(summary: BuildSummary) {
  const builtPackages: Buffer[] = []; // only for use with release mode
  const context = BuildContext.create(summary);

  summary.config.packages.forEach(pkgConfig => {
    const pkg = _buildPackage(BuildContext.forPackage(context, pkgConfig));

    if (summary.buildInfo.mode === "build") {
      summary.config.destinations.forEach(({ resolved }) => {
        // if validation passed, folder either exists or we're allowed to create
        if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
        const outPath = path.join(resolved, pkgConfig.filename);
        fs.writeFileSync(outPath, pkg.getBuffer());
      });
    } else if (summary.buildInfo.mode === "release") {
      builtPackages.push(pkg.getBuffer());
    }
  });

  if (summary.buildInfo.mode === "release")
    await _zipPackagesAndWrite(context, builtPackages);
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

    models.Package.extractResources(buffer).forEach((entry, i) => {
      let inPackageName = i.toString();

      if (entry.key.type === enums.BinaryResourceType.StringTable) {
        context.stbls.push({
          filepath: `${filepath}[${inPackageName}]`,
          stbl: entry as types.ResourceKeyPair<models.StringTableResource>
        });
      } else {
        if (entry.value instanceof models.SimDataResource) {
          inPackageName = entry.value.instance.name;
        } else if (entry.value instanceof models.XmlResource) {
          const filename = inferXmlMetaData(entry.value.content).filename;
          if (filename) inPackageName = filename;
        }

        _addToPackageInfo(context, filepath, entry.key, { inPackageName });
        context.pkg.add(entry.key, entry.value);
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

    if (tgiKey.type === enums.BinaryResourceType.SimData) {
      fileType = "SimData";
      _addToPackageInfo(context, filepath, tgiKey);
      const resource = (buffer.slice(0, 4).toString() === "DATA")
        ? models.RawResource.from(buffer)
        : models.SimDataResource.fromXml(buffer);
      resource.getBuffer(true); // just to catch serialization errors
      context.pkg.add(tgiKey, resource);
    } else if (tgiKey.type === enums.BinaryResourceType.StringTable) {
      fileType = "string table";
      const resource = (buffer.slice(0, 4).toString() === "STBL")
        ? models.StringTableResource.from(buffer)
        : StringTableJson.parse(buffer.toString()).toBinaryResource();
      context.stbls.push({ filepath, stbl: { key: tgiKey, value: resource } });
    } else {
      _addToPackageInfo(context, filepath, tgiKey);
      context.pkg.add(tgiKey, models.RawResource.from(buffer));
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
        fileWarnings.warnings.push("No instance is set in this STBL's meta data; using a random FNV56.");
        context.summary.buildInfo.problems++;
      }

      if (stblJson.locale == undefined) {
        fileWarnings.warnings.push(`No locale is set in this STBL's meta data; assuming default of '${S4TKWorkspace.defaultLocale}'.`);
        context.summary.buildInfo.problems++;
      }
    }

    context.stbls.push({
      filepath,
      stbl: {
        key: stblJson.getResourceKey(S4TKWorkspace.defaultLocale),
        value: stblJson.toBinaryResource()
      }
    });
  } else {
    context.summary.written.fileWarnings.push({
      file: BuildSummary.makeRelative(context.summary, filepath),
      warnings: [
        "Binary STBLs without TGI in filename have no known instance; using a random FNV56.",
        `Binary STBLs without TGI in filename have no known locale; assuming default of '${S4TKWorkspace.defaultLocale}'.`
      ]
    });

    context.stbls.push({
      filepath,
      stbl: {
        key: {
          type: enums.BinaryResourceType.StringTable,
          group: 0x80000000,
          instance: enums.StringTableLocale.setHighByte(
            enums.StringTableLocale[S4TKWorkspace.defaultLocale],
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
  context.pkg.add(key, simdata);
}

function _addXmlTuning(context: PackageBuildContext, filepath: string, buffer: Buffer) {
  const content = buffer.toString();
  const key = _getTuningKey(context, filepath, content);
  _addToPackageInfo(context, filepath, key);
  // raw is more memory efficient than XML, just stores a buffer
  context.pkg.add(key, models.RawResource.from(buffer));
}

function _resolveStringTables(context: PackageBuildContext) {
  if (context.stbls.length < 1) return;

  context.stbls.forEach(({ stbl }) => {
    stbl.value.entries.forEach(({ key }) => {
      if (context.stringKeys.has(key)) {
        // TODO: record repeated key
      } else {
        context.stringKeys.add(key);
      }
    });
  });

  if (S4TKWorkspace.config.buildSettings.generateMissingLocales)
    _generateStringTables(context);

  if (S4TKWorkspace.config.buildSettings.mergeStringTablesInSamePackage)
    _mergeStringTables(context);

  context.stbls.forEach(stblRef => {
    _addToPackageInfo(context, stblRef.filepath, stblRef.stbl.key);
    context.pkg.add(stblRef.stbl.key, stblRef.stbl.value);
  });
}

function _mergeStringTables(context: PackageBuildContext) {
  const stblsByLocale = _orderStblsByLocale(context.stbls);
  const mergedStbls: StringTableReference[] = [];

  stblsByLocale.forEach((stbls) => {
    const filenames = "Merged: " + stbls.map(({ filepath }) =>
      BuildSummary.makeRelative(context.summary, filepath)).join(" | ");

    const merged = stbls.pop()!;
    merged.filepath = filenames;
    stbls.forEach(({ stbl }) => merged.stbl.value.addAll(stbl.value.entries));
    mergedStbls.push(merged);
  });

  //@ts-expect-error It's readonly, but this is the one and only spot that is
  // allowed to reset it - don't wanna get rid of the readonly for intellisense
  context.stbls = mergedStbls;
}

function _generateStringTables(context: PackageBuildContext) {
  const stblsByLocale = _orderStblsByLocale(context.stbls);
  const primaryLocale = enums.StringTableLocale[S4TKWorkspace.defaultLocale];
  const primaryStbls = stblsByLocale.get(primaryLocale);
  if (!primaryStbls) return; // can't generate if no primary
  stblsByLocale.delete(primaryLocale);

  enums.StringTableLocale.all().forEach(locale => {
    if (locale === primaryLocale) return;
    const localeStbls = stblsByLocale.get(locale);

    function pushClonedStbl(primaryStbl: StringTableReference) {
      context.stbls.push({
        filepath: `Generated from: ${primaryStbl.filepath}`,
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

async function _zipPackagesAndWrite(context: BuildContext, buffers: Buffer[]) {
  const zipConfig = context.summary.config.zip!;
  const zip = new JSZip();

  const resolveWithFolder = (filename: string) => {
    return zipConfig.internalFolder
      ? path.join(zipConfig.internalFolder, filename)
      : filename;
  }

  if (zipConfig.internalFolder) zip.folder(zipConfig.internalFolder);

  buffers.forEach((buffer, i) => {
    const pkgConfig = context.summary.config.packages[i];
    zip.file(resolveWithFolder(pkgConfig.filename), buffer);
  });

  context.summary.config.zip!.otherFiles.forEach(filepath => {
    const buffer = fs.readFileSync(filepath);
    zip.file(resolveWithFolder(path.basename(filepath)), buffer);
  });

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  context.summary.config.destinations.forEach(({ resolved }) => {
    // if validation passed, we're allowed to write missing destinations
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
    const filepath = path.join(resolved, context.summary.config.zip!.filename);
    fs.writeFileSync(filepath, buffer);
  });
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
  if (S4TKWorkspace.config.buildSettings.outputBuildSummary === "full") {
    let filename = BuildSummary.makeRelative(context.summary, filepath);
    if (kwargs?.inPackageName) filename += `[${kwargs.inPackageName}]`;
    context.pkgInfo.resources?.push({
      filename: filename,
      key: hashFormat.formatResourceKey(key, "-"),
      type: _getFileTypeString(key),
    });
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
  const key: Partial<types.ResourceKey> = getXmlKeyOverrides(content) ?? {};

  if (key.type != undefined && key.instance != undefined) {
    key.group ??= 0;
    return key as types.ResourceKey;
  }

  const metadata = inferXmlMetaData(content);
  key.type ??= metadata.key.type;
  key.group ??= metadata.key.group ?? 0;
  key.instance ??= metadata.key.instance;

  if (key.type == undefined || key.instance == undefined) {
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

  return key as types.ResourceKey;
}

function _getSimDataKey(context: BuildContext, filepath: string, content: string): types.ResourceKey {
  const key: Partial<types.ResourceKey> = getXmlKeyOverrides(content) ?? {};
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
