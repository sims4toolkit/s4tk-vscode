import * as fs from "fs";
import * as vscode from "vscode";
import { TuningResourceType } from "@s4tk/models/enums";
import { fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import * as inf from "#indexing/inference";
import * as infTypes from "#indexing/types";
import S4TKWorkspace from "#workspace/s4tk-workspace";
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
    _diagnoseTuningDocument(workspace, metadata, key, document, diagnostics);
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

function _diagnoseTuningDocument(
  workspace: S4TKWorkspace,
  metadata: infTypes.TuningMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  if (metadata.attrs?.s && workspace.index.isIdRepeated(metadata.attrs.s)) {
    const diagnostic = new vscode.Diagnostic(
      _findRangeForAttr(metadata, document, "s", metadata.attrs.s),
      `The tuning ID ${metadata.attrs.s} is in use by more than one file.`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.code = DiagnosticKey.instanceRepeated;
    diagnostics.push(diagnostic);
  }

  if (metadata.root === "I") {
    _diagnoseInstanceDocument(metadata, key, document, diagnostics);
  } else if (metadata.root === "M") {
    _diagnoseModuleDocument(metadata, key, document, diagnostics);
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

  if (metadata.attrs?.i && key.key.type != undefined) {
    const expectedType = TuningResourceType.parseAttr(metadata.attrs.i);
    if (expectedType !== TuningResourceType.Tuning && key.key.type !== expectedType) {
      const diagnostic = new vscode.Diagnostic(
        _findRangeForAttr(metadata, document, "i", metadata.attrs.i),
        `Tuning with i="${metadata.attrs.i}" are known to require a type of ${formatAsHexString(expectedType, 8, false)} (${TuningResourceType[expectedType]}), but this one's type has been manually set to ${formatAsHexString(key.key.type, 8, false)}.`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.code = DiagnosticKey.tuningTypeIncorrect;
      diagnostics.push(diagnostic);
    }
  }

  if (metadata.attrs?.s && key.key.instance != undefined) {
    if (metadata.attrs.s !== key.key.instance.toString()) {
      const diagnostic = new vscode.Diagnostic(
        _findRangeForAttr(metadata, document, "s", metadata.attrs.s),
        `This tuning has s="${metadata.attrs.s}", but its instance has been manually set to ${key.key.instance}. The build script will not fail, but this may cause errors in-game.`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.code = DiagnosticKey.tuningIdIncorrect;
      diagnostics.push(diagnostic);
    }
  }
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
