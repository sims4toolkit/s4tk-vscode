import * as vscode from "vscode";
import { StringTableResource } from "@s4tk/models";
import { StringTableLocale } from "@s4tk/models/enums";
import { fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import StringTableEditorProvider from "@editors/stbl-binary/provider";
import { fileExists, saltedUuid } from "@helpers/utils";

export default function registerFileCreateCommands() {
  vscode.commands.registerCommand('s4tk.ts4Files.createStblBinary', () => {
    _createNewFile({
      promptTitle: "Name of new String Table (Binary)",
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
      extension: ".stbl.json",
      contentGenerator: _getStblJsonContent,
      launchFile: (uri) => vscode.window.showTextDocument(uri),
    });
  });
}

//#region Helpers

function _getStblJsonContent(): Uint8Array {
  const json = {
    group: "0x80000000",
    instanceBase: formatAsHexString(
      StringTableLocale.getInstanceBase(fnv64(saltedUuid())),
      14,
      true
    ),
    locale: "English",
    entries: []
  };

  return Buffer.from(JSON.stringify(json, null, 2));
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

  if (!(await fileExists(uri))) {
    await vscode.workspace.fs.writeFile(uri, options.contentGenerator());
  }

  options.launchFile(uri);
}

//#endregion
