import S4TKWorkspaceManager from "#workspace/workspace-manager";
import * as path from "path";
import * as vscode from "vscode";

// URI Format: `s4tk:{relative_path_to_package}/{resource_id}/{filename}`

class _PackageResourceContentProvider implements vscode.TextDocumentContentProvider {
  // maps URIs as strings to file content
  private _packageContent = new Map<string, string>();

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return this._packageContent.get(uri.toString());
  }

  addPackageDocumentContent(
    documentUri: vscode.Uri,
    entryId: number,
    filename: string,
    content: string
  ): vscode.Uri {
    const baseUri = this._getPackageBaseUri(documentUri);
    const contentUri = vscode.Uri.joinPath(baseUri, entryId.toString(), filename);
    this._packageContent.set(contentUri.toString(), content);
    this.onDidChangeEmitter.fire(contentUri);
    return contentUri;
  }

  disposePackageDocumentContent(documentUri: vscode.Uri) {
    const baseUri = this._getPackageBaseUri(documentUri);
    const baseUriFs = baseUri.toString();
    const toReset: string[] = [];

    this._packageContent.forEach((_, uri) => {
      if (uri.startsWith(baseUriFs)) toReset.push(uri);
    });

    toReset.forEach((uri) => {
      this._packageContent.delete(uri);
    });
  }

  private _getPackageBaseUri(documentUri: vscode.Uri): vscode.Uri {
    const workspace = S4TKWorkspaceManager.getWorkspaceForFileAt(documentUri);
    const relative = path.relative(
      workspace?.rootUri.fsPath ?? '', // FIXME: default shouldn't be empty
      documentUri.fsPath
    ).replace(/\\/g, "/");
    return vscode.Uri.parse("s4tk:" + relative);
  }
}

const PackageResourceContentProvider = new _PackageResourceContentProvider();
export default PackageResourceContentProvider;
