import * as vscode from "vscode";
import { COMMAND } from "#constants";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { buildProject } from "#workspace/build";
import { BuildMode, BuildSummary } from "#models/build-summary";

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

  vscode.commands.registerCommand(COMMAND.workspace.createWorkspace, () => {
    S4TKWorkspace.createDefaultWorkspace();
  });

  vscode.commands.registerCommand(COMMAND.workspace.reloadConfig, () => {
    S4TKWorkspace.loadConfig({ showNoConfigError: true });
  });

  vscode.commands.registerCommand(COMMAND.workspace.setDefaultStbl, (uri: vscode.Uri) => {
    S4TKWorkspace.setDefaultStbl(uri);
  });
}

async function _runBuild(mode: BuildMode, readableMode: string) {
  const summary = await buildProject(mode);
  const buildSummaryUri = await _outputBuildSummary(summary);

  if (summary.buildInfo.success) {
    vscode.window.showInformationMessage(`S4TK ${readableMode} Successful`);
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
}

async function _outputBuildSummary(summary: BuildSummary): Promise<vscode.Uri | undefined> {
  if (!S4TKWorkspace.config.buildSettings.outputBuildSummaryFile) return;
  const uri = BuildSummary.getUri();
  if (!uri) return;
  const content = JSON.stringify(summary, null, S4TKWorkspace.spacesPerIndent);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  return uri;
}
