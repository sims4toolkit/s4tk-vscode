import * as vscode from "vscode";
import { diagnoseStblJsonDocument, diagnoseXmlDocument } from "#diagnostics/diagnose";

export default function initializeDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("s4tk");
  context.subscriptions.push(collection);

  if (vscode.window.activeTextEditor) {
    _dispatchDiagnosis(vscode.window.activeTextEditor.document, collection);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor?.document) _dispatchDiagnosis(editor.document, collection);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      _dispatchDiagnosis(e.document, collection);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      collection.delete(document.uri);
    })
  );
}

function _dispatchDiagnosis(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
  if (document.fileName.endsWith(".xml")) {
    diagnoseXmlDocument(document, collection);
  } else if (document.fileName.endsWith(".stbl.json")) {
    diagnoseStblJsonDocument(document, collection);
  }
}
