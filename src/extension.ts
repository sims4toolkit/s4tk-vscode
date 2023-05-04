import * as vscode from "vscode";
import S4TKWorkspace from "#workspace/s4tk-workspace";
import { registerContributions } from "./contributions/_index";

/**
 * Activates the S4TK extension and performs needed setup work.
 * 
 * @param context Extension context
 */
export function activate(context: vscode.ExtensionContext) {
	registerContributions(context);
	S4TKWorkspace.activate();
}
