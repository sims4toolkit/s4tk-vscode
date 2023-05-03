import { ExtensionContext } from "vscode";
import StringTableJsonCodeLensProvider from "./stbl-codelens";
import S4TKConfigCodeLensProvider from "./s4tk-config-codelens";

/**
 * Registers all code lens providers.
 */
export default function registerCodeLensProviders(context: ExtensionContext) {
  StringTableJsonCodeLensProvider.register();
  S4TKConfigCodeLensProvider.register();
}
