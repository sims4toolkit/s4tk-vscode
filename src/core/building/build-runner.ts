import * as vscode from "vscode";
import { S4TKFilename } from "#constants";
import { S4TKSettings } from "#helpers/settings";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { BuildMode, BuildSummary } from "./summary";
import { buildProject } from "./builder";

/**
 * Runs a build for the given workspace and displays all necessary information
 * in the VS Code window before, during, and after.
 * 
 * @param workspace Workspace to run build
 * @param mode Mode to build for
 * @param readableMode Human-readable text for `mode`
 */
export async function runBuild(workspace: S4TKWorkspace, mode: BuildMode, readableMode: string) {
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
