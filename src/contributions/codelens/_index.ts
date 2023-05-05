import S4TKConfigCodeLensProvider from "./s4tk-config-codelens";
import StringTableJsonCodeLensProvider from "./stbl-codelens";
import TuningCodeLensProvider from "./tuning-codelens";

export default function registerCodeLensProviders() {
  S4TKConfigCodeLensProvider.register();
  StringTableJsonCodeLensProvider.register();
  TuningCodeLensProvider.register();
}
