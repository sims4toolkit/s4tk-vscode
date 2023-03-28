import * as vscode from 'vscode';

export default class StringTableJsonCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    this._codeLenses = [];

    for (let line = 2, i = 0; line < document.lineCount; line += 4) {
      const range = new vscode.Range(line, 2, line, 2);
      const command: vscode.Command = {
        title: "Copy as XML",
        command: "s4tk.stringTableJson.new", // FIXME: command
        arguments: ["index", i]
      };
      this._codeLenses.push(new vscode.CodeLens(range, command));
      ++i;
    }

    return this._codeLenses;
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
    return codeLens;
  }
}
