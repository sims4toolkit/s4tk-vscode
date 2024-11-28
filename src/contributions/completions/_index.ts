import * as vscode from "vscode";
import registerXmlCompletionProvider from "./xml-references";

export default function registerCompletionProviders(context: vscode.ExtensionContext) {
  registerXmlCompletionProvider(context);
}
