import S4TKWorkspace from "@workspace/s4tk-workspace";
import * as vscode from "vscode";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand('s4tk.workspace.createWorkspace', () => {
    S4TKWorkspace.createDefaultProject();
  });

  vscode.commands.registerCommand('s4tk.workspace.reloadConfig', () => {
    S4TKWorkspace.loadConfig({ showNoConfigError: true });
  });
}
