import * as vscode from 'vscode';
import WebviewCollection from '../helpers/webview-collection';
import ViewOnlyDocument from './document';

/**
 * Base provider for view-only editors. 
 */
export default abstract class ViewOnlyEditorProvider
  <DocType extends ViewOnlyDocument, InMessageType, OutMessageType>
  implements vscode.CustomEditorProvider<DocType> {

  private readonly _webviews = new WebviewCollection();

  abstract openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): DocType | Thenable<DocType>;

  async resolveCustomEditor(
    document: DocType,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._webviews.add(document.uri, webviewPanel);
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);
    webviewPanel.webview.onDidReceiveMessage(e => {
      this._onMessage(document, webviewPanel, e);
    });
  }

  protected abstract _getHtmlForWebview(
    webview: vscode.Webview
  ): string;

  protected abstract _onMessage(
    document: DocType,
    panel: vscode.WebviewPanel,
    message: InMessageType
  ): void;

  protected _postMessage(
    panel: vscode.WebviewPanel,
    message: OutMessageType
  ): void {
    panel.webview.postMessage(message);
  }

  //#region Ignored

  // These properties/methods are required to be implemented, but do not matter
  // in this context since this is a view-only editor.

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<DocType>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  public backupCustomDocument(
    document: DocType,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  public revertCustomDocument(
    document: DocType,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return new Promise(() => { });
  }

  public saveCustomDocument(
    document: DocType,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return new Promise(() => { });
  }

  public saveCustomDocumentAs(
    document: DocType,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return new Promise(() => { });
  }

  //#endregion
}
