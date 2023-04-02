import type { StringTableLocale } from "@s4tk/models/enums";

type StringTableLocaleString =
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
  stringTables?: {
    default?: string;
    generateMissingLocales?: boolean;
    locale?: StringTableLocaleString;
  };
}

export interface S4TKConfig {
  stringTables: {
    default?: string;
    generateMissingLocales: boolean;
    locale: StringTableLocale;
  };
}
