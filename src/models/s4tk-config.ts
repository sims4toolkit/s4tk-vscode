import { Validator } from "jsonschema";
import { StringTableLocale } from "@s4tk/models/enums";

//#region Types

export interface S4TKConfig {
  projectInfo: {
    creatorName: string;
    projectName: string;
    tuningPrefix?: string;
  };

  buildInstructions: {
    allowFolderCreation?: boolean;
    destinations: string[];
    sourceFolder?: string;
    packages?: {
      filename: string;
      include: string[];
    }[];
  };

  stringTables?: {
    defaultLocale?: StringTableLocale;
    defaultPath: string;
    generateMissingLocales?: boolean;
  };
}

//#endregion

//#region Public Functions

/**
 * Parses the given JSON content as an S4TK config, and validates that it
 * matches the expected format. If there are syntax or validation errors, an
 * exception is thrown.
 * 
 * @param content JSON content to parse and validate as an S4TK config
 */
export function parseConfig(content: string): S4TKConfig {
  const config = JSON.parse(content) as S4TKConfig;

  _validateConfig(config);

  const localeString = config.stringTables?.defaultLocale;
  if (localeString != undefined) {
    //@ts-expect-error Typing doesn't match up, but this is fine
    config.stringTables.defaultLocale = (localeString in StringTableLocale)
      ? StringTableLocale[localeString]
      : StringTableLocale.English;
  }

  return config;
}

/**
 * Converts the given config to a writable string.
 * 
 * @param config Config to stringify
 */
export function stringifyConfig(config: S4TKConfig): string {
  return JSON.stringify(config, ((key, value) => {
    switch (key) {
      case "defaultLocale":
        return StringTableLocale[value];
      default:
        return value;
    }
  }));
}

//#endregion

//#region Helper Functions

/**
 * Validates the given object against the S4TK config schema.
 * 
 * @param config Object to validate against config schema
 * @throws If it fails to validate aginst the schema
 */
function _validateConfig(config: object) {
  const configSchema = require("../../schemas/s4tk-config.schema.json");
  const validator = new Validator();
  validator.validate(config, configSchema, {
    throwError: true,
  });
}

//#endregion
