import * as vscode from "vscode";
import { StringTableResource } from "@s4tk/models";
import StringTableEditorProvider from "../editors/stbl-binary/provider";
import { fileExists } from "@helpers/utils";
import StringTableJson from "@models/stbl-json";

export default function registerFileCreateCommands() {
  vscode.commands.registerCommand('s4tk.ts4Files.createStblBinary', () => {
    _createNewFile({
      promptTitle: "Name of new String Table (Binary)",
      promptBody: "Enter the name of a STBL to create. You can use slashes to indicate subfolders.",
      extension: ".stbl",
      contentGenerator: () => (new StringTableResource()).getBuffer(),
      launchFile: (uri) => vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        StringTableEditorProvider.viewType
      ),
    });
  });

  vscode.commands.registerCommand('s4tk.ts4Files.createStblJson', () => {
    _createNewFile({
      promptTitle: "Name of new String Table (JSON)",
      promptBody: "Enter the name of a STBL to create. You can use slashes to indicate subfolders.",
      extension: ".stbl.json",
      contentGenerator: () => StringTableJson.generateRandomContent(),
      launchFile: (uri) => vscode.window.showTextDocument(uri),
    });
  });
}

//#region Helpers

async function _createNewFile(options: {
  promptTitle: string;
  promptBody: string;
  extension: string;
  contentGenerator: () => Uint8Array;
  launchFile: (uri: vscode.Uri) => void;
}) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Creating a new file requires opening a workspace");
    return;
  }

  let filename = await vscode.window.showInputBox({
    title: options.promptTitle,
    prompt: options.promptBody
  });

  if (!filename) return;
  if (!filename.endsWith(options.extension)) filename = filename + options.extension;
  const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);

  if (!(await fileExists(uri))) {
    await vscode.workspace.fs.writeFile(uri, options.contentGenerator());
  }

  options.launchFile(uri);
}

//#endregion
