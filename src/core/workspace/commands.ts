import * as fs from "fs";
import * as vscode from "vscode";
import S4TKWorkspace from "./s4tk-workspace";
import { XmlDocumentNode } from "@s4tk/xml-dom";
import { S4TKSettings } from "#helpers/settings";

/**
 * Formats all XML files within the given workspace's source folder.
 * 
 * @param workspace Workspace in which to format XML files
 */
export function formatAllSourceFiles(workspace: S4TKWorkspace) {
  if (!workspace.active) {
    vscode.window.showErrorMessage('Cannot format source XML files because no S4TK config is loaded.');
    return;
  }

  let fails = 0;
  let successes = 0;
  workspace.getAllSourceFiles("**/*.xml").forEach(filepath => {
    try {
      const buffer = fs.readFileSync(filepath);
      const doc = XmlDocumentNode.from(buffer);
      fs.writeFileSync(filepath, doc.toXml({
        spacesPerIndent: S4TKSettings.getSpacesPerIndent(),
      }));
      ++successes;
    } catch (_) {
      ++fails;
    }
  });

  if (successes) {
    if (fails) {
      vscode.window.showWarningMessage(
        `Some XML files formatted [${successes} succeeded; ${fails} failed]`
      );
    } else {
      vscode.window.showInformationMessage(
        `All XML files formatted [${successes} succeeded]`
      );
    }
  } else {
    vscode.window.showErrorMessage(fails
      ? `No XML files formatted [${fails} failed]`
      : 'No XML files could be found in the source directory.');
  }
}
