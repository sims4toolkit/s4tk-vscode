import * as vscode from 'vscode';
import S4TKWorkspace from '@workspace/s4tk-workspace';

const _RELOAD_CONFIG_COMMAND_NAME = "s4tk.s4tkConfig.reload";
const _RELOAD_CONFIG_CODELENS = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
  title: "Reload Config",
  tooltip: "Reload your config file to make recent changes take effect immediately.",
  command: _RELOAD_CONFIG_COMMAND_NAME
});

export default class S4TKConfigCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [_RELOAD_CONFIG_CODELENS];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  private constructor() {
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public static register() {
    vscode.languages.registerCodeLensProvider(
      {
        pattern: "**/s4tk.config.json",
      },
      new S4TKConfigCodeLensProvider()
    );

    vscode.commands.registerCommand(_RELOAD_CONFIG_COMMAND_NAME, () => {
      S4TKWorkspace.loadConfig({ showNoConfigError: true });
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    return this._codeLenses;
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    return codeLens;
  }
}
