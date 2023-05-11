import * as fs from "fs";
import * as path from "path";
import * as models from "@s4tk/models";
import * as enums from "@s4tk/models/enums";
import * as types from "@s4tk/models/types";
import { randomFnv64 } from "#helpers/hashing";
import { getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { FatalBuildError, addAndGetItem } from "./helpers";
import { TGI_REGEX, findGlobMatches, parseKeyFromTgi } from "./resources";
import { BuildMode, BuildSummary, ValidatedPackageInfo } from "./summary";
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

//#region Helpers

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

    if (buffer.slice(0, 4).toString() === "DBPF") {
      models.Package.extractResources(buffer).forEach((entry) => {
        if (entry.key.type === enums.BinaryResourceType.StringTable) {
          context.stbls.push(entry as types.ResourceKeyPair<models.StringTableResource>);
        } else {
          // TODO: add to build summary
          context.pkg.add(entry.key, entry.value);
        }
      });
      return;
    }

    // TODO: add to build summary if adding to package
    // context.pkgInfo.resources.push

    const tgiKey = parseKeyFromTgi(filepath);
    if (tgiKey) {
      if (tgiKey.type === enums.BinaryResourceType.SimData) {
        if (buffer.slice(0, 4).toString() === "DATA") {
          context.pkg.add(tgiKey, models.RawResource.from(buffer));
        } else {
          context.pkg.add(tgiKey, models.SimDataResource.fromXml(buffer));
        }
      } else if (tgiKey.type === enums.BinaryResourceType.StringTable) {
        if (buffer.slice(0, 4).toString() === "STBL") {
          const stbl = models.StringTableResource.from(buffer);
          context.stbls.push({ key: tgiKey, value: stbl });
        } else {
          const stblJson = StringTableJson.parse(buffer.toString());
          context.stbls.push({ key: tgiKey, value: stblJson.toBinaryResource() });
        }
      } else {
        // intentionally not checking for tuning or adding filepath to tuning
        // map, because no SimData is going to have the same path if it has TGI
        context.pkg.add(tgiKey, models.RawResource.from(buffer));
      }
    } else {
      const basename = path.basename(filepath);
      const extname = path.extname(basename);

      if (extname === ".xml") {
        if (basename.endsWith(".SimData.xml")) {
          // TODO:
        } else {
          // TODO:
        }
      } else if (extname === ".json") {
        // assuming STBL JSON for now, as no other JSONs pass the filter
        // TODO: add warning if random instance is being used
        const stblJson = StringTableJson.parse(buffer.toString());
        context.stbls.push({
          key: stblJson.getResourceKey(S4TKWorkspace.defaultLocale),
          value: stblJson.toBinaryResource()
        });
      } else if (extname === ".stbl") {
        // TODO: add warning that random instance is being used
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
      } else {
        const warning = "File could not be resolved as a TS4 resource. This error should never occur. If you are reading this, please report it.";

        context.summary.written.fileWarnings.push({
          file: BuildSummary.makeRelative(context.summary, filepath),
          warnings: [warning],
        });

        throw FatalBuildError(warning);
      }
    }
  });

  // TODO: merge / generate stbls

  return context.pkg;
}

function _parsePackage(summary: BuildSummary, filepath: string): types.ResourceKeyPair[] {
  // TODO: update summary
  try {
    // TODO: check if any keys overlap with existing ones
    const buffer = fs.readFileSync(filepath);
    return models.Package.extractResources(buffer);
  } catch (e) {
    throw FatalBuildError(
      `Failed to extract resources from Package (${filepath}) [${e}]`
    );
  }
}

function _parseStblBinary(summary: BuildSummary, filepath: string): types.ResourceKeyPair {
  // TODO: update summary
  const key: types.ResourceKey = parseKeyFromTgi(path.basename(filepath)) ?? {
    type: enums.BinaryResourceType.StringTable,
    group: 0x80000000,
    instance: enums.StringTableLocale.setHighByte(
      enums.StringTableLocale[S4TKWorkspace.defaultLocale],
      randomFnv64()
    )
  };

  try {
    const buffer = fs.readFileSync(filepath);
    return {
      key: key,
      value: models.StringTableResource.from(buffer)
    };
  } catch (e) {
    throw FatalBuildError(
      `Failed to validate binary string table (${filepath}) [${e}]`
    );
  }
}

function _parseStblJson(summary: BuildSummary, filepath: string): types.ResourceKeyPair {
  // TODO: update summary
  try {
    const buffer = fs.readFileSync(filepath);
    const stblJson = StringTableJson.parse(buffer.toString());
    return {
      key: stblJson.getResourceKey(S4TKWorkspace.defaultLocale),
      value: stblJson.toBinaryResource()
    };
  } catch (e) {
    throw FatalBuildError(
      `Failed to parse JSON string table (${filepath}) [${e}]`
    );
  }
}

function _parseTgiFile(summary: BuildSummary, filepath: string): types.ResourceKeyPair {
  // TODO: update summary
  const key = parseKeyFromTgi(path.basename(filepath));
  if (!key) throw FatalBuildError( // should never happen b/c validation
    `Could not parse type/group/instance from filename (${filepath})`
  );

  return { key, value: models.RawResource.from(fs.readFileSync(filepath)) };
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
