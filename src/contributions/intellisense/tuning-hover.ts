import * as vscode from "vscode";
import { inferXmlMetaData } from "#helpers/xml";
import { TuningResourceType } from "@s4tk/models/enums";

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
    const tuningClass = document.getText(range);
    if (!tuningClass) return;
    const metadata = inferXmlMetaData(document);
    if (!metadata.key.type) return;
    const typeName = TuningResourceType[metadata.key.type];
    if (!(typeName in TuningHoverProvider._TDESC_BUCKETS)) return;
    const bucket = TuningHoverProvider._TDESC_BUCKETS[typeName];
    if (!bucket) return;
    return {
      range: range,
      contents: [`[Go to \`${bucket}/${tuningClass}.tdesc\`](https://tdesc.lot51.cc/${bucket}/Descriptions/${tuningClass}.tdesc)`]
    }
  }
}
