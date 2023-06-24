import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import * as vscode from "vscode";
import { inferXmlMetaData } from "#helpers/xml";

const _DEFINITION_REGEX = /<[MI] [^>]+>/;
const _IDS_TO_DEFS = new Map<string, vscode.Definition>();
const _PATHS_TO_IDS = new Map<string, string>();

namespace S4TKIndex {
  /**
   * TODO:
   * 
   * @param id TODO:
   */
  export function getDefinition(id: string): vscode.Definition | undefined {
    return _IDS_TO_DEFS.get(id);
  }

  /**
   * TODO:
   * 
   * @param fsPath TODO:
   */
  export function onDeleteFile(fsPath: string) {
    const id = _PATHS_TO_IDS.get(fsPath);
    if (id == null) return;
    _IDS_TO_DEFS.delete(id);
    _PATHS_TO_IDS.delete(fsPath);
  }

  /**
   * TODO:
   * 
   * @param document TODO:
   */
  export function onSaveDocument(document: vscode.TextDocument) {
    try {
      const oldId = _PATHS_TO_IDS.get(document.uri.fsPath);
      const metadata = inferXmlMetaData(document);
      const newId = metadata.key.instance?.toString();
      if (oldId == newId) return;

      if (oldId) _IDS_TO_DEFS.delete(oldId);

      if (newId) {
        _PATHS_TO_IDS.set(document.uri.fsPath, newId);

        for (let i = 0; i < document.lineCount; ++i) {
          const line = document.lineAt(i);

          if (_DEFINITION_REGEX.test(line.text)) {
            _IDS_TO_DEFS.set(newId, {
              range: line.range,
              uri: document.uri
            });

            return;
          }
        }
      } else {
        _PATHS_TO_IDS.delete(document.uri.fsPath);
      }
    } catch (_) { }
  }

  /**
   * TODO:
   */
  export async function refresh() {
    _IDS_TO_DEFS.clear();
    _PATHS_TO_IDS.clear();
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
          const instString = metadata.key.instance.toString();
          _PATHS_TO_IDS.set(fsPath, instString);
          _IDS_TO_DEFS.set(instString, {
            range: new vscode.Range(newlines, 0, newlines, definition.length),
            uri: vscode.Uri.file(fsPath),
          });
        } catch (_) { }
      });
    });
  }
}

export default S4TKIndex;
