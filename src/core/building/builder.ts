import * as fs from "fs";
import * as path from "path";
import * as models from "@s4tk/models";
import * as enums from "@s4tk/models/enums";
import * as types from "@s4tk/models/types";
import { formatResourceKey } from "@s4tk/hashing/formatting";
import { randomFnv64 } from "#helpers/hashing";
import { getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { FatalBuildError, addAndGetItem } from "./helpers";
import { parseKeyFromTgi } from "./resources";
import { BuildMode, BuildSummary } from "./summary";
import { validateBuild } from "./validation";
import { BuildContext, PackageBuildContext } from "./context";

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
    validateBuild(summary);
    _buildValidatedProject(summary);
  } catch (err) {
    summary.buildInfo.success = false;
    summary.buildInfo.problems++;
    summary.buildInfo.fatalErrorMessage = (err as Error).message;
  }

  return summary;
}

//#endregion

//#region Build Helpers

function _buildValidatedProject(summary: BuildSummary) {
  const builtPackages: models.Package[] = []; // only for use with release mode
  const context = BuildContext.create(summary);

  summary.config.packages.forEach(pkgConfig => {
    const pkg = _buildPackage(BuildContext.forPackage(context, pkgConfig));

    if (summary.buildInfo.mode === "build") {
      summary.config.destinations.forEach(({ resolved }) => {
        const outPath = path.join(resolved, pkgConfig.filename);
        fs.writeFileSync(outPath, pkg.getBuffer());
      });
    } else if (summary.buildInfo.mode === "release") {
      builtPackages.push(pkg);
    }
  });

  if (summary.buildInfo.mode === "release") {
    // TODO: create and write ZIP
  }
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

  // TODO: merge / generate stbls

  return context.pkg;
}

function _tryAddPackage(context: PackageBuildContext, filepath: string, buffer: Buffer): boolean {
  try {
    if (path.extname(filepath) !== ".package") return false;

    models.Package.extractResources(buffer).forEach((entry, i) => {
      let inPackageName = i.toString();

      if (entry.key.type === enums.BinaryResourceType.StringTable) {
        context.stbls.push(entry as types.ResourceKeyPair<models.StringTableResource>);
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
      `Failed to extract resources from Package (${BuildSummary.makeRelative(context.summary, filepath)}) [${e}]`
    );
  }
}

function _tryAddTgiFile(context: PackageBuildContext, filepath: string, buffer: Buffer): boolean {
  try {
    const tgiKey = parseKeyFromTgi(filepath);
    if (!tgiKey) return false;

    if (tgiKey.type === enums.BinaryResourceType.SimData) {
      _addToPackageInfo(context, filepath, tgiKey);
      const resource = (buffer.slice(0, 4).toString() === "DATA")
        ? models.RawResource.from(buffer)
        : models.SimDataResource.fromXml(buffer);
      context.pkg.add(tgiKey, resource);
    } else if (tgiKey.type === enums.BinaryResourceType.StringTable) {
      const resource = (buffer.slice(0, 4).toString() === "STBL")
        ? models.StringTableResource.from(buffer)
        : StringTableJson.parse(buffer.toString()).toBinaryResource();
      context.stbls.push({ key: tgiKey, value: resource });
    } else {
      _addToPackageInfo(context, filepath, tgiKey);
      context.pkg.add(tgiKey, models.RawResource.from(buffer));
    }

    return true;
  } catch (e) {
    throw FatalBuildError(
      `Failed to parse TGI file as a TS4 resource (${BuildSummary.makeRelative(context.summary, filepath)}) [${e}]`
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
        filetype = "Tuning";
        _addXmlTuning(context, filepath, buffer);
      }
    } else if (extname === ".json") {
      filetype = "STBL JSON";
      _addStringTable(context, filepath, buffer, true);
    } else if (extname === ".stbl") {
      filetype = "Binary STBL";
      _addStringTable(context, filepath, buffer, false);
    } else {
      return false;
    }

    return true;
  } catch (e) {
    throw FatalBuildError(
      `Failed to parse file as ${filetype} (${BuildSummary.makeRelative(context.summary, filepath)}) [${e}]`
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
      key: stblJson.getResourceKey(S4TKWorkspace.defaultLocale),
      value: stblJson.toBinaryResource()
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
      key: {
        type: enums.BinaryResourceType.StringTable,
        group: 0x80000000,
        instance: enums.StringTableLocale.setHighByte(
          enums.StringTableLocale[S4TKWorkspace.defaultLocale],
          randomFnv64()
        )
      },
      value: models.StringTableResource.from(buffer),
    });
  }
}

function _addXmlSimData(context: PackageBuildContext, filepath: string, buffer: Buffer) {
  // TODO:
}

function _addXmlTuning(context: PackageBuildContext, filepath: string, buffer: Buffer) {
  // TODO:
}

function _parseXmlSimData(summary: BuildSummary, filepath: string, tunings: Map<string, types.ResourceKey>): types.ResourceKeyPair {
  // TODO: update summary
  const buffer = fs.readFileSync(filepath);
  const content = buffer.toString();

  const key: Partial<types.ResourceKey> = getXmlKeyOverrides(content) ?? {};
  key.type ??= enums.BinaryResourceType.SimData;
  const filename = path.basename(filepath).replace(/\.SimData\.xml$/i, "");
  const tuningKey = tunings.get(filename);
  if (key.group == undefined && tuningKey?.type)
    key.group = enums.SimDataGroup.getForTuning(tuningKey.type);
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
      key: key as types.ResourceKey,
      value: models.SimDataResource.fromXml(content),
    };
  } catch (e) {
    throw FatalBuildError(
      `Failed to serialize SimData, it is likely malformed (${filepath}) [${e}]`
    );
  }
}

function _parseXmlTuning(summary: BuildSummary, filepath: string): types.ResourceKeyPair {
  // TODO: update summary
  const buffer = fs.readFileSync(filepath);
  const content = buffer.toString();

  const key: Partial<types.ResourceKey> = getXmlKeyOverrides(content) ?? {};
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
    key: key as types.ResourceKey,
    value: models.RawResource.from(buffer)
  };
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
  let filename = BuildSummary.makeRelative(context.summary, filepath);
  if (kwargs?.inPackageName) filename += `[${kwargs.inPackageName}]`;
  context.pkgInfo.resources.push({
    filename: filename,
    key: formatResourceKey(key, "-"),
    type: _getFileTypeString(key),
  });
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

//#endregion
