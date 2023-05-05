import { StringTableLocale } from "@s4tk/models/enums";
import { parseAndValidateJson } from "#helpers/schemas";
import { SCHEMAS } from "#assets";

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

  stringTables?: {
    defaultLocale: StringTableLocale;
    defaultPath: string;
    generateMissingLocales: boolean;
    newStringsToTop: boolean;
    onePerPackage: boolean;
  };

  settings: {
    showCopyConfirmation: boolean;
  };
}

export namespace S4TKConfig {
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
    nullable: true,
    defaults: {
      defaultLocale: StringTableLocale.English,
      generateMissingLocales: true,
      newStringsToTop: false,
      onePerPackage: true,
    },
    converter(prop, value) {
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
  converter?: (prop: keyof T, value: any) => any;
}

type ConfigTransformer = Partial<{
  [key in keyof S4TKConfig]: ConfigPropertyTransformer<S4TKConfig[key]>;
}>;

function _getConfigProxy(config: S4TKConfig): S4TKConfig {
  return new Proxy<S4TKConfig>(config, {
    get(config, prop: keyof S4TKConfig) {
      return (prop in _CONFIG_TRANSFORMER)
        ? _getObjectProxy(config[prop], _CONFIG_TRANSFORMER[prop]!)
        : config[prop];
    },
  });
}

function _getObjectProxy<T extends object>(target: T | undefined, {
  nullable = false,
  defaults = {},
  converter = (value) => value
}: ConfigPropertyTransformer<T>): T {
  // Just using ! to silence TS even though these are known to be undefined
  if (nullable && !target) return target!;
  return new Proxy<T>(target!, {
    get(target, prop: string) {
      //@ts-ignore This is safe because we're in a proxy
      return converter(prop, target[prop] ?? defaults[prop]);
    },
  }) as T;
}

//#endregion
