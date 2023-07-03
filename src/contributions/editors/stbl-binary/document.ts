import * as fs from "fs";
import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import { StringTableLocale } from '@s4tk/models/enums';
import { formatAsHexString } from '@s4tk/hashing/formatting';
import { S4TKSettings } from '#helpers/settings';
import StringTableJson from '#stbls/stbl-json';
import { parseKeyFromTgi } from '#building/resources';
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

  async convertToJson() {
    const uri = vscode.Uri.parse(
      this.uri.fsPath.replace(/\.((stbl)|(binary))$/, ".stbl.json")
    );

    if (fs.existsSync(uri.fsPath)) {
      vscode.window.showWarningMessage(`STBL JSON already exists at ${uri.path}`);
      vscode.window.showTextDocument(uri);
    } else {
      const tgi = parseKeyFromTgi(this.uri.fsPath);

      const stblJson = new StringTableJson(
        S4TKSettings.get("defaultStringTableJsonType"),
        this._stbl.toJsonObject(true) as { key: string; value: string; }[],
        {
          group: tgi
            ? formatAsHexString(tgi.group, 8, true)
            : undefined,
          locale: (tgi
            ? StringTableLocale[StringTableLocale.getLocale(tgi.instance)]
            : undefined) as StringTableLocaleName,
          instanceBase: tgi
            ? formatAsHexString(StringTableLocale.getInstanceBase(tgi.instance), 14, true)
            : undefined,
        }
      );

      if (tgi) stblJson.insertDefaultMetadata();

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

  async reload() {
    const data = await vscode.workspace.fs.readFile(this.uri);
    this._stbl = StringTableResource.from(Buffer.from(data));
  }

  //#endregion
}
