import * as vscode from 'vscode';
import { COMMAND } from '#constants';
import S4TKWorkspace from '#workspace/s4tk-workspace';
import BaseCodeLensProvider from './base-codelens';

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
    if (!S4TKWorkspace.active) return [];
    this._codeLenses = [];

    if (!_linesContain(document, "Type:", 0, 2)) this._codeLenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Override Type",
        tooltip: "Add a comment that tells S4TK which Type to use instead of the one it infers from 'i'. It must be an 8-digit hex number.",
        command: COMMAND.tuning.overrideType,
      })
    );

    if (!_linesContain(document, "Group:", 0, 2)) this._codeLenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Override Group",
        tooltip: "Add a comment that tells S4TK which Group to use instead of 00000000. It must be an 8-digit hex number.",
        command: COMMAND.tuning.overrideGroup,
      })
    );

    if (!_linesContain(document, "Instance:", 0, 2)) this._codeLenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Override Instance",
        tooltip: "Add a comment that tells S4TK which Instance to use instead of the one it infers from 's'. It must be an 8-digit hex number.",
        command: COMMAND.tuning.overrideInstance,
      })
    );

    return this._codeLenses;
  }
}

// FIXME: this is dumb, it'll have to change when tuning intellisense is added
function _linesContain(
  document: vscode.TextDocument,
  text: string,
  start: number,
  end: number
): boolean {
  for (let i = start; i <= start + end; ++i) {
    try {
      const line = document.lineAt(i);
      if (line.text.includes(text)) return true;
    } catch (_) { }
  }
  return false;
}
