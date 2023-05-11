import { Package, StringTableResource } from "@s4tk/models";
import { ResourceKey, ResourceKeyPair } from "@s4tk/models/types";
import { BuildSummary, ValidatedPackageInfo, WrittenPackageInfo } from "./summary";
import { findGlobMatches } from "./resources";
import { addAndGetItem } from "./helpers";

export interface BuildContext {
  /** Summary of the build process. */
  readonly summary: BuildSummary;

  /** Set of string keys that are already in use (all packages). */
  readonly stringKeys: Set<number>;

  /** Cache that maps tuning filenames (on disk) to their keys. */
  readonly tuningKeys: Map<string, ResourceKey>;
}

export interface PackageBuildContext extends BuildContext {
  /** Paths to all files to include in this package. */
  readonly filepaths: readonly string[];

  /** Package that the source file is being written to. */
  readonly pkg: Package;

  /** Information about the package in the BuildSummary. */
  readonly pkgInfo: WrittenPackageInfo;

  /** All string table to include in this package (merge/generate after). */
  readonly stbls: StringTableReference[];
}

export interface StringTableReference {
  filepath: string;
  stbl: ResourceKeyPair<StringTableResource>;
}

export namespace BuildContext {
  /**
   * Creates the initial, overall BuildContext object.
   * 
   * @param summary Summary to add to context
   */
  export function create(summary: BuildSummary): BuildContext {
    return {
      summary,
      stringKeys: new Set(),
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
      summary: context.summary,
      stringKeys: context.stringKeys,
      tuningKeys: context.tuningKeys,
      filepaths: findGlobMatches(pkgConfig.include, pkgConfig.exclude),
      pkg: new Package(),
      pkgInfo: addAndGetItem(context.summary.written.packages, {
        filename: pkgConfig.filename,
        resources: []
      }),
      stbls: [],
    }
  }
}
