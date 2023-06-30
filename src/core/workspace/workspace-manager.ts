import * as vscode from "vscode";


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
