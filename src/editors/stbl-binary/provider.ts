import * as vscode from 'vscode';
import { disposeAll } from '@helpers/dispose';
import { getNonce } from '@helpers/utils';
import WebviewCollection from '@helpers/webview-collection';
import StringTableDocument from './document';
import type { StringTableEdit, StringTableInMessage, StringTableJson, StringTableOutMessage } from './types';

/**
 * Provider for string table editors.
 */
export default class StringTableEditorProvider implements vscode.CustomEditorProvider<StringTableDocument> {
  //#region Properties

  public static readonly viewType = 's4tk.editor.stblBinary';

  private readonly _webviews = new WebviewCollection();

  //#endregion

  //#region Initialization

  constructor(
    private readonly _context: vscode.ExtensionContext
  ) { }

  //#endregion

  //#region VSC

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      StringTableEditorProvider.viewType,
      new StringTableEditorProvider(context), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        enableFindWidget: true
      }
    });
  }

  //#endregion

  //#region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<StringTableDocument> {
    const document: StringTableDocument = await StringTableDocument.create(uri, openContext.backupId);

    const listeners: vscode.Disposable[] = [];

    listeners.push(document.onDidChange(e => {
      // Tell VS Code that the document has been edited by the use.
      this._onDidChangeCustomDocument.fire({
        document,
        ...e,
      });
    }));

    listeners.push(document.onDidChangeContent(e => {
      // Update all webviews when the document changes
      for (const webviewPanel of this._webviews.get(document.uri)) {
        webviewPanel.options.enableFindWidget
        this._postMessage(webviewPanel, {
          type: "init",
          body: document.stbl.toJsonObject(true, true) as StringTableJson,
        });
      }
    }));

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  async resolveCustomEditor(
    document: StringTableDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._webviews.add(document.uri, webviewPanel);
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);
    webviewPanel.webview.onDidReceiveMessage(e => this._onMessage(document, e));
    webviewPanel.webview.onDidReceiveMessage(e => {
      if (e.type === 'ready') {
        const body = document.stbl.toJsonObject(true, true) as StringTableJson;
        this._postMessage(webviewPanel, { type: "init", body: body });
      }
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<StringTableDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  public backupCustomDocument(document: StringTableDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  public revertCustomDocument(document: StringTableDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.revert(cancellation);
  }

  public saveCustomDocument(document: StringTableDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.save(cancellation);
  }

  public saveCustomDocumentAs(document: StringTableDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
    return document.saveAs(destination, cancellation);
  }

  //#endregion

  //#region Private Methods

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'reset.css'));

    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'vscode.css'));

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'stbl-binary.css'));

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'stbl-binary.js'));

    const nonce = getNonce();

    return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />
				<title>String Table</title>
			</head>
			<body>
        <p class="margin-bottom">Binary STBLs are view-only. It is recommended to use STBL JSONs with S4TK. <span id="convert-to-json-btn">Convert to JSON</span>.</p>
				<div id="stbl-editor"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  private _onMessage(document: StringTableDocument, message: StringTableInMessage) {
    switch (message.type) {
      case 'edit': {
        document.makeEdit(message.body);
        return;
      }
    }
  }

  private _postMessage(panel: vscode.WebviewPanel, message: StringTableOutMessage) {
    panel.webview.postMessage(message);
  }

  //#endregion
}
