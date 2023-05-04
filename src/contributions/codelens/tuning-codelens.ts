import * as vscode from 'vscode';
import S4TKWorkspace from '#workspace/s4tk-workspace';

const _OVERRIDE_TYPE_COMMAND_NAME = "s4tk.tuning.overrideTypeComment";
const _OVERRIDE_TYPE_CODELENS = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
  title: "Override Type",
  tooltip: "Add a comment to the top of this file that will tell S4TK which Type to use. The Type must be provided as an 8-digit hex number without a 0x prefix.",
  command: _OVERRIDE_TYPE_COMMAND_NAME,
});

const _OVERRIDE_GROUP_COMMAND_NAME = "s4tk.tuning.overrideGroupComment";
const _OVERRIDE_GROUP_CODELENS = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
  title: "Override Group",
  tooltip: "Add a comment to the top of this file that will tell S4TK which Group to use. The Group must be provided as an 8-digit hex number without a 0x prefix.",
  command: _OVERRIDE_GROUP_COMMAND_NAME,
});

export default class TuningCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
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
        pattern: "**/*.xml",
      },
      new TuningCodeLensProvider()
    );

    vscode.commands.registerCommand(_OVERRIDE_TYPE_COMMAND_NAME, () => {
      _addFirstLineToDocument("<!-- Type: 00000000 -->");
    });

    vscode.commands.registerCommand(_OVERRIDE_GROUP_COMMAND_NAME, () => {
      _addFirstLineToDocument("<!-- Group: 00000000 -->");
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!S4TKWorkspace.active) return [];
    this._codeLenses = [];

    if (!_linesContain(document, "Type:", 0, 1)) {
      this._codeLenses.push(_OVERRIDE_TYPE_CODELENS);
    }

    if (!_linesContain(document, "Group:", 0, 1)) {
      this._codeLenses.push(_OVERRIDE_GROUP_CODELENS);
    }

    // TODO: add codelens to hash filename

    return this._codeLenses;
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    return codeLens;
  }
}

async function _addFirstLineToDocument(line: string) {
  const editor = vscode.window.activeTextEditor;
  editor?.edit(editBuilder => {
    const eol = editor?.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const start = new vscode.Position(0, 0);
    editBuilder.insert(start, line);
    editBuilder.insert(start, eol);
  });
}

function _linesContain(
  document: vscode.TextDocument,
  text: string,
  start: number,
  end: number
): boolean {
  for (let i = start; i <= start + end; ++i) {
    try {
      const line = document.lineAt(i);
      if (line.text.includes(text)) return true;
    } catch (_) { }
  }
  return false;
}
