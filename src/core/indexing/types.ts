import * as vscode from "vscode";
import { ResourceKey } from "@s4tk/models/types";
import { StringTableLocale } from "@s4tk/models/enums";

//#region Public Types

export type XmlMetadata = TuningMetadata | SimDataMetadata;

export interface TuningMetadata extends BaseXmlMetadata {
  kind: "tuning";
  root?: "I" | "M";
  range?: vscode.Range;
  attrs?: {
    c?: string;
    i?: string;
    m?: string;
    n?: string;
    s?: string;
  };
}

export interface SimDataMetadata extends BaseXmlMetadata {
  kind: "simdata";
}

export interface InferredResourceKey {
  key: Partial<ResourceKey>;
  sources: Partial<ResourceKeySources>;
}

export interface ResourceKeySources {
  type: string;
  group: string;
  instance: string;
}

export interface StringMetadata {
  stbl: StringTableMetadata;
  key: number;
  value: string;
  range?: vscode.Range;
}

export interface StringTableMetadata {
  uri: vscode.Uri;
}

//#endregion

//#region Private Types

interface BaseXmlMetadata {
  uri?: vscode.Uri;
  kind: "tuning" | "simdata";
  comment?: {
    type?: string;
    group?: string;
    instance?: string;
  };
}

//#endregion
