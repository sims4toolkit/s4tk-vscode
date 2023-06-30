import * as fs from "fs";
import * as vscode from "vscode";
import { ResourceKey } from "@s4tk/models/types";
import { BinaryResourceType, SimDataGroup, TuningResourceType } from "@s4tk/models/enums";
import { findOpenDocument } from "#helpers/fs";
import type ResourceIndex from "./resource-index";
import type { XmlMetadata, TuningMetadata, SimDataMetadata, InferredResourceKey, ResourceKeySources } from "./types";

/*
  NOTE: This file could be greatly simplified by parsing the input XML as an XML
  DOM rather than manually searching individual lines with regexes, however,
  this was a deliberate added complexity because of the massive time and space
  performance gains. Performance in these functions is CRITICAL, because they
  are called whenever an XML document is created or edited, and also on every
  file during the build process.
*/

const _MAX_LINES = 5;
const _TGI_REGEX = /(?<t>[a-f\d]{8}).(?<g>[a-f\d]{8}).(?<i>[a-f\d]{16})/i;
const _S4TK_COMMENT_REGEX = /<!--\s*S4TK[^-]+-->/i;
const _S4TK_TYPE_REGEX = /type:\s*([a-f0-9]{1,8})/i;
const _S4TK_GROUP_REGEX = /group:\s*([a-f0-9]{1,8})/i;
const _S4TK_INSTANCE_REGEX = /instance:\s*([a-f0-9]{1,16})/i;
const _HEADER_REGEX = /^\s*<([IMS])/m;

/**
 * Returns the key to use for the resource with the given meta data, if it can
 * be deduced, along with the source of each key segment.
 * 
 * @param metadata Known meta data about the file to get the key for
 * @param index Existing index, if available (required for SimData)
 */
export function inferKeyFromMetadata(metadata: XmlMetadata, index?: ResourceIndex): InferredResourceKey {
  if (metadata.uri) {
    const filenameKey = parseKeyFromTgiFilename(metadata.uri.path);
    if (filenameKey) return {
      key: filenameKey,
      sources: {
        type: "This type is set in the file name.",
        group: "This group is set in the file name.",
        instance: "This instance is set in the file name.",
      },
    };
  }

  function ifSet<T>(v: string | undefined, fn: (v: string) => T): T | undefined {
    return v ? fn(v) : undefined;
  }

  const key: Partial<ResourceKey> = {
    type: ifSet(metadata.comment?.type, v => parseInt(v, 16)),
    group: ifSet(metadata.comment?.group, v => parseInt(v, 16)),
    instance: ifSet(metadata.comment?.instance, v => BigInt("0x" + v)),
  };

  const sources: Partial<ResourceKeySources> = {};
  if (key.type) sources.type = "This type is set in an S4TK comment.";
  if (key.group) sources.group = "This group is set in an S4TK comment.";
  if (key.instance) sources.instance = "This instance is set in an S4TK comment.";

  if (metadata.kind === "tuning") {
    if (metadata.root === "I") {
      if (key.type == undefined && metadata.attrs?.i) {
        const type = TuningResourceType.parseAttr(metadata.attrs.i);
        if (type !== TuningResourceType.Tuning) {
          key.type = type;
          sources.type = `This type is inferred from i="${metadata.attrs.i}".`;
        }
      }
    } else if (metadata.root === "M") {
      if (key.type == undefined) {
        key.type = TuningResourceType.Tuning;
        sources.type = `This type is the default for tuning modules.`;
      }
    }

    if (key.group == undefined) {
      key.group = 0;
      sources.group = "This group is set to the default value of 0.";
    }

    if (key.instance == undefined && metadata.attrs?.s) {
      key.instance = BigInt(metadata.attrs.s);
      sources.instance = `This instance is inferred from s="${metadata.attrs.s}"`;
    }
  } else if (metadata.kind === "simdata") {
    if (key.type == undefined) {
      key.type = BinaryResourceType.SimData;
      sources.type = "This type is the default for SimData files.";
    }

    if (metadata.uri && index && (key.group == undefined || key.instance == undefined)) {
      const tuning = index.getMetadataFromUri(
        vscode.Uri.file(metadata.uri.fsPath.replace(/\.SimData\.xml$/, ".xml"))
      );

      if (tuning) {
        const tuningKey = inferKeyFromMetadata(tuning);

        if (key.group == undefined && tuningKey.key.type) {
          const group = SimDataGroup.getForTuning(tuningKey.key.type);
          if (group) {
            key.group = group;
            sources.group = `This group is inferred from the paired tuning's type of "${TuningResourceType[tuningKey.key.type]}".`;
          }
        }

        if (key.instance == undefined && tuningKey.key.instance) {
          key.instance = tuningKey.key.instance;
          sources.instance = `This instance is inferred from the paired tuning's instance of ${tuningKey.key.instance}`;
        }
      }
    }
  }

  return { key, sources };
}

/**
 * Returns the inferred meta data for a tuning file.
 * 
 * @param uriOrContent URI to or content of the tuning file
 */
