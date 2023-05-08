import * as vscode from 'vscode';
import { MEDIA } from '#assets';
import { EDITOR } from '#constants';
import { getHtmlForWebview } from '#helpers/media';
import type { PackageInMessage, PackageOutMessage } from './types';
import ViewOnlyEditorProvider from '../view-only/provider';
import PackageDocument from './document';

/**
 * Provider for package editors.
 */
export default class PackageEditorProvider
  extends ViewOnlyEditorProvider<PackageDocument, PackageInMessage, PackageOutMessage> {
  constructor() {
    super();
  }

  public static register(): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      EDITOR.package,
      new PackageEditorProvider(), {
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
  ): Promise<PackageDocument> {
    return await PackageDocument.create(uri, openContext.backupId);
  }

  protected _getHtmlForWebview(webview: vscode.Webview): string {
    return getHtmlForWebview(webview, {
      title: "TS4 Package",
      body: `<p class="margin-bottom">Packages are view-only.</p>
      <div id="pkg-editor"></div>`,
      styles: [MEDIA.editors.packageStyle],
      scripts: [MEDIA.editors.packageScript],
    });
  }

  protected _onMessage(
    document: PackageDocument,
    webviewPanel: vscode.WebviewPanel,
    message: PackageInMessage
  ) {
    if (message.type === 'ready') {
      this._postMessage(webviewPanel, {
        type: "init",
        body: document.index,
      });
    }
  }
}
