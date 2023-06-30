import * as vscode from "vscode";
import { TuningResourceType } from "@s4tk/models/enums";
import { inferKeyFromMetadata } from "#indexing/inference";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

export default class TuningHoverProvider implements vscode.HoverProvider {
  private static readonly _TDESC_BUCKETS = require("../../../data/tdesc-endpoints.json");

  static register() {
    vscode.languages.registerHoverProvider(
      "xml",
      new TuningHoverProvider()
    );
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;

    const prefix = document.getText(new vscode.Range(
      range.start.line,
      range.start.character - 3,
      range.start.line,
      range.start.character,
    ));
    if (prefix !== 'c="') return;

    const tuningClass = document.getText(range);
    if (!tuningClass) return;

    const workspace = S4TKWorkspaceManager.getWorkspaceForFileAt(document.uri);
    if (!workspace) return;

    const metadata = workspace.index.getMetadataFromUri(document.uri);
    if (!metadata) return;

    const key = inferKeyFromMetadata(metadata).key;
    if (!key.type) return;

    const typeName = TuningResourceType[key.type];
    if (!(typeName in TuningHoverProvider._TDESC_BUCKETS)) return;

    const bucket = TuningHoverProvider._TDESC_BUCKETS[typeName];
    if (!bucket) return;

    return {
      range: range,
      contents: [`[Go to \`${bucket}/${tuningClass}.tdesc\`](https://tdesc.lot51.cc/${bucket}/Descriptions/${tuningClass}.tdesc)`]
    }
  }
}
