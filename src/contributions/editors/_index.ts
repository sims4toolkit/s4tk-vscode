import * as vscode from "vscode";
import PackageEditorProvider from "./package/provider";
import StringTableEditorProvider from "./stbl-binary/provider";
import PackageResourceContentProvider from "./package/package-fs";

export default function registerEditorProviders(context: vscode.ExtensionContext) {
  PackageEditorProvider.register();
  StringTableEditorProvider.register();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "s4tk",
      PackageResourceContentProvider
    )
  );
}
