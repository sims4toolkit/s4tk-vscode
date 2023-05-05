import registerHashingCommands from "./hashing";
import registerTS4FilesCommands from "./ts4-files";
import registerWorkspaceCommands from "./workspace";

export default function registerCommands() {
  registerHashingCommands();
  registerTS4FilesCommands();
  registerWorkspaceCommands();
}
