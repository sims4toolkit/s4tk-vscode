import * as vscode from "vscode";
import { COMMAND } from "#constants";

export default function registerStblJsonCommands() {
  vscode.commands.registerCommand(COMMAND.stblJson.addEntry, () => {
    // TODO:
  });

  vscode.commands.registerCommand(COMMAND.stblJson.addMetaData, () => {
    // TODO:
  });

  vscode.commands.registerCommand(COMMAND.stblJson.copyEntry, () => {
    // TODO:
  });
}
