import * as vscode from "vscode";
import { S4TKCommand } from "#constants";
import { S4TKSettings } from "#helpers/settings";
import { replaceEntireDocument } from "#helpers/fs";
import StringTableJson from "#stbls/stbl-json";
import { MessageButton, handleMessageButtonClick } from "#workspace/messaging";

export default function registerStblJsonCommands() {
  vscode.commands.registerCommand(S4TKCommand.stblJson.addEntry,
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

  vscode.commands.registerCommand(S4TKCommand.stblJson.addMetaData,
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

  vscode.commands.registerCommand(S4TKCommand.stblJson.copyEntry,
    (stblJson: StringTableJson, entryIndex: number) => {
      const xml = stblJson.getEntryXml(entryIndex);
      vscode.env.clipboard.writeText(xml);
      if (S4TKSettings.get("showCopyConfirmMessage"))
        vscode.window.showInformationMessage(`Copied: ${xml}`);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.stblJson.toArray,
    async (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      if (stblJson.isArray) return;

      if (editor) {
        stblJson.toArray();
        const content = stblJson.stringify();
        if (await replaceEntireDocument(editor, content)) return;
      }

      vscode.window.showWarningMessage(
        'Something unexpected went wrong while converting STBL JSON to array.',
        MessageButton.ReportProblem,
      ).then(handleMessageButtonClick);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.stblJson.toObject,
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
