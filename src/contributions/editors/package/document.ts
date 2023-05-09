import * as vscode from 'vscode';
import { ResourceEntry, ResourceKeyPair } from '@s4tk/models/types';
import * as models from '@s4tk/models';
import * as enums from '@s4tk/models/enums';
import { formatResourceKey } from '@s4tk/hashing/formatting';
import { inferXmlMetaData } from '#helpers/xml';
import S4TKWorkspace from '#workspace/s4tk-workspace';
import ViewOnlyDocument from '../view-only/document';
import { PackageIndex, PackageIndexEntry, PackageIndexGroup } from './types';
import PackageResourceContentProvider from './package-fs';

/**
 * Document containing binary DBPF data.
 */
export default class PackageDocument extends ViewOnlyDocument {
  private _watcher: vscode.FileSystemWatcher;
  public get index(): PackageIndex { return this._index; }
  public get pkg(): models.Package { return this._pkg; }

  private constructor(
    uri: vscode.Uri,
    private _pkg: models.Package,
    private _index: PackageIndex
  ) {
    super(uri);
    this._watcher = vscode.workspace.createFileSystemWatcher(uri.fsPath, true, false, true);
    this._watcher.onDidChange(uri => this.reload());
  }

  static async create(uri: vscode.Uri): Promise<PackageDocument> {
    const data = await vscode.workspace.fs.readFile(uri);
    const pkg = models.Package.from(Buffer.from(data), { recoveryMode: true });
    return new PackageDocument(uri, pkg, _getPkgIndex(pkg));
  }

  dispose(): void {
    this._watcher.dispose();
    PackageResourceContentProvider.disposePackageDocumentContent(this.uri);
    super.dispose();
  }

  launchVirtualFile(id: number) {
    const entry = this.pkg.get(id);

    const uri = PackageResourceContentProvider.addPackageDocumentContent(
      this.uri,
      id,
      _getVirtualFilename(entry),
      _getVirtualContent(entry)
    );

    vscode.workspace.openTextDocument(uri).then(doc => {
      vscode.window.showTextDocument(doc, { preview: false });
    });
  }

  async reload() {
    PackageResourceContentProvider.disposePackageDocumentContent(this.uri);
    const data = await vscode.workspace.fs.readFile(this.uri);
    this._pkg = models.Package.from(Buffer.from(data), { recoveryMode: true });
    this._index = _getPkgIndex(this._pkg);
  }
}

//#region Index Helpers

function _getPkgIndex(pkg: models.Package): PackageIndex {
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

  groups.forEach((entries, title) => {
    index.groups.push({
      title,
      entries: entries.map(entry => ({
        id: entry.id,
        key: formatResourceKey(entry.key, "-"),
        filename: _getEntryFilename(entry),
        // TODO: find linked resources
      })).sort(_sortEntries)
    });
  });

  index.groups.sort(_sortGroups);

  return index;
}

function _getEntryGroup(entry: ResourceKeyPair): string {
  if (entry.key.type in enums.BinaryResourceType) {
    if (entry.key.type === enums.BinaryResourceType.StringTable) {
      return "String Tables";
    } else if (entry.key.type === enums.BinaryResourceType.SimData) {
      const type = enums.SimDataGroup[entry.key.group] ?? 'Unknown';
      return `SimData, ${type} (No Tuning)`;
    } else {
      return `Other, ${enums.BinaryResourceType[entry.key.type]}`;
    }
  } else if (entry.key.type in enums.TuningResourceType) {
    const type = entry.key.type === enums.TuningResourceType.Tuning ? "Generic"
      : enums.TuningResourceType[entry.key.type];
    return `Tuning, ${type}`;
  } else {
    return "Other, Unknown";
  }
}

function _getEntryFilename(entry: ResourceKeyPair): string {
  if (entry.key.type in enums.BinaryResourceType) {
    if (entry.key.type === enums.BinaryResourceType.StringTable) {
      const locale = enums.StringTableLocale.getLocale(entry.key.instance);
      const localeName = enums.StringTableLocale[locale] ?? "Unknown";
      return `${localeName} (Strings: ${(entry.value as models.StringTableResource).size})`;
    } else if (entry.key.type === enums.BinaryResourceType.SimData) {
      const filename = (entry.value as models.SimDataResource).instance?.name;
      return filename ? `${filename} (SimData)` : 'Unnamed SimData';
    } else {
      return enums.BinaryResourceType[entry.key.type];
    }
  } else if (entry.key.type in enums.TuningResourceType) {
    return ((entry.value as models.XmlResource).content
      ? inferXmlMetaData((entry.value as models.XmlResource).content).filename
      : null) ?? 'Unnamed Tuning';
  } else {
    return "Unknown";
  }
}

function _sortGroups(g1: PackageIndexGroup, g2: PackageIndexGroup): number {
  const priority = ["T", "Si", "St", "O"];
  const p1 = priority.findIndex(p => g1.title.startsWith(p));
  const p2 = priority.findIndex(p => g2.title.startsWith(p));
  if (p1 === p2) {
    if (g1.title > g2.title) return 1;
    if (g1.title < g2.title) return -1;
    return 0;
  } else {
    return p1 - p2;
  }
}

function _sortEntries(e1: PackageIndexEntry, e2: PackageIndexEntry): number {
  if (e1.filename > e2.filename) return 1;
  if (e1.filename < e2.filename) return -1;
  return 0;
}

//#endregion

//#region Virtual FS Helpers

function _getVirtualContent(entry: ResourceKeyPair): string {
  if (entry.value instanceof models.XmlResource) {
    return entry.value.content;
  } else if (entry.value instanceof models.SimDataResource) {
    return entry.value.toXmlDocument().toXml();
  } else if (entry.value instanceof models.StringTableResource) {
    return JSON.stringify(
      entry.value.toJsonObject(true),
      null,
      S4TKWorkspace.spacesPerIndent
    );
  } else {
    return entry.value.getBuffer().toString();
  }
}

function _getVirtualFilename(entry: ResourceKeyPair): string {
  const filename = formatResourceKey(entry.key, "_");
  if (entry.value instanceof models.XmlResource) {
    return filename + ".xml";
  } else if (entry.value instanceof models.SimDataResource) {
    return filename + ".SimData.xml";
  } else if (entry.value instanceof models.StringTableResource) {
    return filename + ".stbl.json";
  } else {
    return filename + ".binary";
  }
}

//#endregion
