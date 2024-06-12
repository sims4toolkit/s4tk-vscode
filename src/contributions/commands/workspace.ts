import * as vscode from "vscode";
import { S4TKCommand } from "#constants";
import { runBuild } from "#building/build-runner";
import * as stbls from "#stbls/stbl-commands";
import { convertFolderToProject } from "#workspace/folder-to-project";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import { isURI } from "./isURI";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(S4TKCommand.workspace.build, async (uri?: vscode.Uri) => {
    if (!isURI(uri)) {
      uri = undefined;
    }
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    if (workspace) runBuild(workspace, "build", "Build");
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.buildDryRun, async (uri?: vscode.Uri) => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    if (workspace) runBuild(workspace, "dryrun", "Dry Run");
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.buildRelease, async (uri?: vscode.Uri) => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    if (workspace) runBuild(workspace, "release", "Release");
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.createConfig, async (uri?: vscode.Uri) => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    workspace?.createConfig(true);
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.createWorkspace, async (uri?: vscode.Uri) => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    workspace?.createDefaultWorkspace();
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.reloadConfig, async (uri?: vscode.Uri) => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    workspace?.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.setDefaultStbl, async (uri: vscode.Uri) => {
    const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(uri);

    if (!workspace?.active) {
      vscode.window.showErrorMessage("The selected file is not a part of an active S4TK project.");
    } else {
      workspace.setDefaultStbl(uri);
    }
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.createStblFragment, async (uri?: vscode.Uri) => {
    if (uri) stbls.createStblFragment(uri);
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.addNewString, async (uri?: vscode.Uri) => {
    if (uri) {
      stbls.addStringToStbl(uri);
    } else {
      const workspace = await S4TKWorkspaceManager.chooseWorkspace();
      if (workspace) stbls.addStringToDefaultStbl(workspace);
    }
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.refreshIndex, async () => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace();
    if (workspace) workspace.index.refresh();
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.folderToProject, convertFolderToProject);
}
