import * as vscode from 'vscode';
import StringTableEditorProvider from '@editors/string-table/provider';
import StringTableJsonCodeLensProvider from '@codelens/stbl-codelens';

export function activate(context: vscode.ExtensionContext) {
	vscode.languages.registerCodeLensProvider(
		{
			pattern: "**/*.stbl.json",
		},
		new StringTableJsonCodeLensProvider()
	);

	vscode.commands.registerCommand("s4tk.stringTableJson.copyAsXml", (xml: string) => {
		vscode.env.clipboard.writeText(xml);
	});

	context.subscriptions.push(
		StringTableEditorProvider.register(context),
	);
}
