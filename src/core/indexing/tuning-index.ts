import * as vscode from "vscode";
import { sanitizeXmlComment } from "#helpers/xml";
import { inferKeyFromMetadata, inferTuningMetadata } from "./inference";
import { TuningMetadata } from "./types";
import IndexBase from "./index-base";

/**
 * Keeps track of tuning files within a workspace.
 */
export default class TuningIndex extends IndexBase {
  private _pathsToDefinitions = new Map<string, TuningMetadata>();
  private _instancesToPaths = new Map<string, string[]>();

  //#region Lifecycle

  constructor(sourceFolder?: vscode.Uri) {
    super(["**/*.xml"], sourceFolder);
  }

  //#endregion

  //#region Public Methods

  /**
   * Returns a list of all metadata for every tracked tuning file.
   */
  getAllFileMetadata(): TuningMetadata[] {
    return [...this._pathsToDefinitions.values()];
  }

  /**
   * Returns info about the tuning file at the given URI, if it exists.
   * 
   * @param uri URI of tuning to get definition for
   */
  getMetadataFromUri(uri: vscode.Uri | string): TuningMetadata | undefined {
    const fsPath = typeof uri === "string" ? uri : uri.fsPath;
    return this._pathsToDefinitions.get(fsPath);
  }

  /**
   * Returns info about the tuning file with the given ID, if it exists.
   * 
   * @param id String representation of the decimal tuning ID
   */
  getMetadataFromId(id: string): TuningMetadata | undefined {
    const fsPaths = this._instancesToPaths.get(id);
    if (fsPaths?.length) return this._pathsToDefinitions.get(fsPaths[0]);
  }

  /**
   * Returns the ID and name of the tuning file at the given URI, if it exists,
   * as a string containing value and comment XML nodes, i.e.
   * `12345<!--some_file-->`.
   * 
   * @param uri URI of tuning file to get reference for
   */
  getTuningReference(uri: vscode.Uri): string | undefined {
    const metadata = this.getMetadataFromUri(uri);
    if (!metadata) return;
    const key = inferKeyFromMetadata(metadata);
    if (key.key.instance == undefined) return;
    return metadata.attrs?.n
      ? `${key.key.instance}<!--${sanitizeXmlComment(metadata.attrs?.n)}-->`
      : key.key.instance.toString();
  }

  /**
   * Returns `true` if there is more than one file associated with the given ID,
   * and `false` otherwise.
   * 
   * @param id ID to check for repeats
   */
  isIdRepeated(id: string): boolean {
    const fsPaths = this._instancesToPaths.get(id);
    return fsPaths ? Boolean(fsPaths.length > 1) : false;
  }

  //#endregion

  //#region Implemented Abstract Methods

  protected _clearIndex() {
    this._pathsToDefinitions.clear();
    this._instancesToPaths.clear();
  }

  protected _onFileChanged(uri: vscode.Uri) {
    this._onFileUpdated(uri);
  }

  protected _onFileCreated(uri: vscode.Uri) {
    this._onFileUpdated(uri);
  }

  protected _onFileDeleted(uri: vscode.Uri) {
    const definition = this._pathsToDefinitions.get(uri.fsPath);
    if (!definition) return;
    this._pathsToDefinitions.delete(uri.fsPath);
    if (definition.attrs?.s == undefined) return;
    this._onIdRemoved(definition.attrs.s, uri.fsPath);
  }

  protected _shouldIndexFile(filepath: string): boolean {
    return !filepath.endsWith(".SimData.xml");
  }

  protected _indexFile(uri: vscode.Uri): void {
    const metadata = inferTuningMetadata(uri);
    this._pathsToDefinitions.set(uri.fsPath, metadata);
    if (metadata.attrs?.s) this._onIdAdded(metadata.attrs.s, uri.fsPath);
  }

  //#endregion

  //#region Private Methods

  private _onFileUpdated(uri: vscode.Uri) {
    if (uri.fsPath.endsWith(".SimData.xml")) return;
    const oldId = this._pathsToDefinitions.get(uri.fsPath)?.attrs?.s;
    if (oldId && this._instancesToPaths.has(oldId))
      this._onIdRemoved(oldId, uri.fsPath);
    const metadata = inferTuningMetadata(uri);
    this._pathsToDefinitions.set(uri.fsPath, metadata);
    if (metadata.attrs?.s) this._onIdAdded(metadata.attrs.s, uri.fsPath);
  }

  private _onIdAdded(id: string, filepath: string) {
    if (this._instancesToPaths.has(id)) {
      this._instancesToPaths.get(id)!.push(filepath);
    } else {
      this._instancesToPaths.set(id, [filepath]);
    }
  }

  private _onIdRemoved(id: string, filepath: string) {
    if (this._instancesToPaths.has(id)) {
      const fsPaths = this._instancesToPaths.get(id)!;
      if (fsPaths.length === 1) {
        this._instancesToPaths.delete(id);
      } else {
        const index = fsPaths.indexOf(filepath);
        if (index >= 0) fsPaths.splice(index, 1);
      }
    }
  }

  //#endregion
}
