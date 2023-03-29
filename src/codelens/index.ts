import StringTableJsonCodeLensProvider from "./stbl-codelens";

/**
 * Registers all code lens providers.
 */
export default function registerCodeLensProviders() {
  StringTableJsonCodeLensProvider.register();
}
