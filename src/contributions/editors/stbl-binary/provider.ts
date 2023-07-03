import * as vscode from 'vscode';
import S4TKAssets from '#assets';
import { S4TKEditor } from '#constants';
import { getHtmlForWebview } from 'contributions/editors/helpers/media';
import type { StringTableInMessage, StringTableOutMessage } from './types';
import ViewOnlyEditorProvider from '../view-only/provider';
import StringTableDocument from './document';

/**
 * Provider for string table editors.
 */
export default class StringTableEditorProvider
  extends ViewOnlyEditorProvider<StringTableDocument, StringTableInMessage, StringTableOutMessage> {
  constructor() {
    super();
  }

  public static register(): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      S4TKEditor.stbl,
      new StringTableEditorProvider(), {
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
    return getHtmlForWebview(webview, {
      title: "Binary String Table",
      body: `<p class="margin-bottom">Binary STBLs are view-only (<span id="reload-btn" class="link-button">Reload</span> | <span id="convert-to-json-btn" class="link-button">Convert to JSON</span>)</p>
      <div id="stbl-editor"></div>`,
      styles: [S4TKAssets.media.styles.stblBinary],
      scripts: [S4TKAssets.media.scripts.stblBinary],
    });
  }

  protected _onMessage(
    document: StringTableDocument,
    webviewPanel: vscode.WebviewPanel,
    message: StringTableInMessage
  ) {
    if (message.type === 'ready') {
      this._initRenderer(document, webviewPanel);
    } else if (message.type === 'convertToJson') {
      document.convertToJson();
    } else if (message.type === 'reload') {
      document.reload().then(() => {
        this._initRenderer(document, webviewPanel);
      });
    }
  }

  private _initRenderer(
    document: StringTableDocument,
    webviewPanel: vscode.WebviewPanel,
  ) {
    this._postMessage(webviewPanel, {
      type: "init",
      body: document.stbl.toJsonObject(true) as { key: string; value: string }[],
    });
  }
}
