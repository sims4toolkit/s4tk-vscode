import * as vscode from "vscode";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

const RANGE_ZERO = new vscode.Range(
  new vscode.Position(0, 0),
  new vscode.Position(0, 0)
);

export default class StringDefinitionProvider implements vscode.DefinitionProvider {
  static register() {
    vscode.languages.registerDefinitionProvider(
      "xml",
      new StringDefinitionProvider()
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
      range.start.character,
      range.start.line,
      range.start.character + 2,
    ));
    if (prefix !== "0x") return;

    const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(document.uri);
    if (!workspace) return;

    try {
      const key = parseInt(document.getText(range), 16);
      const metadata = workspace.stringIndex.getStringByKey(key);
      if (!metadata) return;

      return {
        uri: metadata.stbl.uri,
        range: metadata.range ?? RANGE_ZERO,
      };
    } catch (_) { }
  }
}
