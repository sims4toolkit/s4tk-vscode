import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { SimDataResource, XmlResource } from "@s4tk/models";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { S4TKCommand } from "#constants";
import { replaceEntireDocument } from "#helpers/fs";
import { S4TKSettings } from "#helpers/settings";
import { inferKeyFromMetadata, insertXmlKeyOverrides } from "#indexing/inference";
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
    (editor: vscode.TextEditor | undefined, value?: number) => {
      if (!((editor?.document) && (value != undefined))) return;

      const newContent = insertXmlKeyOverrides(editor.document.getText(), {
        type: formatAsHexString(value, 8, false),
      });

      if (newContent) replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideGroup,
    (editor: vscode.TextEditor | undefined, value?: number) => {
      if (!((editor?.document) && (value != undefined))) return;

      const newContent = insertXmlKeyOverrides(editor.document.getText(), {
        group: formatAsHexString(value, 8, false),
      });

      if (newContent) replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.overrideInstance,
    (editor: vscode.TextEditor | undefined, value?: bigint) => {
      if (!((editor?.document) && (value != undefined))) return;

      const newContent = insertXmlKeyOverrides(editor.document.getText(), {
        instance: formatAsHexString(value, 16, false),
      });

      if (newContent) replaceEntireDocument(editor, newContent, false);
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.copyAsXml,
    async (uri?: vscode.Uri) => {
      if (!uri) return;
      const workspace = S4TKWorkspaceManager.getWorkspaceForFileAt(uri);
      if (!workspace) return;

      const metadata = workspace.index.getMetadataFromUri(uri);
      if (!metadata) return;
      const key = inferKeyFromMetadata(metadata).key;

      if (key.instance == undefined) {
        vscode.window.showWarningMessage("Could not infer tuning ID, and no override was found.");
      } else {
        const toCopy = metadata.attrs?.n
          ? `${key.instance}<!--${metadata.attrs.n}-->`
          : key.instance.toString();

        vscode.env.clipboard.writeText(toCopy);

        if (S4TKSettings.get("showCopyConfirmMessage"))
          vscode.window.showInformationMessage(`Copied: ${toCopy}`);
      }
    }
  );

  vscode.commands.registerCommand(S4TKCommand.tuning.cloneNewName,
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
