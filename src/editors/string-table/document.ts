import * as vscode from 'vscode';
import { Disposable } from '@helpers/dispose';
import type { StringTableEdit } from './types';

interface StringTableDocumentDelegate {
  getFileData(): Promise<Uint8Array>;
}

/**
 * Document containing binary STBL data.
 */
export default class StringTableDocument extends Disposable implements vscode.CustomDocument {
  //#region Properties

  private readonly _delegate: StringTableDocumentDelegate;
  private _documentData: Uint8Array;
  private _edits: StringTableEdit[] = [];
  private _savedEdits: StringTableEdit[] = [];
  private readonly _uri: vscode.Uri;
  // TODO: stbl

  public get documentData(): Uint8Array { return this._documentData; }
  public get uri() { return this._uri; }

  //#endregion

  //#region Initialization

  private constructor(
    uri: vscode.Uri,
    initialContent: Uint8Array,
    delegate: StringTableDocumentDelegate
  ) {
    super();
    this._uri = uri;
    this._documentData = initialContent;
    this._delegate = delegate;
  }

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    delegate: StringTableDocumentDelegate,
  ): Promise<StringTableDocument | PromiseLike<StringTableDocument>> {
    // If we have a backup, read that. Otherwise read the resource from the workspace
    const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
    const fileData = await StringTableDocument._readFile(dataFile);
    return new StringTableDocument(uri, fileData, delegate);
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
    this._documentData = diskContent;
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
    const fileData = await this._delegate.getFileData();
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

    this._onDidChange.fire({
      label: 'Stroke',
      undo: async () => {
        this._edits.pop();
        this._onDidChangeDocument.fire({
          edits: this._edits,
        });
      },
      redo: async () => {
        this._edits.push(edit);
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
    return new Uint8Array(await vscode.workspace.fs.readFile(uri));
  }

  //#endregion
}
