import { ResourceKey } from "@s4tk/models/types";
import { StringTableResource } from "@s4tk/models";
import { StringTableLocale, BinaryResourceType } from "@s4tk/models/enums";
import { formatAsHexString, formatStringKey } from "@s4tk/hashing/formatting";
import { randomFnv32, randomFnv64 } from "#helpers/hashing";
import { parseAndValidateJson } from "#helpers/schemas";
import { SCHEMAS } from "#assets";

type StringTableJsonFormat = "array" | "object";

interface StringTableJsonEntry {
  key: string;
  value: string;
}

/**
 * A string table JSON that follows the `stbl.schema.json` schema.
 */
export default class StringTableJson {
  //#region Properties

  private static _DEFAULT_GROUP_STRING = "0x80000000";
  private static _DEFAULT_GROUP_INT = 0x80000000;

  public get format() { return this._format; }

  private _locale?: StringTableLocaleName;
  public get locale() { return this._locale; }

  private _group?: string;
  public get group() { return this._group; }

  private _instanceBase?: string;
  public get instanceBase() { return this._instanceBase; }

  //#endregion

  //#region Lifecycle

  constructor(
    private _format: StringTableJsonFormat,
    private _entries: StringTableJsonEntry[],
    metadata?: {
      locale?: StringTableLocaleName;
      group?: string;
      instanceBase?: string;
    }) {
    this._locale = metadata?.locale;
    this._group = metadata?.group;
    this._instanceBase = metadata?.instanceBase;
  }

  /**
   * Parses the given JSON content into a StringTableJson object.
   * 
   * @param content JSON content from which to parse a StringTableJson
   * @throws If JSON is malformed or violates schema
   */
  static parse(content: string): StringTableJson {
    const result = parseAndValidateJson<{
      entries: StringTableJsonEntry[];
      locale?: StringTableLocaleName;
      group?: string;
      instanceBase?: string;
    } | StringTableJsonEntry[]>(content, SCHEMAS.stbl);

    if (result.parsed) {
      return Array.isArray(result.parsed)
        ? new StringTableJson("array", result.parsed)
        : new StringTableJson("object", result.parsed.entries, result.parsed);
    } else {
      throw new Error(result.error);
    }
  }

  /**
   * Generates a new StringTableJson. If using the "object" format, all metadata
   * will be filled in with defaults (instanceBase will use random FNV56).
   * 
   * @param format Format to use for JSON
   * @param defaultLocale Locale to use if format is object
   */
  static generate(
    format: StringTableJsonFormat,
    defaultLocale: StringTableLocaleName
  ): StringTableJson {
    return format === "array"
      ? new StringTableJson(format, [])
      : new StringTableJson(format, [], {
        locale: defaultLocale,
        group: StringTableJson._DEFAULT_GROUP_STRING,
        instanceBase: formatAsHexString(randomFnv64(56), 14, true),
      });
  }

  /**
   * Generates a Buffer containing StringTableJson data. If using the "object"
   * format, all metadata will be filled in with defaults (instanceBase will use
   * random FNV56).
   * 
   * @param format Format to use for JSON
   * @param defaultLocale Locale to use if format is object
   * @param spaces Number of spaces to use while formatting
   */
  static generateBuffer(
    format: StringTableJsonFormat,
    defaultLocale: StringTableLocaleName,
    spaces: number
  ): Buffer {
    return Buffer.from(
      StringTableJson.generate(format, defaultLocale).stringify(spaces)
    );
  }

  //#endregion

  //#region Public Methods

  /**
   * Adds an entry to this string table with a random FNV32 hash.
   */
  addEntry({ value = "", position = "end" }: {
    value?: string;
    position?: "start" | "end";
  } = {}) {
    if (position === "start") {
      this._entries.unshift({
        key: formatStringKey(randomFnv32()),
        value: value
      });
    } else {
      this._entries.push({
        key: formatStringKey(randomFnv32()),
        value: value
      });
    }
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
   * 
   * @param defaultLocale Locale to use if one is not set
   */
  getResourceKey(defaultLocale: StringTableLocaleName): ResourceKey {
    return {
      type: BinaryResourceType.StringTable,
      group: this._group
        ? parseInt(this._group, 16)
        : StringTableJson._DEFAULT_GROUP_INT,
      instance: StringTableLocale.setHighByte(
        StringTableLocale[this._locale ?? defaultLocale],
        this._instanceBase
          ? BigInt(this._instanceBase)
          : randomFnv64()
      )
    }
  }

  /**
   * Adds any missing metadata to this STBL by filling them in with defaults,
   * and also changes the format to "object" if needed.
   * 
   * @param defaultLocale Locale to insert if it is missing
   */
  insertDefaultMetadata(defaultLocale: StringTableLocaleName) {
    this._locale ??= defaultLocale;
    this._group ??= StringTableJson._DEFAULT_GROUP_STRING;
    this._instanceBase ??= formatAsHexString(randomFnv64(56), 14, true);
    this._format = "object";
  }

  /**
   * Writes this STBL JSON to a string.
   * 
   * @param spaces Number of spaces to use while formatting
   */
  stringify(spaces: number): string {
    if (this._format === "array") {
      return JSON.stringify(this._entries, null, spaces);
    } else {
      return JSON.stringify({
        locale: this._locale,
        group: this._group,
        instanceBase: this._instanceBase,
        entries: this._entries,
      }, null, spaces);
    }
  }

  /**
   * Converts this STBL JSON to a binary STBL resource.
   */
  toBinaryResource(): StringTableResource {
    return new StringTableResource(this._entries.map(({ key, value }) => ({
      key: parseInt(key, 16),
      value: value
    })));
  }

  //#endregion
}
