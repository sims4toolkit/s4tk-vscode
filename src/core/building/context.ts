import { Package, StringTableResource } from "@s4tk/models";
import { ResourceKey, ResourceKeyPair } from "@s4tk/models/types";
import type S4TKWorkspace from "#workspace/s4tk-workspace";
import { BuildSummary, ValidatedPackageInfo, WrittenPackageInfo } from "./summary";
import { findGlobMatches } from "./resources";
import { addAndGetItem } from "./helpers";

export interface BuildContext {
  /** Workspace containing the files that are being built. */
  readonly workspace: S4TKWorkspace;

  /** Summary of the build process. */
  readonly summary: BuildSummary;

  /** Cache that maps tuning filenames (on disk) to their keys. */
  readonly tuningKeys: Map<string, ResourceKey>;
}

export interface PackageBuildContext extends BuildContext {
  /** Paths to all files to include in this package. */
  readonly filepaths: readonly string[];

  /** Package that the source file is being written to. */
  readonly pkg: Package;

  /** Package config item for the package being written. */
  readonly pkgConfig: ValidatedPackageInfo;

  /** Information about the package in the BuildSummary. */
  readonly pkgInfo: WrittenPackageInfo;

  /** All string table to include in this package (merge/generate after). */
  readonly stbls: StringTableReference[];
}

export interface StringTableReference {
  filepath: string;
  fragment: boolean;
  stbl: ResourceKeyPair<StringTableResource>;
}

export namespace BuildContext {
  /**
   * Creates the initial, overall BuildContext object.
   * 
   * @param workspace Workspace being built
   * @param summary Summary to add to context
   */
  export function create(workspace: S4TKWorkspace, summary: BuildSummary): BuildContext {
    return {
      workspace,
      summary,
      tuningKeys: new Map(),
    };
  }

  /**
   * Creates a new PackageBuildContext object based on the given BuildContext
   * and ValidatedPackageInfo.
   * 
   * @param context Existing build context to copy constant data from
   * @param pkgConfig Info about the package being written
   */
  export function forPackage(context: BuildContext, pkgConfig: ValidatedPackageInfo): PackageBuildContext {
    return {
      workspace: context.workspace,
      summary: context.summary,
      tuningKeys: context.tuningKeys,
      filepaths: findGlobMatches(pkgConfig.include, pkgConfig.exclude, "supported"),
      pkg: new Package(),
      pkgConfig: pkgConfig,
      pkgInfo: addAndGetItem(context.summary.written.packages, {
        filename: pkgConfig.filename,
        resources: context.workspace.config.buildSettings.outputBuildSummary === "full"
          ? []
          : undefined,
      }),
      stbls: [],
    }
  }
}
