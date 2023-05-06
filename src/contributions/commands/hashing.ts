import * as vscode from "vscode";
import { fnv32, fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { randomFnv32, randomFnv64, reduceBits } from "#helpers/hashing";
import { COMMAND } from "#constants";

export default function registerHashingCommands() {
  vscode.commands.registerCommand(COMMAND.hashing.text, async () => {
    // TODO: implement with multiple steps
  });

  vscode.commands.registerCommand(COMMAND.hashing.text32, async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV32" });
    _showHashMessage(`Click to copy 32-bit hash for "${text}"`, fnv32(text ?? ""), 8);
  });

  vscode.commands.registerCommand(COMMAND.hashing.text64, async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV64" });
    _showHashMessage(`Click to copy 64-bit hash for "${text}"`, fnv64(text ?? ""), 16);
  });

  vscode.commands.registerCommand(COMMAND.hashing.random, () => {
    // TODO: implement with multiple steps
  });

  vscode.commands.registerCommand(COMMAND.hashing.random32, () => {
    _showHashMessage("Click to copy this random 32-bit FNV hash", randomFnv32(), 8);
  });

  vscode.commands.registerCommand(COMMAND.hashing.random64, () => {
    _showHashMessage("Click to copy this random 64-bit FNV hash", randomFnv64(), 16);
  });
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
