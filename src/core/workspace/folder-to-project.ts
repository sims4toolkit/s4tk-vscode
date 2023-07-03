import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ResourceKey } from "@s4tk/models/types";
import { Package, RawResource, SimDataResource, StringTableResource } from "@s4tk/models";
import { BinaryResourceType, SimDataGroup, TuningResourceType } from "@s4tk/models/enums";
import { formatResourceType, formatResourceKey, formatAsHexString } from "@s4tk/hashing/formatting";
import { findGlobMatches, parseKeyFromTgi } from "#building/resources";
import StringTableJson from "#stbls/stbl-json";
import * as inference from "#indexing/inference";

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
  if (fs.readdirSync(destFolderUri.fsPath).some(dirent => !dirent.startsWith("."))) {
    const selected = await vscode.window.showWarningMessage(
      "The chosen output directory is not empty. Are you sure you want to generate your project files here?",
      "Yes",
      "Cancel"
    );

    if (selected === "Cancel") return;
  }

  const sourcePattern = path.join(sourceFolderUri.fsPath, "**/*").replace(/\\/g, "/");
  const matches = findGlobMatches([sourcePattern], undefined, "supported");

  matches.forEach((sourcePath: string) => {
    _processSourceFile(sourcePath, destFolderUri.fsPath);
  });
}

//#region Helpers

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

function _getDestFilename(destFolder: string, filename: string, ext: string): string {
  const baseDestPath = path.join(
    destFolder,
    filename.includes(":")
      ? filename.split(":").slice(1).join(":")
      : filename
  );

  let index = 0;
  let destPath = baseDestPath;
  while (fs.existsSync(`${destPath}.${ext}`)) {
    destPath = `${baseDestPath}_${index++}`;
  }

  return `${destPath}.${ext}`;
}

function _processSourceFile(sourcePath: string, destFolder: string) {
  const sourceName = path.basename(sourcePath);

  if (sourceName.endsWith(".package")) {
    const packageName = sourceName.replace(/\.package/g, "");
    const packageDest = _appendFolder(destFolder, "Packages", packageName);
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
    const resourceDest = _appendFolder(destFolder, "Loose Files");
    _processResource(key, buffer, resourceDest);
  }
}

function _processResource(key: ResourceKey, buffer: Buffer, destFolder: string) {
  const getSubfolder = (...args: string[]) => _appendFolder(destFolder, ...args);

  if (key.type in TuningResourceType) {
    const subfolder = getSubfolder(TuningResourceType[key.type]);
    let xmlContent = buffer.toString();

    const metadata = inference.inferTuningMetadata(xmlContent);
    const inferredKey = inference.inferKeyFromMetadata(metadata);

    const overrides = {
      type: key.type !== inferredKey.key.type
        ? formatAsHexString(key.type, 8, false)
        : undefined,
      group: key.group !== 0
        ? formatAsHexString(key.group, 8, false)
        : undefined,
      instance: key.instance !== inferredKey.key.instance
        ? formatAsHexString(key.instance, 16, false)
        : undefined,
    };

    xmlContent = inference.insertXmlKeyOverrides(xmlContent, overrides) ?? xmlContent;

    // FIXME: remove creator name prefix
    fs.writeFileSync(
      _getDestFilename(subfolder, metadata.attrs?.n ?? "UnnamedTuning", "xml"),
      xmlContent
    );
  } else if (key.type in BinaryResourceType) {
    if (key.type === BinaryResourceType.SimData) {
      const subfolder = key.group in SimDataGroup
        ? getSubfolder(SimDataGroup[key.group])
        : getSubfolder("SimData", formatResourceType(key.group));

      const simdata = buffer.slice(0, 4).toString() === "DATA"
        ? SimDataResource.from(buffer)
        : SimDataResource.fromXml(buffer);

      const xmlContent = simdata.toXmlDocument().toXml();

      // TODO: insert group and instance override if tuning not found

      fs.writeFileSync(
        _getDestFilename(subfolder, simdata.instance.name, "SimData.xml"),
        xmlContent
      );
    } else if (key.type === BinaryResourceType.StringTable) {
      const subfolder = getSubfolder("StringTable");
      const stbl = StringTableResource.from(buffer);
      const stblJson = StringTableJson.fromBinary(key, stbl);

      fs.writeFileSync(
        _getDestFilename(subfolder, stblJson.locale!, "stbl.json"),
        stblJson.stringify()
      );
    } else {
      fs.writeFileSync(
        _getDestFilename(
          getSubfolder(BinaryResourceType[key.type]),
          formatResourceKey(key, "_"),
          key.type === BinaryResourceType.DdsImage || key.type === BinaryResourceType.DstImage
            ? "dds"
            : "binary"
        ),
        buffer
      );
    }
  } else {
    fs.writeFileSync(
      _getDestFilename(
        getSubfolder("Unsupported", formatResourceType(key.type)),
        formatResourceKey(key, "_"),
        "binary"
      ),
      buffer
    );
  }
}

//#endregion
