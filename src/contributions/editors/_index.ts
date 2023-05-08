import PackageEditorProvider from "./package/provider";
import StringTableEditorProvider from "./stbl-binary/provider";

export default function registerEditorProviders() {
  PackageEditorProvider.register();
  StringTableEditorProvider.register();
}
