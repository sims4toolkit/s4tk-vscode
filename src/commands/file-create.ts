import * as vscode from "vscode";
import { Package, StringTableResource } from "@s4tk/models";
import StringTableEditorProvider from "@editors/string-table/provider";

export default function registerFileCreateCommands() {
  vscode.commands.registerCommand('s4tk.fileCreate.stblBinary', () => {
    _createNewStringTable(false);
  });

  vscode.commands.registerCommand('s4tk.fileCreate.stblJson', () => {
    _createNewStringTable(true);
  });
}

async function _createNewStringTable(json: boolean) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Creating a new String Table requires opening a workspace");
    return;
  }

  let filename = await vscode.window.showInputBox({
    title: "Name of String Table"
  });

  if (!filename) return;

  const ext = json ? ".stbl.json" : ".stbl";

  if (!filename.endsWith(ext)) filename = filename + ext;

  const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);

  try {
    // there isn't an "exists" method, weirdly...
    await vscode.workspace.fs.stat(uri);
  } catch (e) {
    const content = json
      ? new Uint8Array([91, 93])
      : (new StringTableResource()).getBuffer();

    await vscode.workspace.fs.writeFile(uri, content);
  }

  if (json) {
    vscode.window.showTextDocument(uri);
  } else {
    vscode.commands.executeCommand('vscode.openWith', uri, StringTableEditorProvider.viewType);
  }
}
