import * as vscode from "vscode";
import { formatStringKey } from "@s4tk/hashing/formatting";
import { sanitizeXmlComment } from "#helpers/xml";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

export default function registerXmlCompletionProvider(context: vscode.ExtensionContext) {
  const tuningRefCompletionProvider = vscode.languages.registerCompletionItemProvider("xml", {
    provideCompletionItems(document, position, token, context) {
      const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(document.uri);
      const allMetadata = workspace?.tuningIndex.getAllFileMetadata() ?? [];
      return allMetadata
        .filter(metadata => metadata.attrs?.s && metadata.attrs.n)
        .map(metadata => new vscode.CompletionItem(
          `${metadata.attrs!.s!}<!--${sanitizeXmlComment(metadata.attrs!.n!)}-->`
        ));
    }
  });

  const stringRefCompletionProvider = vscode.languages.registerCompletionItemProvider("xml", {
    provideCompletionItems(document, position, token, context) {
      const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(document.uri);
      const allMetadata = workspace?.stringIndex.getAllStringMetadata() ?? [];
      return allMetadata
        .map(({ key, value }) => new vscode.CompletionItem(
          `${formatStringKey(key)}<!--${sanitizeXmlComment(value)}-->`
        ));
    }
  });

  context.subscriptions.push(tuningRefCompletionProvider, stringRefCompletionProvider);
}
