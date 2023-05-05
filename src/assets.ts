import * as vscode from "vscode";
import { getExtensionContext } from "#extension";

function _uriResolver<T>(obj: T): {
  [key in keyof T]: vscode.Uri;
} {
  return new Proxy(obj as object, {
    get(target: any, prop: string) {
      const baseUri = getExtensionContext().extension.extensionUri;
      return vscode.Uri.joinPath(baseUri, ...(target[prop]));
    }
  });
}

export const MEDIA = {
  root: _uriResolver({
    reset: ["reset.css"],
    vscode: ["vscode.css"],
  }),
  editors: _uriResolver({
    stblBinaryStyle: ["editors", "stbl-binary.css"],
    stblBinaryScript: ["editors", "stbl-binary.js"],
  }),
};

export const SCHEMAS = _uriResolver({
  config: ["s4tk-config.schema.json"],
  stbl: ["stbl.schema.json"],
});
