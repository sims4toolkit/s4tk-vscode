import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import { Disposable } from '@helpers/dispose';
import StringTableJson from '@models/stbl-json';
import { fileExists } from '@helpers/utils';

/**
 * Document containing binary STBL data.
 */
export default class StringTableDocument extends Disposable implements vscode.CustomDocument {
  //#region Properties

  private _stbl: StringTableResource;
  public get stbl(): StringTableResource { return this._stbl; }

  private readonly _uri: vscode.Uri;
  public get uri() { return this._uri; }

  //#endregion

  //#region Initialization

  private constructor(uri: vscode.Uri, initialContent: Uint8Array) {
    super();
    this._uri = uri;
    this._stbl = StringTableResource.from(Buffer.from(initialContent));
  }

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined
  ): Promise<StringTableDocument | PromiseLike<StringTableDocument>> {
    const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
    const fileData = await StringTableDocument._readFile(dataFile);
    return new StringTableDocument(uri, fileData);
  }

  //#endregion

  //#region VSC Hooks

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  public readonly onDidDispose = this._onDidDispose.event;

  /**
   * Called by VS Code when there are no more references to the document.
   *
   * This happens when all editors for it have been closed.
   */
  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  /**
   * Called by VS Code to backup the edited document.
   *
   * These backups are used to implement hot exit.
   */
  async backup(
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch {
          // noop
        }
      }
    };
  }

  //#endregion

  //#region Public Methods

  /**
   * Converts this STBL to a JSON and writes it to the same directory that this
   * one is in. If the STBL JSON already exists, a warning is shown.
   */
  async convertToJson() {
    const uri = vscode.Uri.parse(this.uri.fsPath + ".json");

    if (await fileExists(uri)) {
      vscode.window.showWarningMessage(`STBL JSON already exists at ${uri.path}`);
      vscode.window.showTextDocument(uri);
    } else {
      const json = new StringTableJson(this.stbl.toJsonObject(true));
      const content = json.stringify();
      vscode.workspace.fs.writeFile(uri, Buffer.from(content)).then(() => {
        vscode.window.showTextDocument(uri);
      });
    }
  }

  //#endregion

  //#region Private Methods

  private static async _readFile(uri: vscode.Uri): Promise<Uint8Array> {
    if (uri.scheme === 'untitled') return new Uint8Array();
    return await vscode.workspace.fs.readFile(uri);
  }

  //#endregion
}
