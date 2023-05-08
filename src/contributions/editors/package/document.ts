import * as vscode from 'vscode';
import { Package, RawResource, StringTableResource } from '@s4tk/models';
import { ResourceKeyPair } from '@s4tk/models/types';
import { BinaryResourceType, SimDataGroup, StringTableLocale, TuningResourceType } from '@s4tk/models/enums';
import { formatResourceKey } from '@s4tk/hashing/formatting';
import ViewOnlyDocument from '../view-only/document';
import { PackageEntryInfo } from './types';

/**
 * Document containing binary DBPF data.
 */
export default class PackageDocument extends ViewOnlyDocument {
  //#region Properties

  public get index(): PackageEntryInfo[] { return this._index; }

  //#endregion

  //#region Lifecycle

  private constructor(uri: vscode.Uri, private _index: PackageEntryInfo[]) {
    super(uri);
  }

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined
  ): Promise<PackageDocument | PromiseLike<PackageDocument>> {
    const dataUri = backupId ? vscode.Uri.parse(backupId) : uri;
    const fileData = await vscode.workspace.fs.readFile(dataUri);

    const entries = Package.extractResources(Buffer.from(fileData), {
      recoveryMode: true
    }).map(entry => {
      return {
        key: formatResourceKey(entry.key, "-"),
        details: _getEntryDetails(entry),
        warnings: _getEntryWarnings(entry),
      };
    });

    return new PackageDocument(uri, entries);
  }

  //#endregion
}

//#region Helpers

function _getEntryDetails(entry: ResourceKeyPair): string {
  if (entry.key.type in BinaryResourceType) {
    if (entry.key.type === BinaryResourceType.StringTable) {
      const locale = StringTableLocale.getLocale(entry.key.instance);
      const localeName = StringTableLocale[locale] ?? "Unknown";
      return `${localeName} String Table (${(entry.value as StringTableResource).size} strings)`;
    } else if (entry.key.type === BinaryResourceType.SimData) {
      const groupName = SimDataGroup[entry.key.group] ?? "Unknown";
      return `${groupName} SimData`;
    } else {
      return BinaryResourceType[entry.key.type];
    }
  } else if (entry.key.type in TuningResourceType) {
    const tuningName = entry.key.type === TuningResourceType.Tuning
      ? "Generic"
      : TuningResourceType[entry.key.type];
    return `${tuningName} Tuning`;
  } else {
    return "Unknown";
  }
}

function _getEntryWarnings(entry: ResourceKeyPair): string[] | undefined {
  if (entry.value instanceof RawResource) {
    if (entry.key.type === BinaryResourceType.StringTable) {
      return ['Not a valid string table (it may be corrupt)'];
    } else if (entry.key.type === BinaryResourceType.SimData) {
      return ['Not a valid SimData (it may be corrupt)'];
    } else if (entry.key.type in TuningResourceType) {
      return ['Not a valid tuning file (it may be corrupt)'];
    }
  }
}

//#endregion
