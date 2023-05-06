import * as vscode from 'vscode';
import { COMMAND } from '#constants';
import BaseCodeLensProvider from './base-codelens';

/**
 * Provides CodeLenses for S4TK Config files, including:
 * - Build S4TK Project
 * - Build S4TK Project (Dry Run)
 * - Add Package Instructions
 */
export default class S4TKConfigCodeLensProvider extends BaseCodeLensProvider {
  private constructor() { super(); }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/s4tk.config.json",
      },
      new S4TKConfigCodeLensProvider()
    );
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    this._codeLenses = [];

    let count = 0;
    for (let i = 0; i < document.lineCount - 1; ++i) {
      const line = document.lineAt(i);
      if (line.text.includes(`"buildInstructions":`)) {
        this._pushBuildInstructionsCodeLenses(line);
        ++count;
      } else if (line.text.includes(`"packages":`)) {
        this._pushPackagesCodeLenses(line);
        ++count;
      }
      if (count >= 2) break;
    }

    return this._codeLenses;
  }

  private _pushBuildInstructionsCodeLenses(line: vscode.TextLine) {
    this._codeLenses.push(
      new vscode.CodeLens(line.range, {
        title: "Build",
        tooltip: "Build your project and output its files.",
        command: COMMAND.workspace.build,
      }),
      new vscode.CodeLens(line.range, {
        title: "Dry Run",
        tooltip: "Run the build process, check for issues, and show where the files *would* have been output to, but do not actually write them.",
        command: COMMAND.workspace.buildDryRun,
      })
    );
  }

  private _pushPackagesCodeLenses(line: vscode.TextLine) {
    this._codeLenses.push(
      new vscode.CodeLens(line.range, {
        title: "New Package",
        tooltip: "Add instructions for building a new package.",
        command: COMMAND.config.addPackage,
      })
    );
  }
}
