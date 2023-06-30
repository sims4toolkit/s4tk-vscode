import * as vscode from "vscode";
import { sync as globSync } from "glob";
import { resolveGlobPattern } from "#helpers/fs";
import type { TuningMetadata } from "./types";
import { inferTuningMetadata } from "./inference";

/**
 * Keeps track of all resources within a workspace's source folder.
 */
export default class ResourceIndex implements vscode.Disposable {
  private _watcherDisposables: vscode.Disposable[] = [];
  private _pathsToDefinitions = new Map<string, TuningMetadata>();
  private _instancesToPaths = new Map<string, string>();

  //#region Lifecycle

  constructor(private _sourceFolder?: vscode.Uri) {
    this._startFsWatcher();
  }

  dispose() {
    this._teardownFsWatcher();
  }

  //#endregion

  //#region Public Methods

  /**
   * Replaces the source folder and refreshes the index.
   * 
   * @param uri URI to new source folder
   */
  updateSourceFolder(uri: vscode.Uri) {
    this._teardownFsWatcher();
    this._sourceFolder = uri;
    this._startFsWatcher();
    this.refresh();
  }

  /**
   * Returns info about the tuning file at the given URI, if it exists.
   * 
   * @param uri URI of tuning to get definition for
   */
  getMetadataFromUri(uri: vscode.Uri): TuningMetadata | undefined {
    return this._pathsToDefinitions.get(uri.fsPath);
  }

  /**
   * Returns info about the tuning file with the given ID, if it exists.
   * 
   * @param id String representation of the decimal tuning ID
   */
  getMetadataFromId(id: string): TuningMetadata | undefined {
    const fsPath = this._instancesToPaths.get(id);
    if (fsPath) return this._pathsToDefinitions.get(fsPath);
  }

  /**
   * Clears all data in the index and re-indexes the source folder.
   */
  refresh() {
    this._clearIndex();
    this._indexSourceFolder();
  }

  //#endregion

  //#region Private Helpers

  private _clearIndex() {
    this._pathsToDefinitions.clear();
    this._instancesToPaths.clear();
  }

  private async _indexSourceFolder() {
    if (!this._sourceFolder) return;
    const pattern = resolveGlobPattern(this._sourceFolder, "**/*.xml");
    globSync(pattern).forEach(filepath => {
      if (filepath.endsWith(".SimData.xml")) return;
      const uri = vscode.Uri.file(filepath);
      const metadata = inferTuningMetadata(uri);
      this._pathsToDefinitions.set(uri.fsPath, metadata);
      if (metadata.attrs?.s)
        this._instancesToPaths.set(metadata.attrs.s, uri.fsPath);
    });
  }

  private _updateFile(uri: vscode.Uri) {
    if (uri.fsPath.endsWith(".SimData.xml")) return;
    const oldId = this._pathsToDefinitions.get(uri.fsPath)?.attrs?.s;
    if (oldId && this._instancesToPaths.has(oldId))
      this._instancesToPaths.delete(oldId);
    const metadata = inferTuningMetadata(uri);
    this._pathsToDefinitions.set(uri.fsPath, metadata);
    if (metadata.attrs?.s)
      this._instancesToPaths.set(metadata.attrs.s, uri.fsPath);
  }

  private _removeFile(uri: vscode.Uri) {
    const definition = this._pathsToDefinitions.get(uri.fsPath);
    if (!definition) return;
    this._pathsToDefinitions.delete(uri.fsPath);
    if (definition.attrs?.s == undefined) return;
    this._instancesToPaths.delete(definition.attrs.s);
  }

  private _startFsWatcher() {
    if (!this._sourceFolder) return;
    const pattern = new vscode.RelativePattern(this._sourceFolder, "**/*.xml");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(e => this._updateFile(e), this, this._watcherDisposables);
    watcher.onDidCreate(e => this._updateFile(e), this, this._watcherDisposables);
    watcher.onDidDelete(e => this._removeFile(e), this, this._watcherDisposables);
    this._watcherDisposables.push(watcher);
  }

  private _teardownFsWatcher() {
    while (this._watcherDisposables.length)
      this._watcherDisposables.pop()?.dispose();
  }

  //#endregion
}
