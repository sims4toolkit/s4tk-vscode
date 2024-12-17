import * as fs from "fs";
import * as vscode from "vscode";
import { StringTableResource } from "@s4tk/models";
import { StringTableLocale } from "@s4tk/models/enums";
import { S4TKSettings } from "#helpers/settings";
import { parseKeyFromTgi } from "#helpers/file-names";
import StringTableJson from "#stbls/stbl-json";
import IndexBase from "./index-base";
import { StringMetadata, StringTableMetadata } from "./types";

const _FILE_PATTERNS = ["**/*.stbl", "**/*.stbl.json", "**/220557DA*.binary"];

/**
 * Keeps track of string table files within a workspace.
 */
export default class StringIndex extends IndexBase {
  private _locale: StringTableLocale = StringTableLocale.English;
  private readonly _keysToStrings = new Map<number, Set<StringMetadata>>();
  private readonly _filepathsToStbls = new Map<string, StringTableMetadata>();

  //#region Lifecycle

  constructor(sourceFolder?: vscode.Uri) {
    super(_FILE_PATTERNS, sourceFolder);
    this._setLocaleOrDefault(undefined);
  }

  //#endregion

  //#region Public Methods

  /**
   * Returns a list of all metadata for every tracked string.
   */
  getAllStringMetadata(): StringMetadata[] {
    const strings: StringMetadata[] = [];
    this._keysToStrings.forEach((set) => strings.push(...set));
    return strings;
  }

  /**
   * Returns a string with the given key. If given a second argument, then will
   * only return a string in the string table at the given URI.
   * 
   * @param key Key of string to get
   * @param stblUri Stbl that string must be in
   */
  getStringByKey(key: number, stblUri?: vscode.Uri): StringMetadata | undefined {
    const strings = this._keysToStrings.get(key);
    if (!strings) return;
    for (const stringData of strings.values()) {
      if (!stblUri || (stringData.stbl.uri.fsPath === stblUri.fsPath))
        return stringData;
    }
  }

  /**
   * Returns a list of all of the strings with the given key.
   * 
   * @param key Key of strings to get
   */
  getStringsByKey(key: number): StringMetadata[] {
    const strings = this._keysToStrings.get(key);
    if (!strings) return [];
    return [...strings.values()];
  }

  /**
   * Sets the locale of strings to index. If omitted, then the default locale
   * set in S4TK VS Code settings is used.
   * 
   * @param locale Locale to use
   */
  updateLocale(locale?: StringTableLocale) {
    this._setLocaleOrDefault(locale);
    this.refresh();
  }

  //#endregion

  //#region Implemented Abstract Methods

  protected _clearIndex(): void {
    this._keysToStrings.clear();
    this._filepathsToStbls.clear();
  }

  protected _onFileChanged(uri: vscode.Uri): void {
    this._updateStbl(uri);
  }

  protected _onFileCreated(uri: vscode.Uri): void {
    this._updateStbl(uri);
  }

  protected _onFileDeleted(uri: vscode.Uri): void {
    this._removeStbl(uri);
  }

  protected _shouldIndexFile(_: string): boolean {
    return true;
  }

  protected _indexFile(uri: vscode.Uri): void {
    this._updateStbl(uri);
  }

  //#endregion

  //#region Private Methods

  private _setLocaleOrDefault(locale: StringTableLocale | undefined) {
    this._locale = locale
      ?? StringTableLocale[S4TKSettings.get("defaultStringTableLocale")]
      ?? StringTableLocale.English;
  }

  private _updateStbl(uri: vscode.Uri) {
    const key = parseKeyFromTgi(uri.fsPath);
    if (key?.instance !== undefined) {
      const locale = StringTableLocale.getLocale(key.instance);
      if (locale !== this._locale) return;
    }

    if (!this._filepathsToStbls.has(uri.fsPath))
      this._filepathsToStbls.set(uri.fsPath, { uri });
    const data = this._filepathsToStbls.get(uri.fsPath)!;

    const buffer = fs.readFileSync(uri.fsPath);
    const magic = buffer.toString("utf8", 0, 4);

    if (magic === "STBL") {
      const stbl = StringTableResource.from(buffer);
      stbl.entries.forEach(({ key, value }) => this._addString(key, value, data));
    } else {
      const stbl = StringTableJson.parse(buffer.toString());
      if (stbl.locale !== undefined)
        if (StringTableLocale[stbl.locale] !== this._locale) return;
      stbl.forEach(({ key, value }) => this._addString(parseInt(key, 16), value, data));
    }
  }

  private _removeStbl(uri: vscode.Uri) {
    const stblData = this._filepathsToStbls.get(uri.fsPath);
    if (!stblData) return;
    this._filepathsToStbls.delete(uri.fsPath);
    const keysToDelete: number[] = [];
    this._keysToStrings.forEach((stringDatas, key) => {
      const stringsToDelete: StringMetadata[] = [];
      stringDatas.forEach(data => {
        if (data.stbl === stblData) stringsToDelete.push(data);
      });
      stringsToDelete.forEach(s => stringDatas.delete(s));
      if (stringDatas.size < 1) keysToDelete.push(key);
    });
    keysToDelete.forEach(k => this._keysToStrings.delete(k));
  }

  private _addString(key: number, value: string, stbl: StringTableMetadata) {
    // TODO: implement range for keys in stbl jsons
    if (!this._keysToStrings.has(key)) {
      this._keysToStrings.set(key, new Set());
    }

    const string = this.getStringByKey(key, stbl.uri);
    if (string) {
      string.key = key;
      string.value = value;
    } else {
      const strings = this._keysToStrings.get(key)!;
      strings.add({ key, value, stbl });
    }
  }

  //#endregion
}
