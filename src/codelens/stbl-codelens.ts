import * as vscode from 'vscode';
import { formatStringKey } from '@s4tk/hashing/formatting';

const _keyRegex = /^\s*"key":[^,]*,/;

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

    vscode.commands.registerCommand("s4tk.stringTableJson.copyAsXml", (xml: string) => {
      vscode.env.clipboard.writeText(xml);
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    this._codeLenses = [];

    let json: string[];
    try {
      const parsed: { key: number | string; value: string; }[] = JSON.parse(document.getText());
      json = parsed.map(({ key, value }) => {
        if (typeof key === "number") key = formatStringKey(key);
        return `${key}<!--${value}-->`;
      });
    } catch {
      json = [];
    }

    let stblEntryIndex = 0;
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
      const line = document.lineAt(lineIndex);
      if (_keyRegex.test(line.text)) {
        const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
        const command: vscode.Command = {
          title: "Copy as XML",
          tooltip: json[stblEntryIndex],
          command: "s4tk.stringTableJson.copyAsXml",
          arguments: [json[stblEntryIndex]]
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
