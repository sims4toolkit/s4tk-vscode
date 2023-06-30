import * as vscode from "vscode";
import { S4TKLink, S4TKCommand } from "#constants";

export const MessageButton = {
  GetHelp: "Get Help",
  ReportProblem: "Report Problem",
  ReloadConfig: "Reload Config",
  CreateProject: "Create S4TK Project",
};

/**
 * Handles the action to take when one of the message buttons was clicked.
 * 
 * @param button Button that was clicked
 */
export function handleMessageButtonClick(button: string | undefined) {
  if (!button) return;

  switch (button) {
    case MessageButton.GetHelp:
      vscode.env.openExternal(vscode.Uri.parse(S4TKLink.help));
      break;
    case MessageButton.ReportProblem:
      vscode.env.openExternal(vscode.Uri.parse(S4TKLink.issues));
      break;
    case MessageButton.ReloadConfig:
      vscode.commands.executeCommand(S4TKCommand.workspace.reloadConfig);
      break;
    case MessageButton.CreateProject:
      vscode.commands.executeCommand(S4TKCommand.workspace.createWorkspace);
      break;
  }
}
