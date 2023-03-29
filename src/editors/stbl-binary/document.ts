import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import { Disposable } from '@helpers/dispose';
import type { StringTableEdit } from './types';

/**
 * Document containing binary STBL data.
 */
export default class StringTableDocument extends Disposable implements vscode.CustomDocument {
  //#region Properties

  private readonly _uri: vscode.Uri;
  private _edits: StringTableEdit[] = [];
  private _savedEdits: StringTableEdit[] = [];
  private _stbl: StringTableResource;

  public get stbl(): StringTableResource { return this._stbl; }
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

  private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
    readonly content?: Uint8Array;
    readonly edits: readonly StringTableEdit[];
  }>());
  public readonly onDidChangeContent = this._onDidChangeDocument.event;

  private readonly _onDidChange = this._register(new vscode.EventEmitter<{
    readonly label: string,
    undo(): void,
    redo(): void,
  }>());
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Called by VS Code to backup the edited document.
   *
   * These backups are used to implement hot exit.
   */
  async backup(
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination, cancellation);

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
   * Called by VS Code when the user calls `revert` on a document.
   */
  async revert(_cancellation: vscode.CancellationToken): Promise<void> {
    const diskContent = await StringTableDocument._readFile(this.uri);
    this._stbl = StringTableResource.from(Buffer.from(diskContent));
    this._edits = this._savedEdits;
    this._onDidChangeDocument.fire({
      content: diskContent,
      edits: this._edits,
    });
  }

  /**
   * Called by VS Code when the user saves the document.
   */
  async save(cancellation: vscode.CancellationToken): Promise<void> {
    await this.saveAs(this.uri, cancellation);
    this._savedEdits = Array.from(this._edits);
  }

  /**
   * Called by VS Code when the user saves the document to a new location.
   */
  async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    const fileData = this._stbl.getBuffer();
    if (cancellation.isCancellationRequested) return;
    await vscode.workspace.fs.writeFile(targetResource, fileData);
  }

  //#endregion

  //#region Public Methods

  /**
   * Called when the user edits the document in a webview.
   *
   * This fires an event to notify VS Code that the document has been edited.
   */
  makeEdit(edit: StringTableEdit) {
    this._edits.push(edit);

    switch (edit.op) {
      case "create": {
        this._stbl.add(0, "");
        break;
      }
      case "update": {
        const entry = this._stbl.get(edit.id);
        // FIXME: error handling in case can't parse
        if (edit.key !== undefined) entry.key = parseInt(edit.key, 16);
        if (edit.value !== undefined) entry.value = edit.value;
        break;
      }
      case "delete": {
        this._stbl.delete(edit.id);
        break;
      }
    }

    this._onDidChange.fire({
      label: edit.op,
      undo: async () => {
        this._edits.pop();
        // FIXME: actually undo change?
        this._onDidChangeDocument.fire({
          edits: this._edits,
        });
      },
      redo: async () => {
        this._edits.push(edit);
        // FIXME: actually undo change?
        this._onDidChangeDocument.fire({
          edits: this._edits,
        });
      }
    });
  }

  //#endregion

  //#region Private Methods

  private static async _readFile(uri: vscode.Uri): Promise<Uint8Array> {
    if (uri.scheme === 'untitled') return new Uint8Array();
    return await vscode.workspace.fs.readFile(uri);
  }

  //#endregion
}
