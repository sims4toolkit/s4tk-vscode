import type { BuildSummary, BuildMode } from "./types";

/**
 * Returns a new BuildSummary object to fill out during the build process.
 * 
 * @param mode Mode that build will run in
 */
export function getDefaultBuildSummary(mode: BuildMode): BuildSummary {
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
