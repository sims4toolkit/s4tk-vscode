import * as vscode from "vscode";
import { COMMAND } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { MessageButton, handleMessageButtonClick } from "#workspace/messaging";

export default function registerStblJsonCommands() {
  vscode.commands.registerCommand(
    COMMAND.stblJson.addEntryTop,
    (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      _tryAddNewEntry(editor, stblJson, "start");
    }
  );

  vscode.commands.registerCommand(
    COMMAND.stblJson.addEntryBottom,
    (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      _tryAddNewEntry(editor, stblJson, "end");
    }
  );

  vscode.commands.registerCommand(
    COMMAND.stblJson.addMetaData,
    async (editor: vscode.TextEditor | undefined, stblJson: StringTableJson) => {
      if (stblJson.format === "array") return;

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

  vscode.commands.registerCommand(
    COMMAND.stblJson.copyEntry,
    (stblJson: StringTableJson, entryIndex: number) => {
      const xml = stblJson.getEntryXml(entryIndex);
      vscode.env.clipboard.writeText(xml);
      if (S4TKWorkspace.config?.settings.showCopyConfirmation ?? true)
        vscode.window.showInformationMessage(`Copied: ${xml}`);
    }
  );
}


//#region Helpers

async function _tryAddNewEntry(
  editor: vscode.TextEditor | undefined,
  stblJson: StringTableJson,
  position: 'start' | 'end'
) {
  if (editor) {
    stblJson.addEntry({ position });
    const content = stblJson.stringify();
    if (await replaceEntireDocument(editor, content)) return;
  }

  vscode.window.showWarningMessage(
    'Something unexpected went wrong while adding an entry to this STBL JSON.',
    MessageButton.ReportProblem,
  ).then(handleMessageButtonClick);
}

//#endregion
