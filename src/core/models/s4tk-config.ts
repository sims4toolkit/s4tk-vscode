import * as path from "path";
import * as vscode from "vscode";
import { SCHEMAS } from "#assets";
import { FILENAME } from "#constants";
import { fileExists } from "#helpers/fs";
import { parseAndValidateJson } from "#helpers/schemas";

//#region Types

export interface S4TKConfig {
  buildInstructions: {
    source: string;
    destinations: string[];
    packages: {
      filename: string;
      include: string[];
      exclude?: string[];
    }[];
  };

  buildSettings: {
    allowEmptyPackages: boolean;
    allowFolderCreation: boolean;
    allowMissingSourceFiles: boolean;
    allowPackageOverlap: boolean;
    generateMissingLocales: boolean;
    mergeStringTablesInSamePackage: boolean;
    outputBuildSummary: "none" | "partial" | "full";
  };

  releaseSettings: {
    filename: string;
    otherFiles: {
      include?: string[];
      exclude?: string[];
    };
    overrideDestinations: string[];
  };

  workspaceSettings: {
    defaultLocale: StringTableLocaleName;
    defaultStringTable: string;
    defaultStringTableJsonType: "array" | "object";
    newStringsToStartOfStblJson: boolean;
    showCopyConfirmationPopup: boolean;
    spacesPerIndent: number;
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
      generateMissingLocales: true,
      mergeStringTablesInSamePackage: true,
      outputBuildSummary: "partial",
    },
  },
  releaseSettings: {
    defaults: {
      filename: "",
      otherFiles: {},
      overrideDestinations: [],
    },
  },
  workspaceSettings: {
    defaults: {
      defaultLocale: "English",
      defaultStringTable: "",
      defaultStringTableJsonType: "object",
      newStringsToStartOfStblJson: true,
      showCopyConfirmationPopup: true,
      spacesPerIndent: 2,
    },
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
  export async function find(): Promise<ConfigInfo> {
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!rootUri) return { exists: false };
    const uri = vscode.Uri.joinPath(rootUri, FILENAME.config);
    const exists = await fileExists(uri);
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
    const result = parseAndValidateJson<S4TKConfig>(content, SCHEMAS.config);

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
    return JSON.stringify(
      config,
      null,
      config.workspaceSettings.spacesPerIndent
    );
  }

  /**
   * Resolves one of the paths listed in the config.
   * 
   * @param original Original path to resolve
   * @param relativeTo Path that original is relative to if not the config
   * @param isGlob Whether or not to return a path compatible with globbing 
   */
  export function resolvePath(original: string, {
    relativeTo = undefined,
    isGlob = false,
  }: {
    relativeTo?: string;
    isGlob?: boolean;
  } = {}): string | undefined {
    let absPath = original;
    if (!path.isAbsolute(original)) {
      const basePath = relativeTo ?? vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      if (!basePath) return;
      absPath = path.resolve(basePath, original);
    }
    return isGlob ? absPath.replace(/\\/g, "/") : absPath;
  }
}

//#endregion

//#region Helper Types + Proxy

interface ConfigPropertyTransformer<T> {
  defaults: T;
  getConverter?: (prop: keyof T, value: any) => any;
}

type ConfigTransformer = {
  [key in keyof S4TKConfig]: ConfigPropertyTransformer<S4TKConfig[key]>;
};

type ConfigInfo = {
  uri?: vscode.Uri;
  exists: boolean;
};

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
