export type BuildMode = "build" | "dryrun" | "release";

export interface ValidatedPath {
  orignal: string;
  resolved: string;
  warning?: string;
}

export interface BuildSummary {
  buildInfo: {
    mode: BuildMode;
    success: boolean;
    warnings: number;
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
        success: false,
        warnings: 0,
      },
      config: {
        source: {
          orignal: unknownPath,
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
