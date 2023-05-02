import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch (e) {
		return false;
	}
}

export function saltedUuid(): string {
	//@ts-ignore This is valid, TS just doesn't like it
	return `${Math.floor(new Date())}-${uuidv4()}`;
}
