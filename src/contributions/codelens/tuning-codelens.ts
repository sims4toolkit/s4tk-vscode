import * as vscode from 'vscode';
import { COMMAND } from '#constants';
import S4TKWorkspace from '#workspace/s4tk-workspace';
import BaseCodeLensProvider from './base-codelens';
import { getXmlKeyOverrides } from '#helpers/xml';

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

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const editor = vscode.window.activeTextEditor;
    if (!(S4TKWorkspace.active && editor)) return [];
    const rangeZero = new vscode.Range(0, 0, 0, 0);

    this._codeLenses = [
      new vscode.CodeLens(rangeZero, {
        title: "Format",
        tooltip: "Format this XML document.",
        command: COMMAND.tuning.format,
        arguments: [editor],
      }),
    ];

    if (S4TKWorkspace.showXmlKeyOverrideButtons) {
      const overrides = getXmlKeyOverrides(document);

      if (overrides?.type == undefined) this._codeLenses.push(
        new vscode.CodeLens(rangeZero, {
          title: "Override Type",
          tooltip: "Add a comment that tells S4TK which Type to use instead of the one it infers from 'i'. It must be an 8-digit hex number.",
          command: COMMAND.tuning.overrideType,
          arguments: [editor],
        })
      );

      if (overrides?.group == undefined) this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: "Set Group",
          tooltip: "Add a comment that tells S4TK which Group to use instead of 00000000. It must be an 8-digit hex number.",
          command: COMMAND.tuning.overrideGroup,
          arguments: [editor],
        })
      );

      if (overrides?.instance == undefined) this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: "Set Instance",
          tooltip: "Add a comment that tells S4TK which Instance to use instead of the one it infers from 's'. It must be an 8-digit hex number.",
          command: COMMAND.tuning.overrideInstance,
          arguments: [editor],
        })
      );
    }

    return this._codeLenses;
  }
}
