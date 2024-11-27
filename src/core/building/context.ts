import { Package, StringTableResource } from "@s4tk/models";
import { ResourceKey, ResourceKeyPair } from "@s4tk/models/types";
import { S4TKConfig } from "#workspace/s4tk-config";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { BuildSummary, ValidatedPackageInfo, WrittenPackageInfo } from "./summary";
import { findGlobMatches } from "./resources";
import { addAndGetItem } from "./helpers";

export interface BuildContext {
  /** Config containing the build instructions. */
  readonly config: S4TKConfig;

  /** Summary of the build process. */
  readonly summary: BuildSummary;

  /** Cache that maps tuning filenames (on disk) to their keys. */
  readonly tuningKeys: Map<string, ResourceKey>;

  /** Absolute path to the root folder of the workspace. */
  readonly workspaceRootPath: string;

  /** Function that resolves a path relative to the workspace root. */
  readonly resolvePath: (relativePath: string, isGlob?: boolean) => string;
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
   * @param options Optional arguments
   */
  export function create(workspace: S4TKWorkspace, summary: BuildSummary, options?: {
    /** Config to use instead of `workspace.config` for build. */
    configOverride?: S4TKConfig;
  }): BuildContext {
    return {
      config: options?.configOverride ?? workspace.config,
      summary,
      tuningKeys: new Map(),
      workspaceRootPath: workspace.rootUri.fsPath,
      resolvePath: (p, g?) => workspace.resolvePath(p, g),
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
      config: context.config,
      summary: context.summary,
      tuningKeys: context.tuningKeys,
      workspaceRootPath: context.workspaceRootPath,
      resolvePath: context.resolvePath,
      filepaths: findGlobMatches(pkgConfig.include, pkgConfig.exclude, "supported"),
      pkg: new Package(),
      pkgConfig: pkgConfig,
      pkgInfo: addAndGetItem(context.summary.written.packages, {
        filename: pkgConfig.filename,
        resources: context.config.buildSettings.outputBuildSummary === "full"
          ? []
          : undefined,
      }),
      stbls: [],
    }
  }
}
