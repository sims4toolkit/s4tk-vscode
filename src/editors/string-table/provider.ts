import * as vscode from 'vscode';
import { StringTableResource } from '@s4tk/models';
import { disposeAll } from '@helpers/dispose';
import { getNonce } from '@helpers/nonce';
import WebviewCollection from '@helpers/webview-collection';
import StringTableDocument from './document';
import type { StringTableEdit, StringTableInMessage, StringTableJson, StringTableOutMessage } from './types';

/**
 * Provider for string table editors.
 */
export default class StringTableEditorProvider implements vscode.CustomEditorProvider<StringTableDocument> {
  //#region Properties

  private static readonly viewType = 's4tk.stringTable';

  private readonly _webviews = new WebviewCollection();

  //#endregion

  //#region Initialization

  constructor(
    private readonly _context: vscode.ExtensionContext
  ) { }

  //#endregion

  //#region VSC

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    vscode.commands.registerCommand('s4tk.stringTable.new', () => {
      this._createNewStringTable(false);
    });

    vscode.commands.registerCommand('s4tk.stringTableJson.new', () => {
      this._createNewStringTable(true);
    });

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

  private static async _createNewStringTable(json: boolean) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("Creating a new String Table requires opening a workspace");
      return;
    }

    let filename = await vscode.window.showInputBox({
      title: "Name of String Table"
    });

    if (!filename) return;

    const ext = json ? ".stbl.json" : ".stbl";

    if (!filename.endsWith(ext)) filename = filename + ext;

    const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);

    try {
      // there isn't an "exists" method, weirdly...
      await vscode.workspace.fs.stat(uri);
    } catch (e) {
      const content = json
        ? new Uint8Array([91, 93])
        : (new StringTableResource()).getBuffer();

      await vscode.workspace.fs.writeFile(uri, content);
    }

    if (json) {
      vscode.window.showTextDocument(uri);
    } else {
      vscode.commands.executeCommand('vscode.openWith', uri, StringTableEditorProvider.viewType);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'reset.css'));

    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'vscode.css'));

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'string-table.css'));

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'string-table.js'));

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
