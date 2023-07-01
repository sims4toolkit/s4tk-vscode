import * as fs from "fs";
import * as vscode from "vscode";
import * as models from "@s4tk/models";
import * as enums from "@s4tk/models/enums";
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
    _diagnoseSimDataDocument(workspace, metadata, key, document, diagnostics);
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
    const expectedType = enums.TuningResourceType.parseAttr(metadata.attrs.i);
    if (expectedType !== enums.TuningResourceType.Tuning && key.key.type !== expectedType) {
      const diagnostic = new vscode.Diagnostic(
        _findRangeForAttr(metadata, document, "i", metadata.attrs.i),
        `Tuning with i="${metadata.attrs.i}" are known to require a type of ${formatAsHexString(expectedType, 8, false)} (${enums.TuningResourceType[expectedType]}), but this one's type has been manually set to ${formatAsHexString(key.key.type, 8, false)}.`,
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
  workspace: S4TKWorkspace,
  metadata: infTypes.SimDataMetadata,
  key: infTypes.InferredResourceKey,
  document: vscode.TextDocument,
  diagnostics: vscode.Diagnostic[]
) {
  const tuningMetadata = workspace.index.getMetadataFromUri(
    document.uri.fsPath.replace(".SimData.xml", ".xml")
  );

  if (key.key.type !== enums.BinaryResourceType.SimData) {
    const diagnostic = new vscode.Diagnostic(
      document.lineAt(0).range,
      `SimData files should always use the type ${formatAsHexString(enums.BinaryResourceType.SimData, 8, false)}.`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.code = DiagnosticKey.simDataTypeIncorrect;
    diagnostics.push(diagnostic);
  }

  if (!tuningMetadata) {
    const diagnostic = new vscode.Diagnostic(
      document.lineAt(0).range,
      `No matching tuning was found for this SimData file. Note that S4TK requires your SimData files to be in the same folder as your tuning, and have the exact same file name, but with a '.SimData.xml' extension.`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.code = DiagnosticKey.unpairedSimData;
    diagnostics.push(diagnostic);
    return;
  }

  const tuningKey = inf.inferKeyFromMetadata(tuningMetadata);

  if (tuningKey.key.type != undefined) {
    const expectedGroup = enums.SimDataGroup.getForTuning(tuningKey.key.type);
    if (key.key.group && expectedGroup && (key.key.group !== expectedGroup)) {
      const diagnostic = new vscode.Diagnostic(
        document.lineAt(0).range,
        `This SimData's paired tuning has type ${formatAsHexString(tuningKey.key.type, 8, false)} (${enums.TuningResourceType[tuningKey.key.type]}), so this SimData should be using group ${formatAsHexString(expectedGroup, 8, false)} (${enums.SimDataGroup[expectedGroup]}), but instead it is using ${formatAsHexString(key.key.group, 8, false)} (${enums.SimDataGroup[key.key.group] ?? "Unknown"}).`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.code = DiagnosticKey.simDataGroupMismatch;
      diagnostics.push(diagnostic);
    }
  }

  if (tuningKey.key.instance && (key.key.instance != tuningKey.key.instance)) {
    const diagnostic = new vscode.Diagnostic(
      document.lineAt(0).range,
      `This SimData's instance is set to ${key.key.instance}, but its paired tuning is using an instance of ${tuningKey.key.instance}, which does not match.`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.code = DiagnosticKey.simDataIdMismatch;
    diagnostics.push(diagnostic);
  }

  try {
    if (!document.isDirty) models.SimDataResource.fromXml(document.getText());
  } catch (e) {
    const diagnostic = new vscode.Diagnostic(
      document.lineAt(0).range,
      `This file could not be parsed as a valid binary SimData, which will cause a fatal error during the build process. [${e}]`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.code = DiagnosticKey.simDataInvalidFormat;
    diagnostics.push(diagnostic);
  }
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
