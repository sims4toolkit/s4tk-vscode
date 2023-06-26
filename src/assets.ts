import * as vscode from "vscode";

namespace S4TKAssets {
  let _extensionContext: vscode.ExtensionContext;

  export const MEDIA = {
    root: _uriResolver("media", {
      resetStyle: ["reset.css"],
      vscodeStyle: ["vscode.css"],
    }),
    editors: _uriResolver("media", {
      packageStyle: ["editors", "package.css"],
      packageScript: ["editors", "package.js"],
      stblBinaryStyle: ["editors", "stbl-binary.css"],
      stblBinaryScript: ["editors", "stbl-binary.js"],
    }),
  };

  export const SCHEMAS = _uriResolver("schemas", {
    config: ["s4tk-config.schema.json"],
    stbl: ["stbl.schema.json"],
  });

  export const SAMPLES = _uriResolver("samples", {
    config: ["s4tk.config.json"],
    gitignore: ["gitignore.txt"],
    package: ["sample.package"],
    readme: ["HowToUseS4TK.md"],
    simdata: ["buff_Example.SimData.xml"],
    stbl: ["sample.stbl"],
    stblJsonStrings: ["default-stbl-strings.json"],
    tuning: ["buff_Example.xml"],
  });

  export function setExtensionContext(context: vscode.ExtensionContext) {
    _extensionContext = context;
  }

  function _uriResolver<T>(root: string, obj: T): {
    [key in keyof T]: vscode.Uri;
  } {
    return new Proxy(obj as object, {
      get(target: any, prop: string) {
        const baseUri = _extensionContext.extension.extensionUri;
        return vscode.Uri.joinPath(baseUri, root, ...(target[prop]));
      }
    });
  }
}

export default S4TKAssets;
