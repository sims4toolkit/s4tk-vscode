import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import S4TKAssets from "#assets";
import { findOpenDocument, replaceEntireDocument, resolveGlobPattern } from "#helpers/fs";
import { S4TKSettings } from "#helpers/settings";
import ResourceIndex from "#indexing/resource-index";
import { S4TKConfig } from "#workspace/s4tk-config";
import StringTableJson from "#stbls/stbl-json";
import { MessageButton, handleMessageButtonClick } from "./messaging";

/**
 * A model for a single workspace folder that contains an S4TK project.
 */
export default class S4TKWorkspace implements vscode.Disposable {
  private static readonly _blankConfig: S4TKConfig = S4TKConfig.blankProxy();
  private _activeConfig?: S4TKConfig;
  private _index: ResourceIndex;
  private _disposables: vscode.Disposable[] = [];
  private _isSavingConfig = false;
  get config(): S4TKConfig { return this._activeConfig ?? S4TKWorkspace._blankConfig; }
  get active(): boolean { return Boolean(this._activeConfig); }
  get index(): ResourceIndex { return this._index; }

  constructor(
    public readonly rootUri: vscode.Uri,
    private readonly _onConfigChange: () => void,
  ) {
    this.loadConfig({ showNoConfigError: false });
    this._index = new ResourceIndex(undefined);
    this._disposables.push(this._index);
    this._startFsWatcher();
  }

  dispose() {
    while (this._disposables.length)
      this._disposables.pop()?.dispose();
  }

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
   * Generates an S4TK config at the project root. Returns true if one was
   * created successfully.
   * 
   * @param show Whether or not to show the document when it's created
   */
  async createConfig(show: boolean): Promise<boolean> {
    const configInfo = S4TKConfig.find(this.rootUri);
    if (configInfo.exists) {
      vscode.window.showWarningMessage("S4TK config file already exists.");
      return false;
    }

    const configData = await vscode.workspace.fs.readFile(S4TKAssets.samples.config);

    vscode.workspace.fs.writeFile(configInfo.uri, configData).then(() => {
      this.loadConfig();
      if (show) vscode.window.showTextDocument(configInfo.uri);
    });

    return true;
  }

  /**
   * Generates a sample S4TK project, including a config.
   */
  async createDefaultWorkspace() {
    if (!(await this.createConfig(false))) return;

    const createDir = (...segments: string[]) =>
      vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(this.rootUri, ...segments)
      );

    createDir("out");
    createDir("src");
    createDir("src", "strings");
    createDir("src", "tuning");
    createDir("src", "packages");

    const createFile = async (contentSource: vscode.Uri | Buffer, ...destination: string[]) => {
      const uri = vscode.Uri.joinPath(this.rootUri, ...destination);
      if (!fs.existsSync(uri.fsPath)) {
        const content = contentSource instanceof Buffer
          ? contentSource
          : await vscode.workspace.fs.readFile(contentSource);
        await vscode.workspace.fs.writeFile(uri, content);
      }
      return uri;
    };

    const { samples } = S4TKAssets;
    createFile(samples.readme, "HowToUseS4TK.md").then((uri) => {
      vscode.window.showTextDocument(uri);
    });

    createFile(samples.gitignore, ".gitignore");
    createFile(samples.package, "src", "packages", "sample.package");
    createFile(samples.tuning, "src", "tuning", "buff_Example.xml");
    createFile(samples.simdata, "src", "tuning", "buff_Example.SimData.xml");
    createFile(samples.stbl, "src", "strings", "sample.stbl");

