import * as vscode from "vscode";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { ResourceKey } from "@s4tk/models/types";
import { BinaryResourceType, TuningResourceType } from "@s4tk/models/enums";
import { formatAsHexString } from "@s4tk/hashing/formatting";

/*
  NOTE: This file could be greatly simplified by parsing the input XML as an XML
  DOM rather than manually searching individual lines with regexes, however,
  this was a deliberate added complexity because of the massive time and space
  performance gains. Performance in these functions is CRITICAL, because they
  are called whenever an XML document is edited (because of the CodeLens), and
  also on every XML file during the build process.
*/

//#region Types

type KeyOverrideType = keyof ResourceKey;

export type XmlRootType = "instance" | "module" | "simdata" | "unknown";

export type XmlMetaData = {
  root: XmlRootType;
  key: Partial<ResourceKey>;
};

//#endregion

//#region Constants

// allow for XML declaration, S4TK comment, header, and 2 lines for padding
const _MAX_LINES = 5;

// regexes
const _S4TK_COMMENT_REGEX = /<!--\ss4tk[^-]*-->/i;
const _S4TK_TYPE_REGEX = /type:\s*([a-f0-9]{1,8})/i;
const _S4TK_GROUP_REGEX = /group:\s*([a-f0-9]{1,8})/i;
const _S4TK_INSTANCE_REGEX = /instance:\s*([a-f0-9]{1,16})/i;
const _HEADER_REGEX = /^\s*<([IMS])/m;
const _INSTANCE_HEADER_REGEX = /^\s*<I/;
const _MODULE_HEADER_REGEX = /^\s*<M/;
const _SIMDATA_HEADER_REGEX = /^\s*<SimData/;

//#endregion

//#region Exported Functions

/**
 * Inserts or updates the S4TK override comment and returns the content of the
 * document that contains it. If there is nothing to change, then undefined
 * is returned.
 * 
 * @param xml XML content to analyze
 * @param override Type of override to add
 */
export function getNewXmlContentWithOverride(xml: string | vscode.TextDocument, override: KeyOverrideType): string | undefined {
  const existingOverrides = getXmlKeyOverrides(xml);
  if (existingOverrides?.[override] != undefined) return;
  const inferredValue = inferXmlMetaData(xml).key[override];
  const newOverrides = [];

  if (existingOverrides?.type != undefined) {
    newOverrides.push(`Type: ${formatAsHexString(existingOverrides.type, 8, false)}`);
  } else if (override === "type") {
    newOverrides.push(`Type: ${formatAsHexString(inferredValue ?? 0, 8, false)}`);
  }

  if (existingOverrides?.group != undefined) {
    newOverrides.push(`Group: ${formatAsHexString(existingOverrides.group, 8, false)}`);
  } else if (override === "group") {
    newOverrides.push(`Group: ${formatAsHexString(inferredValue ?? 0, 8, false)}`);
  }

  if (existingOverrides?.instance != undefined) {
    newOverrides.push(`Instance: ${formatAsHexString(existingOverrides.instance, 16, false)}`);
  } else if (override === "instance") {
    newOverrides.push(`Instance: ${formatAsHexString(inferredValue ?? 0n, 16, false)}`);
  }

  const comment = `<!-- S4TK ${newOverrides.join(", ")} -->`;
  const content = typeof xml === "string" ? xml : xml.getText();

  if (existingOverrides) {
    return content.replace(_S4TK_COMMENT_REGEX, comment);
  } else {
    const eol = content.split("\n", 1)[0]?.at(-1) === "\r" ? "\r\n" : "\n";
    return content.replace(_HEADER_REGEX, `${comment}${eol}<$1`);
  }
}

/**
 * Returns a partial resource key that contains any properties override by a
 * comment at the top of the file. If there is no S4TK comment, undefined is
 * returned.
 * 
 * @param xml XML content to analyze
 */
export function getXmlKeyOverrides(xml: string | vscode.TextDocument): Partial<ResourceKey> | undefined {
  if (typeof xml === "string") {
    return _getXmlStringKeyOverrides(xml);
  } else {
    return _getXmlDocumentKeyOverrides(xml);
  }
}

