import * as path from "path";
import * as vscode from "vscode";
import { S4TKCommand } from "#constants";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import { S4TKConfig } from "#workspace/s4tk-config";
import S4TKWorkspace from "#workspace/s4tk-workspace";

let _statusBarItem: vscode.StatusBarItem;
let _mostRecentWorkspace: S4TKWorkspace;

export default function registerRunBuildStatusBarItem(context: vscode.ExtensionContext) {
  _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  _statusBarItem.command = S4TKCommand.workspace.build;
  _statusBarItem.name = "Run S4TK Build";
  _statusBarItem.text = "$(play) Run S4TK Build";
  context.subscriptions.push(_statusBarItem);
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(_onActiveEditorChanged));
  _checkForInitialWorkspace();
}

async function _checkForInitialWorkspace() {
  const workspace = await S4TKWorkspaceManager.chooseWorkspace();
  if (workspace) _onWorkspaceChanged(workspace);
}

function _onActiveEditorChanged(editor?: vscode.TextEditor) {
  if (!editor?.document?.uri) return;
  const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(editor.document.uri);
  if (workspace && workspace !== _mostRecentWorkspace) _onWorkspaceChanged(workspace);
}

function _onWorkspaceChanged(workspace: S4TKWorkspace) {
  _mostRecentWorkspace = workspace;
  workspace.addCallbackOnConfigChange(_onConfigChanged, { doNotRepeat: true });
  _updateStatusBarTextForWorkspace(workspace);
  _toggleStatusBarItemForWorkspace(workspace);
}

function _onConfigChanged(workspace: S4TKWorkspace, _?: S4TKConfig) {
  if (workspace !== _mostRecentWorkspace) return;
  _updateStatusBarTextForWorkspace(workspace);
  _toggleStatusBarItemForWorkspace(workspace);
}

function _updateStatusBarTextForWorkspace(workspace: S4TKWorkspace) {
  const workspaceName = workspace.config.projectMetaData.modName
    ? workspace.config.projectMetaData.modName
    : path.basename(workspace.rootUri.fsPath);
  _statusBarItem.text = `$(play) Run S4TK Build (${workspaceName})`;
}

function _toggleStatusBarItemForWorkspace(workspace: S4TKWorkspace) {
  if (workspace.active) {
    _statusBarItem?.show();
  } else {
    _statusBarItem?.hide();
  }
}
