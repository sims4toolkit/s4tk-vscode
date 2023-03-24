import * as vscode from 'vscode';
import StringTableEditorProvider from '@editors/string-table/provider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		StringTableEditorProvider.register(context)
	);
}
