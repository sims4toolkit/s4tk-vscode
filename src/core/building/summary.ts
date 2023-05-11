import * as vscode from "vscode";

//#region Types

export type BuildMode = "build" | "dryrun" | "release";

export interface BuildSummary {
  buildInfo: {
    mode: BuildMode;
    success: boolean;
    problems: number;
    fatalErrorMessage?: string;
  };

  config: {
    source: ValidatedPath;
    destinations: ValidatedPath[];
    packages: ValidatedPackageInfo[];
    zip?: ValidatedZipInfo;
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
  include: ValidatedPath[];
  exclude: ValidatedPath[];
}

export interface ValidatedPath extends Warnable {
  original: string;
  resolved: string;
  ignore?: boolean;
}

export interface ValidatedZipInfo extends Warnable {
  filename: string;
  otherFiles: ValidatedPath[];
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
  resources: WrittenResourceInfo[];
}

export interface WrittenResourceInfo {
  filename?: string;
  key: string;
  type: string;
}

//#endregion

//#region Functions

export namespace BuildSummary {
  const _BUILD_SUMMARY_FILENAME = "BuildSummary.json";

  export function create(mode: BuildMode): BuildSummary {
    return {
      buildInfo: {
        mode: mode,
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
        zip: mode !== "release" ? undefined : {
          filename: "",
          otherFiles: [],
        },
      },
      written: {
        fileWarnings: [],
        ignoredSourceFiles: [],
        missingSourceFiles: [],
        packages: [],
      },
    };
  }

  export function getUri(): vscode.Uri | undefined {
    const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!rootDir) return;
    return vscode.Uri.joinPath(rootDir, _BUILD_SUMMARY_FILENAME);
  }

  export function makeRelative(summary: BuildSummary, filepath: string): string {
    return filepath.replace(summary.config.source.resolved, "");
  }
}

//#endregion
