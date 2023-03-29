import * as vscode from "vscode";
import { Package, StringTableResource } from "@s4tk/models";
import StringTableEditorProvider from "@editors/stbl-binary/provider";

export default function registerFileCreateCommands() {
  vscode.commands.registerCommand('s4tk.fileCreate.stblBinary', () => {
    _createNewFile({
      promptTitle: "Name of new String Table",
      extension: ".stbl",
      contentGenerator: () => (new StringTableResource()).getBuffer(),
      launchFile: (uri) => vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        StringTableEditorProvider.viewType
      ),
    });
  });

  vscode.commands.registerCommand('s4tk.fileCreate.stblJson', () => {
    _createNewFile({
      promptTitle: "Name of new String Table JSON",
      extension: ".stbl.json",
      contentGenerator: () => new Uint8Array([91, 93]),
      launchFile: (uri) => vscode.window.showTextDocument(uri),
    });
  });
}

async function _createNewFile(options: {
  promptTitle: string;
  extension: string;
  contentGenerator: () => Uint8Array;
  launchFile: (uri: vscode.Uri) => void;
}) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Creating a new file requires opening a workspace");
    return;
  }

  let filename = await vscode.window.showInputBox({ title: options.promptTitle });
  if (!filename) return;
  if (!filename.endsWith(options.extension)) filename = filename + options.extension;
  const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);

  if (!_fileExists(uri)) {
    await vscode.workspace.fs.writeFile(uri, options.contentGenerator());
  }

  options.launchFile(uri);
}

async function _fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    return false;
  }
}
