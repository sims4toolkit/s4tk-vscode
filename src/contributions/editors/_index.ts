import * as vscode from "vscode";
import PackageEditorProvider from "./package/provider";
import StringTableEditorProvider from "./stbl-binary/provider";
import { VirtualFileSystemManager } from "./helpers/virtual-fs";

export default function registerEditorProviders(context: vscode.ExtensionContext) {
  PackageEditorProvider.register();
  StringTableEditorProvider.register();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "s4tk",
      new class implements vscode.TextDocumentContentProvider {
        onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        onDidChange = this.onDidChangeEmitter.event;
        provideTextDocumentContent(uri: vscode.Uri): string {
          return VirtualFileSystemManager.getContent(uri) ?? 'ERROR';
        }
      }
    )
  );
}
