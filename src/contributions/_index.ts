import registerCommands from "./commands/_index";
import registerCodeLensProviders from "./codelens/_index";
import registerEditorProviders from "./editors/_index";

export default function registerContributions() {
	registerCommands();
	registerCodeLensProviders();
	registerEditorProviders();
}
