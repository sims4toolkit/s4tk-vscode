import * as vscode from "vscode";
import { fnv64 } from "@s4tk/hashing";
import * as inf from "#indexing/inference";
import * as infTypes from "#indexing/types";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import { DiagnosticKey } from "./types";

/**
 * Runs diagnostics on the given XML document.
 * 
 * @param document Document to run diagnostics on
 * @param collection Collection to add diagnostics to
 */
export function diagnoseXmlDocument(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
) {
  if (!document.uri.fsPath.endsWith(".xml")) return;
  const workspace = S4TKWorkspaceManager.getWorkspaceForFileAt(document.uri);
  if (!workspace) return;

  const metadata = document.uri.fsPath.endsWith(".SimData.xml")
    ? inf.inferSimDataMetadata(document.uri)
    : inf.inferTuningMetadata(document.uri);
  const key = inf.inferKeyFromMetadata(metadata, workspace.index);

  const diagnostics: vscode.Diagnostic[] = [];
  _diagnoseMetadata(metadata, key, document, diagnostics);
  if (metadata.kind === "tuning") {
    if (metadata.root === "I") {
      _diagnoseInstanceDocument(metadata, key, document, diagnostics);
    } else if (metadata.root === "M") {
      _diagnoseModuleDocument(metadata, key, document, diagnostics);
    }
  } else {
    _diagnoseSimDataDocument(metadata, key, document, diagnostics);
  }
  collection.set(document.uri, diagnostics);
}

//#region Helper Funcstions

function _diagnoseMetadata(
  metadata: infTypes.XmlMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  if (key.key.type == undefined || key.key.group == undefined || key.key.instance == undefined) {
    const diagnostic = new vscode.Diagnostic(
      document.lineAt(0).range,
      `This resource's full key could not be resolved, which will cause the build script to fail.`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.code = DiagnosticKey.unknownKeyValues;
    diagnostics.push(diagnostic);
  }
}

function _diagnoseInstanceDocument(
  metadata: infTypes.TuningMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  // TODO:
}

function _diagnoseModuleDocument(
  metadata: infTypes.TuningMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  if (!(metadata.attrs?.n && metadata.attrs?.s)) {
    const diagnostic = new vscode.Diagnostic(
      metadata.range ?? document.lineAt(0).range,
      `Module tuning must contain non-empty 'n' and 's' attributes.`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.code = DiagnosticKey.rootAttrsMissing;
    diagnostics.push(diagnostic);
  } else {
    const expectedInst = fnv64(metadata.attrs.n.replace(".", "-"), false).toString();
    if (metadata.attrs.s !== expectedInst) {
      const defRange = metadata.range ?? document.lineAt(0).range;
      const def = document.getText(defRange);
      const start = def.indexOf('s="') + 3;
      const end = start + metadata.attrs.s.length;
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(defRange.start.line, start, defRange.start.line, end),
        `Module tuning ID must be the FNV64 hash of the filename, where all '.' are replaced with '-'. The expected ID is '${expectedInst}', but found '${metadata.attrs.s}' instead.`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.code = DiagnosticKey.moduleIdMismatch;
      diagnostics.push(diagnostic);
    }
  }
}

function _diagnoseSimDataDocument(
  metadata: infTypes.SimDataMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  // TODO:
}

//#endregion
