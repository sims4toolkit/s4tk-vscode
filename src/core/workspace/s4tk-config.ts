import { existsSync } from "fs";
import * as vscode from "vscode";
import * as justClone from "just-clone";
import S4TKAssets from "#assets";
import { S4TKFilename } from "#constants";
import { parseAndValidateJson } from "#helpers/schemas";
import { S4TKSettings } from "#helpers/settings";
import type { BuildSummary, ValidatedPath } from "#building/summary";

//#region Types

interface BuildPackageInfo {
  filename: string;
  duplicateFilesFrom?: string[];
  include: string[];
  exclude?: string[];
  doNotGenerate?: boolean;
  doNotWrite?: boolean;
}

interface BuildZipInfo {
  filename: string;
  internalFolder?: string;
  doNotGenerate?: boolean;
  packages: string[];
  otherFiles?: {
    include?: string[];
    exclude?: string[];
  };
}

export interface ShellScriptInfo {
  command: string;
  workingDirectory?: string;
  mustSucceed?: boolean;
  enabled?: boolean;
}

export interface S4TKConfig {
  projectMetaData: {
    creator?: string;
    modName?: string;
    modVersion?: string;
    customVariables?: {
      [key: string]: string;
    };
  };

  buildInstructions: {
    source: string;
    destinations: string[];
    packages: BuildPackageInfo[];
    additionalScripts?: {
      runBeforeBuild?: ShellScriptInfo[];
      runAfterBuild?: ShellScriptInfo[];
    };
  };

  buildSettings: {
    allowEmptyPackages: boolean;
    allowFolderCreation: boolean;
    allowMissingSourceFiles: boolean;
    allowPackageOverlap: boolean;
    allowResourceKeyOverrides: boolean;
    outputBuildSummary: "none" | "partial" | "full";
  };

  releaseSettings: {
    overrideDestinations: string[];
    zips: BuildZipInfo[];
  };

  stringTableSettings: {
    allowStringKeyOverrides: boolean;
    defaultStringTable: string;
    generateMissingLocales: boolean;
    mergeStringTablesInSamePackage: boolean;
    commentRestoration: {
      locale?: StringTableLocaleName;
      sources: string[];
    }
  };

  workspaceSettings: {
    overrideIndexRoot?: string;
  };
}

const _CONFIG_TRANSFORMER: ConfigTransformer = {
  projectMetaData: {
    defaults: {
      creator: "",
      modName: "",
      modVersion: "",
      customVariables: {}
    }
  },
  buildInstructions: {
    defaults: {
      source: "",
      destinations: [],
      packages: [],
    },
  },
  buildSettings: {
    defaults: {
      allowEmptyPackages: false,
      allowFolderCreation: false,
      allowMissingSourceFiles: false,
      allowPackageOverlap: false,
      allowResourceKeyOverrides: false,
      outputBuildSummary: "partial",
    },
  },
  releaseSettings: {
    defaults: {
      overrideDestinations: [],
      zips: [],
    },
  },
  stringTableSettings: {
    defaults: {
      allowStringKeyOverrides: false,
      defaultStringTable: "",
      generateMissingLocales: true,
      mergeStringTablesInSamePackage: true,
      commentRestoration: {
        sources: []
      },
    },
  },
  workspaceSettings: {
    defaults: {},
  },
};

export namespace S4TKConfig {
  /**
   * Clones the given config and applies the variables in its metadata to all
   * value strings.
   * 
   * @param config Config to clone
   * @param options Optional arguments
   */
  export function applyVariablesOnClone(config: S4TKConfig, options?: {
    /** BuildSummary to write variable replacements to. */
    summary?: BuildSummary,
  }): S4TKConfig {
    return modify(_getDeepClone(config), c => _applyVariables(c, options?.summary));
  }

  /**
   * Returns an empty object wrapped in an S4TKConfig proxy, so that default
   * values can be accessed in a type-safe way.
   */
  export function blankProxy(): S4TKConfig {
    return _getConfigProxy({} as S4TKConfig);
  }

  /**
   * Finds the expected URI of the config file, if the current workspace were to
   * have one, and returns it alongside a boolean that says whether it actually
   * exists or not.
   */
  export function find(workspaceRoot: vscode.Uri): ConfigInfo {
    const uri = vscode.Uri.joinPath(workspaceRoot, S4TKFilename.config);
    const exists = existsSync(uri.fsPath);
    return { uri, exists };
  }

