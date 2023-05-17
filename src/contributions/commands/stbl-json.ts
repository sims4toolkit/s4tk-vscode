import * as vscode from "vscode";
import { COMMAND } from "#constants";
import { S4TKSettings } from "#helpers/settings";
import { replaceEntireDocument } from "#helpers/fs";
import StringTableJson from "#models/stbl-json";
import { MessageButton, handleMessageButtonClick } from "#workspace/messaging";

export default function registerStblJsonCommands() {
  vscode.commands.registerCommand(COMMAND.stblJson.addEntry,
    async (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      if (editor) {
        const start = S4TKSettings.get("newStringsToStartOfStringTable");
        stblJson.addEntry({ position: start ? "start" : "end" });
        const content = stblJson.stringify();
        if (await replaceEntireDocument(editor, content)) return;
      }

      vscode.window.showWarningMessage(
        'Something unexpected went wrong while adding an entry to this STBL JSON.',
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
    }
  );

  vscode.commands.registerCommand(COMMAND.stblJson.addMetaData,
    async (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      if (stblJson.hasMetaData) return;

      if (editor) {
        stblJson.insertDefaultMetadata();
        const content = stblJson.stringify();
        if (await replaceEntireDocument(editor, content)) return;
      }

      vscode.window.showWarningMessage(
        'Something unexpected went wrong while adding meta data to this STBL JSON.',
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
    }
  );

  vscode.commands.registerCommand(COMMAND.stblJson.copyEntry,
    (stblJson: StringTableJson, entryIndex: number) => {
      const xml = stblJson.getEntryXml(entryIndex);
      vscode.env.clipboard.writeText(xml);
      if (S4TKSettings.get("showCopyConfirmMessage"))
        vscode.window.showInformationMessage(`Copied: ${xml}`);
    }
  );

  vscode.commands.registerCommand(COMMAND.stblJson.toArray,
    async (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      if (stblJson.isArray) return;

      if (editor) {
        stblJson.toArray();
        stblJson.insertDefaultMetadata();
        const content = stblJson.stringify();
        if (await replaceEntireDocument(editor, content)) return;
      }

      vscode.window.showWarningMessage(
        'Something unexpected went wrong while converting STBL JSON to array.',
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
    }
  );

  vscode.commands.registerCommand(COMMAND.stblJson.toObject,
    async (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      if (stblJson.isObject) return;

      if (editor) {
        stblJson.toObject();
        const content = stblJson.stringify();
        if (await replaceEntireDocument(editor, content)) return;
      }

      vscode.window.showWarningMessage(
        'Something unexpected went wrong while converting STBL JSON to object.',
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
    }
  );
}
