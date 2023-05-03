import * as vscode from "vscode";
import { ValidationError } from "jsonschema";
import { CONFIG_FILENAME, DEFAULT_CONFIG_CONTENT, S4TKConfig, parseConfig, stringifyConfig } from "@models/s4tk-config";
import { fileExists } from "@helpers/utils";
import StringTableJson from "@models/stbl-json";
import { StringTableLocale } from "@s4tk/models/enums";

class _S4TKWorkspace {
  //#region Properties

  private _config?: S4TKConfig;
  get config() { return this._config; }

  //#endregion

  //#region Public Methods

  /**
   * Creates a default workspace setup, if possible.
   */
  async createDefaultProject() {
    // confirm workspace doesn't already exist
    const configUriInfo = await _findConfig();
    if (configUriInfo.exists) {
      vscode.window.showWarningMessage("S4TK config file already exists.");
      return;
    } else if (!configUriInfo.uri) {
      vscode.window.showErrorMessage(
        "Failed to create config file. Please report this problem.",
        _REPORT_PROBLEM_BUTTON
      ).then(_handlePopupClick);
      return;
    }

    vscode.workspace.fs.writeFile(configUriInfo.uri!, DEFAULT_CONFIG_CONTENT).then(() => {
      vscode.window.showTextDocument(configUriInfo.uri!);
      this.loadConfig();
    });

    // rootUri is guaranteed to be a URI because configUriInfo.uri is truthy
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri as vscode.Uri;
    vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "src"));
    vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "out"));

    vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(rootUri, "src", "default.stbl.json"),
      StringTableJson.generateRandomContent()
    );
  }

  /**
   * Loads the config (located at `~/s4tk.config.json`), saves it to the
   * workspace, and returns it. If it could not be loaded, and error is
   * displayed and undefined is returned.
   * 
   * @param options Options for loading the config
   */
  async loadConfig(options?: {
    showNoConfigError?: boolean;
  }): Promise<S4TKConfig | undefined> {
    delete this._config;

    const configUriInfo = await _findConfig();
    if (!(configUriInfo.uri && configUriInfo.exists)) {
      if (options?.showNoConfigError)
        vscode.window.showWarningMessage(
          "No 's4tk.config.json' file was found at the root of this project.",
          _CREATE_PROJECT_BUTTON
        ).then(_handlePopupClick);
      return undefined;
    }

    try {
      const content = await vscode.workspace.fs.readFile(configUriInfo.uri!);
      const config = parseConfig(content.toString());
      vscode.window.showInformationMessage('Successfully initialized S4TK workspace.');
      return this._config = config;
    } catch (err: any) {
      let errMsg = err;
      if (err instanceof SyntaxError) {
        errMsg = err.message;
      } else if (err instanceof ValidationError) {
        errMsg = err.stack;
      }

      vscode.window.showErrorMessage(
        `Could not validate S4TK config. You will not be able to build your project until all errors are resolved and the config has been reloaded. (${errMsg})`,
        _GET_HELP_BUTTON,
        _RELOAD_CONFIG_BUTTON
      ).then(_handlePopupClick);

      return undefined;
    }
  }

  /**
   * TODO:
   * 
   * @param stblUri TODO:
   */
  async setDefaultStbl(stblUri: vscode.Uri) {
    if (!this._config) {
      vscode.window.showErrorMessage(
        'Cannot set this STBL as default because no S4TK config is currently loaded.',
        _RELOAD_CONFIG_BUTTON
      ).then(_handlePopupClick);
      return;
    }

    // FIXME: make paths relative?
    if (!this._config.stringTables) {
      this._config.stringTables = {
        defaultPath: stblUri.fsPath
      };
    } else {
      this._config.stringTables.defaultPath = stblUri.fsPath;
    }

    const configUri = (await _findConfig()).uri;
    // FIXME: check that uri is not null
    const configContent = stringifyConfig(this._config);
    // FIXME: what if document is dirty? it will cause issues...
    vscode.workspace.fs.writeFile(configUri!, Buffer.from(configContent));
  }

  //#endregion
}

//#region Exports

const S4TKWorkspace = new _S4TKWorkspace();
export default S4TKWorkspace;

//#endregion

//#region Helpers

const _GET_HELP_BUTTON = "Get Help";
const _REPORT_PROBLEM_BUTTON = "Report Problem";
const _RELOAD_CONFIG_BUTTON = "Reload Config";
const _CREATE_PROJECT_BUTTON = "Create S4TK Project";

async function _findConfig(): Promise<{
  uri?: vscode.Uri;
  exists: boolean;
}> {
  const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!rootUri) return { exists: false };
  const uri = vscode.Uri.joinPath(rootUri, CONFIG_FILENAME);
  const exists = await fileExists(uri);
  return { uri, exists };
}

function _handlePopupClick(button: string | undefined) {
  switch (button) {
    case _GET_HELP_BUTTON:
    case _REPORT_PROBLEM_BUTTON:
      _launchContactLink();
      break;
    case _RELOAD_CONFIG_BUTTON:
      S4TKWorkspace.loadConfig({ showNoConfigError: true });
      break;
    case _CREATE_PROJECT_BUTTON:
      S4TKWorkspace.createDefaultProject();
      break;
  }
}

function _launchContactLink() {
  vscode.env.openExternal(vscode.Uri.parse('https://frankkmods.com/#/contact'));
}

//#endregion
