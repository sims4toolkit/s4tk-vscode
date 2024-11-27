import { spawnSync } from "child_process";
import { ShellScriptInfo } from "#workspace/s4tk-config";
import { BuildContext } from "./context";
import { FatalBuildError } from "./helpers";

/**
 * Runs any scripts set in the config's `additionalScripts.runBeforeBuild`.
 * 
 * @param context BuildContext to use during script execution
 */
export function runPreBuildShellScripts(context: BuildContext) {
  const scripts = context.config.buildInstructions.additionalScripts?.runBeforeBuild;
  if (!scripts?.length) return;
  scripts.forEach(script => _runShellScript(context, script, "before"));
}

/**
 * Runs any scripts set in the config's `additionalScripts.runAfterBuild`.
 * 
 * @param context BuildContext to use during script execution
 */
export function runPostBuildShellScripts(context: BuildContext) {
  const scripts = context.config.buildInstructions.additionalScripts?.runAfterBuild;
  if (!scripts?.length) return;
  scripts.forEach(script => _runShellScript(context, script, "after"));
}

function _runShellScript(context: BuildContext, script: ShellScriptInfo, timing: "before" | "after") {
  const cwd = script.workingDirectory ?? context.workspaceRootPath;
  const result = spawnSync(script.command, { cwd, shell: true });
  const summary = context.summary.scriptsRun[timing];

  summary.push({
    command: script.command,
    workingDirectory: cwd,
    stdout: result.stdout?.toString(),
    stderr: result.stderr?.toString(),
    error: result.error ? `${result.error}` : undefined,
    output: result.output?.map(line => line ? line.toString() : ""),
  });

  if (result.error) {
    const warnable = summary[summary.length - 1];
    warnable.warning = `Exception while running command '${script.command}' ${timing} build script`;
    if (script.mustSucceed) {
      throw FatalBuildError(warnable.warning);
    } else {
      context.summary.buildInfo.problems++
    }
  }
}
