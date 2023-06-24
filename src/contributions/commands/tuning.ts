import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { fnv64 } from "@s4tk/hashing";
import { SimDataResource, XmlResource } from "@s4tk/models";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { COMMAND } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import { S4TKSettings } from "#helpers/settings";
import { getNewXmlContentWithOverride, getXmlKeyOverrides, inferXmlMetaData } from "#helpers/xml";
import S4TKIndex from "#workspace/indexing";

export default function registerTuningCommands() {
  vscode.commands.registerCommand(COMMAND.tuning.format,
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

        if (S4TKSettings.get("showCopyConfirmMessage"))
          vscode.window.showInformationMessage(`Copied: ${toCopy}`);
      }
    }
  );

  vscode.commands.registerCommand(COMMAND.tuning.cloneNewName,
    async (srcUri?: vscode.Uri) => {
      if (!(srcUri && fs.existsSync(srcUri.fsPath))) return;

      const tuning = XmlResource.from(fs.readFileSync(srcUri.fsPath));
      const originalFilename = tuning.root.name;

      const simdataSrc = srcUri.fsPath.replace(/\.xml$/i, ".SimData.xml");
      const hasSimdata = fs.existsSync(simdataSrc);
      const fileTypes = hasSimdata ? "Tuning & SimData" : "Tuning";

      const newFilename = await vscode.window.showInputBox({
        title: `Enter Name of New ${fileTypes}`,
        prompt: hasSimdata
          ? "Name will be hashed for a new instance. Paired SimData will be cloned too."
          : "Name will be hashed for a new instance.",
        value: originalFilename
      });
      if (!newFilename) return;
      if (newFilename === originalFilename) {
        vscode.window.showErrorMessage("Cannot use existing filename.");
        return;
      }

      const tuningFsPath = path.join(
        path.dirname(srcUri.fsPath),
        `${newFilename.replace(/^[^:]*:/, "")}.xml`
      );

      if (fs.existsSync(tuningFsPath)) {
        const selected = await vscode.window.showWarningMessage(
          "A tuning file already exists at the chosen location. Do you want to overwrite it?",
          "Yes",
          "Cancel"
        );

        if (selected === "Cancel") return;
      }

      tuning.updateRoot(root => {
        root.name = newFilename;
        root.id = fnv64(newFilename);
      });

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(tuningFsPath),
        tuning.getBuffer()
      );
      // TODO: add to index

      if (hasSimdata) {
        const simdataFsPath = tuningFsPath.replace(/\.xml$/, ".SimData.xml");
        const simdata = SimDataResource.fromXml(fs.readFileSync(simdataSrc));
        simdata.instance.name = newFilename;
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(simdataFsPath),
          Buffer.from(simdata.toXmlDocument().toXml()),
        );
      }
    }
  );
}
