import TdescDefinitionProvider from "./tuning-definitions";
import TdescHoverProvider from "./tuning-hover";

export default function registerIntellisenseProviders() {
  TdescDefinitionProvider.register();
  TdescHoverProvider.register();
}
