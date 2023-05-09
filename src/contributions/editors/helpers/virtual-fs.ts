import * as path from "path";
import * as vscode from "vscode";

const _VIRTUAL_URI_REGEX = /^(?<scheme>s4tk):(?<owner>.+)\/(?<bucket>[0-9]+)\/(?<filename>[^\/]+)$/

interface VirtualUri {
  scheme: string;
  owner: string;
  bucket: number;
  filename: string;
}

class _VirtualFileSystemManager {
  private _owners = new Map<string, VirtualFileSystem>();

  set(owner: string, fs: VirtualFileSystem) {
    this._owners.set(owner.toString(), fs);
  }

  delete(owner: string) {
    this._owners.delete(owner.toString());
  }

  getContent(uri: vscode.Uri): string | undefined {
    try {
      const virtualUri = this._parseUri(uri);
      const fs = this._owners.get(virtualUri.owner);
      console.log(virtualUri);
      return fs?.getContent(virtualUri.bucket);
    } catch (_) { }
  }

  private _parseUri(uri: vscode.Uri): VirtualUri {
    const groups = _VIRTUAL_URI_REGEX.exec(uri.toString())?.groups as unknown as VirtualUri;
    groups.bucket = parseInt(groups.bucket as unknown as string);
    return groups;
  }
}

export const VirtualFileSystemManager = new _VirtualFileSystemManager();

export class VirtualFileSystem implements vscode.Disposable {
  private _base: vscode.Uri;
  private _buckets = new Map<number, string>();
  private _owner: string;

  constructor(owner: vscode.Uri) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath ?? '';
    this._owner = path.relative(root, owner.fsPath).replace(/\\/g, "/");
    this._base = vscode.Uri.parse("s4tk:" + this._owner);
    VirtualFileSystemManager.set(this._owner, this);
  }

  dispose() {
    VirtualFileSystemManager.delete(this._owner);
  }

  setContent(bucket: number, content: string) {
    this._buckets.set(bucket, content);
  }

  getContent(bucket: number): string | undefined {
    return this._buckets.get(bucket);
  }

  getUri(bucket: number, filename: string): vscode.Uri {
    return vscode.Uri.joinPath(this._base, bucket.toString(), filename);
  }
}
