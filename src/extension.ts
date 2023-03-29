import * as vscode from 'vscode';
import registerCommands from '@commands/index';
import registerCodeLensProviders from '@codelens/index';
import StringTableEditorProvider from '@editors/string-table/provider';

export function activate(context: vscode.ExtensionContext) {
	registerCommands();
	registerCodeLensProviders();

	context.subscriptions.push(
		StringTableEditorProvider.register(context),
	);
}
