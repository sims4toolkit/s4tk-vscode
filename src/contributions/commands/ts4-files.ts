import * as vscode from "vscode";
import { StringTableResource } from "@s4tk/models";
import { COMMAND, EDITOR } from "#constants";
import StringTableJson from "#models/stbl-json";
import { tryCreateCustomFile } from "#helpers/fs";

export default function registerTS4FilesCommands() {
  vscode.commands.registerCommand(COMMAND.ts4Files.createStblBinary, () => {
    tryCreateCustomFile({
      promptTitle: "Name of New String Table (Binary)",
      fileExtension: ".stbl",
      contentGenerator: () => (new StringTableResource()).getBuffer(),
      launchFile: (uri) => vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        EDITOR.stblBinary,
      ),
    });
  });

  vscode.commands.registerCommand(COMMAND.ts4Files.createStblJson, () => {
    tryCreateCustomFile({
      promptTitle: "Name of New String Table (JSON)",
      fileExtension: ".stbl.json",
      contentGenerator: () => StringTableJson.generateBuffer("object"),
      launchFile: (uri) => vscode.window.showTextDocument(uri),
    });
  });
}
