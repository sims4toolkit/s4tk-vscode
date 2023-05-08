export type BuildMode = "build" | "dryrun" | "release";

export interface ValidatedPath {
  original: string;
  resolved: string;
  warning?: string;
  ignore?: boolean;
}

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
    packages: {
      filename: string;
      include: ValidatedPath[];
      exclude?: ValidatedPath[];
      warning?: string;
    }[];
    zip?: {
      filename: string;
      otherFiles: ValidatedPath[];
      warning?: string;
    };
  };

  fileWarnings: {
    file: string;
    warnings: string[];
  }[];

  writtenPackages: {
    filename: string;
    resources: {
      key: string;
      type: string;
    }[];
  }[];

  // TODO: something for files in source that aren't being built
}

export namespace BuildSummary {
  /**
   * Creates and returns a new BuildSummary for the given mode.
   */
  export function create(mode: BuildMode): BuildSummary {
    const unknownPath = "unknown";

    return {
      buildInfo: {
        mode: mode,
        success: true,
        problems: 0,
      },
      config: {
        source: {
          original: unknownPath,
          resolved: unknownPath,
        },
        destinations: [],
        packages: [],
        zip: mode !== "release" ? undefined : {
          filename: unknownPath,
          otherFiles: [],
        },
      },
      fileWarnings: [],
      writtenPackages: [],
    };
  }
}
