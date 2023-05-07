import * as vscode from "vscode";
import { SAMPLES } from "#assets";
import { CONTEXT, FILENAME } from "#constants";
import { fileExists, findOpenDocument, getRelativeToRoot, replaceEntireDocument } from "#helpers/fs";
import { S4TKConfig } from "#models/s4tk-config";
import StringTableJson from "#models/stbl-json";
import { MessageButton, handleMessageButtonClick } from "./messaging";

class _S4TKWorkspace {
  //#region Properties

  private _isSavingDocument: boolean = false;
  private _activeConfig?: S4TKConfig;
  private _blankConfig: S4TKConfig = S4TKConfig.blankProxy();
  get config(): S4TKConfig { return this._activeConfig ?? this._blankConfig; }
  get active() { return Boolean(this._activeConfig); }

  // aliases for workspace settings
  get defaultLocale() { return this.config.workspaceSettings.defaultLocale; };
  get defaultStringTable() { return this.config.workspaceSettings.defaultStringTable; };
  get newStringTableJsonType() { return this.config.workspaceSettings.newStringTableJsonType; };
  get newStringsToStartOfTable() { return this.config.workspaceSettings.newStringsToStartOfTable; };
  get showCopyConfirmationPopup() { return this.config.workspaceSettings.showCopyConfirmationPopup; };
  get showStblJsonMetaDataButton() { return this.config.workspaceSettings.showStblJsonMetaDataButton; };
  get showXmlKeyOverrideButtons() { return this.config.workspaceSettings.showXmlKeyOverrideButtons; };
  get spacesPerIndent() { return this.config.workspaceSettings.spacesPerIndent; };

  //#endregion

  //#region Activation

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
        this._setConfig();
        vscode.window.showWarningMessage("S4TK config has been unloaded.");
      }
    });

    this.loadConfig();
  }

  //#endregion

  //#region Public Methods

  /**
   * Inserts a new package instructions object to the build instructions of the
   * config, if it is loaded. If an editor is provided, then the editor will be
   * used to make the edit. If not, then it will be written straight to disk.
   */
  async addPackageInstructions(editor?: vscode.TextEditor) {
    await this._tryEditAndSaveConfig("Add Package", editor, (config) => {
      config.buildInstructions.packages.push({
        filename: `MyPackage${config.buildInstructions.packages.length + 1}`,
        include: ["**/*"],
      });
    });
  }

  /**
   * Generates the files needed for an S4TK project and loads the config.
   */
  async createDefaultWorkspace() {
    // confirm workspace doesn't already exist
    const configInfo = await S4TKConfig.find();
    if (configInfo.exists) {
      vscode.window.showWarningMessage("S4TK config file already exists.");
      return;
    } else if (!configInfo.uri) {
      vscode.window.showErrorMessage("Failed to locate URI for config file.");
      return;
    }

    const configData = await vscode.workspace.fs.readFile(SAMPLES.config);

    vscode.workspace.fs.writeFile(configInfo.uri, configData).then(() => {
      this.loadConfig();
    });

    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri as vscode.Uri;
    vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "out"));
    vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "src"));
    vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "src", "strings"));
    vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "src", "tuning"));

    const createFile = async (uri: vscode.Uri, contentSource: vscode.Uri | Buffer) => {
      if (!(await fileExists(uri))) {
        const content = contentSource instanceof Buffer
          ? contentSource
          : await vscode.workspace.fs.readFile(contentSource);

        await vscode.workspace.fs.writeFile(uri, content);
      }
    };

    const readmeUri = vscode.Uri.joinPath(rootUri, "HowToUseS4TK.md");
    createFile(readmeUri, SAMPLES.readme).then(() => {
      vscode.window.showTextDocument(readmeUri);
    });

    createFile(
      vscode.Uri.joinPath(rootUri, ".gitignore"),
      SAMPLES.gitignore
    );

    createFile(
      vscode.Uri.joinPath(rootUri, "src", "tuning", "buff_Example.xml"),
      SAMPLES.tuning
    );

    createFile(
      vscode.Uri.joinPath(rootUri, "src", "tuning", "buff_Example.SimData.xml"),
      SAMPLES.simdata
    );

    createFile(
      vscode.Uri.joinPath(rootUri, "src", "strings", "default.stbl.json"),
      StringTableJson.generateBuffer(
        this.newStringTableJsonType,
        this.defaultLocale,
        this.spacesPerIndent,
      )
    );
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
    this._setConfig();

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
      this._setConfig(config);
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
    await this._tryEditAndSaveConfig("Set Default STBL", null, (config) => {
      config.workspaceSettings.defaultStringTable =
        getRelativeToRoot(stblUri) ?? stblUri.fsPath;
    });
  }

  //#endregion

  //#region Private Methods

  private _setConfig(config?: S4TKConfig) {
    this._activeConfig = config;
    vscode.commands.executeCommand(
      'setContext',
      CONTEXT.workspace.active,
      this.active
    );
  }

  private async _tryEditAndSaveConfig(
    action: string,
    editor: vscode.TextEditor | undefined | null,
    fn: (config: S4TKConfig, configUri: vscode.Uri) => void
  ) {
    if (!this.active) {
      vscode.window.showErrorMessage(
        `Cannot perform '${action}' because no S4TK config is currently loaded.`,
        MessageButton.ReloadConfig,
      ).then(handleMessageButtonClick);
      return;
    }

    const configUri = (await S4TKConfig.find()).uri;
    if (!configUri) {
      vscode.window.showErrorMessage(
        `Cannot perform '${action}' because no S4TK config could be located. Please report this problem.`,
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
      return;
    }

    const openConfigDocument = editor?.document ?? findOpenDocument(configUri);
    if (openConfigDocument)
      await this.trySaveDocumentAndReload(openConfigDocument);

    if (!this._activeConfig) {
      vscode.window.showErrorMessage(
        `Your S4TK config file was automatically saved before performing '${action}', and these changes have made it invalid. You must fix your config file and reload it before trying '${action}' again.`,
        MessageButton.ReloadConfig,
      ).then(handleMessageButtonClick);
      return undefined;
    }

    S4TKConfig.modify(this._activeConfig, (config) => fn(config, configUri));
    const newContent = S4TKConfig.stringify(this._activeConfig);
    if (!(editor && await replaceEntireDocument(editor, newContent, true)))
      vscode.workspace.fs.writeFile(configUri, Buffer.from(newContent));
  }

  //#endregion
}

/**
 * Manages the state of the S4TK workspace, including the config.
 */
const S4TKWorkspace = new _S4TKWorkspace();
export default S4TKWorkspace;