/**
 * Returns any meta data that can be inferred from the given XML content alone.
 * 
 * @param xml XML content to analyze
 */
export function inferXmlMetaData(xml: string | vscode.TextDocument): XmlMetaData {
  if (typeof xml === "string") {
    return _inferXmlStringMetaData(xml);
  } else {
    return _inferXmlDocumentMetaData(xml);
  }
}

//#endregion

//#region Helpers

function _getXmlDocumentKeyOverrides(document: vscode.TextDocument): Partial<ResourceKey> | undefined {
  const key: Partial<ResourceKey> = {};

  let overridesFound = false;
  for (let i = 0; i < _MAX_LINES; ++i) {
    if (i >= document.lineCount) break;
    const text = document.lineAt(i).text;
    if (_parseKeyOverrides(key, text)) {
      overridesFound = true;
      break;
    }
  }

  return overridesFound ? key : undefined;
}

function _getXmlStringKeyOverrides(content: string): Partial<ResourceKey> | undefined {
  const key: Partial<ResourceKey> = {};

  let overridesFound = false;
  const firstLines = content.split("\n", _MAX_LINES);
  for (let i = 0; i < firstLines.length; ++i) {
    const text = firstLines[i];
    if (_parseKeyOverrides(key, text)) {
      overridesFound = true;
      break;
    }
  }

  return overridesFound ? key : undefined;
}

function _inferXmlDocumentMetaData(document: vscode.TextDocument): XmlMetaData {
  const metaData: XmlMetaData = { root: "unknown", key: {} };

  for (let i = 0; i < _MAX_LINES; ++i) {
    if (i >= document.lineCount) break;
    const text = document.lineAt(i).text;
    if (_parseMetaData(metaData, text)) break;
  }

  return metaData;
}

function _inferXmlStringMetaData(content: string): XmlMetaData {
  const metaData: XmlMetaData = { root: "unknown", key: {} };

  const firstLines = content.split("\n", _MAX_LINES);
  for (let i = 0; i < firstLines.length; ++i) {
    const text = firstLines[i];
    if (_parseMetaData(metaData, text)) break;
  }

  return metaData;
}

function _parseAttributes(key: Partial<ResourceKey>, header: string) {
  try {
    // just parsing the opening tag, better than using regex to get attrs
    const root = XmlDocumentNode.from(header).child;

    if (root.attributes.i) {
      const type = TuningResourceType.parseAttr(root.attributes.i);
      if (type !== TuningResourceType.Tuning) key.type = type;
    }

    if (root.attributes.s)
      key.instance = root.attributes.s ? BigInt(root.attributes.s) : 0n;
  } catch (_) { }
}

function _parseKeyOverrides(key: Partial<ResourceKey>, comment: string): boolean {
  if (!/^<!--\s*s4tk/i.test(comment)) return false;
  const type = _S4TK_TYPE_REGEX.exec(comment)?.[1];
  if (type) key.type = parseInt(type, 16);
  const group = _S4TK_GROUP_REGEX.exec(comment)?.[1];
  if (group) key.group = parseInt(group, 16);
  const instance = _S4TK_INSTANCE_REGEX.exec(comment)?.[1];
  if (instance) key.instance = BigInt("0x" + instance);
  return Boolean(type || group || instance);
}

function _parseMetaData(metaData: XmlMetaData, header: string): boolean {
  if (_INSTANCE_HEADER_REGEX.test(header)) {
    metaData.root = "instance";
    _parseAttributes(metaData.key, header);
    return true;
  } else if (_SIMDATA_HEADER_REGEX.test(header)) {
    metaData.root = "simdata";
    metaData.key.type = BinaryResourceType.SimData;
    return true;
  } else if (_MODULE_HEADER_REGEX.test(header)) {
    metaData.root = "module";
    metaData.key.type = TuningResourceType.Tuning;
    _parseAttributes(metaData.key, header);
    return true;
  }

  return false;
}

//#endregion
