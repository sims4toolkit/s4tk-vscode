import { existsSync } from "fs";
import * as vscode from "vscode";

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

/**
 * Returns a posix-style fs path for use with globbing.
 * 
 * @param baseUri Base folder for globbing to take place
 * @param pattern Pattern to capture files with
 */
export function resolveGlobPattern(baseUri: vscode.Uri | string, pattern: string): string {
  const baseFsPath = typeof baseUri === "string" ? baseUri : baseUri.fsPath;
  return `${baseFsPath}/${pattern}`.replace(/\\/g, "/");
}

/**
 * Prompts the user for a file name and attempts to create it using the given
 * content generator.
 * 
 * @param options Options for prompting the user and creating the document
 */
export async function tryCreateCustomFile(options: {
  promptTitle: string;
  fileExtension: string;
  folderUri?: vscode.Uri;
  contentGenerator: () => Uint8Array;
  launchFile?: (uri: vscode.Uri) => void;
}) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("Creating a new file requires opening a workspace.");
    return;
  }

  let destination: vscode.Uri | undefined;

  if (options.folderUri) {
    let filename = await vscode.window.showInputBox({
      title: options.promptTitle,
      prompt: `File will be created in '${options.folderUri.fsPath}'`,
    });

    if (!filename) return;

    destination = vscode.Uri.joinPath(options.folderUri, filename);
  } else {
    destination = (await vscode.window.showSaveDialog({
      defaultUri: workspaceFolders[0]?.uri, // FIXME: how to get current workspace?
      saveLabel: "Create File",
    }));
  }

  if (!destination) return;

  if (!destination.path.endsWith(options.fileExtension))
    destination = destination.with({
      path: destination.path + options.fileExtension,
    });

  if (!existsSync(destination.fsPath))
    await vscode.workspace.fs.writeFile(destination, options.contentGenerator());

  options.launchFile?.(destination);
}
