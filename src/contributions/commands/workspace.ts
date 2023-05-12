import * as path from "path";
import * as vscode from "vscode";
import { formatStringKey } from "@s4tk/hashing/formatting";
import { COMMAND } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { buildProject } from "#building/builder";
import { BuildMode, BuildSummary } from "#building/summary";
import StringTableProxy from "#models/stbl-proxy";
import { S4TKConfig } from "#models/s4tk-config";

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

  vscode.commands.registerCommand(COMMAND.workspace.addNewString, (clickedUri?: vscode.Uri) => {
    _addNewString(clickedUri);
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
  const content = JSON.stringify(summary, null, S4TKWorkspace.spacesPerIndent);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  return uri;
}

async function _addNewString(clickedUri?: vscode.Uri) {
  try {
    let uri = clickedUri;
    if (!uri) {
      if (!S4TKWorkspace.defaultStringTable) {
        vscode.window.showWarningMessage("Cannot add string because no default string table is set in s4tk.config.json.");
        return;
      }

      uri = vscode.Uri.parse(S4TKConfig.resolvePath(S4TKWorkspace.defaultStringTable)!);
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
