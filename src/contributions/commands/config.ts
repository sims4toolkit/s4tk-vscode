import * as vscode from "vscode";
import { COMMAND } from "#constants";

export default function registerConfigCommands() {
  vscode.commands.registerCommand(COMMAND.config.addPackage, () => {
    // TODO:
  });
}
