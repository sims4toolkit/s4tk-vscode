import { sanitizeXmlComment } from "#helpers/xml";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import * as vscode from "vscode";

export default function registerXmlCompletionProvider(context: vscode.ExtensionContext) {
  const tuningRefCompletionProvider = vscode.languages.registerCompletionItemProvider("xml", {
    provideCompletionItems(document, position, token, context) {
      const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(document.uri);
      const allMetadata = workspace?.index.getAllFileMetadata() ?? [];
      return allMetadata
        .filter(metadata => metadata.attrs?.s && metadata.attrs.n)
        .map(metadata => new vscode.CompletionItem(
          `${metadata.attrs!.s!}<!--${sanitizeXmlComment(metadata.attrs!.n!)}-->`
        ));
    }
  });

  const stringRefCompletionProvider = vscode.languages.registerCompletionItemProvider("xml", {
    provideCompletionItems(document, position, token, context) {
      // TODO: implement; requires stbl index to be built, can also be used for comment restoration, settings should change
      return [];
    }
  });

  context.subscriptions.push(tuningRefCompletionProvider, stringRefCompletionProvider);
}
