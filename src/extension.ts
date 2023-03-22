import * as vscode from 'vscode';
import { CatScratchEditorProvider } from '@editors/catScratchEditor';
import { PawDrawEditorProvider } from '@editors/pawDrawEditor';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		CatScratchEditorProvider.register(context),
		PawDrawEditorProvider.register(context)
	);
}
