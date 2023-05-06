import * as vscode from "vscode";

/**
 * Prompts the user for a file name and attempts to create it using the given
 * content generator. If the 
 * 
 * @param options Options for prompting the user and creating the document
 */
export async function tryCreateCustomFile(options: {
  promptTitle: string;
  fileExtension: string;
  contentGenerator: () => Uint8Array;
  launchFile: (uri: vscode.Uri) => void;
}) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Creating a new file requires opening a workspace.");
    return;
  }

  let filename = await vscode.window.showInputBox({
    title: options.promptTitle,
    prompt: "File path is relative to the root of your profect. Use slashes to indicate subfolders.",
  });

  if (!filename) return;
  if (!filename.endsWith(options.fileExtension))
    filename = filename + options.fileExtension;

  const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);
  if (!(await fileExists(uri)))
    await vscode.workspace.fs.writeFile(uri, options.contentGenerator());

  options.launchFile(uri);
}

/**
 * Returns whether or not a file exists at the given URI.
 * 
 * @param uri URI to check
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if the file at the given URI is currently open, and if so, returns its
 * TextDocument. Returns undefined otherwise.
 * 
 * @param uri URI to check
 */
export function findOpenDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  const expectedUriString = uri.toString();
  return vscode.workspace.textDocuments.find(document => {
    return document.uri.toString() === expectedUriString;
  });
} 
