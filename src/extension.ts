import { ExtensionContext } from "vscode";
import registerCommands from "@commands/index";
import registerCodeLensProviders from "@codelens/index";
import registerCustomEditors from "@editors/index";
import { loadConfig } from "@project/s4tk-config";

export function activate(context: ExtensionContext) {
	registerCommands(context);
	registerCodeLensProviders(context);
	registerCustomEditors(context);

	// TODO: when to load?
	loadConfig()
		.then(config => {
			// TODO:
			config;
		})
		.catch(err => {
			// TODO:
			err;
		});
}
