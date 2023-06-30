import * as vscode from "vscode";
import S4TKWorkspace from "./s4tk-workspace";

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
    this._workspaces.set(uri.fsPath, new S4TKWorkspace(uri));
  }

  getWorkspace(uri: vscode.Uri): S4TKWorkspace | undefined {
    return this._workspaces.get(uri.fsPath);
  }

  removeWorkspace(uri: vscode.Uri) {
    this._workspaces.get(uri.fsPath)?.dispose();
    this._workspaces.delete(uri.fsPath);
  }

  //#endregion
}

const S4TKWorkspaceManager = new _S4TKWorkspaceManager();
export default S4TKWorkspaceManager;
