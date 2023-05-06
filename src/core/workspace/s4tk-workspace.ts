import * as vscode from "vscode";
import { CONTEXT, FILENAME } from "#constants";
import { S4TKConfig } from "#models/s4tk-config";
import { findOpenDocument } from "#helpers/fs";
import { MessageButton, handleMessageButtonClick } from "./messaging";

class _S4TKWorkspace {
  //#region Properties

  private _isSavingDocument: boolean = false;

  private _config?: S4TKConfig;
  get config() { return this._config; }
  private set config(config: S4TKConfig | undefined) {
    this._config = config;
    vscode.commands.executeCommand(
      'setContext',
      CONTEXT.workspace.active,
      this.active
    );
  }

  get active() { return Boolean(this._config); }

  //#endregion

  //#region Public Methods

  /**
   * Does setup work for the S4TK workspace.
   */
  activate() {
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (this._isSavingDocument) return;
      if (document.fileName.endsWith(FILENAME.config)) this.loadConfig();
    });

    vscode.workspace.onDidDeleteFiles((e) => {
      if (!this.active) return;
      if (e.files.some(uri => uri.path.endsWith(FILENAME.config))) {
        this.config = undefined;
        vscode.window.showWarningMessage("S4TK config has been unloaded.");
      }
    });

    this.loadConfig();
  }

  /**
   * Attempts to save the given document and then reload the config.
   * 
   * @param document Document to save before reloading the config
   */
  async trySaveDocumentAndReload(document: vscode.TextDocument) {
    if (this._isSavingDocument || !document.isDirty) return;
    this._isSavingDocument = true;
    await document.save();
    await this.loadConfig();
    this._isSavingDocument = false;
  }

  /**
   * Loads the config into the workspace if it exists and is valid. If it does
   * not exist or is not valid, then the config becomes unloaded.
   * 
   * @param showNoConfigError Whether or not to display an error to the user
   * if there is no config to load
   */
  async loadConfig({ showNoConfigError = false }: { showNoConfigError?: boolean; } = {}) {
    // do not use _config or delete; must use setter to trigger context change
    this.config = undefined;

    const configInfo = await S4TKConfig.find();
    if (!(configInfo.uri && configInfo.exists)) {
      if (showNoConfigError)
        vscode.window.showWarningMessage(
          "No 's4tk.config.json' file was found at the root of this project.",
          MessageButton.CreateProject,
        ).then(handleMessageButtonClick);
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(configInfo.uri!);
      const config = S4TKConfig.parse(content.toString());
      vscode.window.showInformationMessage('Successfully loaded S4TK config.');
      // do not use _config; must use setter to trigger context change
      this.config = config;
    } catch (e) {
      vscode.window.showErrorMessage(
        `Could not validate S4TK config. You will not be able to build your project until all errors are resolved and the config has been reloaded. (${e})`,
        MessageButton.GetHelp,
        MessageButton.ReloadConfig,
      ).then(handleMessageButtonClick);
    }
  }

  /**
   * Sets the STBL at the given URI as the default STBL for this project.
   * 
   * @param stblUri URI of the string table to set as default
   */
  async setDefaultStbl(stblUri: vscode.Uri) {
    const configUri = await this._ensureConfigIsEditable('Set Default STBL');
    if (!(this.config && configUri)) return;

    S4TKConfig.modify(this.config, (original) => {
      //@ts-ignore Ok to leave blank, proxy takes care of defaults
      original.stringTables ??= {};
      original.stringTables.defaultPath = stblUri.fsPath;
    });

    const buffer = Buffer.from(S4TKConfig.stringify(this.config))
    vscode.workspace.fs.writeFile(configUri, buffer);
  }

  //#endregion

  //#region Private Methods

  private async _ensureConfigIsEditable(action: string): Promise<vscode.Uri | undefined> {
    if (!this._config) {
      vscode.window.showErrorMessage(
        `Cannot perform '${action}' because no S4TK config is currently loaded.`,
        MessageButton.ReloadConfig,
      ).then(handleMessageButtonClick);
      return undefined;
    }

    const configUri = (await S4TKConfig.find()).uri;
    if (!configUri) {
      vscode.window.showErrorMessage(
        `Cannot perform '${action}' because no S4TK config could be located. Please report this problem.`,
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
      return undefined;
    }

    const openConfigDocument = findOpenDocument(configUri);
    if (openConfigDocument)
      await this.trySaveDocumentAndReload(openConfigDocument);

    if (!this._config) {
      vscode.window.showErrorMessage(
        `Your S4TK config file was automatically saved before performing '${action}', and these changes have made it invalid. You must fix your config file and reload it before trying '${action}' again.`,
        MessageButton.ReloadConfig,
      ).then(handleMessageButtonClick);
      return undefined;
    }

    return configUri;
  }

  //#endregion
}

const S4TKWorkspace = new _S4TKWorkspace();
export default S4TKWorkspace;
