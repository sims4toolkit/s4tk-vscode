import * as vscode from "vscode";
import { StringTableResource } from "@s4tk/models";
import { S4TKCommand, S4TKEditor } from "#constants";
import StringTableJson from "#models/stbl-json";
import { tryCreateCustomFile } from "#helpers/fs";
import { S4TKSettings } from "#helpers/settings";

export default function registerTS4FilesCommands() {
  vscode.commands.registerCommand(S4TKCommand.ts4Files.createStblBinary, (folderUri?: vscode.Uri) => {
    tryCreateCustomFile({
      promptTitle: "Name of String Table (Binary)",
      fileExtension: ".stbl",
      folderUri: folderUri,
      contentGenerator: () => (new StringTableResource()).getBuffer(),
      launchFile: (uri) => vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        S4TKEditor.stbl,
      ),
    });
  });

  vscode.commands.registerCommand(S4TKCommand.ts4Files.createStblJson, (folderUri?: vscode.Uri) => {
    tryCreateCustomFile({
      promptTitle: "Name of String Table (JSON)",
      fileExtension: ".stbl.json",
      folderUri: folderUri,
      contentGenerator: () => Buffer.from(StringTableJson.generate(
        S4TKSettings.get("defaultStringTableJsonType")
      ).stringify()),
      launchFile: (uri) => vscode.window.showTextDocument(uri),
    });
  });
}
