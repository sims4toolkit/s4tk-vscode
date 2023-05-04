import * as vscode from 'vscode';
import { Disposable } from '../helpers/dispose';

/**
 * Custom document that can only be viewed, but not edited.
 */
export default abstract class ViewOnlyDocument extends Disposable implements vscode.CustomDocument {
  public get uri() { return this._uri; }

  constructor(private readonly _uri: vscode.Uri) {
    super();
  }

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  public readonly onDidDispose = this._onDidDispose.event;

  /**
   * Called by VS Code when there are no more references to the document.
   *
   * This happens when all editors for it have been closed.
   */
  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  /**
   * Called by VS Code to backup the edited document.
   *
   * These backups are used to implement hot exit.
   */
  async backup(
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch {
          // noop
        }
      }
    };
  }
}