export function inferTuningMetadata(uriOrContent: vscode.Uri | string): TuningMetadata {
  const metadata: TuningMetadata = {
    kind: "tuning",
    uri: typeof uriOrContent === "string" ? undefined : uriOrContent,
  };

  let parsedComment = false;
  const lines = _getTopLinesFromFile(uriOrContent);
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];

    if (!parsedComment && _parseOverrideComment(line, metadata)) {
      parsedComment = true;
      continue;
    }

    if (_parseTuningDeclaration(line, metadata)) {
      metadata.range = new vscode.Range(i, 0, i, line.length);
      break;
    }
  }

  return metadata;
}

/**
 * Returns the inferred meta data for an XML SimData file.
 * 
 * @param uriOrContent URI to or content of the SimData file
 */
export function inferSimDataMetadata(uriOrContent: vscode.Uri | string): SimDataMetadata {
  const metadata: SimDataMetadata = {
    kind: "simdata",
    uri: typeof uriOrContent === "string" ? undefined : uriOrContent,
  };

  const lines = _getTopLinesFromFile(uriOrContent);
  for (let i = 0; i < lines.length; ++i) {
    if (_parseOverrideComment(lines[i], metadata)) break;
  }

  return metadata;
}

/**
 * Parses a resource key from the given filename, if possible.
 * 
 * @param filename Name of file that may or may not contain a TGI
 */
export function parseKeyFromTgiFilename(filename: string): ResourceKey | undefined {
  const groups = _TGI_REGEX.exec(filename)?.groups;

  if (groups) return {
    type: parseInt(groups.t, 16),
    group: parseInt(groups.g, 16),
    instance: BigInt("0x" + groups.i),
  };
}

/**
 * Inserts a subset of key overrides to XML content, if applicable, and returns
 * the new content to use if anything has changed.
 * 
 * @param xmlContent XML content as a plain text string
 * @param overrides Object of overrides to insert
 */
export function insertXmlKeyOverrides(
  xmlContent: string,
  overrides: Partial<{ [key in 'type' | 'group' | 'instance']: string; }>
): string | undefined {
  const lines = _getTopLinesFromFile(xmlContent);
  const mockMetadata: XmlMetadata = { kind: "tuning" }; // kind is irrelevant
  for (const line of lines)
    if (_parseOverrideComment(line, mockMetadata)) break;

  const hadOverrides = Boolean(mockMetadata.comment);
  const existingOverrides = mockMetadata.comment ?? {};
  let hasChange = false;
  for (const overrideKey in overrides) {
    //@ts-expect-error 3 typing errors here, all safe to ignore
    if (existingOverrides[overrideKey] !== overrides[overrideKey]) {
      //@ts-expect-error 3 typing errors here, all safe to ignore
      existingOverrides[overrideKey] = overrides[overrideKey];
      hasChange = true;
    }
  }

  if (!hasChange) return;

  const commentSegments = [];
  if (existingOverrides.type)
    commentSegments.push(`Type: ${existingOverrides.type}`);
  if (existingOverrides.group)
    commentSegments.push(`Group: ${existingOverrides.group}`);
  if (existingOverrides.instance)
    commentSegments.push(`Instance: ${existingOverrides.instance}`);

  const comment = `<!-- S4TK ${commentSegments.join(", ")} -->`;

  if (hadOverrides) {
    return xmlContent.replace(_S4TK_COMMENT_REGEX, comment);
  } else {
    const eol = xmlContent.split("\n", 1)[0]?.at(-1) === "\r" ? "\r\n" : "\n";
    return xmlContent.replace(_HEADER_REGEX, `${comment}${eol}<$1`);
  }
}

//#region Helper Functions

function _getTopLinesFromFile(uriOrContent: vscode.Uri | string): string[] {
  try {
    if (typeof uriOrContent === "string") {
      return uriOrContent.split("\n", _MAX_LINES);
    } else {
      const document = findOpenDocument(uriOrContent);
      if (document) {
        const lines: string[] = [];
        const maxLines = Math.min(_MAX_LINES, document.lineCount);
        for (let i = 0; i < maxLines; ++i) lines.push(document.lineAt(i).text);
        return lines;
      } else {
        return fs.readFileSync(uriOrContent.fsPath).toString().split("\n", _MAX_LINES);
      }
    }
  } catch (_) {
    return [];
  }
}

function _parseOverrideComment(line: string, metadata: XmlMetadata): boolean {
  if (!_S4TK_COMMENT_REGEX.test(line)) return false;
  metadata.comment = {
    type: _S4TK_TYPE_REGEX.exec(line)?.[1],
    group: _S4TK_GROUP_REGEX.exec(line)?.[1],
    instance: _S4TK_INSTANCE_REGEX.exec(line)?.[1],
  };
  return true;
}

function _parseTuningDeclaration(line: string, metadata: TuningMetadata): boolean {
  if (line.startsWith("<I")) {
    metadata.root = "I";
  } else if (line.startsWith("<M")) {
    metadata.root = "M";
  } else {
    return false;
  }

  _parseAttributes(line, metadata);
  return true;
}

function _parseAttributes(line: string, metadata: TuningMetadata) {
  metadata.attrs ??= {};
  const regex = /\s(?<key>[cimns])="(?<value>[^"]+)"/g;
  let match: RegExpExecArray | null;

  do {
    match = regex.exec(line);
    //@ts-ignore Safe because regex restricts to cimns
    if (match?.groups) metadata.attrs[match.groups.key] = match.groups.value;
  } while (match);
}

//#endregion
