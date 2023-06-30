import * as vscode from "vscode";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { S4TKCommand } from "#constants";
import * as inference from "#indexing/inference";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import type S4TKWorkspace from "#workspace/s4tk-workspace";
import BaseCodeLensProvider from "./base-codelens";

/**
 * Provides CodeLenses for XML files, including:
 * - Override Type
 * - Override Group
 * - Override Instance
 */
export default class TuningCodeLensProvider extends BaseCodeLensProvider {
  constructor() { super(); }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/*.xml",
      },
      new TuningCodeLensProvider()
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const editor = vscode.window.activeTextEditor;
    const workspace = S4TKWorkspaceManager.getWorkspaceForFileAt(document.uri);
    if (!(editor && workspace?.active)) return [];
    if (editor.document.uri.scheme === "s4tk") return [];

    this._codeLenses = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Format",
        tooltip: "Format this XML document.",
        command: S4TKCommand.tuning.format,
        arguments: [editor],
      }),
    ];

    await this._addKeyCodeLenses(workspace, editor);

    return this._codeLenses;
  }

  private async _addKeyCodeLenses(workspace: S4TKWorkspace, editor: vscode.TextEditor) {
    const metadata = editor.document.uri.fsPath.endsWith(".SimData.xml")
      ? inference.inferSimDataMetadata(editor.document.uri)
      : inference.inferTuningMetadata(editor.document.uri);

    const keyInfo = inference.inferKeyFromMetadata(metadata, workspace.index);

    if (metadata.comment?.type == undefined) {
      const typeDisplay = keyInfo.key.type != undefined
        ? formatAsHexString(keyInfo.key.type, 8, false)
        : "Unknown";

      this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: `Type (${typeDisplay})`,
          tooltip: keyInfo.sources.type,
          command: S4TKCommand.tuning.overrideType,
          arguments: [editor, keyInfo.key.type],
        })
      );
    }

    if (metadata.comment?.group == undefined) {
      const groupDisplay = keyInfo.key.group != undefined
        ? formatAsHexString(keyInfo.key.group, 8, false)
        : "Unknown";

      this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: `Group (${groupDisplay})`,
          tooltip: keyInfo.sources.group,
          command: S4TKCommand.tuning.overrideGroup,
          arguments: [editor, keyInfo.key.group],
        })
      );
    }

    if (metadata.comment?.instance == undefined) {
      const instDisplay = keyInfo.key.instance != undefined
        ? formatAsHexString(keyInfo.key.instance, 16, false)
        : "Unknown";

      this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: `Instance (${instDisplay})`,
          tooltip: keyInfo.sources.instance,
          command: S4TKCommand.tuning.overrideInstance,
          arguments: [editor, keyInfo.key.instance],
        })
      );
    }
  }
}
