import * as vscode from "vscode";
import { S4TKCommand } from "#constants";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

export default function registerConfigCommands() {
  vscode.commands.registerCommand(S4TKCommand.config.addPackage,
    async (editor?: vscode.TextEditor) => {
      const workspace = editor?.document.uri
        ? S4TKWorkspaceManager.getWorkspaceForFileAt(editor.document.uri)
        : await S4TKWorkspaceManager.chooseWorkspace();

      workspace?.addPackageInstructions(editor);
    }
  );
}
