import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { SimDataResource, XmlResource } from "@s4tk/models";
import { XmlCommentNode, XmlDocumentNode, XmlNode, XmlValueNode } from "@s4tk/xml-dom";
import { replaceEntireDocument } from "#helpers/fs";
import { insertXmlKeyOverrides } from "#indexing/inference";
import { reduceBits } from "#helpers/hashing";
import { maxBitsForClass } from "#diagnostics/helpers";
import { S4TKSettings } from "#helpers/settings";
import { sanitizeXmlComment } from "#helpers/xml";
import type S4TKWorkspace from "#workspace/s4tk-workspace";

/**
 * Clones the tuning file (and its SimData, if it has one) at the given URI,
 * prompting the user for a new name to use. A new hash with the correct number
 * of bits will be generated as well.
 * 
 * @param srcUri URI of source file to clone
 * @returns Array of created URIs, if any (undefined if not)
 */
export async function cloneWithNewName(srcUri: vscode.Uri): Promise<vscode.Uri[] | undefined> {
  return _renameTuningAndSimData(srcUri, "clone");
}

/**
 * Updates the name the tuning file (and its SimData, if it has one) at the
 * given URI, both within the file and on disc. A new hash with the correct
 * number of bits will be generated as well.
 * 
 * @param srcUri URI of source file to clone
 * @returns Array of created URIs, if any (undefined if not)
 */
export async function renameTuningFile(srcUri: vscode.Uri): Promise<vscode.Uri[] | undefined> {
  return _renameTuningAndSimData(srcUri, "rename");
}

/**
 * Inserts a TGI override comment to the document in the given editor.
 * 
 * @param editor Editor containing the document to edit
 * @param kind Which TGI value to override
 * @param value Value of override
 */
export async function overrideTgiComment(
  editor: vscode.TextEditor,
  kind: "group" | "type" | "instance",
  value: number | bigint
) {
  if (!editor?.document) return;
  const args: any = {};
  args[kind] = formatAsHexString(value, kind === "instance" ? 16 : 8, false);
  const newContent = insertXmlKeyOverrides(editor.document.getText(), args);
  if (newContent) replaceEntireDocument(editor, newContent, false);
}

/**
 * Restores comments in the XML (tuning or SimData) files at the given paths.
 * 
 * @param filepaths Paths to XML files to restore comments in
 */
export function restoreStringCommentsForFiles(filepaths: string[], workspace: S4TKWorkspace) {
  const commentMap = workspace.getStringCommentsMap();
  if (commentMap.size < 1) return vscode.window.showErrorMessage(
    "No string tables with strings found in stringTableSettings.commentRestoration.sources"
  );

  if (filepaths.length === 1) {
    _restoreStringCommentsForSingleFile(filepaths[0], commentMap);
  } else {
    _restoreStringCommentsForMultipleFiles(filepaths, commentMap);
  }
}

//#region Helpers

function _restoreStringCommentsForSingleFile(filepath: string, commentMap: Map<number, string>) {
  const filename = path.basename(filepath);

  try {
    _restoreStringCommentsForFile(filepath, commentMap);
    vscode.window.showInformationMessage(`String comments restored in '${filename}'`);
  } catch (_) {
    vscode.window.showErrorMessage(`Failed to restore string comments in '${filename}'`);
  }
}

function _restoreStringCommentsForMultipleFiles(filepaths: string[], commentMap: Map<number, string>) {
  let failed = 0;
  let succeeded = 0;

  filepaths.forEach(filepath => {
    try {
      _restoreStringCommentsForFile(filepath, commentMap);
      ++succeeded;
    } catch (_) {
      ++failed;
    }
  });

  if (succeeded) {
    if (failed) {
      vscode.window.showWarningMessage(
        `Comments restored in some XML files [${succeeded} succeeded; ${failed} failed]`
      );
    } else {
      vscode.window.showInformationMessage(
        `Comments restored in all XML files [${succeeded} succeeded]`
      );
    }
  } else {
    vscode.window.showErrorMessage(failed
      ? `Comments not restored in any XML files [${failed} failed]`
      : "Cannot restore comments because no XML files were found."
    );
  }
}

