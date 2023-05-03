import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import { Disposable } from '@helpers/dispose';

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
   * TODO:
   */
  async convertToJson() {
    // TODO: implement
  }

  //#endregion

  //#region Private Methods

  private static async _readFile(uri: vscode.Uri): Promise<Uint8Array> {
    if (uri.scheme === 'untitled') return new Uint8Array();
    return await vscode.workspace.fs.readFile(uri);
  }

  //#endregion
}
