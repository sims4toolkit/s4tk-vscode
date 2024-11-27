import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import { Package, StringTableResource } from "@s4tk/models";
import { BinaryResourceType, StringTableLocale } from "@s4tk/models/enums";
import { resolveGlobPattern } from "#helpers/fs";
import StringTableJson from "./stbl-json";
import { S4TKSettings } from "#helpers/settings";
import { parseKeyFromTgi } from "#helpers/file-names";

type StringTableMap = Map<number, string>;

/**
 * Loads all strings from all STBLs in the given locale found in the given
 * directories into a map and returns it.
 * 
 * @param dirpaths Paths to all directories to search for STBLs
 * @param locale Locale of string tables to load
 */
export function loadAllStringsInFolders(dirpaths: string[], locale: StringTableLocale): StringTableMap {
  const map: StringTableMap = new Map<number, string>();
  dirpaths.forEach(dirpath => _loadAllStringsInFolder(dirpath, locale, map));
  return map;
}

//#region Helpers

function _loadAllStringsInFolder(dirpath: string, locale: StringTableLocale, map: StringTableMap) {
  try {
    const filepaths = glob.sync(resolveGlobPattern(dirpath, "**/*"));
    filepaths.forEach(filepath => _loadAllStringsInFile(filepath, locale, map));
  } catch (_) { }
}

function _loadAllStringsInFile(filepath: string, locale: StringTableLocale, map: StringTableMap) {
  try {
    const ext = path.extname(filepath);
    switch (ext) {
      case ".json":
        return _loadAllStringsInJsonFile(filepath, locale, map);
      case ".package":
        return _loadAllStringsInPackageFile(filepath, locale, map);
      case ".stbl":
      case ".binary":
      case ".bnry":
        return _loadAllStringsInBinaryStblFile(filepath, locale, map);
    }
  } catch (_) { }
}

function _loadAllStringsInJsonFile(filepath: string, locale: StringTableLocale, map: StringTableMap) {
  const buffer = fs.readFileSync(filepath);
  const json = StringTableJson.parse(buffer.toString());
  const jsonLocale = StringTableLocale[json.locale == undefined
    ? S4TKSettings.get("defaultStringTableLocale")
    : json.locale];
  if (jsonLocale === locale)
    json.forEach(entry => map.set(parseInt(entry.key, 16), entry.value));
}

function _loadAllStringsInPackageFile(filepath: string, locale: StringTableLocale, map: StringTableMap) {
  const buffer = fs.readFileSync(filepath);
  Package.extractResources<StringTableResource>(buffer, {
    resourceFilter(type, _, instance) {
      if (type !== BinaryResourceType.StringTable) return false;
      return StringTableLocale.getLocale(instance) === locale;
    }
  }).forEach(entry => _loadAllStringsInStbl(entry.value, map));
}

function _loadAllStringsInBinaryStblFile(filepath: string, locale: StringTableLocale, map: StringTableMap) {
  const filename = path.basename(filepath);
  const key = parseKeyFromTgi(filename);
  const actualLocale = key?.instance != undefined
    ? StringTableLocale.getLocale(key.instance)
    : StringTableLocale[S4TKSettings.get("defaultStringTableLocale")];
  if (actualLocale !== locale) return;
  const buffer = fs.readFileSync(filepath);
  const stbl = StringTableResource.from(buffer);
  _loadAllStringsInStbl(stbl, map);
}

function _loadAllStringsInStbl(stbl: StringTableResource, map: StringTableMap) {
  stbl.entries.forEach(entry => map.set(entry.key, entry.value));
}

//#endregion
