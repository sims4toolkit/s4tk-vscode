import * as vscode from "vscode";
import { randomBytes } from "crypto";

type UriSegments = string[];

export const STYLES = {
  stblBinary: ["editor", "stbl-binary.css"],
};

export const SCRIPTS = {
  stblBinary: ["editor", "stbl-binary.js"],
};

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
    styles?: UriSegments[];
    scripts?: UriSegments[];
  },
): string {
  const nonce = randomBytes(32).toString("hex");

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
  ${htmlContent.styles?.map(toStyleLink).join('\n')}
  <title>${htmlContent.title}</title>
</head>
<body>
  ${htmlContent.body}
  ${htmlContent.scripts?.map(toScriptTag).join('\n')}
</body>
</html>`;
}
