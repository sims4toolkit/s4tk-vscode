import * as vscode from 'vscode';
import { disposeAll } from '@helpers/dispose';
import { getNonce } from '@helpers/nonce';
import WebviewCollection from '@helpers/webview-collection';
import StringTableDocument from './document';
import type { StringTableEdit } from './types';

/**
 * Provider for string table editors.
 */
export default class StringTableEditorProvider implements vscode.CustomEditorProvider<StringTableDocument> {
  //#region Properties

  private static readonly viewType = 'catCustoms.stringTable';

  private readonly _callbacks = new Map<number, (response: any) => void>();
  private _requestId = 1;
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
      supportsMultipleEditorsPerDocument: false,
    });
  }

  //#endregion

  //#region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<StringTableDocument> {
    const document: StringTableDocument = await StringTableDocument.create(uri, openContext.backupId, {
      getFileData: async () => {
        const webviewsForDocument = Array.from(this._webviews.get(document.uri));
        if (!webviewsForDocument.length) {
          throw new Error('Could not find webview to save for');
        }
        const panel = webviewsForDocument[0];
        const response = await this._postMessageWithResponse<number[]>(panel, 'getFileData', {});
        return new Uint8Array(response);
      }
    });

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
        this._postMessage(webviewPanel, 'update', document.stbl.toJsonObject());
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
    // Add the webview to our internal set of active webviews
    this._webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage(e => this._onMessage(document, e));

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage(e => {
      if (e.type === 'ready') {
        this._postMessage(webviewPanel, 'init', document.stbl.toJsonObject());
        // if (document.uri.scheme === 'untitled') {
        // } else {
        //   const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);

        //   // this._postMessage(webviewPanel, 'init', {
        //   //   value: document.documentData,
        //   //   editable,
        //   // });
        // }
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
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'stbl.js'));

    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'reset.css'));

    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'vscode.css'));

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'stbl.css'));

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
				<div id="stbl-editor"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  private _onMessage(document: StringTableDocument, message: any) {
    switch (message.type) {
      case 'stroke':
        document.makeEdit(message as StringTableEdit);
        return;

      case 'response':
        {
          const callback = this._callbacks.get(message.requestId);
          callback?.(message.body);
          return;
        }
    }
  }

  private _postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
    panel.webview.postMessage({ type, body });
  }

  private _postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  //#endregion
}
