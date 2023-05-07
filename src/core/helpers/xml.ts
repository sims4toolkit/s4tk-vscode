import * as vscode from "vscode";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { ResourceKey } from "@s4tk/models/types";
import { BinaryResourceType, TuningResourceType } from "@s4tk/models/enums";

type XmlRootType = "instance" | "module" | "simdata" | "unknown";

type XmlMetaData = {
  root: XmlRootType;
  key: Partial<ResourceKey>;
};

/**
 * Returns a partial resource key that contains any properties override by a
 * comment at the top of the file.
 * 
 * @param xml XML content to analyze
 */
export function getXmlKeyOverrides(xml: string | vscode.TextDocument): Partial<ResourceKey> {
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

//#region Helpers

// allow for XML declaration, S4TK comment, header, and 2 lines for padding
const _MAX_LINES = 5;

// this is intentionally hacky because it's more space and time efficient than
// parsing an XML DOM, which is important because this is called by codelens
// every time an XML file is edited
function _getXmlDocumentKeyOverrides(document: vscode.TextDocument): Partial<ResourceKey> {
  const key: Partial<ResourceKey> = {};

  for (let i = 0; i < _MAX_LINES; ++i) {
    if (i >= document.lineCount) break;
    const text = document.lineAt(i).text;
    if (_parseKeyOverrides(key, text)) break;
  }

  return key;
}

// this is intentionally hacky because it's more space and time efficient than
// parsing an XML DOM, which is important because this is used on every single
// XML file during the build process
function _getXmlStringKeyOverrides(content: string): Partial<ResourceKey> {
  const key: Partial<ResourceKey> = {};

  const firstLines = content.split("\n", _MAX_LINES);
  for (let i = 0; i < firstLines.length; ++i) {
    const text = firstLines[i];
    if (_parseKeyOverrides(key, text)) break;
  }

  return key;
}

// this is intentionally hacky because it's more space and time efficient than
// parsing an XML DOM, which is important because this is called by codelens
// every time an XML file is edited
function _inferXmlDocumentMetaData(document: vscode.TextDocument): XmlMetaData {
  const metaData: XmlMetaData = { root: "unknown", key: {} };

  for (let i = 0; i < _MAX_LINES; ++i) {
    if (i >= document.lineCount) break;
    const text = document.lineAt(i).text;
    if (_parseMetaData(metaData, text)) break;
  }

  return metaData;
}

// this is intentionally hacky because it's more space and time efficient than
// parsing an XML DOM, which is important because this is used on every single
// XML file during the build process
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

    if (root.attributes.i)
      key.type = TuningResourceType.parseAttr(root.attributes.i) ?? 0;

    if (root.attributes.s)
      key.instance = root.attributes.s ? BigInt(root.attributes.s) : 0n;
  } catch (_) { }
}

function _parseKeyOverrides(key: Partial<ResourceKey>, comment: string): boolean {
  if (!/^<!--\s*s4tk/i.test(comment)) return false;
  const type = /type:\s*([a-f0-9]{1,8})/i.exec(comment)?.[1];
  if (type) key.type = parseInt(type, 16);
  const group = /group:\s*([a-f0-9]{1,8})/i.exec(comment)?.[1];
  if (group) key.group = parseInt(group, 16);
  const instance = /instance:\s*([a-f0-9]{1,16})/i.exec(comment)?.[1];
  if (instance) key.instance = BigInt("0x" + instance);
  return Boolean(type || group || instance);
}

function _parseMetaData(metaData: XmlMetaData, header: string): boolean {
  if (/^\s*<I/.test(header)) {
    metaData.root = "instance";
    _parseAttributes(metaData.key, header);
    return true;
  } else if (/^\s*<S/.test(header)) {
    metaData.root = "simdata";
    metaData.key.type = BinaryResourceType.SimData;
    return true;
  } else if (/^\s*<M/.test(header)) {
    metaData.root = "module";
    metaData.key.type = TuningResourceType.Tuning;
    _parseAttributes(metaData.key, header);
    return true;
  }

  return false;
}

//#endregion
