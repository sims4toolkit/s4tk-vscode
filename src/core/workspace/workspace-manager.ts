import * as vscode from "vscode";
import { S4TKContext } from "#constants";
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

    for (const fsPath of this._workspaces.keys()) {
      this._workspaces.get(fsPath)?.dispose();
      this._workspaces.delete(fsPath);
    }
  }

  //#region Public Methods

  /**
   * Creates and adds a workspace for the given root URI.
   * 
   * @param uri Root URI of workspace to add
   */
  addWorkspace(uri: vscode.Uri) {
    const workspace = new S4TKWorkspace(uri, () => this._onSomeConfigChanged());
    this._workspaces.set(uri.fsPath, workspace);
  }

  /**
   * If given a URI, then returns the workspace that contains it, if there is
   * one. If not given a URI, then return the first workspace if there is only
   * one. If there is more than one workspace, a prompt is displayed for the
   * user to pick from.
   * 
   * @param uri Optional URI that the existing workspace must contain
   */
  async chooseWorkspace(uri?: vscode.Uri): Promise<S4TKWorkspace | undefined> {
    if (uri) return this.getWorkspaceContainingUri(uri);
    const numWorkspaces = vscode.workspace.workspaceFolders?.length ?? 0;
    if (numWorkspaces === 0) return;
    if (numWorkspaces === 1) {
      return this.getWorkspace(vscode.workspace.workspaceFolders![0].uri);
    } else {
      const folder = await vscode.window.showWorkspaceFolderPick();
      return folder ? this.getWorkspace(folder.uri) : undefined;
    }
  }

  /**
   * Returns the workspace with the given root URI, if there is one.
   * 
   * @param uri URI of workspace root
   */
  getWorkspace(uri: vscode.Uri): S4TKWorkspace | undefined {
    return this._workspaces.get(uri.fsPath);
  }

  /**
   * Returns the workspace that contains the given URI, if one exists.
   * 
   * @param uri URI that a workspace may contain
   */
  getWorkspaceContainingUri(uri: vscode.Uri): S4TKWorkspace | undefined {
    if (!vscode.workspace.workspaceFolders) return;
    for (const folder of vscode.workspace.workspaceFolders) {
      if (uri.fsPath.startsWith(folder.uri.fsPath))
        return this.getWorkspace(folder.uri);
    }
  }

  /**
   * Tears down, untracks, and deletes the workspace with the given root URI.
   * 
   * @param uri Root URI of workspace to remove
   */
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
