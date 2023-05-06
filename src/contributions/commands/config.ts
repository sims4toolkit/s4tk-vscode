import * as vscode from "vscode";
import { COMMAND } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerConfigCommands() {
  vscode.commands.registerCommand(COMMAND.config.addPackage,
    (editor?: vscode.TextEditor) => {
      S4TKWorkspace.addPackageInstructions(editor);
    }
  );
}
