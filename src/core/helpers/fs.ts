import * as path from "path";
import * as vscode from "vscode";

/**
 * Returns an FS path that is relative to the root of the VS Code workspace.
 * 
 * @param uri URI to make relative
 */
export function getRelativeToRoot(uri: vscode.Uri): string | undefined {
  try {
    const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!rootUri) return;
    const relPath = path.relative(rootUri.fsPath, uri.fsPath);
    if (relPath) return relPath;
  } catch (_) { }
}

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

/**
 * Replaces an entire document's contents using its editor, and returns whether
 * the edits could be made or not.
 * 
 * @param editor Editor of the document to change
 * @param content New content to insert into document
 * @param save Whether or not to save the file after applying edits
 */
export async function replaceEntireDocument(
  editor: vscode.TextEditor,
  content: string,
  save: boolean = false
): Promise<boolean> {
  if (!editor.document) return false;

  const editSuccess = await editor.edit((editBuilder) => {
    editBuilder.replace(
      new vscode.Range(
        editor.document.lineAt(0).range.start,
        editor.document.lineAt(editor.document.lineCount - 1).range.end
      ),
      content,
    );
  });

  if (save && editSuccess)
    await editor.document.save();

  return editSuccess;
}
