import type { ResourceKey } from "@s4tk/models/types";
import { StringTableResource } from "@s4tk/models";
import { StringTableLocale, BinaryResourceType } from "@s4tk/models/enums";
import { formatAsHexString, formatStringKey } from "@s4tk/hashing/formatting";
import S4TKAssets from "#assets";
import { randomFnv32, randomFnv64 } from "#helpers/hashing";
import { parseAndValidateJson } from "#helpers/schemas";
import { S4TKSettings } from "#helpers/settings";

/**
 * A string table JSON that follows the `stbl.schema.json` schema.
 */
export default class StringTableJson {
  //#region Properties

  private static _DEFAULT_GROUP_STRING = "0x80000000";
  private static _DEFAULT_GROUP_INT = 0x80000000;

  public get format() { return this._format; }
  public get hasMetaData() { return this._format.endsWith("metadata"); }
  public get isArray() { return this._format.startsWith("array"); }
  public get isObject() { return this._format.startsWith("object"); }

  private _locale?: StringTableLocaleName;
  public get locale() { return this._locale; }

  private _group?: string;
  public get group() { return this._group; }

  private _instanceBase?: string;
  public get instanceBase() { return this._instanceBase; }

  private _fragment?: boolean;
  public get fragment() { return this._fragment; }

  //#endregion

  //#region Lifecycle

  constructor(
    private _format: StringTableJsonFormat,
    private _entries: StringTableJsonEntry[],
    metadata?: {
      locale?: StringTableLocaleName;
      group?: string;
      instanceBase?: string;
      fragment?: boolean;
    }) {
    this._locale = metadata?.locale;
    this._group = metadata?.group;
    this._instanceBase = metadata?.instanceBase;
    this._fragment = metadata?.fragment;
  }

  /**
   * Parses the given JSON content into a StringTableJson object.
   * 
   * @param content JSON content from which to parse a StringTableJson
   * @throws If JSON is malformed or violates schema
   */
  static parse(content: string): StringTableJson {
    const result = parseAndValidateJson<RawStringTableJson>(content, S4TKAssets.schemas.stbl);

    if (result.parsed) {
      if (Array.isArray(result.parsed)) {
        const entriesArr = result.parsed as RawStringTableJsonArray;
        return new StringTableJson("array", entriesArr);
      } else if ((result.parsed as RawStringTableJsonMetaData).entries) {
        const metadata = result.parsed as RawStringTableJsonMetaData;
        if (Array.isArray(metadata.entries)) {
          const entriesArr = metadata.entries as RawStringTableJsonArray;
          return new StringTableJson("array-metadata", entriesArr, {
            locale: metadata.locale,
            group: metadata.group,
            instanceBase: metadata.instanceBase,
            fragment: metadata.fragment,
          });
        } else {
          const entriesObj = metadata.entries as RawStringTableJsonObject;
          const entriesArr: RawStringTableJsonArray = [];
          for (const key in entriesObj) entriesArr.push({ key, value: entriesObj[key] });
          return new StringTableJson("object-metadata", entriesArr, {
            locale: metadata.locale,
            group: metadata.group,
            instanceBase: metadata.instanceBase,
            fragment: metadata.fragment,
          });
        }
      } else {
        const entriesObj = result.parsed as RawStringTableJsonObject;
        const entriesArr: RawStringTableJsonArray = [];
        for (const key in entriesObj) entriesArr.push({ key, value: entriesObj[key] });
        return new StringTableJson("object", entriesArr);
      }
    } else {
      throw new Error(result.error);
    }
  }

  /**
   * Generates a new StringTableJson. If using a "metadata" format, all metadata
   * will be filled in with defaults (instanceBase will use random FNV56).
   * 
   * @param format Format to use for JSON
   */
  static generate(format?: StringTableJsonFormat): StringTableJson {
    format ??= S4TKSettings.get("defaultStringTableJsonType");
    return (format === "array" || format === "object")
      ? new StringTableJson(format, [])
      : new StringTableJson(format, [], {
        locale: S4TKSettings.get("defaultStringTableLocale"),
        group: StringTableJson._DEFAULT_GROUP_STRING,
        instanceBase: formatAsHexString(randomFnv64(56), 14, true),
      });
  }

  /**
   * Converts a binary string table to a StringTableJson.
   * 
   * @param key Meta data to use for STBL JSON
   * @param stbl Binary STBL resource to convert
   */
  static fromBinary(key: ResourceKey, stbl: StringTableResource): StringTableJson {
    const group = formatAsHexString(key.group, 8, true);
    const locale = (StringTableLocale[StringTableLocale.getLocale(key.instance)]
      ?? S4TKSettings.get("defaultStringTableLocale")) as StringTableLocaleName;
    const instanceBase = formatAsHexString(StringTableLocale.getInstanceBase(key.instance), 14, true);
    return new StringTableJson(
      S4TKSettings.get("defaultStringTableJsonType") === "array"
        ? "array-metadata"
        : "object-metadata",
      stbl.toJsonObject(true, false) as StringTableJsonEntry[],
      { group, locale, instanceBase }
    );
  }

