import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import { fileExists } from '#helpers/fs';
import { S4TKSettings } from '#helpers/settings';
import StringTableJson from '#models/stbl-json';
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
  async convertToJson() {
    const uri = vscode.Uri.parse(this.uri.fsPath + ".json");

    if (await fileExists(uri)) {
      vscode.window.showWarningMessage(`STBL JSON already exists at ${uri.path}`);
      vscode.window.showTextDocument(uri);
    } else {
      const stblJson = new StringTableJson(
        S4TKSettings.get("defaultStringTableJsonType"),
        this._stbl.toJsonObject(true) as { key: string; value: string; }[],
      );

      const stblJsonContent = stblJson.stringify();

      vscode.workspace.fs.writeFile(uri, Buffer.from(stblJsonContent)).then(() => {
        vscode.window.showTextDocument(uri);
        const deleteOriginal = "Delete Binary STBL";
        vscode.window.showInformationMessage(
          "Converted binary STBL to JSON. Would you like to delete the original? This action cannot be undone.",
          deleteOriginal
        ).then((button) => {
          if (button === deleteOriginal)
            vscode.workspace.fs.delete(this.uri);
        });
      });
    }
  }

  //#endregion
}
