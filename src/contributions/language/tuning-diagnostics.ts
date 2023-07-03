import * as vscode from "vscode";
import { diagnoseXmlDocument } from "#diagnostics/diagnose";

export default function initializeDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("s4tk");
  context.subscriptions.push(collection);

  if (vscode.window.activeTextEditor) {
    diagnoseXmlDocument(vscode.window.activeTextEditor.document, collection);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) diagnoseXmlDocument(editor.document, collection);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      diagnoseXmlDocument(e.document, collection);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      collection.delete(document.uri);
    })
  );
}
