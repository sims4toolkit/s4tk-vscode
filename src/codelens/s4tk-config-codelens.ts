import * as vscode from 'vscode';
import S4TKWorkspace from '@workspace/s4tk-workspace';
import { stringifyConfig } from '@models/s4tk-config';

const _BUILD_COMMAND_NAME = "s4tk.s4tkConfig.build";
const _ADD_PACKAGE_COMMAND_NAME = "s4tk.s4tkConfig.addBuildPackage";

export default class S4TKConfigCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  private constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/s4tk.config.json",
      },
      new S4TKConfigCodeLensProvider()
    );

    vscode.commands.registerCommand(_BUILD_COMMAND_NAME, async (dryRun: boolean) => {
      // TODO: implement
      vscode.window.showInformationMessage(dryRun ? "Dry run" : "Real build");
    });

    vscode.commands.registerCommand(_ADD_PACKAGE_COMMAND_NAME, _addNewBuildPackage);
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

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    return codeLens;
  }

  private _pushBuildInstructionsCodeLenses(line: vscode.TextLine) {
    this._codeLenses.push(
      new vscode.CodeLens(line.range, {
        title: "Build",
        tooltip: "Build your project and output its files.",
        command: _BUILD_COMMAND_NAME,
        arguments: [false]
      }),
      new vscode.CodeLens(line.range, {
        title: "Dry Run",
        tooltip: "Run the build process, check for issues, and show where the files *would* have been output to, but do not actually write them.",
        command: _BUILD_COMMAND_NAME,
        arguments: [true]
      })
    );
  }

  private _pushPackagesCodeLenses(line: vscode.TextLine) {
    this._codeLenses.push(
      new vscode.CodeLens(line.range, {
        title: "New Package",
        tooltip: "Add instructions for building a new package.",
        command: _ADD_PACKAGE_COMMAND_NAME
      })
    );
  }
}

async function _addNewBuildPackage() {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error("Editor could not be found");
    const doc = editor.document;
    if (doc.isDirty) await doc.save();

    // FIXME: this never works when the document is saving because the config
    // is being unloaded and reloaded every time

    if (!S4TKWorkspace.config) {
      // TODO: throw error
    } else {
      S4TKWorkspace.config?.buildInstructions.packages?.push(
        { filename: "", include: [""] }
      );

      editor.edit(editBuilder => {
        editBuilder.replace(
          new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end),
          stringifyConfig(S4TKWorkspace.config!)
        );
      });
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Exception occured while adding new package build instructions.`);
  }
}
