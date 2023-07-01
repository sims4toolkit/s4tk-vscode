import * as fs from "fs";
import * as vscode from "vscode";
import { fnv64 } from "@s4tk/hashing";
import * as inf from "#indexing/inference";
import * as infTypes from "#indexing/types";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import { DiagnosticKey } from "./types";
import * as helpers from "./helpers";

/**
 * Runs diagnostics on the given XML document.
 * 
 * @param document Document to run diagnostics on
 * @param collection Collection to add diagnostics to
 */
export async function diagnoseXmlDocument(
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

//#region Diagnose Helper Functions

function _diagnoseMetadata(
  metadata: infTypes.XmlMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  if (key.key.type == undefined || key.key.group == undefined || key.key.instance == undefined) {
    const diagnostic = new vscode.Diagnostic(
      (metadata as infTypes.TuningMetadata).range ?? document.lineAt(0).range,
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
  const missingAttrs = ["c", "i", "m", "n", "s"]
    .filter(attr => !Boolean((metadata.attrs as any)?.[attr]));
  if (missingAttrs.length) {
    const diagnostic = new vscode.Diagnostic(
      metadata.range ?? document.lineAt(0).range,
      `Instance tuning requires non-empty 'c', 'i', 'm', 'n', and 's' attributes and this file is missing [${missingAttrs}].`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.code = DiagnosticKey.rootAttrsMissing;
    diagnostics.push(diagnostic);
  }

  if (metadata.attrs?.c && key.key.instance != undefined) {
    const maxBits = helpers.maxBitsForClass(metadata.attrs.c);
    const maxValue = 2n ** BigInt(maxBits) - 1n;
    if (BigInt(key.key.instance) > maxValue) {
      const diagnostic = new vscode.Diagnostic(
        metadata.attrs.s
          ? _findRangeForAttr(metadata, document, "s", metadata.attrs.s)
          : _findRangeForAttr(metadata, document, "c", metadata.attrs.c),
        `'${metadata.attrs.c}' class is known to require ${maxBits}-bit tuning IDs (max value: ${maxValue}), but this one has ${key.key.instance}.`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.code = DiagnosticKey.tuningIdTooLarge;
      diagnostics.push(diagnostic);
    }
  }

  if (metadata.uri && metadata.attrs?.i && metadata.attrs?.c) {
    if (helpers.requiresSimData(metadata.attrs.i, metadata.attrs.c)) {
      const simdataPath = metadata.uri.fsPath.replace(".xml", ".SimData.xml");
      if (!fs.existsSync(simdataPath)) {
        const diagnostic = new vscode.Diagnostic(
          metadata.range ?? document.lineAt(0).range,
          `'${metadata.attrs.c}' class is known to require SimData, but no paired SimData file was found. Note that S4TK requires your SimData files to be in the same folder as your tuning, and have the exact same file name, but with a '.SimData.xml' extension.`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.code = DiagnosticKey.tuningRequiresSimData;
        diagnostics.push(diagnostic);
      }
    }
  }

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
      const diagnostic = new vscode.Diagnostic(
        _findRangeForAttr(metadata, document, "s", metadata.attrs.s),
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

//#region Other Helper Functions

function _findRangeForAttr(
  metadata: infTypes.TuningMetadata,
  document: vscode.TextDocument,
  attr: string,
  value: string
): vscode.Range {
  const defRange = metadata.range ?? document.lineAt(0).range;
  const def = document.getText(defRange);
  const start = def.indexOf(`${attr}="`) + attr.length + 2;
  const end = start + value.length;
  return new vscode.Range(defRange.start.line, start, defRange.start.line, end);
}

//#endregion
