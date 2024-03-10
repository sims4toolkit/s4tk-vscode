import * as vscode from "vscode";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { S4TKCommand } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import { S4TKSettings } from "#helpers/settings";
import { cloneWithNewName, overrideTgiComment, renameTuningFile } from "#tuning/commands";
import S4TKWorkspaceManager from "#workspace/workspace-manager";

export default function registerTuningCommands() {
  vscode.commands.registerCommand(S4TKCommand.tuning.format,
    (editor: vscode.TextEditor | undefined) => {
      if (!editor?.document) return;
      try {
        const doc = XmlDocumentNode.from(editor.document.getText());
        replaceEntireDocument(editor, doc.toXml({
          spacesPerIndent: S4TKSettings.getSpacesPerIndent(),
        }));
      } catch (_) {
        vscode.window.showWarningMessage('Could not format this XML document. There is probably a syntax error.');
      }
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideType,
    (editor?: vscode.TextEditor, value?: number) => {
      if (!(editor?.document && value != undefined)) return;
      overrideTgiComment(editor, "type", value);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideGroup,
    (editor?: vscode.TextEditor, value?: number) => {
      if (!(editor?.document && value != undefined)) return;
      overrideTgiComment(editor, "group", value);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideInstance,
    (editor?: vscode.TextEditor, value?: bigint) => {
      if (!(editor?.document && value != undefined)) return;
      overrideTgiComment(editor, "instance", value);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.copyAsXml,
    async (uri?: vscode.Uri) => {
      if (!uri) return;
      const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(uri);
      const ref = workspace?.index.getTuningReference(uri);
      if (ref) {
        vscode.env.clipboard.writeText(ref);
        if (S4TKSettings.get("showCopyConfirmMessage"))
          vscode.window.showInformationMessage(`Copied: ${ref}`);
      } else {
        vscode.window.showWarningMessage(`Could not resolve XML reference for '${uri.fsPath}'`);
      }
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.cloneNewName,
    async (srcUri?: vscode.Uri) => {
      if (srcUri) cloneWithNewName(srcUri);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.renameTuning,
    async (srcUri?: vscode.Uri) => {
      if (srcUri) renameTuningFile(srcUri);
    }
  );
}