  /**
   * Allows the original config object to be edited.
   * 
   * @param config S4TK config proxy object
   * @param fn Function to run on the original object
   */
  export function modify(config: S4TKConfig, fn: (original: S4TKConfig) => void): S4TKConfig {
    //@ts-ignore "_original" is a special case on the proxy
    fn(config._original ?? config);
    return config;
  }

  /**
   * Parses a JSON string as an S4TKConfig object. If there are syntax or
   * validation errors, an exception is thrown.
   * 
   * @param content JSON content to parse
   */
  export function parse(content: string): S4TKConfig {
    const result = parseAndValidateJson<S4TKConfig>(content, S4TKAssets.schemas.config);

    if (result.parsed) {
      return _getConfigProxy(result.parsed);
    } else {
      throw new Error(result.error);
    }
  }

  /**
   * Converts an S4TKConfig object to a JSON string.
   * 
   * @param config Config to stringify
   */
  export function stringify(config: S4TKConfig): string {
    return JSON.stringify(config, null, S4TKSettings.getSpacesPerIndent());
  }

  function _applyVariables(config: S4TKConfig, summary: BuildSummary | undefined) {
    const variables = _getVariableMap(config);

    function transformString(original: string): string {
      let resolved = original;

      variables.forEach((value, name) => {
        // regex is safe because original is guaranteed to be alphanumeric only
        const regex = new RegExp(`{{${name}}}`, "g");
        resolved = resolved.replace(regex, value);
      });

      if (summary) {
        const stillHasVar = resolved.includes("{{") || resolved.includes("}}");
        if (resolved !== original || stillHasVar) {
          const validated: ValidatedPath = { original, resolved };
          if (stillHasVar) {
            validated.warning = "Resolved path still contains variables.";
            summary.buildInfo.problems++;
          }
          summary.config.variableReplacements.push(validated);
        }
      }

      return resolved;
    }

    function handleNonStringValue(value: any): any {
      if (value) {
        if (Array.isArray(value)) return handleArray(value);
        if (typeof value === "object") return handleObject(value);
      }
      return value
    }

    function handleArray(arr: any[]): any[] {
      return arr.map(value => (typeof value === "string")
        ? transformString(value)
        : handleNonStringValue(value)
      );
    }

    function handleObject(obj: { [key: string]: any; }): object {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = (typeof value === "string")
          ? transformString(value)
          : handleNonStringValue(value);
      }
      return obj;
    }

    return handleObject(config);
  }

  function _getDeepClone(config: S4TKConfig): S4TKConfig {
    //@ts-ignore "_original" is a special case on the proxy
    const clone = justClone<S4TKConfig>(config._original ?? config);
    return _getConfigProxy(clone);
  }

  function _getVariableMap(config: S4TKConfig): Map<string, string> {
    const data = config.projectMetaData;
    const map = new Map<string, string>();

    // pre-defined variables
    map.set("creator", data.creator ?? "");
    map.set("modName", data.modName ?? "");
    map.set("modVersion", data.modVersion ?? "");

    // custom variables
    if (data.customVariables) {
      for (const key in data.customVariables) {
        const value = data.customVariables[key];
        map.set(key, value);
      }
    }

    return map;
  }
}

//#endregion

//#region Proxy

interface ConfigPropertyTransformer<T> {
  defaults: T;
  getConverter?: (prop: keyof T, value: any) => any;
}

type ConfigTransformer = {
  [key in keyof S4TKConfig]: ConfigPropertyTransformer<S4TKConfig[key]>;
};

interface ConfigInfo {
  uri: vscode.Uri;
  exists: boolean;
}

function _getConfigProxy(config: S4TKConfig): S4TKConfig {
  return new Proxy<S4TKConfig>(config, {
    get(target, prop: keyof S4TKConfig) {
      //@ts-ignore "_original" is a special case to preserve the non-proxied obj
      if (prop === "_original") return config;
      return (prop in _CONFIG_TRANSFORMER)
        ? _getObjectProxy(target[prop], _CONFIG_TRANSFORMER[prop]!)
        : target[prop];
    },
  });
}

function _getObjectProxy<T extends object>(target: T | undefined, {
  defaults = {} as T,
  getConverter = (_, value) => value
}: ConfigPropertyTransformer<T>): T {
  return new Proxy<T>(target ?? {} as T, {
    //@ts-ignore I genuinely do not understand why TS doesn't like this
    get(target, prop: keyof T) {
      return getConverter(prop, target[prop] ?? defaults[prop]);
    },
  }) as T;
}

//#endregion
