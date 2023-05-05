import * as vscode from "vscode";

/**
 * Returns whether or not a file exists at the given URI.
 * 
 * @param uri URI to check for existance of
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    return false;
  }
}
