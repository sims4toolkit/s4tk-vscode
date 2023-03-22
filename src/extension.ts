import * as vscode from 'vscode';
import { CatScratchEditorProvider } from '@editors/catScratchEditor';
import { PawDrawEditorProvider } from '@editors/pawDrawEditor';
import StringTableEditorProvider from '@editors/string-table/provider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		CatScratchEditorProvider.register(context),
		PawDrawEditorProvider.register(context),
		StringTableEditorProvider.register(context)
	);
}
