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

    this._codeLenses = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Add New String (Top)",
        tooltip: "Add a new string with a random hash to the start of this STBL.",
        command: COMMAND.stblJson.addEntryTop,
        arguments: [editor, stblJson],
      }),
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Add New String (Bottom)",
        tooltip: "Add a new string with a random hash to the end of this STBL.",
        command: COMMAND.stblJson.addEntryBottom,
        arguments: [editor, stblJson],

      }),
    ];

    if (stblJson.format === "array") this._codeLenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Insert Metadata",
        tooltip: "Convert this array-based STBL into an object-based one that tracks file metadata.",
        command: COMMAND.stblJson.addMetaData,
        arguments: [editor, stblJson],
      })
    );

    let stblEntryIndex = 0;
    const keyRegex = /^\s*"key":/;
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
      const line = document.lineAt(lineIndex);

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
