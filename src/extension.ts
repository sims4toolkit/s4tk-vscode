import * as vscode from "vscode";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import registerContributions from "./contributions/_index";

let _extensionContext: vscode.ExtensionContext;
export const getExtensionContext = () => _extensionContext;

export function activate(context: vscode.ExtensionContext) {
	_extensionContext = context;
	registerContributions(context);
	S4TKWorkspace.activate();
}
