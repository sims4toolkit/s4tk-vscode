import * as vscode from "vscode";
import TuningDefinitionProvider from "./tuning-definitions";
import TuningHoverProvider from "./tuning-hover";
import initializeDiagnostics from "./diagnostics";
import StringDefinitionProvider from "./string-definitions";

export default function registerLanguageProviders(context: vscode.ExtensionContext) {
  StringDefinitionProvider.register();
  TuningDefinitionProvider.register();
  TuningHoverProvider.register();
  initializeDiagnostics(context);
}
