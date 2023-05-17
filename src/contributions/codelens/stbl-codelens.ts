import * as vscode from 'vscode';
import { COMMAND } from '#constants';
import StringTableJson from '#models/stbl-json';
import BaseCodeLensProvider from './base-codelens';

/**
 * Provides CodeLenses for STBL JSON files, including:
 * - Add Entry to Top
 * - Add Entry to Bottom
 * - Insert MetaData
 * - Copy Entry as XML
 */
export default class StringTableJsonCodeLensProvider extends BaseCodeLensProvider {
  private constructor() { super(); }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/*.stbl.json",
      },
      new StringTableJsonCodeLensProvider()
    );
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    // uncaught exception is fine, it just disables the codelens
    const stblJson = StringTableJson.parse(document.getText());
    const editor = vscode.window.activeTextEditor;

    this._codeLenses = [];

    if (document.uri.scheme !== "s4tk") {
      if (!stblJson.hasMetaData) {
        this._codeLenses.push(
          new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
            title: "New String",
            tooltip: "Add a new string with a random hash to this STBL.",
            command: COMMAND.stblJson.addEntry,
            arguments: [editor, stblJson],
          })
        );
      }

      if (stblJson.isArray) {
        this._codeLenses.push(
          new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
            title: "Convert to Object",
            tooltip: "Convert this array-based STBL JSON into an object-based one.",
            command: COMMAND.stblJson.toObject,
            arguments: [editor, stblJson],
          })
        );
      } else {
        this._codeLenses.push(
          new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
            title: "Convert to Array",
            tooltip: "Convert this object-based STBL JSON into an array-based one.",
            command: COMMAND.stblJson.toArray,
            arguments: [editor, stblJson],
          })
        );
      }

      if (!stblJson.hasMetaData) {
        this._codeLenses.push(
          new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
            title: "Insert Metadata",
            tooltip: "Convert this STBL into an object that tracks metadata (locale, group, instance).",
            command: COMMAND.stblJson.addMetaData,
            arguments: [editor, stblJson],
          })
        );
      }
    }

    let stblEntryIndex = 0;
    const keyRegex = stblJson.isArray ? /^\s*"key":/ : /^\s*"0[xX][a-fA-F0-9]{8}":/;
    const entriesRegex = /^\s*"entries":/;
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
      const line = document.lineAt(lineIndex);

      if (stblJson.hasMetaData && entriesRegex.test(line.text)) {
        this._codeLenses.push(
          new vscode.CodeLens(new vscode.Range(lineIndex, 0, lineIndex, 0), {
            title: "New String",
            tooltip: "Add a new string with a random hash to this STBL.",
            command: COMMAND.stblJson.addEntry,
            arguments: [editor, stblJson],
          })
        );

        continue;
      }

      if (keyRegex.test(line.text)) {
        this._codeLenses.push(new vscode.CodeLens(
          new vscode.Range(lineIndex, 0, lineIndex, 0),
          {
            title: "Copy as XML",
            tooltip: "Copies this string's key and value as XML that can be pasted into tuning.",
            command: COMMAND.stblJson.copyEntry,
            arguments: [stblJson, stblEntryIndex]
          }
        ));

        ++stblEntryIndex;
      }
    }

    return this._codeLenses;
  }
}
