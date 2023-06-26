import { S4TKConfig } from "#models/s4tk-config";
import * as vscode from "vscode";
// import { _S4TKWorkspace as S4TKWorkspace } from "./s4tk-workspace";


class S4TKWorkspace {
  private static readonly _blankConfig: S4TKConfig = S4TKConfig.blankProxy();
  private _activeConfig?: S4TKConfig;
  get config(): S4TKConfig { return this._activeConfig ?? S4TKWorkspace._blankConfig; }
  get active(): boolean { return Boolean(this._activeConfig); }

  constructor(public readonly rootUri: vscode.Uri) {
    // TODO: activate and index
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  }

  dispose() {
    // TODO:
  }
}

namespace S4TKWorkspaceManager {
  const _disposables: vscode.Disposable[] = [];
  const _workspaces = new Map<string, S4TKWorkspace>();

  export function activate() {
    vscode.workspace.workspaceFolders?.forEach(folder => create(folder.uri));

    _disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(e => {
      e.removed.forEach(removed => remove(removed.uri));
      e.added.forEach(added => create(added.uri));
    }));
  }

  export function dispose() {
    _disposables.forEach(disposable => disposable.dispose());
    _disposables.length = 0;
  }

  export function get(rootUri: vscode.Uri): S4TKWorkspace | undefined {
    return _workspaces.get(rootUri.fsPath);
  }

  function create(rootUri: vscode.Uri) {
    _workspaces.set(rootUri.fsPath, new S4TKWorkspace(rootUri));
  }

  function remove(rootUri: vscode.Uri) {
    _workspaces.get(rootUri.fsPath)?.dispose();
    _workspaces.delete(rootUri.fsPath);
  }
}

export default S4TKWorkspaceManager;
