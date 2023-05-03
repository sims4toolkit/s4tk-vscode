import * as vscode from 'vscode';
import { formatStringKey } from '@s4tk/hashing/formatting';
import StringTableJson from 'models/stbl-json';

const _KEY_REGEX = /^\s*"key":[^,]*,/;

export default class StringTableJsonCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  private constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/*.stbl.json",
      },
      new StringTableJsonCodeLensProvider()
    );

    vscode.commands.registerCommand("s4tk.stringTableJson.addNewEntry", async (document: vscode.TextDocument, addToStart: boolean) => {
      try {
        if (document.isDirty) await document.save();
        const json = StringTableJson.parse(document.getText());
        json.addEntry(undefined, addToStart);
        const uri = vscode.Uri.file(document.fileName);
        vscode.workspace.fs.writeFile(uri, Buffer.from(json.stringify()));
      } catch (err) {
        vscode.window.showErrorMessage(`Exception occured while adding new string to STBL JSON at ${document.fileName}`);
      }
    });

    vscode.commands.registerCommand("s4tk.stringTableJson.copyAsXml", (xml: string) => {
      vscode.env.clipboard.writeText(xml);
      vscode.window.showInformationMessage(`Copied: ${xml}`);
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    this._codeLenses = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "New String (Top)",
        tooltip: "New entry will have a randomly generated hash",
        command: "s4tk.stringTableJson.addNewEntry",
        arguments: [document, true]
      }),
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "New String (Bottom)",
        tooltip: "New entry will have a randomly generated hash",
        command: "s4tk.stringTableJson.addNewEntry",
        arguments: [document, false]
      }),
    ];

    let xmls: string[];
    try {
      const json = StringTableJson.parse(document.getText());

      xmls = json.entries.map(({ key, value }) => {
        if (typeof key === "number") key = formatStringKey(key);
        return `${key}<!--${value}-->`;
      });
    } catch {
      xmls = [];
    }

    let stblEntryIndex = 0;
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
      const line = document.lineAt(lineIndex);
      if (_KEY_REGEX.test(line.text)) {
        const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
        const command: vscode.Command = {
          title: "Copy as XML",
          tooltip: xmls[stblEntryIndex],
          command: "s4tk.stringTableJson.copyAsXml",
          arguments: [xmls[stblEntryIndex]]
        };
        this._codeLenses.push(new vscode.CodeLens(range, command));
        ++stblEntryIndex;
      }
    }

    return this._codeLenses;
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
    return codeLens;
  }
}
