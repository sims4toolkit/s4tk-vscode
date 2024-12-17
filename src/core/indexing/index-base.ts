import * as glob from "glob";
import * as vscode from "vscode";
import { resolveGlobPattern } from "#helpers/fs";

/**
 * Keeps track of files of a specific type within a workspace.
 */
export default abstract class IndexBase implements vscode.Disposable {
  private _watcherDisposables: vscode.Disposable[] = [];

  //#region Lifecycle

  constructor(
    private readonly _globPatterns: string[],
    private _sourceFolder: vscode.Uri | undefined
  ) {
    this._startFsWatchers();
  }

  dispose() {
    this._teardownFsWatchers();
  }

  //#endregion

  //#region Public Methods

  /**
   * Clears all data in the index and re-indexes the source folder.
   */
  refresh() {
    this._clearIndex();
    this._indexSourceFolder();
  }

  /**
   * Replaces the source folder and refreshes the index.
   * 
   * @param uri URI to new source folder
   */
  updateSourceFolder(uri: vscode.Uri) {
    this._teardownFsWatchers();
    this._sourceFolder = uri;
    this._startFsWatchers();
    this.refresh();
  }

  //#endregion

  //#region Protected Abstract Helpers

  protected abstract _clearIndex(): void;

  protected abstract _onFileChanged(uri: vscode.Uri): void;

  protected abstract _onFileCreated(uri: vscode.Uri): void;

  protected abstract _onFileDeleted(uri: vscode.Uri): void;

  protected abstract _shouldIndexFile(filepath: string): boolean;

  protected abstract _indexFile(uri: vscode.Uri): void;

  //#endregion

  //#region Private Helpers

  private async _indexSourceFolder() {
    if (!this._sourceFolder) return;
    for (const globPattern of this._globPatterns) {
      const resolvedPattern = resolveGlobPattern(this._sourceFolder, globPattern);
      glob.sync(resolvedPattern).forEach(filepath => {
        try {
          if (!this._shouldIndexFile(filepath)) return;
          const uri = vscode.Uri.file(filepath);
          this._indexFile(uri);
        } catch (e) {
          console.error(`Error while indexing '${filepath}':\n${e}`);
        }
      });
    }
  }

  private _startFsWatchers() {
    if (!this._sourceFolder) return;
    for (const globPattern of this._globPatterns) {
      const fsPattern = new vscode.RelativePattern(this._sourceFolder, globPattern);
      const watcher = vscode.workspace.createFileSystemWatcher(fsPattern);
      watcher.onDidChange(e => this._onFileChanged(e), this, this._watcherDisposables);
      watcher.onDidCreate(e => this._onFileCreated(e), this, this._watcherDisposables);
      watcher.onDidDelete(e => this._onFileDeleted(e), this, this._watcherDisposables);
      this._watcherDisposables.push(watcher);
    }
  }

  private _teardownFsWatchers() {
    while (this._watcherDisposables.length)
      this._watcherDisposables.pop()?.dispose();
  }

  //#endregion
}
