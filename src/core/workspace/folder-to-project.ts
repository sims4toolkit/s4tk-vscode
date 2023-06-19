import * as path from "path";
import * as vscode from "vscode";
import { findGlobMatches, parseKeyFromTgi } from "#building/resources";
import { BinaryResourceType, SimDataGroup, TuningResourceType } from "@s4tk/models/enums";

/**
 * Prompts the user for a source folder that contains TS4 files, converts them
 * to a valid S4TK project setup, and writes those new files to a prompted
 * destination folder.
 */
export async function convertFolderToProject() {
  const sourceFolder = await _promptForFolder({
    title: "Folder Containing TS4 Resources",
    openLabel: "Use as Source"
  });

  if (!sourceFolder) return;

  const destFolder = await _promptForFolder({
    title: "Folder to Use for S4TK Project",
    openLabel: "Create S4TK Project"
  });

  if (!destFolder) return;
  // TODO: check that destination folder is empty, if not, ask to confirm

  // FIXME: make sure paths work on Windows
  const sourcePattern = path.join(sourceFolder.fsPath, "**/*");
  const matches = findGlobMatches([sourcePattern], undefined, "supported");
  matches.forEach(_processSourceFile);
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

function _processSourceFile(filepath: string) {
  const filename = path.basename(filepath);
  const key = parseKeyFromTgi(filename);

  if (key) {
    if (key.type in TuningResourceType) {
      // TODO: write to folder for tuning type, insert S4TK key comment if there
      // are any discrepancies between inference and TGI
    } else if (key.type in BinaryResourceType) {
      if (key.type === BinaryResourceType.StringTable) {
        // TODO: write to string tables folder
      } else if (key.type === BinaryResourceType.SimData) {
        if (key.group in SimDataGroup) {
          // TODO: write to folder for tuning type, do not rely on name, find
          // matching tunig from instance ID
        } else {
          // TODO: see if there is a matching tuning with same instance, if so,
          // use its type if known, else write to an "unknown" folder
        }
      } else {
        // TODO: write as-is
      }
    } else {
      // TODO: write as-is
    }
  } else if (filename.endsWith(".package")) {
    // TODO:
  } else if (filename.endsWith(".xml")) {
    // TODO:
  } else if (filename.endsWith(".stbl.json")) {
    // TODO:
  }
}
