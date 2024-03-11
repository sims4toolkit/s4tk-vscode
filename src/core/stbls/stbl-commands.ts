import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { formatStringKey } from "@s4tk/hashing/formatting";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import StringTableProxy from "#stbls/stbl-proxy";
import StringTableJson from "#stbls/stbl-json";

/**
 * Adds a string to a specific STBL by its URI.
 * 
 * @param uri URI of STBL to add string to
 */
export async function addStringToStbl(uri: vscode.Uri) {
  const stblBasename = path.basename(uri.fsPath);

  try {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      var stbl = new StringTableProxy(bytes);
    } catch (e) {
      vscode.window.showErrorMessage(`'${stblBasename}' is not a valid string table.`);
      return;
    }

    const input = await vscode.window.showInputBox({
      title: "Enter String Text",
      prompt: "A random FNV32 will be generated for the key.",
    });

    if (!input) return;
    const key = stbl.addValue(input);
    await vscode.workspace.fs.writeFile(uri, stbl.serialize());

    const clickToCopy = "Copy as XML";
    vscode.window.showInformationMessage(
      `Added new string to '${stblBasename}'`,
      clickToCopy,
    ).then(value => {
      if (value === clickToCopy)
        vscode.env.clipboard.writeText(`${formatStringKey(key)}<!--${input}-->`);
    });
  } catch (e) {
    vscode.window.showErrorMessage(`Could not add string to '${stblBasename}' [${e}]`);
  }
}

/**
 * Adds a string to the default STBL for the given workspace.
 * 
 * @param workspace Workspace to get default STBL for
 */
export async function addStringToDefaultStbl(workspace: S4TKWorkspace) {
  const defaultStringTable = workspace.config.stringTableSettings.defaultStringTable;

  if (!defaultStringTable) {
    vscode.window.showWarningMessage(`Cannot add string because no default string table is set in the S4TK config.`);
    return;
  }

  const uri = vscode.Uri.file(workspace.resolvePath(defaultStringTable));
  addStringToStbl(uri);
}

/**
 * Creates a fragment from the STBL at the given URI.
 * 
 * @param uri URI of STBL to create fragment from
 */
export async function createStblFragment(uri: vscode.Uri) {
  const dirname = path.dirname(uri.fsPath);
  const filename = path.basename(uri.fsPath);

  try {
    let fragmentName = await vscode.window.showInputBox({
      title: "Enter the name to use for the fragment.",
      prompt: `Name cannot be the same as an existing file in the '${dirname}' folder.`,
      value: filename.replace(/\.stbl\.json$/, "")
    });

    if (!fragmentName) return;
    if (!fragmentName.endsWith(".stbl.json")) fragmentName += ".stbl.json";
    const fragmentUri = vscode.Uri.file(path.join(dirname, fragmentName));
    if (fs.existsSync(fragmentUri.fsPath)) {
      vscode.window.showWarningMessage("Cannot create a fragment at the chosen location because that file already exists.");
      return;
    }

    const content = await vscode.workspace.fs.readFile(uri);
    const source = StringTableJson.parse(content.toString());
    const fragment = source.toFragment();
    vscode.workspace.fs.writeFile(fragmentUri, Buffer.from(fragment.stringify()))
  } catch (e) {
    vscode.window.showErrorMessage(`Failed to create fragment from '${filename}' [${e}]`);
  }
}
