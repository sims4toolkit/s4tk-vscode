import * as vscode from 'vscode';
import { S4TKCommand } from '#constants';
import BaseCodeLensProvider from './base-codelens';

/**
 * Provides CodeLenses for S4TK Config files, including:
 * - Build S4TK Project
 * - Build S4TK Project (Dry Run)
 * - Build S4TK Project (Release)
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
        command: S4TKCommand.workspace.build,
      }),
      new vscode.CodeLens(line.range, {
        title: "Dry Run",
        tooltip: "Run the build process, check for issues, and show where the files *would* have been output to, but do not actually write them.",
        command: S4TKCommand.workspace.buildDryRun,
      }),
      new vscode.CodeLens(line.range, {
        title: "Release",
        tooltip: "Build your project for release (ZIP all packages with optional other files), follwing `releaseSettings`.",
        command: S4TKCommand.workspace.buildRelease,
      })
    );
  }

  private _pushPackagesCodeLenses(line: vscode.TextLine) {
    this._codeLenses.push(
      new vscode.CodeLens(line.range, {
        title: "New Package",
        tooltip: "Add instructions for building a new package.",
        command: S4TKCommand.config.addPackage,
        arguments: [vscode.window.activeTextEditor]
      })
    );
  }
}
