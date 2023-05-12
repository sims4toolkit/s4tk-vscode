import * as vscode from "vscode";
import { StringTableResource } from "@s4tk/models";
import { COMMAND, EDITOR } from "#constants";
import StringTableJson from "#models/stbl-json";
import { tryCreateCustomFile } from "#helpers/fs";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerTS4FilesCommands() {
  vscode.commands.registerCommand(COMMAND.ts4Files.createStblBinary, (folderUri?: vscode.Uri) => {
    tryCreateCustomFile({
      promptTitle: "Name of String Table (Binary)",
      fileExtension: ".stbl",
      folderUri: folderUri,
      contentGenerator: () => (new StringTableResource()).getBuffer(),
      launchFile: (uri) => vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        EDITOR.stblBinary,
      ),
    });
  });

  vscode.commands.registerCommand(COMMAND.ts4Files.createStblJson, (folderUri?: vscode.Uri) => {
    tryCreateCustomFile({
      promptTitle: "Name of String Table (JSON)",
      fileExtension: ".stbl.json",
      folderUri: folderUri,
      contentGenerator: () => StringTableJson.generateBuffer(
        S4TKWorkspace.defaultStringTableJsonType,
        S4TKWorkspace.defaultLocale,
        S4TKWorkspace.spacesPerIndent
      ),
      launchFile: (uri) => vscode.window.showTextDocument(uri),
    });
  });
}
