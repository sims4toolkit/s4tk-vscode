import * as vscode from "vscode";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { COMMAND } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import { getNewXmlContentWithOverride } from "#helpers/xml";
import S4TKWorkspace from "#workspace/s4tk-workspace";

export default function registerTuningCommands() {
  vscode.commands.registerCommand(COMMAND.tuning.format,
    (editor: vscode.TextEditor | undefined) => {
      if (!editor?.document) return;
      try {
        const doc = XmlDocumentNode.from(editor.document.getText());
        replaceEntireDocument(editor, doc.toXml({
          spacesPerIndent: S4TKWorkspace.spacesPerIndent,
        }));
      } catch (_) {
        vscode.window.showWarningMessage('Could not format this XML document. There is probably a syntax error.');
      }
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideGroup,
    (editor: vscode.TextEditor | undefined) => {
      if (!editor?.document) return;
      const newContent = getNewXmlContentWithOverride(editor.document, "group");
      if (!newContent) return;
      replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideInstance,
    (editor: vscode.TextEditor | undefined) => {
      if (!editor?.document) return;
      const newContent = getNewXmlContentWithOverride(editor.document, "instance");
      if (!newContent) return;
      replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideType,
    (editor: vscode.TextEditor | undefined) => {
      if (!editor?.document) return;
      const newContent = getNewXmlContentWithOverride(editor.document, "type");
      if (!newContent) return;
      replaceEntireDocument(editor, newContent, false);
    }
  );
}
