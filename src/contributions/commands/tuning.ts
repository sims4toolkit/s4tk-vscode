import * as vscode from "vscode";
import { ResourceKey } from "@s4tk/models/types";
import { TuningResourceType } from "@s4tk/models/enums";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { MessageButton, handleMessageButtonClick } from "#workspace/messaging";
import { COMMAND } from "#constants";

export default function registerTuningCommands() {
  vscode.commands.registerCommand(COMMAND.tuning.overrideGroup,
    (editor: vscode.TextEditor | undefined) => {
      _insertCommentAtTopOfDocument(editor, 'Group: 00000000');
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideInstance,
    (editor: vscode.TextEditor | undefined) => {
      const key = _getDefaultResourceKey(editor);
      const instance = formatAsHexString(key.instance, 16, false);
      _insertCommentAtTopOfDocument(editor, `Instance: ${instance}`);
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideType,
    (editor: vscode.TextEditor | undefined) => {
      const key = _getDefaultResourceKey(editor);
      const type = formatAsHexString(key.type, 8, false);
      _insertCommentAtTopOfDocument(editor, `Type: ${type}`);
    }
  );
}

//#region Helpers

// TODO: this should be expanded for use with simdata
function _getDefaultResourceKey(editor: vscode.TextEditor | undefined): ResourceKey {
  const key = { type: 0, group: 0, instance: 0n };

  try {
    const definition = _getDefinitionLine(editor);
    if (!definition) return key;

    if (/^\s*<M/.test(definition)) {
      key.type = TuningResourceType.Tuning;
    } else {
      const typeName = /i="([^"]+)"/.exec(definition)?.[1];
      if (typeName) key.type = TuningResourceType.parseAttr(typeName);
    }

    const tuningId = /s="([^"]+)"/.exec(definition)?.[1];
    if (tuningId) key.instance = BigInt(tuningId);
  } catch (_) { }

  return key;
}

// TODO: this helper can probably be used while building and in codelenses
function _getDefinitionLine(
  editor: vscode.TextEditor | undefined
): string | undefined {
  // this is intentionally hacky because it's faster than parsing an XML doc
  if (!editor?.document) return;
  const instOrModRegex = /^\s*<[IM]/;
  // limit to 5 because that's how many comments/PI tags there can be
  for (let i = 0; i < 5; ++i) {
    if (i >= editor.document.lineCount) break;
    const text = editor.document.lineAt(i).text;
    if (instOrModRegex.test(text)) return text;
  }
}

async function _insertCommentAtTopOfDocument(
  editor: vscode.TextEditor | undefined,
  comment: string
) {
  if (editor) {
    const editSuccess = await editor.edit(editBuilder => {
      const eol = editor?.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
      const start = new vscode.Position(0, 0);
      editBuilder.insert(start, `<!-- ${comment} -->`);
      editBuilder.insert(start, eol);
    });

    if (editSuccess) return;
  }

  vscode.window.showWarningMessage(
    'Something unexpected went wrong while adding meta data to this XML file.',
    MessageButton.ReportProblem,
  ).then(handleMessageButtonClick);
}

//#endregion
