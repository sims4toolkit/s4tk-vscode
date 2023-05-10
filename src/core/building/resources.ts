import * as path from "path";
import { sync as globSync } from "glob";
import { ResourceKey } from "@s4tk/models/types";
import type { ValidatedPath } from "./summary";

//#region Constants

export const SUPPORTED_EXTENSIONS = [
  ".package",
  ".stbl",
  ".stbl.json",
  ".xml",
];

export const TGI_REGEX = /(?<t>[0-9a-f]{8}).(?<g>[0-9a-f]{8}).(?<i>[0-9a-f]{16})/i;

//#endregion

//#region Functions

/**
 * Returns all supported filepaths resolved from the given patterns.
 * 
 * @param include Patterns to include in search
 * @param exclude Patterns to exclude from search
 * @param unsupported If true, then inverts the supported filter
 */
export function findGlobMatches(
  include: ValidatedPath[] | string[],
  exclude: ValidatedPath[] | string[] | undefined,
  unsupported: boolean = false,
): string[] {
  const toAbsPath = (p: string | ValidatedPath) =>
    typeof p === "string" ? p : p.resolved;
  return globSync(include.map(toAbsPath), {
    ignore: exclude?.map(toAbsPath)
  }).filter((fp) => isSupportedFileType(fp) !== unsupported);
}

/**
 * Returns whether the given file is of a supported filetype.
 * 
 * @param filepath Absolute path to file
 */
export function isSupportedFileType(filepath: string): boolean {
  const filename = path.basename(filepath);
  if (SUPPORTED_EXTENSIONS.some(ext => filename.endsWith(ext))) return true;
  return TGI_REGEX.test(filename);
}

/**
 * Parses a ResourceKry from a TGI filename, if possible. Returns undefined if
 * the filename does not pass the TGI regex.
 * 
 * @param filename Name of file to parse TGI from
 */
export function parseKeyFromTgi(filename: string): ResourceKey | undefined {
  const match = TGI_REGEX.exec(filename);
  if (match?.groups) {
    const { t, g, i } = match.groups;
    return {
      type: parseInt(t, 16),
      group: parseInt(g, 16),
      instance: BigInt("0x" + i),
    };
  }
}

//#endregion
