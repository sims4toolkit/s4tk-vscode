import * as vscode from "vscode";

export interface S4TKSettings {
  showCopyConfirmMessage: boolean;
  showConfigLoadedMessage: boolean;
  showConfigUnloadedMessage: boolean;
  newStringsToStartOfStringTable: boolean;
  defaultStringTableJsonType: "array" | "object";
  defaultStringTableLocale: StringTableLocaleName;
}

type S4TKSettingKey = keyof S4TKSettings;

export namespace S4TKSettings {
  export function get<T extends S4TKSettingKey>(setting: T): S4TKSettings[T] {
    const config = vscode.workspace.getConfiguration("s4tk");
    return config.get(setting) as S4TKSettings[T];
  }

  export function set<T extends S4TKSettingKey>(setting: T, value: S4TKSettings[T]) {
    const config = vscode.workspace.getConfiguration("s4tk");
    config.update(setting, value);
  }

  export function getSpacesPerIndent(): number {
    return vscode.workspace.getConfiguration("editor").get("tabSpaces") ?? 2;
  }
}
