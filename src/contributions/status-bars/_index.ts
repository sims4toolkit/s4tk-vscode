import * as vscode from "vscode";
import registerRunBuildStatusBarItem from "./run-build-item";

export default function registerStatusBarItems(context: vscode.ExtensionContext) {
  registerRunBuildStatusBarItem(context);
}
