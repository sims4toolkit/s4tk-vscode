import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { formatStringKey } from "@s4tk/hashing/formatting";
import { S4TKCommand } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import StringTableProxy from "#stbls/stbl-proxy";
import { convertFolderToProject } from "#workspace/folder-to-project";
import StringTableJson from "#stbls/stbl-json";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import { runBuild } from "#building/build-runner";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(S4TKCommand.workspace.build, async (uri?: vscode.Uri) => {
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

  vscode.commands.registerCommand(S4TKCommand.workspace.createStblFragment, async (uri: vscode.Uri) => {
    try {
      // TODO: move this logic somewhere else
      const dirname = path.dirname(uri.fsPath);
      const filename = path.basename(uri.fsPath);

      let fragmentName = await vscode.window.showInputBox({
        title: "Enter the name to use for the fragment.",
        value: filename.replace(/\.stbl\.json$/, "")
      });

      if (!fragmentName) return;
      if (!fragmentName.endsWith(".stbl.json")) fragmentName += ".stbl.json";
      const fragmentUri = vscode.Uri.file(path.join(dirname, fragmentName));
      if (fs.existsSync(fragmentUri.fsPath)) {
        vscode.window.showWarningMessage("Cannot create a fragment at the chosen location because that file already exists.");
        return;
      }

      const content = await vscode.workspace.fs.readFile(uri);
      const source = StringTableJson.parse(content.toString());
      const fragment = source.toFragment();
      vscode.workspace.fs.writeFile(fragmentUri, Buffer.from(fragment.stringify()))
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to create fragment: ${e}`);
    }
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.addNewString, async (uri?: vscode.Uri) => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace(uri);
    if (workspace) _addNewString(workspace, uri);
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.refreshIndex, async () => {
    const workspace = await S4TKWorkspaceManager.chooseWorkspace();
    if (workspace) workspace.index.refresh();
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.folderToProject, convertFolderToProject);
}

//#region Helpers

async function _addNewString(workspace: S4TKWorkspace, clickedUri?: vscode.Uri) {
  try {
    let uri = clickedUri;
    if (!uri) {
      const defaultStringTable = workspace.config.stringTableSettings.defaultStringTable;

      if (!defaultStringTable) {
        vscode.window.showWarningMessage("Cannot add string because no default string table is set in s4tk.config.json.");
        return;
      }

      uri = vscode.Uri.parse(workspace.resolvePath(defaultStringTable));
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      var stbl = new StringTableProxy(bytes);
    } catch (e) {
      vscode.window.showErrorMessage(`Path '${uri.fsPath}' does not lead to a valid string table.`);
      return;
    }

    const input = await vscode.window.showInputBox({
      title: "Enter String Text",
      prompt: "A random FNV32 will be generated for the key.",
    });

    if (!input) return;
    const key = stbl.addValue(input);
    await vscode.workspace.fs.writeFile(uri, stbl.serialize());

    const clickToCopy = "Copy as XML";
    vscode.window.showInformationMessage(
      `Added new string to ${path.basename(uri.fsPath)}`,
      clickToCopy,
    ).then(value => {
      if (value === clickToCopy)
        vscode.env.clipboard.writeText(`${formatStringKey(key)}<!--${input}-->`);
    });
  } catch (e) {
    vscode.window.showErrorMessage(`Could not add string to STBL [${e}]`);
  }
}

//#endregion
