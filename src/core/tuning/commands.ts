import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { SimDataResource, XmlResource } from "@s4tk/models";
import { replaceEntireDocument, simplifyTuningFilename } from "#helpers/fs";
import { insertXmlKeyOverrides } from "#indexing/inference";
import { reduceBits } from "#helpers/hashing";
import { maxBitsForClass } from "#diagnostics/helpers";

/**
 * Clones the tuning file (and its SimData, if it has one) at the given URI,
 * prompting the user for a new name to use. A new hash with the correct number
 * of bits will be generated as well.
 * 
 * @param srcUri URI of source file to clone
 */
export async function cloneWithNewName(srcUri: vscode.Uri) {
  // TODO: this function is pretty ugly, but it works, probably wanna refactor
  // later, especially replacing the XML DOM parsing with a regex that just
  // replaces the contains of the declaration line
  if (!fs.existsSync(srcUri.fsPath)) return;

  const tuning = XmlResource.from(fs.readFileSync(srcUri.fsPath));
  const originalFilename = tuning.root.name;

  const simdataSrc = srcUri.fsPath.replace(/\.xml$/i, ".SimData.xml");
  const hasSimdata = fs.existsSync(simdataSrc);
  const fileTypes = hasSimdata ? "Tuning & SimData" : "Tuning";

  const newFilename = await vscode.window.showInputBox({
    title: `Enter Name of New ${fileTypes}`,
    prompt: hasSimdata
      ? "Name will be hashed for a new instance. Paired SimData will be cloned too."
      : "Name will be hashed for a new instance.",
    value: originalFilename
  });
  if (!newFilename) return;
  if (newFilename === originalFilename) {
    vscode.window.showErrorMessage("Cannot use existing filename.");
    return;
  }

  const tuningFsPath = path.join(
    path.dirname(srcUri.fsPath),
    simplifyTuningFilename(newFilename)
  );

  if (fs.existsSync(tuningFsPath)) {
    const selected = await vscode.window.showWarningMessage(
      "A tuning file already exists at the chosen location. Do you want to overwrite it?",
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

  vscode.workspace.fs.writeFile(
    vscode.Uri.file(tuningFsPath),
    tuning.getBuffer()
  );

  if (hasSimdata) {
    const simdataFsPath = tuningFsPath.replace(/\.xml$/, ".SimData.xml");
    const simdata = SimDataResource.fromXml(fs.readFileSync(simdataSrc));
    simdata.instance.name = newFilename;
    vscode.workspace.fs.writeFile(
      vscode.Uri.file(simdataFsPath),
      Buffer.from(simdata.toXmlDocument().toXml()),
    );
  }
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
