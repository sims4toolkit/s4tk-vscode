import registerConfigCommands from "./config";
import registerHashingCommands from "./hashing";
import registerStblJsonCommands from "./stbl-json";
import registerTS4FilesCommands from "./ts4-files";
import registerTuningCommands from "./tuning";
import registerWorkspaceCommands from "./workspace";

export default function registerCommands() {
  registerConfigCommands();
  registerHashingCommands();
  registerStblJsonCommands();
  registerTS4FilesCommands();
  registerTuningCommands();
  registerWorkspaceCommands();
}
