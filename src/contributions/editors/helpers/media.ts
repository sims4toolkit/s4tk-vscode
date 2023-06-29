import * as vscode from "vscode";
import { randomBytes } from "crypto";
import S4TKAssets from "#assets";

/**
 * Returns an HTML string for use in the given webview.
 * 
 * @param webview Webview to render the HTML in
 * @param htmlContent Object of HTML content to load
 */
export function getHtmlForWebview(
  webview: vscode.Webview,
  htmlContent: {
    title: string;
    body?: string;
    styles?: vscode.Uri[];
    scripts?: vscode.Uri[];
  },
): string {
  const nonce = randomBytes(32).toString("hex");

  const toWebviewUri = (uri: vscode.Uri) => webview.asWebviewUri(uri);

  const toStyleLink = (uri: vscode.Uri) =>
    `<link href="${toWebviewUri(uri)}" rel="stylesheet" />`;

  const toScriptTag = (uri: vscode.Uri) =>
    `<script nonce="${nonce}" src="${toWebviewUri(uri)}"></script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${toStyleLink(S4TKAssets.media.styles.reset)}
  ${toStyleLink(S4TKAssets.media.styles.vscode)}
  ${htmlContent.styles?.map(toStyleLink).join('\n')}
  <title>${htmlContent.title}</title>
</head>
<body>
  ${htmlContent.body ?? ''}
  ${htmlContent.scripts?.map(toScriptTag).join('\n')}
</body>
</html>`;
}