    const stblJson = StringTableJson.generate();
    JSON.parse((await vscode.workspace.fs.readFile(samples.stblJsonStrings)).toString()
    ).forEach((value: string) => stblJson.addEntry({ value }));
    stblJson.insertDefaultMetadata();
    const stblBuffer = Buffer.from(stblJson.stringify());
    createFile(stblBuffer, "src", "strings", "default.stbl.json");
  }

  /**
   * Loads the config into the workspace if it exists and is valid. If it does
   * not exist or is not valid, then the config becomes unloaded.
   * 
   * @param showNoConfigError Whether or not to display an error to the user
   * if there is no config to load
   */
  async loadConfig({ showNoConfigError = false }: { showNoConfigError?: boolean; } = {}) {
    const configInfo = S4TKConfig.find(this.rootUri);
    if (!configInfo.exists) {
      if (showNoConfigError) vscode.window.showWarningMessage(
        "No S4TK config file was found at the root of this workspace.",
        MessageButton.CreateProject,
      ).then(handleMessageButtonClick);
      this._setConfig(undefined);
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(configInfo.uri);
      const config = S4TKConfig.parse(content.toString());
      if (S4TKSettings.get("showConfigLoadedMessage"))
        vscode.window.showInformationMessage("Successfully loaded S4TK config.");
      this._setConfig(config);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Could not validate S4TK config. You will not be able to build your project until all errors are resolved and the config has been reloaded. [${e}]`,
        MessageButton.GetHelp,
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
      this._setConfig(undefined);
    }
  }

  /**
   * Resolves a path that is either absolute or relative to the root URI of this
   * workspace. 
   * 
   * @param relativePath Relative path to resolve
   * @param isGlob Whether or not this is for a glob pattern
   */
  resolvePath(relativePath: string, isGlob: boolean = false): string {
    // FIXME: unsure if this is correct
    if (isGlob) {
      return resolveGlobPattern(this.rootUri, relativePath);
    } else {
      return path.isAbsolute(relativePath)
        ? path.normalize(relativePath)
        : path.resolve(this.rootUri.fsPath, relativePath);
    }
  }

  /**
   * Sets the STBL at the given URI as the default STBL for this project.
   * 
   * @param stblUri URI of the string table to set as default
   */
  async setDefaultStbl(stblUri: vscode.Uri) {
    await this._tryEditAndSaveConfig("Set Default STBL", null, (config) => {
      config.stringTableSettings.defaultStringTable =
        path.relative(this.rootUri.fsPath, stblUri.fsPath);
    });
  }

  /**
   * Attempts to save the given document and then reload the config.
   * 
   * @param document Document to save before reloading the config
   */
  async trySaveConfigAndReload(document: vscode.TextDocument) {
    if (this._isSavingConfig || !document.isDirty) return;
    this._isSavingConfig = true;
    await document.save();
    await this.loadConfig();
    this._isSavingConfig = false;
  }

  //#endregion

  //#region Private Methods

  private _checkForSourceChange(oldSrc: string | undefined, newSrc: string | undefined) {
    if (oldSrc) {
      if (newSrc) {
        const oldResolved = path.resolve(this.rootUri.fsPath, oldSrc);
        const newResolved = path.resolve(this.rootUri.fsPath, newSrc);
        if (oldResolved !== newResolved)
          this._index.updateSourceFolder(vscode.Uri.file(newResolved));
      }

      // intentionally not clearing index if newSrc is falsey, config might have
      // a syntax error but the source is the same as before
    } else if (newSrc) {
      const newResolved = path.resolve(this.rootUri.fsPath, newSrc);
      this._index.updateSourceFolder(vscode.Uri.file(newResolved));
    }
  }

  private _setConfig(config: S4TKConfig | undefined) {
    const getIndexRoot = (config?: S4TKConfig) =>
      config?.workspaceSettings.overrideIndexRoot
        ? config.workspaceSettings.overrideIndexRoot
        : config?.buildInstructions.source;

    this._checkForSourceChange(
      getIndexRoot(this._activeConfig),
      getIndexRoot(config)
    );

    this._activeConfig = config;
    this._onConfigChange();
  }

  private _startFsWatcher() {
    const pattern = new vscode.RelativePattern(this.rootUri, "s4tk.config.json");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(_ => this.loadConfig(), this, this._disposables);
    watcher.onDidChange(_ => {
      if (!this._isSavingConfig) this.loadConfig();
    }, this, this._disposables);
    watcher.onDidDelete(_ => {
      this._setConfig(undefined);
      if (S4TKSettings.get("showConfigUnloadedMessage"))
        vscode.window.showWarningMessage("S4TK config has been unloaded.");
    }, this, this._disposables);
    this._disposables.push(watcher);
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

    const configUri = S4TKConfig.find(this.rootUri).uri;
    const openConfigDocument = editor?.document ?? findOpenDocument(configUri);
    if (openConfigDocument)
      await this.trySaveConfigAndReload(openConfigDocument);

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