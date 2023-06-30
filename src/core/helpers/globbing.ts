import * as vscode from "vscode";

/**
 * Returns a posix-style fs path for use with globbing.
 * 
 * @param baseUri Base folder for globbing to take place
 * @param pattern Pattern to capture files with
 */
export function resolvePattern(baseUri: vscode.Uri, pattern: string): string {
  return `${baseUri.fsPath}/${pattern}`.replace(/\\/g, "/");
}
