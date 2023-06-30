import * as vscode from "vscode";
import { S4TKContext } from "#constants";
import S4TKWorkspace from "./s4tk-workspace";
import { S4TKConfig } from "#models/s4tk-config";

class _S4TKWorkspaceManager implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _workspaces = new Map<string, S4TKWorkspace>();

  constructor() {
    vscode.workspace.workspaceFolders?.forEach(folder => {
      this.addWorkspace(folder.uri);
    });

    this._disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(e => {
      e.removed.forEach(removed => this.removeWorkspace(removed.uri));
      e.added.forEach(added => this.addWorkspace(added.uri));
    }));
  }

  dispose() {
    while (this._disposables.length)
      this._disposables.pop()?.dispose();
  }

  //#region Public Methods

  addWorkspace(uri: vscode.Uri) {
    const workspace = new S4TKWorkspace(uri, () => this._onSomeConfigChanged());
    this._workspaces.set(uri.fsPath, workspace);
  }

  async chooseWorkspace(): Promise<S4TKWorkspace | undefined> {
    const numWorkspaces = vscode.workspace.workspaceFolders?.length ?? 0;
    if (numWorkspaces === 0) return;
    if (numWorkspaces === 1) {
      return this.getWorkspace(vscode.workspace.workspaceFolders![0].uri);
    } else {
      const folder = await vscode.window.showWorkspaceFolderPick();
      return folder ? this.getWorkspace(folder.uri) : undefined;
    }
  }

  getWorkspace(uri: vscode.Uri): S4TKWorkspace | undefined {
    return this._workspaces.get(uri.fsPath);
  }

  getWorkspaceForFileAt(uri: vscode.Uri): S4TKWorkspace | undefined {
    if (!vscode.workspace.workspaceFolders) return;
    for (const folder of vscode.workspace.workspaceFolders) {
      if (uri.fsPath.startsWith(folder.uri.fsPath))
        return this.getWorkspace(folder.uri);
    }
  }

  removeWorkspace(uri: vscode.Uri) {
    this._workspaces.get(uri.fsPath)?.dispose();
    this._workspaces.delete(uri.fsPath);
  }

  //#endregion

  //#region Private Methods

  private _onSomeConfigChanged() {
    let someWorkspaceActive = false;
    for (const workspace of this._workspaces.values()) {
      if (workspace.active) {
        someWorkspaceActive = true;
        break;
      }
    }

    vscode.commands.executeCommand(
      'setContext',
      S4TKContext.workspace.active,
      someWorkspaceActive
    );
  }

  //#endregion
}

const S4TKWorkspaceManager = new _S4TKWorkspaceManager();
export default S4TKWorkspaceManager;
