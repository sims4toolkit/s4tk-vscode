import * as vscode from 'vscode';
import { ResourceEntry, ResourceKeyPair } from '@s4tk/models/types';
import { Package, RawResource, SimDataResource, StringTableResource, XmlResource } from '@s4tk/models';
import { BinaryResourceType, SimDataGroup, StringTableLocale, TuningResourceType } from '@s4tk/models/enums';
import { formatResourceKey } from '@s4tk/hashing/formatting';
import { inferXmlMetaData } from '#helpers/xml';
import S4TKWorkspace from '#workspace/s4tk-workspace';
import ViewOnlyDocument from '../view-only/document';
import { PackageIndex } from './types';
import { VirtualFileSystem } from '../helpers/virtual-fs';

/**
 * Document containing binary DBPF data.
 */
export default class PackageDocument extends ViewOnlyDocument {
  private _fs: VirtualFileSystem;
  public get fs(): VirtualFileSystem { return this._fs; }
  public get index(): PackageIndex { return this._index; }
  public get pkg(): Package { return this._pkg; }

  private constructor(
    uri: vscode.Uri,
    private _pkg: Package,
    private _index: PackageIndex
  ) {
    super(uri);
    this._fs = new VirtualFileSystem(uri);
  }

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined
  ): Promise<PackageDocument | PromiseLike<PackageDocument>> {
    const dataUri = backupId ? vscode.Uri.parse(backupId) : uri;
    const fileData = await vscode.workspace.fs.readFile(dataUri);
    const pkg = Package.from(Buffer.from(fileData), { recoveryMode: true });
    return new PackageDocument(uri, pkg, _getPkgIndex(pkg));
  }

  dispose(): void {
    this.fs.dispose();
    super.dispose();
  }

  launchVirtualFile(id: number) {
    const entry = this.pkg.get(id);
    this.fs.setContent(id, _getVirtualContent(entry));
    const uri = this.fs.getUri(id, _getVirtualFilename(entry));
    vscode.workspace.openTextDocument(uri).then(doc => {
      vscode.window.showTextDocument(doc, { preview: false });
    });
  }
}

//#region Index Helpers

function _getPkgIndex(pkg: Package): PackageIndex {
  const groups = new Map<string, ResourceEntry[]>();

  pkg.entries.forEach(entry => {
    const group = _getEntryGroup(entry);
    if (groups.has(group)) {
      groups.get(group)?.push(entry)
    } else {
      groups.set(group, [entry])
    }
  });

  const index: PackageIndex = {
    size: pkg.size,
    groups: []
  };

  groups.forEach((entries, group) => {
    index.groups.push({
      group,
      entries: entries.map(entry => ({
        id: entry.id,
        key: formatResourceKey(entry.key, "-"),
        details: _getEntryDetails(entry),
        warnings: _getEntryWarnings(entry),
      }))
    });
  });

  return index;
}

function _getEntryGroup(entry: ResourceKeyPair): string {
  if (entry.key.type in BinaryResourceType) {
    if (entry.key.type === BinaryResourceType.StringTable) {
      return "String Tables";
    } else if (entry.key.type === BinaryResourceType.SimData) {
      return "SimData";
    } else {
      return BinaryResourceType[entry.key.type];
    }
  } else if (entry.key.type in TuningResourceType) {
    return "Tuning"
  } else {
    return "Unknown";
  }
}

function _getEntryDetails(entry: ResourceKeyPair): string {
  if (entry.key.type in BinaryResourceType) {
    if (entry.key.type === BinaryResourceType.StringTable) {
      const locale = StringTableLocale.getLocale(entry.key.instance);
      const localeName = StringTableLocale[locale] ?? "Unknown";
      return `${localeName} String Table (Strings: ${(entry.value as StringTableResource).size})`;
    } else if (entry.key.type === BinaryResourceType.SimData) {
      const groupName = SimDataGroup[entry.key.group] ?? "Unknown";
      const filename = (entry.value as SimDataResource).instance?.name ?? 'Unnamed';
      return `${groupName} SimData (${filename})`;
    } else {
      return BinaryResourceType[entry.key.type];
    }
  } else if (entry.key.type in TuningResourceType) {
    const tuningName = entry.key.type === TuningResourceType.Tuning
      ? "Generic"
      : TuningResourceType[entry.key.type];
    const filename = (entry.value as XmlResource).content
      ? inferXmlMetaData((entry.value as XmlResource).content).filename ?? 'Unnamed'
      : 'Unnamed';
    return `${tuningName} Tuning (${filename})`;
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

//#region Virtual FS Helpers

function _getVirtualContent(entry: ResourceKeyPair): string {
  if (entry.value instanceof XmlResource) {
    return entry.value.content;
  } else if (entry.value instanceof SimDataResource) {
    return entry.value.toXmlDocument().toXml();
  } else if (entry.value instanceof StringTableResource) {
    return JSON.stringify(
      entry.value.toJsonObject(true),
      null,
      S4TKWorkspace.spacesPerIndent
    );
  } else {
    return "Unsupported file type."
  }
}

function _getVirtualFilename(entry: ResourceKeyPair): string {
  const filename = formatResourceKey(entry.key, "_");
  if (entry.value instanceof XmlResource) {
    return filename + ".xml";
  } else if (entry.value instanceof SimDataResource) {
    return filename + ".SimData.xml";
  } else if (entry.value instanceof StringTableResource) {
    return filename + ".stbl.json";
  } else {
    return filename + ".binary";
  }
}

//#endregion
