import * as vscode from "vscode";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand('s4tk.workspace.createWorkspace', () => {
    S4TKWorkspace.createDefaultProject();
  });

  vscode.commands.registerCommand('s4tk.workspace.reloadConfig', () => {
    S4TKWorkspace.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand('s4tk.workspace.setDefaultStbl', (uri: vscode.Uri) => {
    S4TKWorkspace.setDefaultStbl(uri);
  });
}
