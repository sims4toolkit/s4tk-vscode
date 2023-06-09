import * as vscode from 'vscode';
import S4TKAssets from '#assets';
import { S4TKEditor } from '#constants';
import { getHtmlForWebview } from 'contributions/editors/helpers/media';
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
      S4TKEditor.dbpf,
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
    return await PackageDocument.create(uri);
  }

  protected _getHtmlForWebview(webview: vscode.Webview): string {
    return getHtmlForWebview(webview, {
      title: "TS4 Package",
      body: `<p class="margin-bottom">Packages are view-only (<span id="reload-button" class="link-button">Reload</span>)</p>
      <div id="pkg-editor"></div>`,
      styles: [S4TKAssets.media.styles.package],
      scripts: [S4TKAssets.media.scripts.package],
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
    } else if (message.type === 'view') {
      document.launchVirtualFile(message.body);
    } else if (message.type === 'reload') {
      this._postMessage(webviewPanel, {
        type: "loading",
      });

      document.reload().then(() => {
        this._postMessage(webviewPanel, {
          type: "init",
          body: document.index,
        });
      });
    }
  }
}
