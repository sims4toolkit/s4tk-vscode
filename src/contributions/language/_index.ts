import * as vscode from "vscode";
import TuningDefinitionProvider from "./tuning-definitions";
import TuningHoverProvider from "./tuning-hover";
import initializeDiagnostics from "./tuning-diagnostics";

export default function registerLanguageProviders(context: vscode.ExtensionContext) {
  TuningDefinitionProvider.register();
  TuningHoverProvider.register();
  initializeDiagnostics(context);
}
