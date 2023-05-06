import * as vscode from "vscode";
import { COMMAND } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(COMMAND.workspace.createWorkspace, () => {
    S4TKWorkspace.createDefaultWorkspace();
  });

  vscode.commands.registerCommand(COMMAND.workspace.reloadConfig, () => {
    S4TKWorkspace.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand(COMMAND.workspace.setDefaultStbl, (uri: vscode.Uri) => {
    S4TKWorkspace.setDefaultStbl(uri);
  });
}
