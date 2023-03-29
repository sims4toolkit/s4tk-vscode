import * as vscode from 'vscode';
import registerCommands from '@commands/index';
import registerCodeLensProviders from '@codelens/index';
import registerCustomEditors from '@editors/index';

export function activate(context: vscode.ExtensionContext) {
	registerCommands();
	registerCodeLensProviders();
	registerCustomEditors(context);
}
