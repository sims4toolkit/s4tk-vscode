import * as vscode from 'vscode';
import StringTableEditorProvider from "./stbl-binary/provider";

/**
 * Registers all custom editors.
 * 
 * @param context Extension context
 */
export default function registerCustomEditors(context: vscode.ExtensionContext) {
  StringTableEditorProvider.register(context);
}
