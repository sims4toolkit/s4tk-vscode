import * as vscode from "vscode";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

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

    const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(document.uri);
    if (!workspace) return;

    const id = document.getText(range);
    const metadata = workspace.index.getMetadataFromId(id);
    if (metadata?.range == undefined || metadata?.uri == undefined) return;

    return {
      uri: metadata.uri,
      range: metadata.range,
    }
  }
}
