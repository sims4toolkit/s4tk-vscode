import registerFileCreateCommands from "./file-create";
import registerHashingCommands from "./hashing";

/**
 * Registers all commands.
 */
export default function registerCommands() {
  registerFileCreateCommands();
  registerHashingCommands();
}
