import * as vscode from 'vscode';
import { formatStringKey } from '@s4tk/hashing/formatting';
import StringTableJson from 'models/stbl-json';
import S4TKWorkspace from '@workspace/s4tk-workspace';

const _KEY_REGEX = /^\s*"key":[^,]*,/;
const _NEW_ENTRY_COMMAND_NAME = "s4tk.stringTableJson.addNewEntry";
const _COPY_ENTRY_COMMAND_NAME = "s4tk.stringTableJson.copyAsXml";
const _ADD_METADATA_COMMAND_NAME = "s4tk.stringTableJson.addMetaData";

export default class StringTableJsonCodeLensProvider implements vscode.CodeLensProvider {
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
        pattern: "**/*.stbl.json",
      },
      new StringTableJsonCodeLensProvider()
    );

    vscode.commands.registerCommand(_NEW_ENTRY_COMMAND_NAME, _newEntryCommand);
    vscode.commands.registerCommand(_COPY_ENTRY_COMMAND_NAME, _copyEntryCommand);
    vscode.commands.registerCommand(_ADD_METADATA_COMMAND_NAME, _addMetadataCommand);
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    this._codeLenses = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Add New String (Start)",
        tooltip: "Add a new string with a random hash to the start of this STBL.",
        command: _NEW_ENTRY_COMMAND_NAME,
        arguments: [true]
      }),
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Add New String (End)",
        tooltip: "Add a new string with a random hash to the end of this STBL.",
        command: _NEW_ENTRY_COMMAND_NAME,
        arguments: [false]
      })
    ];

    if (document.getText(new vscode.Range(0, 0, 0, 1)) === "[") {
      this._codeLenses.push(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: "Insert Metadata",
          tooltip: "Convert this array-based STBL into an object-based one that tracks file metadata.",
          command: _ADD_METADATA_COMMAND_NAME
        })
      );
    }

    let xmls: string[];
    try {
      const json = StringTableJson.parse(document.getText());

      xmls = json.entries.map(({ key, value }) => {
        if (typeof key === "number") key = formatStringKey(key);
        return `${key}<!--${value}-->`;
      });
    } catch {
      xmls = [];
    }

    let stblEntryIndex = 0;
    for (let lineIndex = 0; lineIndex < document.lineCount; ++lineIndex) {
      const line = document.lineAt(lineIndex);
      if (_KEY_REGEX.test(line.text)) {
        const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
        const command: vscode.Command = {
          title: "Copy as XML",
          tooltip: xmls[stblEntryIndex],
          command: _COPY_ENTRY_COMMAND_NAME,
          arguments: [xmls[stblEntryIndex]]
        };
        this._codeLenses.push(new vscode.CodeLens(range, command));
        ++stblEntryIndex;
      }
    }

    return this._codeLenses;
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
    return codeLens;
  }
}

//#region Helpers

async function _newEntryCommand(addToStart: boolean) {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error("Editor could not be found");
    const doc = editor.document;
    if (doc.isDirty) await doc.save();

    const json = StringTableJson.parse(doc.getText());
    json.addEntry(undefined, addToStart);

    editor.edit(editBuilder => {
      editBuilder.replace(
        new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end),
        json.stringify()
      );
    });
  } catch (err) {
    vscode.window.showErrorMessage(`Exception occured while adding new string to STBL JSON`);
  }
}

function _copyEntryCommand(xml: string) {
  vscode.env.clipboard.writeText(xml);
  if (S4TKWorkspace.config?.settings?.showCopyConfirmation ?? true)
    vscode.window.showInformationMessage(`Copied: ${xml}`);
}

async function _addMetadataCommand() {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error("Editor could not be found");
    const doc = editor.document;
    if (doc.isDirty) await doc.save();

    const json = StringTableJson.parse(doc.getText());
    json.insertDefaultMetadata();

    editor.edit(editBuilder => {
      editBuilder.replace(
        new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end),
        json.stringify()
      );
    });
  } catch (err) {
    vscode.window.showErrorMessage(`Exception occured while adding metadata to STBL JSON`);
  }
}

//#endregion
