import * as vscode from "vscode";
import { fnv32, fnv64 } from "@s4tk/hashing";
import { formatAsHexString } from "@s4tk/hashing/formatting";
import { randomFnv32, randomFnv64, reduceBits } from "#helpers/hashing";
import { COMMAND } from "#constants";

export default function registerHashingCommands() {
  vscode.commands.registerCommand(COMMAND.hashing.text, async () => {
    const bits = await _promptForBits();
    if (!bits) return;
    const text = await vscode.window.showInputBox({ title: `Text to hash with FNV${bits}` });
    const msg = `Click to copy ${bits}-bit hash for "${text}"`;
    if (bits <= 32) _showHashMessage(msg, reduceBits(fnv32(text ?? ""), bits), 8);
    else _showHashMessage(msg, reduceBits(fnv64(text ?? ""), bits), 16);
  });

  vscode.commands.registerCommand(COMMAND.hashing.text32, async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV32" });
    _showHashMessage(`Click to copy 32-bit hash for "${text}"`, fnv32(text ?? ""), 8);
  });

  vscode.commands.registerCommand(COMMAND.hashing.text64, async () => {
    const text = await vscode.window.showInputBox({ title: "Text to hash with FNV64" });
    _showHashMessage(`Click to copy 64-bit hash for "${text}"`, fnv64(text ?? ""), 16);
  });

  vscode.commands.registerCommand(COMMAND.hashing.random, async () => {
    const bits = await _promptForBits();
    if (!bits) return;
    const msg = `Click to copy this random ${bits}-bit FNV hash`;
    if (bits <= 32) _showHashMessage(msg, randomFnv32(bits), 8);
    else _showHashMessage(msg, randomFnv64(bits), 16);
  });

  vscode.commands.registerCommand(COMMAND.hashing.random32, () => {
    _showHashMessage("Click to copy this random 32-bit FNV hash", randomFnv32(), 8);
  });

  vscode.commands.registerCommand(COMMAND.hashing.random64, () => {
    _showHashMessage("Click to copy this random 64-bit FNV hash", randomFnv64(), 16);
  });
}

async function _promptForBits(): Promise<number | undefined> {
  const bitsString = await vscode.window.showInputBox({
    title: "Number of bits to use in hash",
    prompt: "Must be between 8 and 64 bits."
  });

  if (!bitsString) return;
  const bits = parseInt(bitsString);
  if (isNaN(bits) || bits < 8 || bits > 64) return;
  return bits;
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
