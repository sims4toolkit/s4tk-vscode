import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import * as vscode from "vscode";
import { inferXmlMetaData } from "#helpers/xml";

const _DEFINITION_REGEX = /<[MI] [^>]+>/;
const _INDEX = new Map<string, vscode.Definition>();

/**
 * TODO:
 * 
 * @param id TODO:
 */
export function getDefinition(id: string): vscode.Definition | undefined {
  return _INDEX.get(id);
}

/**
 * TODO:
 */
export async function indexWorkspace() {
  _INDEX.clear();
  vscode.workspace.workspaceFolders?.forEach(folder => {
    const basePath = folder.uri.fsPath.replace(/\\/g, "/");
    glob.sync(`${basePath}/**/*.xml`).forEach(filepath => {
      if (filepath.endsWith(".SimData.xml")) return;
      try {
        const fsPath = path.normalize(filepath);
        const buffer = fs.readFileSync(fsPath);
        const content = buffer.toString();
        const metadata = inferXmlMetaData(content);
        if (!metadata?.key.instance) return;
        const match = _DEFINITION_REGEX.exec(content);
        const definition = match?.[0]!;
        const [start] = content.split(definition, 1);
        const newlines = start.split("\n").length - 1;
        _INDEX.set(metadata.key.instance.toString(), {
          range: new vscode.Range(newlines, 0, newlines, definition.length),
          uri: vscode.Uri.file(fsPath),
        });
      } catch (_) { }
    });
  });
}
