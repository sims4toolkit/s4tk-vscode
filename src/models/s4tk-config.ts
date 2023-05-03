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
    allowOverwritingFiles?: boolean;
    sourceFolder?: string;
    destinations: string[];
    packages?: {
      filename: string;
      include: string[];
    }[];
  };

  stringTables?: {
    defaultLocale?: StringTableLocale;
    defaultPath: string;
    generateMissingLocales?: boolean;
    onePerPackage?: boolean;
  };
}

//#endregion

//#region Constants

export const CONFIG_FILENAME = "s4tk.config.json";

export const DEFAULT_CONFIG_CONTENT = Buffer.from(`{
  "projectInfo": {
    "creatorName": "",
    "projectName": "",
    "tuningPrefix": ""
  },
  "buildInstructions": {
    "allowFolderCreation": false,
    "allowOverwritingFiles": false,
    "sourceFolder": "./src",
    "destinations": [
      "./out"
    ],
    "packages": []
  },
  "stringTables": {
    "defaultLocale": "English",
    "defaultPath": "./default.stbl.json",
    "generateMissingLocales": true,
    "onePerPackage": true
  }
}`);

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
 * @param spaces Number of spaces to use in formatted JSON
 */
export function stringifyConfig(config: S4TKConfig, spaces = 2): string {
  return JSON.stringify(config, ((key, value) => {
    switch (key) {
      case "defaultLocale":
        return StringTableLocale[value];
      default:
        return value;
    }
  }), spaces);
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
