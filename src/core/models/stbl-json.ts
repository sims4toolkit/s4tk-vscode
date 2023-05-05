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

  private static _DEFAULT_LOCALE = "English";
  private static _DEFAULT_GROUP = "0x80000000";

  private _locale?: string;
  private _group?: string;
  private _instanceBase?: string;

  //#endregion

  //#region Lifecycle

  private constructor(
    private _format: StringTableJsonFormat,
    private _entries: StringTableJsonEntry[],
    metadata?: {
      locale?: string;
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
      locale?: string;
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
   */
  static generate(format: StringTableJsonFormat): StringTableJson {
    return format === "array"
      ? new StringTableJson(format, [])
      : new StringTableJson(format, [], {
        locale: StringTableJson._DEFAULT_LOCALE,
        group: StringTableJson._DEFAULT_GROUP,
        instanceBase: formatAsHexString(randomFnv64(56), 14, true),
      });
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
   * Returns a resource key to use for a binary STBL created from this JSON. If
   * any metadata is missing, it will be filled in with default values (or a
   * random FNV56 in the case of the instance base).
   */
  getResourceKey(): ResourceKey {
    return {
      type: BinaryResourceType.StringTable,
      group: parseInt(this._group ?? StringTableJson._DEFAULT_GROUP, 16),
      instance: StringTableLocale.setHighByte(
        //@ts-ignore If locale isn't valid, English is returned
        StringTableLocale[this._locale] ?? StringTableLocale.English,
        this._instanceBase ? BigInt(this._instanceBase) : randomFnv64()
      )
    }
  }

  /**
   * Adds any missing metadata to this STBL by filling them in with defaults,
   * and also changes the format to "object" if needed.
   */
  insertDefaultMetadata() {
    this._locale ??= StringTableJson._DEFAULT_LOCALE;
    this._group ??= StringTableJson._DEFAULT_GROUP;
    this._instanceBase ??= formatAsHexString(randomFnv64(56), 14, true);
    this._format = "object";
  }

  /**
   * Writes this STBL JSON to a string.
   */
  stringify(): string {
    // TODO: get spacing from config / user settings
    const spacing = 2;

    if (this._format === "array") {
      return JSON.stringify(this._entries, null, spacing);
    } else {
      return JSON.stringify({
        locale: this._locale,
        group: this._group,
        instanceBase: this._instanceBase,
        entries: this._entries,
      }, null, spacing);
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
