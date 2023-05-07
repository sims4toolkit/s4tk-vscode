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
    allowFolderCreation: boolean;
    generateMissingLocales: boolean;
    minifyTuning: boolean;
    mergeStringTablesInSamePackage: boolean;
    outputBuildSummaryFile: boolean;
  };

  workspaceSettings: {
    defaultLocale: StringTableLocaleName;
    defaultStringTable: string;
    newStringsToStartOfTable: boolean;
    newStringTableJsonType: "array" | "object";
    showCopyConfirmationPopup: boolean;
    showStblJsonMetaDataButton: boolean;
    showXmlKeyOverrideButtons: boolean;
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
      allowFolderCreation: false,
      generateMissingLocales: true,
      mergeStringTablesInSamePackage: true,
      minifyTuning: false,
      outputBuildSummaryFile: true,
    },
  },
  workspaceSettings: {
    defaults: {
      defaultLocale: "English",
      defaultStringTable: "",
      newStringsToStartOfTable: true,
      newStringTableJsonType: "object",
      showCopyConfirmationPopup: true,
      showStblJsonMetaDataButton: true,
      showXmlKeyOverrideButtons: true,
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
}

//#endregion

//#region Helper Types + Proxy

type StringTableLocaleName =
  "English" |
  "ChineseSimplified" |
  "ChineseTraditional" |
  "Czech" |
  "Danish" |
  "Dutch" |
  "Finnish" |
  "French" |
  "German" |
  "Italian" |
  "Japanese" |
  "Korean" |
  "Norwegian" |
  "Polish" |
  "Portuguese" |
  "Russian" |
  "Spanish" |
  "Swedish";

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
