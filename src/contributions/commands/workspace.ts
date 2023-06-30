import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { formatStringKey } from "@s4tk/hashing/formatting";
import { S4TKCommand, S4TKFilename } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { buildProject } from "#building/builder";
import { BuildMode, BuildSummary } from "#building/summary";
import StringTableProxy from "#models/stbl-proxy";
import { S4TKSettings } from "#helpers/settings";
import { convertFolderToProject } from "#workspace/folder-to-project";
import StringTableJson from "#models/stbl-json";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(S4TKCommand.workspace.build, async (uri?: vscode.Uri) => {
    const workspace = await _resolveWorkspace(uri);
    if (workspace) _runBuild(workspace, "build", "Build");
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.buildDryRun, async (uri?: vscode.Uri) => {
    const workspace = await _resolveWorkspace(uri);
    if (workspace) _runBuild(workspace, "dryrun", "Dry Run");
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.buildRelease, async (uri?: vscode.Uri) => {
    const workspace = await _resolveWorkspace(uri);
    if (workspace) _runBuild(workspace, "release", "Release");
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.createConfig, async (uri?: vscode.Uri) => {
    const workspace = await _resolveWorkspace(uri);
    workspace?.createConfig(true);
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.createWorkspace, async (uri?: vscode.Uri) => {
    const workspace = await _resolveWorkspace(uri);
    workspace?.createDefaultWorkspace();
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.reloadConfig, async (uri?: vscode.Uri) => {
    const workspace = await _resolveWorkspace(uri);
    workspace?.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.setDefaultStbl, async (uri: vscode.Uri) => {
    const workspace = S4TKWorkspaceManager.getWorkspaceForFileAt(uri);

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
    const workspace = await _resolveWorkspace(uri);
    if (workspace) _addNewString(workspace, uri);
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.refreshIndex, async () => {
    const workspace = await _resolveWorkspace(undefined);
    if (workspace) workspace.index.refresh();
  });

  vscode.commands.registerCommand(S4TKCommand.workspace.folderToProject, convertFolderToProject);
}

//#region Helpers

async function _resolveWorkspace(uri: vscode.Uri | undefined): Promise<S4TKWorkspace | undefined> {
  return uri
    ? S4TKWorkspaceManager.getWorkspaceForFileAt(uri)
    : S4TKWorkspaceManager.chooseWorkspace();
}

async function _runBuild(workspace: S4TKWorkspace, mode: BuildMode, readableMode: string) {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    cancellable: false,
    title: `Building S4TK Project (${readableMode})`
  }, async (progress) => {
    progress.report({ increment: 0 });

    const summary = await buildProject(workspace, mode);
    const buildSummaryUri = await _outputBuildSummary(workspace, summary);

    if (summary.buildInfo.success) {
      const warnings: string[] = [];
      const warnIf = (num: number, msg: string) => {
        if (num) warnings.push(`${num} ${msg}${(num === 1) ? '' : 's'}`);
      }
      warnIf(summary.buildInfo.problems, "problem");
      warnIf(summary.written.ignoredSourceFiles.length, "ignored file");
      warnIf(summary.written.missingSourceFiles.length, "missing file");
      const warningMsg = warnings.length ? ` [${warnings.join("; ")}]` : "";
      vscode.window.showInformationMessage(`S4TK ${readableMode} Successful${warningMsg}`);
    } else if (buildSummaryUri) {
      const viewBuildSummary = 'View BuildSummary.json';
      vscode.window.showErrorMessage(
        `S4TK ${readableMode} Failed: ${summary.buildInfo.fatalErrorMessage}`,
        viewBuildSummary
      ).then((button) => {
        if (button === viewBuildSummary) vscode.window.showTextDocument(buildSummaryUri);
      });
    } else {
      vscode.window.showErrorMessage(`S4TK ${readableMode} Failed: ${summary.buildInfo.fatalErrorMessage}`);
    }

    progress.report({ increment: 100 });
  });
}

async function _outputBuildSummary(workspace: S4TKWorkspace, summary: BuildSummary): Promise<vscode.Uri | undefined> {
  if (workspace.config.buildSettings.outputBuildSummary === "none") return;
  const uri = vscode.Uri.joinPath(workspace.rootUri, S4TKFilename.buildSummary);
  if (!uri) return;
  const content = JSON.stringify(summary, null, S4TKSettings.getSpacesPerIndent());
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  return uri;
}

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
