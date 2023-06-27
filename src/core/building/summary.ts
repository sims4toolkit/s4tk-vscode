import * as vscode from "vscode";
import S4TKWorkspace from "#workspace/s4tk-workspace";

//#region Types

export type BuildMode = "build" | "dryrun" | "release";
export type SummaryType = "none" | "partial" | "full";

export interface BuildSummary {
  buildInfo: {
    mode: BuildMode;
    summary: SummaryType;
    success: boolean;
    problems: number;
    fatalErrorMessage?: string;
  };

  config: {
    source: ValidatedPath;
    destinations: ValidatedPath[];
    packages: ValidatedPackageInfo[];
    zips?: ValidatedZipInfo[];
  };

  written: {
    fileWarnings: WrittenFileInfo[];
    ignoredSourceFiles: string[];
    missingSourceFiles: string[];
    packages: WrittenPackageInfo[];
  };
}

export interface ValidatedPackageInfo extends Warnable {
  filename: string;
  duplicateFilesFrom: string[];
  include: ValidatedPath[];
  exclude: ValidatedPath[];
  doNotGenerate: boolean;
  doNotWrite: boolean;
}

export interface ValidatedPath extends Warnable {
  original: string;
  resolved: string;
  ignore?: boolean;
}

export interface ValidatedZipInfo extends Warnable {
  filename: string;
  internalFolder?: string;
  doNotGenerate: boolean;
  packages: string[];
  otherFiles: string[];
}

export interface Warnable {
  warning?: string;
}

export interface WrittenFileInfo {
  file: string;
  warnings: string[];
}

export interface WrittenPackageInfo {
  filename: string;
  resources?: WrittenResourceInfo[];
}

export interface WrittenResourceInfo {
  filename: string;
  key: string;
  type: string;
}

//#endregion

//#region Functions

export namespace BuildSummary {
  const _BUILD_SUMMARY_FILENAME = "BuildSummary.json";

  /**
   * Returns a new BuildSummary object for the given mode.
   * 
   * @param mode Mode for build
   */
  export function create(mode: BuildMode): BuildSummary {
    return {
      buildInfo: {
        mode: mode,
        summary: S4TKWorkspace.config.buildSettings.outputBuildSummary,
        success: true,
        problems: 0,
      },
      config: {
        source: {
          original: "",
          resolved: "",
        },
        destinations: [],
        packages: [],
      },
      written: {
        fileWarnings: [],
        ignoredSourceFiles: [],
        missingSourceFiles: [],
        packages: [],
      },
    };
  }

  /**
   * Returns the URI at which to write the BuildSummary.json file.
   */
  export function getUri(): vscode.Uri | undefined {
    const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!rootDir) return;
    return vscode.Uri.joinPath(rootDir, _BUILD_SUMMARY_FILENAME);
  }

  /**
   * Returns the given path as relative to the source folder in the build.
   * 
   * @param summary Summary that contains build info
   * @param filepath Path to make relative
   */
  export function makeRelative(summary: BuildSummary, filepath: string): string {
    // easier / more efficient that using path lib
    return filepath.replace(summary.config.source.resolved, "");
  }
}

//#endregion
