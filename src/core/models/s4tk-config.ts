import * as vscode from "vscode";
import { StringTableLocale } from "@s4tk/models/enums";
import { SCHEMAS } from "#assets";
import { FILENAME } from "#constants";
import { fileExists } from "#helpers/fs";
import { parseAndValidateJson } from "#helpers/schemas";

//#region Exported Members

export interface S4TKConfig {
  projectInfo: {
    creatorName: string;
    projectName: string;
    tuningPrefix?: string;
  };

  buildInstructions: {
    allowFolderCreation: boolean;
    sourceFolder?: string;
    destinations: string[];
    packages?: {
      filename: string;
      include: string[];
    }[];
  };

  stringTables: {
    defaultLocale: StringTableLocale;
    defaultPath?: string;
    generateMissingLocales: boolean;
    newStringsToTop: boolean;
    onePerPackage: boolean;
  };

  settings: {
    showCopyConfirmation: boolean;
  };
}

export namespace S4TKConfig {
  type ConfigInfo = {
    uri?: vscode.Uri;
    exists: boolean;
  };

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
    return JSON.stringify(config, ((key, value) => {
      if (key === "defaultLocale" && typeof value === "number") {
        return StringTableLocale[value];
      }

      return value;
    }), 2); // FIXME: get number of spaces from somewhere
  }
}

//#endregion

//#region Transformer / Default Values

const _CONFIG_TRANSFORMER: ConfigTransformer = {
  stringTables: {
    defaults: {
      defaultLocale: StringTableLocale.English,
      generateMissingLocales: true,
      newStringsToTop: false,
      onePerPackage: true,
    },
    getConverter(prop, value) {
      if (prop === "defaultLocale" && typeof value === "string") {
        //@ts-ignore This is safe because value passed the schema
        return StringTableLocale[value];
      }

      return value;
    }
  },
  settings: {
    defaults: {
      showCopyConfirmation: true,
    },
  },
};

//#endregion

//#region Config Proxy

interface ConfigPropertyTransformer<T> {
  /**
   * Whether or not this property can be null at runtime.
   */
  nullable?: boolean;

  /**
   * Default values to use for undefined or null properties.
   */
  defaults?: Partial<T>;

  /**
   * Converts a property from its schema type to its runtime type.
   * 
   * @param prop Name of property being converted
   * @param value Value of property being converted
   */
  getConverter?: (prop: keyof T, value: any) => any;
}

type ConfigTransformer = Partial<{
  [key in keyof S4TKConfig]: ConfigPropertyTransformer<S4TKConfig[key]>;
}>;

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
  nullable = false,
  defaults = {},
  getConverter = (value) => value
}: ConfigPropertyTransformer<T>): T {
  // Just using ! to silence TS even though these are known to be undefined
  if (nullable && !target) return target!;
  return new Proxy<T>(target!, {
    get(target, prop: string) {
      //@ts-ignore This is safe because we're in a proxy
      return getConverter(prop, target[prop] ?? defaults[prop]);
    },
  }) as T;
}

//#endregion