function _restoreStringCommentsForFile(filepath: string, commentMap: Map<number, string>) {
  if (!fs.existsSync(filepath)) return;

  const buffer = fs.readFileSync(filepath);
  const doc = XmlDocumentNode.from(buffer);
  if (!_canRestoreComments(doc)) return;
  const keyRegex = /^0x[0-9a-f]{1,8}$/i;

  function processNode(node: XmlNode) {
    if (!(node.hasChildren && node.numChildren > 0)) return;

    let commentToRestore: string | undefined;

    node.children.forEach(child => {
      if (child.hasChildren) {
        processNode(child);
      } else if (child instanceof XmlValueNode) {
        if (typeof child.value === "string" && keyRegex.test(child.value)) {
          const stringKey = parseInt(child.value, 16);
          const stringValue = commentMap.get(stringKey);
          if (stringValue != undefined)
            commentToRestore = sanitizeXmlComment(stringValue);
        }
      } else if (child instanceof XmlCommentNode) {
        if (commentToRestore != undefined) {
          child.value = commentToRestore;
          commentToRestore = undefined;
        }
      }
    });

    if (commentToRestore != undefined) {
      node.children.push(new XmlCommentNode(commentToRestore));
    }
  }

  processNode(doc);

  fs.writeFileSync(filepath, doc.toXml({
    spacesPerIndent: S4TKSettings.getSpacesPerIndent()
  }));
}

function _canRestoreComments(doc: XmlDocumentNode): boolean {
  try {
    const rootTag = doc.children.find(c => c.tag)?.tag;
    switch (rootTag) {
      case "I":
      case "M":
      case "SimData":
        return true;
      default:
        return false;
    }
  } catch (_) {
    return false;
  }
}

async function _renameTuningAndSimData(srcUri: vscode.Uri, operation: "clone" | "rename"): Promise<vscode.Uri[] | undefined> {
  // TODO: this function is pretty ugly, but it works, probably wanna refactor
  // later, especially replacing the XML DOM parsing with a regex that just
  // replaces the contents of the declaration line
  if (!fs.existsSync(srcUri.fsPath)) return;

  const tuning = XmlResource.from(fs.readFileSync(srcUri.fsPath));
  const originalFilename = tuning.root.name;

  const simdataSrc = srcUri.fsPath.replace(/\.xml$/i, ".SimData.xml");
  const hasSimdata = fs.existsSync(simdataSrc);
  const fileTypes = hasSimdata ? "Tuning & SimData" : "Tuning";

  const newFilename = await vscode.window.showInputBox({
    title: `Enter New Name of ${fileTypes}`,
    prompt: "Name will be hashed for a new instance.",
    value: originalFilename
  });
  if (!newFilename) return;
  if (newFilename === originalFilename) {
    vscode.window.showErrorMessage("Cannot use current filename.");
    return;
  }

  const tuningFsPath = path.join(
    path.dirname(srcUri.fsPath),
    `${newFilename.replace(/^[^:]*:/, "")}.xml`
  );

  if (fs.existsSync(tuningFsPath)) {
    const selected = await vscode.window.showWarningMessage(
      "Tuning file with this name already exists. Do you want to overwrite it?",
      "Yes",
      "Cancel"
    );

    if (selected === "Cancel") return;
  }

  tuning.updateRoot(root => {
    root.name = newFilename;

    root.id = tuning.root.tag === "I"
      ? reduceBits(fnv64(newFilename), maxBitsForClass(tuning.root.attributes.c))
      : fnv64(newFilename.replace(/\./g, "-"));
  });

  async function writeRenamedFile(content: Buffer, location: {
    original: vscode.Uri;
    renamed: vscode.Uri,
  }) {
    if (operation === "clone") {
      await vscode.workspace.fs.writeFile(location.renamed, content);
    } else if (operation === "rename") {
      await vscode.workspace.fs.rename(location.original, location.renamed, {
        overwrite: true
      });

      await vscode.workspace.fs.writeFile(location.renamed, content);
    }
  }

  const newTuningUri = vscode.Uri.file(tuningFsPath);
  const createdUris = [newTuningUri];
  await writeRenamedFile(
    Buffer.from(tuning.dom.toXml({
      spacesPerIndent: S4TKSettings.getSpacesPerIndent()
    })), {
    original: srcUri,
    renamed: newTuningUri
  });

  if (hasSimdata) {
    const simdataFsPath = tuningFsPath.replace(/\.xml$/, ".SimData.xml");
    const simdata = SimDataResource.fromXml(fs.readFileSync(simdataSrc));
    simdata.instance.name = newFilename;

    const newSimDataUri = vscode.Uri.file(simdataFsPath);
    createdUris.push(newSimDataUri);
    await writeRenamedFile(
      Buffer.from(simdata.toXmlDocument().toXml({
        spacesPerIndent: S4TKSettings.getSpacesPerIndent()
      })), {
      original: vscode.Uri.file(simdataSrc),
      renamed: newSimDataUri
    });
  }

  return createdUris;
}

//#endregion
