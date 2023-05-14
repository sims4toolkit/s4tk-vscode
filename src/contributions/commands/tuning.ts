import * as vscode from "vscode";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { COMMAND } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import { getNewXmlContentWithOverride, getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
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
    (editor: vscode.TextEditor | undefined, value?: number) => {
      if (!editor?.document) return;
      const newContent = getNewXmlContentWithOverride(editor.document, "group", value);
      if (!newContent) return;
      replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideInstance,
    (editor: vscode.TextEditor | undefined, value?: bigint) => {
      if (!editor?.document) return;
      const newContent = getNewXmlContentWithOverride(editor.document, "instance", value);
      if (!newContent) return;
      replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.overrideType,
    (editor: vscode.TextEditor | undefined, value?: number) => {
      if (!editor?.document) return;
      const newContent = getNewXmlContentWithOverride(editor.document, "type", value);
      if (!newContent) return;
      replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.copyAsXml,
    async (uri?: vscode.Uri) => {
      if (!uri) return;

      const content = (await vscode.workspace.fs.readFile(uri)).toString();
      const overrides = getXmlKeyOverrides(content);
      const metadata = inferXmlMetaData(content);
      const instance = overrides?.instance ?? metadata.key.instance;

      if (instance == undefined) {
        vscode.window.showWarningMessage("Could not infer tuning ID, and no override was found.");
      } else {
        const toCopy = metadata.filename
          ? `${instance}<!--${metadata.filename}-->`
          : instance.toString();

        vscode.env.clipboard.writeText(toCopy);

        if (S4TKWorkspace.showCopyConfirmationPopup)
          vscode.window.showInformationMessage(`Copied: ${toCopy}`);
      }
    }
  );
}
