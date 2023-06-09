import * as vscode from "vscode";
import registerCommands from "./commands/_index";
import registerCodeLensProviders from "./codelens/_index";
import registerEditorProviders from "./editors/_index";
import registerLanguageProviders from "./language/_index";

export default function registerContributions(context: vscode.ExtensionContext) {
	registerCommands();
	registerCodeLensProviders();
	registerLanguageProviders(context);
	registerEditorProviders(context);
}
