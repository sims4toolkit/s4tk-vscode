import type { S4TKConfig } from "#workspace/s4tk-config";

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

  scriptsRun: {
    before: ShellScriptSummary[];
    after: ShellScriptSummary[];
  };

  config: {
    variableReplacements: ValidatedPath[];
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

export interface ShellScriptSummary extends Warnable {
  workingDirectory: string;
  command: string;
  stdout?: string;
  stderr?: string;
  output?: string[];
  error?: string;
}

//#endregion

//#region Functions

export namespace BuildSummary {
  /**
   * Returns a new BuildSummary object for the given mode.
   * 
   * @param config Config for build
   * @param mode Mode for build
   */
  export function create(config: S4TKConfig, mode: BuildMode): BuildSummary {
    return {
      buildInfo: {
        mode: mode,
        summary: config.buildSettings.outputBuildSummary,
        success: true,
        problems: 0,
      },
      scriptsRun: {
        before: [],
        after: []
      },
      config: {
        variableReplacements: [],
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
