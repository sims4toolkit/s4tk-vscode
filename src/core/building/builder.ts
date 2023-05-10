import * as fs from "fs";
import * as path from "path";
import * as models from "@s4tk/models";
import * as enums from "@s4tk/models/enums";
import * as types from "@s4tk/models/types";
import { randomFnv64 } from "#helpers/hashing";
import { getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { FatalBuildError } from "./helpers";
import { findGlobMatches, parseKeyFromTgi } from "./resources";
import { BuildMode, BuildSummary, ValidatedPackageInfo } from "./summary";
import { validateBuild } from "./validation";

interface ResourcePaths {
  packages: string[];
  simdata: string[];
  stblJson: string[];
  stblBinary: string[];
  tuning: string[];
  tgi: string[];
}

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
  const tunings = new Map<string, types.ResourceKey>(); // for use with SimData

  // FIXME: subtle bug, if a package contains a simdata paired with a tuning
  // that is written in a later package, it will fail with fatal error... no
  // easy way around this until I parse ALL of the tuning first, which has
  // pretty nasty memory overhead

  // TODO: check if any resource keys/stbl keys overlap

  summary.config.packages.forEach(packageInfo => {
    const pkg = _buildPackage(summary, packageInfo, tunings);

    if (summary.buildInfo.mode === "build") {
      summary.config.destinations.forEach(({ resolved }) => {
        const outPath = path.join(resolved, packageInfo.filename);
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

function _buildPackage(summary: BuildSummary, packageInfo: ValidatedPackageInfo, tunings: Map<string, types.ResourceKey>): models.Package {
  const pkg = new models.Package();
  const matches = findGlobMatches(packageInfo.include, packageInfo.exclude);
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
