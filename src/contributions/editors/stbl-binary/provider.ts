import * as vscode from 'vscode';
import { getNonce } from '#helpers/utils';
import StringTableDocument from './document';
import type { StringTableInMessage, StringTableOutMessage } from './types';
import ViewOnlyEditorProvider from '../view-only/provider';

const _VIEW_TYPE = 's4tk.editor.stblBinary';

/**
 * Provider for string table editors.
 */
export default class StringTableEditorProvider
  extends ViewOnlyEditorProvider<StringTableDocument, StringTableInMessage, StringTableOutMessage> {
  constructor(private readonly _context: vscode.ExtensionContext) {
    super();
  }

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      _VIEW_TYPE,
      new StringTableEditorProvider(context), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        enableFindWidget: true
      }
    });
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<StringTableDocument> {
    return await StringTableDocument.create(uri, openContext.backupId);
  }

  protected _getHtmlForWebview(webview: vscode.Webview): string {
    // TODO: move this somewhere else
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'reset.css'));

    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'vscode.css'));

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'stbl-binary.css'));

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
      this._context.extensionUri, 'media', 'editors', 'stbl-binary.js'));

    const nonce = getNonce();

    // TODO: make this cleaner
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

  protected _onMessage(
    document: StringTableDocument,
    webviewPanel: vscode.WebviewPanel,
    message: StringTableInMessage
  ) {
    if (message.type === 'ready') {
      this._postMessage(webviewPanel, {
        type: "init",
        body: document.stbl.toJsonObject(true) as { key: string; value: string }[]
      });
    } else if (message.type === 'convertToJson') {
      document.convertToJson();
    }
  }
}