  //#endregion

  //#region Public Methods

  /**
   * Adds an entry to this string table with a random FNV32 hash, and then
   * returns the key that was generated.
   */
  addEntry({ value = "", position = "end" }: {
    value?: string;
    position?: "start" | "end";
  } = {}): number {
    const key = randomFnv32();
    if (position === "start") {
      this._entries.unshift({
        key: formatStringKey(key),
        value: value
      });
    } else {
      this._entries.push({
        key: formatStringKey(key),
        value: value
      });
    }
    return key;
  }

  /**
   * Returns the XML string to use for the entry at the given index.
   * 
   * @param index Index of entry to get XML for
   */
  getEntryXml(index: number): string {
    const entry = this._entries[index];
    return entry ? `${entry.key}<!--${entry.value}-->` : '';
  }

  /**
   * Returns a resource key to use for a binary STBL created from this JSON. If
   * any metadata is missing, it will be filled in with default values (or a
   * random FNV56 in the case of the instance base).
   */
  getResourceKey(): ResourceKey {
    return {
      type: BinaryResourceType.StringTable,
      group: this._group
        ? parseInt(this._group, 16)
        : StringTableJson._DEFAULT_GROUP_INT,
      instance: StringTableLocale.setHighByte(
        StringTableLocale[this._locale ?? S4TKSettings.get("defaultStringTableLocale")],
        this._instanceBase
          ? BigInt(this._instanceBase)
          : randomFnv64()
      )
    }
  }

  /**
   * Adds any missing metadata to this STBL by filling them in with defaults,
   * and also changes the format to a "metadata" one if needed.
   * 
   * @param defaultLocale Locale to insert if it is missing
   */
  insertDefaultMetadata() {
    this._locale ??= S4TKSettings.get("defaultStringTableLocale");
    this._group ??= StringTableJson._DEFAULT_GROUP_STRING;
    this._instanceBase ??= formatAsHexString(randomFnv64(56), 14, true);
    if (this._format === "object") this._format = "object-metadata";
    else if (this._format === "array") this._format = "array-metadata";
  }

  /**
   * Writes this STBL JSON to a string.
   */
  stringify(): string {

    let entries: RawStringTableJsonEntries = this._entries;
    if (this.isObject) {
      entries = {};
      this._entries.forEach(({ key, value }) =>
        (entries as RawStringTableJsonObject)[key] = value
      );
    }

    if (this.hasMetaData) {
      return JSON.stringify({
        locale: this._locale,
        group: this._group,
        instanceBase: this._instanceBase,
        fragment: this._fragment,
        entries: entries,
      }, null, S4TKSettings.getSpacesPerIndent());
    } else {
      return JSON.stringify(entries, null, S4TKSettings.getSpacesPerIndent());
    }
  }

  /**
   * Converts this StringTableJson to an array in-place.
   */
  toArray() {
    if (this._format === "object") this._format = "array";
    else if (this._format === "object-metadata") this._format = "array-metadata";
  }

  /**
   * Converts this StringTableJson to an object in-place.
   */
  toObject() {
    if (this._format === "array") this._format = "object";
    else if (this._format === "array-metadata") this._format = "object-metadata";
  }

  /**
   * Creates a new StringTableJson that is a fragment of this one.
   */
  toFragment(): StringTableJson {
    if (!(this.hasMetaData && this.instanceBase && this.locale != null)) {
      throw new Error("Cannot create a fragment for a STBL JSON that doesn't have a set locale and instance base.");
    }

    return new StringTableJson(this.format, [], {
      locale: this.locale,
      group: this.group,
      instanceBase: this.instanceBase,
      fragment: true
    });
  }

  /**
   * Creates a binary StringTableResource from this StringTableJson.
   */
  toBinaryResource(): StringTableResource {
    return new StringTableResource(this._entries.map(({ key, value }) => ({
      key: parseInt(key, 16),
      value: value
    })));
  }

  //#endregion
}

//#region Types

type StringTableJsonFormat = "array" | "object" | "array-metadata" | "object-metadata";

interface StringTableJsonEntry { key: string; value: string; }

type RawStringTableJsonArray = StringTableJsonEntry[];
type RawStringTableJsonObject = { [key: string]: string; };
type RawStringTableJsonEntries = RawStringTableJsonArray | RawStringTableJsonObject;

interface RawStringTableJsonMetaData {
  locale?: StringTableLocaleName;
  group?: string;
  instanceBase?: string;
  fragment?: boolean;
  entries: RawStringTableJsonEntries;
}

type RawStringTableJson = RawStringTableJsonEntries | RawStringTableJsonMetaData;

//#endregion
