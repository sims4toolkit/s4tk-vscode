import { ExtensionContext } from "vscode";
import registerCommands from "@commands/index";
import registerCodeLensProviders from "@codelens/index";
import registerCustomEditors from "@editors/index";

export function activate(context: ExtensionContext) {
	registerCommands(context);
	registerCodeLensProviders(context);
	registerCustomEditors(context);
}
