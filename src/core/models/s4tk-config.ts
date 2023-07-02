import { existsSync } from "fs";
import * as vscode from "vscode";
import S4TKAssets from "#assets";
import { S4TKFilename } from "#constants";
import { parseAndValidateJson } from "#helpers/schemas";
import { S4TKSettings } from "#helpers/settings";

//#region Types

export interface S4TKConfig {
  buildInstructions: {
    source: string;
    destinations: string[];
    packages: {
      filename: string;
      duplicateFilesFrom?: string[];
      include: string[];
      exclude?: string[];
      doNotGenerate?: boolean;
      doNotWrite?: boolean;
    }[];
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
    zips: {
      filename: string;
      internalFolder?: string;
      doNotGenerate?: boolean;
      packages: string[];
      otherFiles?: {
        include?: string[];
        exclude?: string[];
      };
    }[];
  };

  stringTableSettings: {
    allowStringKeyOverrides: boolean;
    defaultStringTable: string;
    generateMissingLocales: boolean;
    mergeStringTablesInSamePackage: boolean;
  };

  workspaceSettings: {
    overrideIndexRoot?: string;
  };
}

const _CONFIG_TRANSFORMER: ConfigTransformer = {
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
    },
  },
  workspaceSettings: {
    defaults: {},
  },
};

export namespace S4TKConfig {
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
