import * as vscode from "vscode";
import { StringTableLocale } from "@s4tk/models/enums";
import { S4TKConfig, RawS4TKConfig, StringTableLocaleString } from "./types";
import { fileExists } from "@helpers/utils";

const CONFIG_FILENAME = "s4tk.config.json";

/**
 * Loads the `s4tk.config.json` file and parses it into an object. If there is
 * no config, then `undefined` is returned. If there is a config but it is
 * malformatted, then an exception is thrown.
 * 
 * @returns Parsed S4TK config if there is one, `undefined` otherwise
 * @throws If there is a config and it is malformed
 */
export async function loadConfig(): Promise<S4TKConfig | undefined> {
  return new Promise(async (resolve, reject) => {
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!rootUri) return resolve(undefined);

    const configUri = vscode.Uri.joinPath(rootUri, CONFIG_FILENAME);
    if (!(await fileExists(configUri))) return resolve(undefined);

    try {
      const content = await vscode.workspace.fs.readFile(configUri);
      const rawConfig = JSON.parse(content.toString()) as RawS4TKConfig;
      resolve(_processConfig(rawConfig));
    } catch (err) {
      reject(err);
    }

    resolve(undefined);
  });
}

/**
 * Saves an S4TK config object to the `s4tk.config.json` file.
 * 
 * @param config Config file to save
 */
export async function saveConfig(config: S4TKConfig) {
  const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (rootUri) {
    // FIXME: add safeguards around checking if the file exists
    const rawConfig = _serializeConfig(config);
    const bytes = Buffer.from(JSON.stringify(rawConfig, null, 2));
    const configUri = vscode.Uri.joinPath(rootUri, CONFIG_FILENAME);
    await vscode.workspace.fs.writeFile(configUri, bytes);
  }
}

//#region Helpers

async function _processConfig(rawConfig: RawS4TKConfig): Promise<S4TKConfig> {
  // just for typing / readability
  const config = rawConfig as unknown as S4TKConfig;

  if (rawConfig.stringTables) {
    if (rawConfig.stringTables.generateMissingLocales == undefined) {
      config.stringTables!.generateMissingLocales = true;
    }

    // if (!rawConfig.stringTables.defaultPath) {
    //   throw new Error("S4TK config contains stringTables, but does not specify its defaultPath.");
    // } else {
    //   // FIXME: create helper that automatically converts a path into an absolute
    //   // path with a scheme, as well as converting it to correct format
    //   const uri = vscode.Uri.parse(rawConfig.stringTables.defaultPath);
    //   if (!(await fileExists(uri))) {
    //     throw new Error("S4TK config contains stringTables, but its defaultPath does not lead to an existing string table.");
    //   }
    // }

    if (rawConfig.stringTables.defaultLocale == undefined) {
      config.stringTables!.defaultLocale = StringTableLocale.English;
    } else {
      config.stringTables!.defaultLocale = StringTableLocale[rawConfig.stringTables!.defaultLocale!];
    }
  }

  return config;
}

function _serializeConfig(config: S4TKConfig): RawS4TKConfig {
  // just for typing / readability
  const rawConfig = config as unknown as RawS4TKConfig;

  if (config.stringTables) {
    rawConfig.stringTables!.defaultLocale =
      StringTableLocale[config.stringTables.defaultLocale] as StringTableLocaleString;
  }

  return rawConfig;
}

//#endregion
