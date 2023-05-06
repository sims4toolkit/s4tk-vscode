import * as vscode from "vscode";
import { COMMAND } from "#constants";

export default function registerTuningCommands() {
  vscode.commands.registerCommand(COMMAND.tuning.overrideGroup, () => {
    // TODO:
  });

  vscode.commands.registerCommand(COMMAND.tuning.overrideType, () => {
    // TODO:
  });
}
