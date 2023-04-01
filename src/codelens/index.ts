import { ExtensionContext } from "vscode";
import StringTableJsonCodeLensProvider from "./stbl-codelens";

/**
 * Registers all code lens providers.
 */
export default function registerCodeLensProviders(context: ExtensionContext) {
  StringTableJsonCodeLensProvider.register();
}
