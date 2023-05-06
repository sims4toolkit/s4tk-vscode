import * as vscode from "vscode";
import { COMMAND } from "#constants";
import { S4TKConfig } from "#models/s4tk-config";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerConfigCommands() {
  vscode.commands.registerCommand(COMMAND.config.addPackage, () => {
    // TODO:
  });
}

// FIXME: move this to config or workspace
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
          S4TKConfig.stringify(S4TKWorkspace.config!),
        );
      });
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Exception occured while adding new package build instructions.`);
  }
}
