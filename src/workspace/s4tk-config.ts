import { StringTableLocale } from "@s4tk/models/enums";

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

export function parseConfig(content: string): S4TKConfig {
  try {
    return JSON.parse(content, ((key, value) => {
      switch (key) {
        case "defaultLocale":
          return (value in StringTableLocale)
            ? StringTableLocale[value]
            : StringTableLocale.English;
        default:
          return value;
      }
    }));
  } catch (err) {
    throw new Error(`S4TK config is invalid (${err})`);
  }
}

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
