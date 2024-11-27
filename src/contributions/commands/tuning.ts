import * as vscode from "vscode";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { S4TKCommand } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import { S4TKSettings } from "#helpers/settings";
import * as tuningCommands from "#tuning/commands";
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
      tuningCommands.overrideTgiComment(editor, "type", value);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideGroup,
    (editor?: vscode.TextEditor, value?: number) => {
      if (!(editor?.document && value != undefined)) return;
      tuningCommands.overrideTgiComment(editor, "group", value);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideInstance,
    (editor?: vscode.TextEditor, value?: bigint) => {
      if (!(editor?.document && value != undefined)) return;
      tuningCommands.overrideTgiComment(editor, "instance", value);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.copyAsXml,
    async (uri?: vscode.Uri) => {
      if (!uri) return;
      const workspace = S4TKWorkspaceManager.getWorkspaceContainingUri(uri);
      const ref = workspace?.index.getTuningReference(uri);
      if (ref) {
        // ref already sanitized in getTuningReference
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
      if (!srcUri) return;
      const createdUris = await tuningCommands.cloneWithNewName(srcUri);
      if (!createdUris?.length) return;
      createdUris.forEach(uri => {
        try {
          vscode.window.showTextDocument(uri);
        } catch (_) { }
      });
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.renameTuning,
    async (srcUri?: vscode.Uri) => {
      if (srcUri) tuningCommands.renameTuningFile(srcUri);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.restoreStringComments,
    async (srcUri?: vscode.Uri) => {
      if (!srcUri) return;

      const workspace = await S4TKWorkspaceManager.chooseWorkspace(srcUri);
      if (!workspace?.active) return vscode.window.showErrorMessage(
        "Cannot restore comments because no S4TK config is loaded."
      );

      tuningCommands.restoreStringCommentsForFiles([srcUri.fsPath], workspace);
    }
  );
}
