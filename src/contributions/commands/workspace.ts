import * as vscode from "vscode";
import { COMMAND } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(COMMAND.workspace.build, () => {
    // TODO:
    vscode.window.showInformationMessage("Build");
  });

  vscode.commands.registerCommand(COMMAND.workspace.buildDryRun, () => {
    // TODO:
    vscode.window.showInformationMessage("Dry Run");
  });

  vscode.commands.registerCommand(COMMAND.workspace.buildRelease, () => {
    // TODO:
    vscode.window.showInformationMessage("Release");
  });

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
