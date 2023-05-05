import registerFileCreateCommands from "./file-create";
import registerHashingCommands from "./hashing";
import registerReferencesCommands from "./references";
import registerWorkspaceCommands from "./workspace";

export default function registerCommands() {
  registerFileCreateCommands();
  registerHashingCommands();
  registerReferencesCommands();
  registerWorkspaceCommands();
}
