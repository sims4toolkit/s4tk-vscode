import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ResourceKey } from "@s4tk/models/types";
import { Package, RawResource, SimDataResource } from "@s4tk/models";
import { BinaryResourceType, SimDataGroup, TuningResourceType } from "@s4tk/models/enums";
import { formatResourceType, formatResourceKey } from "@s4tk/hashing/formatting";
import { findGlobMatches, parseKeyFromTgi } from "#building/resources";

/**
 * Prompts the user for a folder containing packages and/or loose TGI files and
 * turns them into a structure that is easier to use with the S4TK extension.
 */
export async function convertFolderToProject() {
  const sourceFolderUri = await _promptForFolder({
    title: "Folder Containing TS4 Resources",
    openLabel: "Use as Source"
  });

  if (!sourceFolderUri) return;

  const destFolderUri = await _promptForFolder({
    title: "Folder to Use for S4TK Project",
    openLabel: "Create S4TK Project"
  });

  if (!destFolderUri) return;
  // TODO: check that destination folder is empty, if not, ask to confirm

  // FIXME: make sure paths work on Windows
  const sourcePattern = path.join(sourceFolderUri.fsPath, "**/*");
  const matches = findGlobMatches([sourcePattern], undefined, "supported");

  matches.forEach((sourcePath: string) => {
    _processSourceFile(sourcePath, destFolderUri.fsPath);
  });
}

async function _promptForFolder({ title, openLabel }: {
  title: string;
  openLabel: string;
}): Promise<vscode.Uri | undefined> {
  const uris = await vscode.window.showOpenDialog({
    title: title,
    openLabel: openLabel,
    defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
  });

  return uris?.[0];
}

function _appendFolder(basepath: string, ...toAppend: string[]): string {
  const folder = path.join(basepath, ...toAppend);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function _processSourceFile(sourcePath: string, destFolder: string) {
  const sourceName = path.basename(sourcePath);

  if (sourceName.endsWith(".package")) {
    const packageName = sourceName.replace(/\.package/g, "");
    const packageDest = _appendFolder(destFolder, packageName);
    const buffer = fs.readFileSync(sourcePath);
    Package.extractResources<RawResource>(buffer, {
      loadRaw: true,
      decompressBuffers: true,
    }).forEach(entry => {
      _processResource(entry.key, entry.value.buffer, packageDest);
    });
  } else {
    const key = parseKeyFromTgi(sourceName);
    if (!key) return;
    const buffer = fs.readFileSync(sourcePath);
    const resourceDest = _appendFolder(destFolder, "Packageless");
    _processResource(key, buffer, resourceDest);
  }
}

function _processResource(key: ResourceKey, buffer: Buffer, destFolder: string) {
  const getSubfolder = (...args: string[]) => _appendFolder(destFolder, ...args);

  if (key.type in TuningResourceType) {
    const subfolder = getSubfolder(TuningResourceType[key.type]);
    // TODO: if inference != key, then insert S4TK comment
    // TODO: check if file exists, if so, insert number until it doesn't
    // TODO: write to subfolder
  } else if (key.type in BinaryResourceType) {
    if (key.type === BinaryResourceType.SimData) {
      const xmlContent = buffer.slice(0, 4).toString() === "DATA"
        ? SimDataResource.from(buffer).toXmlDocument().toXml()
        : buffer.toString();

      if (key.group in SimDataGroup) {
        const subfolder = getSubfolder(SimDataGroup[key.group]);
        // TODO: if inference != key, then insert S4TK comment
        // TODO: check if file exists, if so, insert number until it doesn't
        // TODO: write to subfolder
      } else {
        const subfolder = getSubfolder("Unbound SimData", formatResourceType(key.group));
        // TODO: insert S4TK comment
        // TODO: check if file exists, if so, insert number until it doesn't
        // TODO: write to subfolder
      }
    } else if (key.type === BinaryResourceType.StringTable) {
      const subfolder = getSubfolder("StringTable");
      // TODO: write as STBL JSON with metadata
      // TODO: write as "strings_#.Language" with number that doesn't exist
    } else {
      const subfolder = getSubfolder("Raw TGI Files");
      // TODO: write as TGI file or keep in package?
    }
  } else {
    const subfolder = formatResourceType(key.type);
    // TODO: write as TGI file or keep in package?
  }
}
