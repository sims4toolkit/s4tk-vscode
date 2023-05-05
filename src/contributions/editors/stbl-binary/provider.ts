import * as vscode from 'vscode';
import { EDITOR } from '#contributes';
import { WebviewMediaGroup, getHtmlForWebview } from '#helpers/media';
import type { StringTableInMessage, StringTableOutMessage } from './types';
import ViewOnlyEditorProvider from '../view-only/provider';
import StringTableDocument from './document';

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
      EDITOR.stblBinary,
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
    return getHtmlForWebview(this._context, webview, {
      title: "Binary String Table",
      body: `<p class="margin-bottom">Binary STBLs are view-only. It is recommended to use STBL JSONs with S4TK. <span id="convert-to-json-btn">Convert to JSON</span>.</p>
      <div id="stbl-editor"></div>`,
      media: WebviewMediaGroup.StringTableBinary,
    });
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
