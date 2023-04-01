import { ExtensionContext } from "vscode";
import registerFileCreateCommands from "./file-create";
import registerHashingCommands from "./hashing";
import registerReferencesCommands from "./references";

/**
 * Registers all commands.
 */
export default function registerCommands(context: ExtensionContext) {
  registerFileCreateCommands();
  registerHashingCommands();
  registerReferencesCommands();
}
