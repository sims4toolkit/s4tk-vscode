import * as vscode from "vscode";
import { ResourceKey } from "@s4tk/models/types";
import { findOpenDocument } from "#helpers/fs";
import type ResourceIndex from "./resource-index";
import { XmlMetadata, TuningMetadata, SimDataMetadata, InferredResourceKey, ResourceKeySources } from "./types";
import { BinaryResourceType, SimDataGroup, TuningResourceType } from "@s4tk/models/enums";


const _TGI_REGEX = /(?<t>[a-f\d]{8}).(?<g>[a-f\d]{8}).(?<i>[a-f\d]{16})/i;


function inferKeyFromMetadata(metadata: XmlMetadata, index?: ResourceIndex): InferredResourceKey {
  const groups = _TGI_REGEX.exec(metadata.uri.path)?.groups;

  if (groups) return {
    key: {
      type: parseInt(groups.t, 16),
      group: parseInt(groups.g, 16),
      instance: BigInt("0x" + groups.i),
    },
    sources: {
      type: "This type is set in the file name.",
      group: "This group is set in the file name.",
      instance: "This instance is set in the file name.",
    },
  };

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

    if (index != undefined && (key.group == undefined || key.instance == undefined)) {
      const tuning = index.getMetadataFromUri(metadata.uri.with({
        path: metadata.uri.path.replace(/\.SimData\.xml$/, ".xml"),
      }));

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


export function inferTuningMetadata(uri: vscode.Uri): TuningMetadata {
  const def: TuningMetadata = { kind: "tuning", uri };

  // TODO:

  return def;
}

/**
 * Returns the metadata
 * 
 * @param uri URI to XML SimData file
 * @param index Index for current workspace
 */
export function inferSimDataMetadata(uri: vscode.Uri, index?: ResourceIndex): SimDataMetadata {
  const def: SimDataMetadata = { kind: "simdata", uri };

  // TODO:

  return def;
}

//#region Helper Functions



//#endregion


// export function inferXmlMetaData(uri: vscode.Uri, index?: ResourceIndex): ResourceMetaData | undefined {
//   if (!uri.fsPath.endsWith(".xml")) return;
//   return uri.fsPath.endsWith(".SimData.xml")
//     ? _inferSimDataMetaData(uri)
//     : _inferTuningMetaData(uri);
// }

// function _inferSimDataMetaData(uri: vscode.Uri): ResourceMetaData {
//   const metadata: ResourceMetaData = { kind: "simdata", uri: uri, key: {} };

//   // TODO:
//   const document = findOpenDocument(uri);
//   // return document
//   //   ? _inferMetaDataFromDocument(document)
//   //   : _inferMetaDataFromFileSystem(uri);

//   return metadata;
// }

// function _inferTuningMetaData(uri: vscode.Uri): ResourceMetaData {
//   const document = findOpenDocument(uri);
//   if (document)
//     // return document
//     //   ? _inferMetaDataFromDocument(document)
//     //   : _inferMetaDataFromFileSystem(uri);


//     const metadata: ResourceMetaData = { kind: "unknown", uri: uri, key: {} };

//   // TODO:

//   return metadata;
// }
