import * as vscode from "vscode";
import { randomBytes } from "crypto";

//#region Types

type UriSegments = string[];

interface WebviewMediaUris {
  scripts?: UriSegments[];
  styles?: UriSegments[];
}

export enum WebviewMediaGroup {
  StringTableBinary,
}

const _WEBVIEW_MEDIA = new Map<WebviewMediaGroup, WebviewMediaUris>([
  [WebviewMediaGroup.StringTableBinary, {
    styles: [["editor", "stbl-binary.css"]],
    scripts: [["editor", "stbl-binary.js"]],
  }],
]);

//#endregion

//#region Exported Functions

/**
 * Returns an HTML string for use in the given webview.
 * 
 * @param context VS Code extension context
 * @param webview Webview to render the HTML in
 * @param htmlContent Object of HTML content to load
 */
export function getHtmlForWebview(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  htmlContent: {
    title: string;
    body: string;
    media: WebviewMediaGroup;
  },
): string {
  const nonce = randomBytes(32).toString("hex");
  const media = _WEBVIEW_MEDIA.get(htmlContent.media);
  const styles = media?.styles;
  const scripts = media?.scripts;

  const toUri = (segments: UriSegments) => webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', ...segments)
  );

  const toStyleLink = (segments: UriSegments) =>
    `<link href="${toUri(segments)}" rel="stylesheet" />`;

  const toScriptTag = (segments: UriSegments) =>
    `<script nonce="${nonce}" src="${toUri(segments)}"></script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${toStyleLink(['reset.css'])}
  ${toStyleLink(['vscode.css'])}
  ${styles?.map(toStyleLink).join('\n')}
  <title>${htmlContent.title}</title>
</head>
<body>
  ${htmlContent.body ?? ''}
  ${scripts?.map(toScriptTag).join('\n')}
</body>
</html>`;
}

//#endregion
