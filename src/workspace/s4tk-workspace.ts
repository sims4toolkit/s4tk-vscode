import * as vscode from "vscode";
import { ValidationError } from "jsonschema";
import { CONFIG_FILENAME, DEFAULT_CONFIG_CONTENT, S4TKConfig, parseConfig } from "@models/s4tk-config";
import { fileExists } from "@helpers/utils";
import StringTableJson from "@models/stbl-json";

interface LoadConfigOptions {
  showNoConfigError?: boolean;
}

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
    const configUriInfo = await this._findConfig();
    if (configUriInfo.exists) {
      vscode.window.showWarningMessage("S4TK config file already exists.");
      return;
    } else if (!configUriInfo.uri) {
      const reportProblem = "Report Problem";
      vscode.window.showErrorMessage(
        "Failed to create config file. Please report this problem.",
        reportProblem
      ).then((message) => {
        if (message === reportProblem)
          this._launchContactLink();
      });
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
  async loadConfig(options?: LoadConfigOptions): Promise<S4TKConfig | undefined> {
    delete this._config;

    const configUriInfo = await this._findConfig();
    if (!(configUriInfo.uri && configUriInfo.exists)) {
      if (options?.showNoConfigError)
        vscode.window.showWarningMessage("No 's4tk.config.json' file was found at the root of this project.");
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

      const getHelp = 'Get Help';
      const reload = 'Reload Config';
      vscode.window.showErrorMessage(
        `Could not validate S4TK config. You will not be able to build your project until all errors are resolved and the config has been reloaded. (${errMsg})`,
        getHelp,
        reload
      ).then((message) => {
        if (message === getHelp)
          this._launchContactLink();
        else if (message === reload)
          this.loadConfig({ showNoConfigError: true });
      });

      return undefined;
    }
  }

  //#endregion

  //#region Private Methods

  private async _findConfig(): Promise<{
    uri?: vscode.Uri;
    exists: boolean;
  }> {
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!rootUri) return { exists: false };
    const uri = vscode.Uri.joinPath(rootUri, CONFIG_FILENAME);
    const exists = await fileExists(uri);
    return { uri, exists };
  }

  private _launchContactLink() {
    vscode.env.openExternal(vscode.Uri.parse('https://frankkmods.com/#/contact'));
  }

  //#endregion
}

const S4TKWorkspace = new _S4TKWorkspace();
export default S4TKWorkspace;
