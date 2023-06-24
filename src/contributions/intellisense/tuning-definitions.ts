import * as vscode from "vscode";
import { getDefinition } from "#workspace/indexing";

export default class TuningDefinitionProvider implements vscode.DefinitionProvider {
  static register() {
    vscode.languages.registerDefinitionProvider(
      "xml",
      new TuningDefinitionProvider()
    );
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.LocationLink[] | vscode.Definition> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;
    const prefix = document.getText(new vscode.Range(
      range.start.line,
      range.start.character - 3,
      range.start.line,
      range.start.character,
    ));
    if (prefix === 's="') return;
    const word = document.getText(range);
    return getDefinition(word);
  }
}
