import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import { fnv32, fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";

export default function registerHashingCommands() {
  vscode.commands.registerCommand("s4tk.hashing.fnv31", async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV31" });
    const hash = fnv31(text ?? "");
    _showHashMessage(`Click to copy 31-bit hash for "${text}"`, hash, 8);
  });

  vscode.commands.registerCommand("s4tk.hashing.fnv32", async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV32" });
    const hash = fnv32(text ?? "");
    _showHashMessage(`Click to copy 32-bit hash for "${text}"`, hash, 8);
  });

  vscode.commands.registerCommand("s4tk.hashing.fnv64", async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV64" });
    const hash = fnv64(text ?? "");
    _showHashMessage(`Click to copy 64-bit hash for "${text}"`, hash, 16);
  });

  vscode.commands.registerCommand("s4tk.hashing.random31", () => {
    const hash = fnv31(uuidv4());
    _showHashMessage("Click to copy this random 31-bit FNV hash", hash, 8);
  });

  vscode.commands.registerCommand("s4tk.hashing.random32", () => {
    const hash = fnv32(uuidv4());
    _showHashMessage("Click to copy this random 32-bit FNV hash", hash, 8);
  });

  vscode.commands.registerCommand("s4tk.hashing.random64", () => {
    const hash = fnv64(uuidv4());
    _showHashMessage("Click to copy this random 64-bit FNV hash", hash, 16);
  });
}

function fnv31(text: string): number {
  return fnv32(text) & 2147483647;
}

function _showHashMessage(message: string, hash: number | bigint, digits: number) {
  vscode.window.showInformationMessage(
    message,
    hash.toString(),
    formatAsHexString(hash, digits, true),
    formatAsHexString(hash, digits, false)
  ).then(value => {
    if (value) vscode.env.clipboard.writeText(value);
  });
}
