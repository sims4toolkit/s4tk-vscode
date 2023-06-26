import * as vscode from "vscode";
import S4TKAssets from "#assets";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import registerContributions from "./contributions/_index";

export function activate(context: vscode.ExtensionContext) {
	S4TKAssets.setExtensionContext(context);
	registerContributions(context);
	S4TKWorkspace.activate();
}
