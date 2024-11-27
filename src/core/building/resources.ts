import * as path from "path";
import { sync as globSync } from "glob";
import type { ValidatedPath } from "./summary";
import { TGI_REGEX } from "#helpers/file-names";

//#region Constants

export const SUPPORTED_EXTENSIONS = [
  ".package",
  ".stbl",
  ".stbl.json",
  ".xml",
];

//#endregion

//#region Functions

/**
 * Returns all filepaths resolved from the given patterns.
 * 
 * @param include Patterns to include in search
 * @param exclude Patterns to exclude from search
 * @param searchType Which files to match
 */
export function findGlobMatches(
  include: ValidatedPath[] | string[],
  exclude: ValidatedPath[] | string[] | undefined,
  searchType: "all" | "supported" | "unsupported",
): string[] {
  const toAbsPath = (p: string | ValidatedPath) =>
    typeof p === "string" ? p : p.resolved;

  const matches = globSync(include.map(toAbsPath), {
    ignore: exclude?.map(toAbsPath)
  });

  if (searchType === "all") return matches;

  const supported = searchType === "supported";
  return matches.filter((fp) => isSupportedFileType(fp) === supported);
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

//#endregion
