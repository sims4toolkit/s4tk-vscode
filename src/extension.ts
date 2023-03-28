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

	context.subscriptions.push(
		StringTableEditorProvider.register(context),
	);
}
