import * as vscode from "vscode";
import { COMMAND } from "#constants";
import { SCHEMA_DEFAULTS } from "#assets";
import { fileExists } from "#helpers/fs";
import { S4TKConfig } from "#models/s4tk-config";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(COMMAND.workspace.createWorkspace, _createDefaultProject);

  vscode.commands.registerCommand(COMMAND.workspace.reloadConfig, () => {
    S4TKWorkspace.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand(COMMAND.workspace.setDefaultStbl, (uri: vscode.Uri) => {
    S4TKWorkspace.setDefaultStbl(uri);
  });
}

//#region Helpers

async function _createDefaultProject() {
  // confirm workspace doesn't already exist
  const configInfo = await S4TKConfig.find();
  if (configInfo.exists) {
    vscode.window.showWarningMessage("S4TK config file already exists.");
    return;
  } else if (!configInfo.uri) {
    vscode.window.showErrorMessage("Failed to locate URI for config file.");
    return;
  }

  const configData = await vscode.workspace.fs.readFile(SCHEMA_DEFAULTS.config);

  vscode.workspace.fs.writeFile(configInfo.uri, configData).then(() => {
    vscode.window.showTextDocument(configInfo.uri!);
    S4TKWorkspace.loadConfig();
  });

  const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri as vscode.Uri;
  vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "out"));
  vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "src"));
  vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, "strings"));

  const stblUri = vscode.Uri.joinPath(rootUri, "strings", "default.stbl.json");
  if (!(await fileExists(stblUri))) {
    const stblJson = StringTableJson.generate("object");
    const stblBuffer = Buffer.from(stblJson.stringify());
    vscode.workspace.fs.writeFile(stblUri, stblBuffer);
  }
}

//#endregion
