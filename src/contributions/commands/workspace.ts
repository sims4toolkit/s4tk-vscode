import * as path from "path";
import * as vscode from "vscode";
import { formatStringKey } from "@s4tk/hashing/formatting";
import { COMMAND } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { buildProject } from "#building/builder";
import { BuildMode, BuildSummary } from "#building/summary";
import StringTableProxy from "#models/stbl-proxy";
import { S4TKConfig } from "#models/s4tk-config";
import { S4TKSettings } from "#helpers/settings";
import { convertFolderToProject } from "#workspace/folder-to-project";
import S4TKIndex from "#workspace/indexing";
import StringTableJson from "#models/stbl-json";
import { fileExists } from "#helpers/fs";

export default function registerWorkspaceCommands() {
  vscode.commands.registerCommand(COMMAND.workspace.build, () => {
    _runBuild("build", "Build");
  });

  vscode.commands.registerCommand(COMMAND.workspace.buildDryRun, () => {
    _runBuild("dryrun", "Dry Run");
  });

  vscode.commands.registerCommand(COMMAND.workspace.buildRelease, () => {
    _runBuild("release", "Release");
  });

  vscode.commands.registerCommand(COMMAND.workspace.createConfig, (_?: vscode.Uri) => {
    S4TKWorkspace.createConfig(true);
  });

  vscode.commands.registerCommand(COMMAND.workspace.createWorkspace, (_?: vscode.Uri) => {
    S4TKWorkspace.createDefaultWorkspace();
  });

  vscode.commands.registerCommand(COMMAND.workspace.reloadConfig, () => {
    S4TKWorkspace.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand(COMMAND.workspace.setDefaultStbl, (uri: vscode.Uri) => {
    S4TKWorkspace.setDefaultStbl(uri);
  });

  vscode.commands.registerCommand(COMMAND.workspace.createStblFragment, async (uri: vscode.Uri) => {
    try {
      const dirname = path.dirname(uri.fsPath);
      const filename = path.basename(uri.fsPath);

      let fragmentName = await vscode.window.showInputBox({
        title: "Enter the name to use for the fragment.",
        value: filename.replace(/\.stbl\.json$/, "")
      });

      if (!fragmentName) return;
      if (!fragmentName.endsWith(".stbl.json")) fragmentName += ".stbl.json";
      const fragmentUri = vscode.Uri.file(path.join(dirname, fragmentName));
      if (await fileExists(fragmentUri)) {
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

  vscode.commands.registerCommand(COMMAND.workspace.addNewString, (clickedUri?: vscode.Uri) => {
    _addNewString(clickedUri);
  });

  vscode.commands.registerCommand(COMMAND.workspace.folderToProject, convertFolderToProject);

  vscode.commands.registerCommand(COMMAND.workspace.refreshIndex, () => {
    S4TKIndex.refresh();
  });
}

async function _runBuild(mode: BuildMode, readableMode: string) {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    cancellable: false,
    title: `Building S4TK Project (${readableMode})`
  }, async (progress) => {
    progress.report({ increment: 0 });

    const summary = await buildProject(mode);
    const buildSummaryUri = await _outputBuildSummary(summary);

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

async function _outputBuildSummary(summary: BuildSummary): Promise<vscode.Uri | undefined> {
  if (S4TKWorkspace.config.buildSettings.outputBuildSummary === "none") return;
  const uri = BuildSummary.getUri();
  if (!uri) return;
  const content = JSON.stringify(summary, null, S4TKSettings.getSpacesPerIndent());
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  return uri;
}

async function _addNewString(clickedUri?: vscode.Uri) {
  try {
    let uri = clickedUri;
    if (!uri) {
      const defaultStringTable = S4TKWorkspace.config.stringTableSettings.defaultStringTable;

      if (!defaultStringTable) {
        vscode.window.showWarningMessage("Cannot add string because no default string table is set in s4tk.config.json.");
        return;
      }

      uri = vscode.Uri.parse(S4TKConfig.resolvePath(defaultStringTable)!);
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
