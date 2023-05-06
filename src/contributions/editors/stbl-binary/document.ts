import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import StringTableJson from '#models/stbl-json';
import { fileExists } from '#helpers/fs';
import ViewOnlyDocument from '../view-only/document';

/**
 * Document containing binary STBL data.
 */
export default class StringTableDocument extends ViewOnlyDocument {
  //#region Properties

  public get stbl(): StringTableResource { return this._stbl; }

  //#endregion

  //#region Lifecycle

  private constructor(uri: vscode.Uri, private _stbl: StringTableResource) {
    super(uri);
  }

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined
  ): Promise<StringTableDocument | PromiseLike<StringTableDocument>> {
    const dataUri = backupId ? vscode.Uri.parse(backupId) : uri;
    const fileData = await vscode.workspace.fs.readFile(dataUri);
    const stbl = StringTableResource.from(Buffer.from(fileData));
    return new StringTableDocument(uri, stbl);
  }

  //#endregion

  //#region Public Methods

  /**
   * Converts this STBL to a JSON and writes it to the same directory that this
   * one is in. If the STBL JSON already exists, a warning is shown.
   */
  async convertToJson() { // TODO: this probably does not belong here
    const uri = vscode.Uri.parse(this.uri.fsPath + ".json");

    if (await fileExists(uri)) {
      vscode.window.showWarningMessage(`STBL JSON already exists at ${uri.path}`);
      vscode.window.showTextDocument(uri);
    } else {
      // FIXME: get number of spaces from somewhere
      const content = JSON.stringify(this._stbl.toJsonObject(true), null, 2);
      vscode.workspace.fs.writeFile(uri, Buffer.from(content)).then(() => {
        vscode.window.showTextDocument(uri);
      });
    }
  }

  //#endregion
}
