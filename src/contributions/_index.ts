import * as vscode from "vscode";
import registerCommands from "./commands/_index";
import registerCodeLensProviders from "./codelens/_index";
import registerCustomEditors from "./editors/_index";

/**
 * Registers all of the S4TK contributions.
 * 
 * @param context Extension context
 */
export function registerContributions(context: vscode.ExtensionContext) {
	registerCommands(context);
	registerCodeLensProviders(context);
	registerCustomEditors(context);
}
