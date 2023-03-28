import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import { fnv32, fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";

export default function registerHashingCommands() {
  vscode.commands.registerCommand("s4tk.hashing.fnv31", () => {
    // TODO: implement
    vscode.window.showInformationMessage("Not implemented");
  });

  vscode.commands.registerCommand("s4tk.hashing.fnv32", () => {
    // TODO: implement
    vscode.window.showInformationMessage("Not implemented");
  });

  vscode.commands.registerCommand("s4tk.hashing.fnv64", () => {
    // TODO: implement
    vscode.window.showInformationMessage("Not implemented");
  });

  vscode.commands.registerCommand("s4tk.hashing.random31", () => {
    const hash = fnv32(uuidv4()) & 2147483647;
    _showHashMessage("Click to copy this random 31-bit FNV hash", hash);
  });

  vscode.commands.registerCommand("s4tk.hashing.random32", () => {
    const hash = fnv32(uuidv4());
    _showHashMessage("Click to copy this random 32-bit FNV hash", hash);
  });

  vscode.commands.registerCommand("s4tk.hashing.random64", () => {
    const hash = fnv64(uuidv4());
    _showHashMessage("Click to copy this random 64-bit FNV hash", hash);
  });
}

function _showHashMessage(message: string, hash: number | bigint) {
  vscode.window.showInformationMessage(
    message,
    hash.toString(),
    formatAsHexString(hash, 16, true),
    formatAsHexString(hash, 16, false)
  ).then(value => {
    if (value) vscode.env.clipboard.writeText(value);
  });
}
