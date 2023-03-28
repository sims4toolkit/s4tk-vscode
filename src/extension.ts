import * as vscode from 'vscode';
import StringTableEditorProvider from '@editors/string-table/provider';
import StringTableJsonCodeLensProvider from '@codelens/stbl-codelens';
import registerHashingCommands from '@commands/hashing';

export function activate(context: vscode.ExtensionContext) {
	StringTableJsonCodeLensProvider.register();

	registerHashingCommands();

	context.subscriptions.push(
		StringTableEditorProvider.register(context),
	);
}
