import * as vscode from "vscode";
import S4TKAssets from "#assets";
import S4TKWorkspaceManager from "#workspace/workspace-manager";
import registerContributions from "./contributions/_index";

export function activate(context: vscode.ExtensionContext) {
	S4TKAssets.setExtensionContext(context);
	registerContributions(context);
}

export function deactivate() {
	S4TKWorkspaceManager.dispose();
}
