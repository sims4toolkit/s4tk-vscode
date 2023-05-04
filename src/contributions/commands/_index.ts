import { ExtensionContext } from "vscode";
import registerFileCreateCommands from "./file-create";
import registerHashingCommands from "./hashing";
import registerReferencesCommands from "./references";
import registerWorkspaceCommands from "./workspace";

/**
 * Registers all commands.
 */
export default function registerCommands(context: ExtensionContext) {
  registerFileCreateCommands();
  registerHashingCommands();
  registerReferencesCommands();
  registerWorkspaceCommands();
}
