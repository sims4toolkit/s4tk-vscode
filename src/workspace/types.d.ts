import type { StringTableLocale } from "@s4tk/models/enums";

export type StringTableLocaleString =
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

export interface RawS4TKConfig {
  allowFolderCreation?: boolean;
  buildFolders: string[];
  sourceFolder: string;
  stringTables?: {
    defaultLocale?: StringTableLocaleString;
    defaultPath: string;
    generateMissingLocales?: boolean;
  };
}

export interface S4TKConfig {
  allowFolderCreation: boolean;
  buildFolders: string[];
  sourceFolder: string;
  stringTables?: {
    defaultLocale: StringTableLocale;
    defaultPath: string;
    generateMissingLocales: boolean;
  };
}
