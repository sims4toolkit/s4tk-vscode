// import { fnv32, fnv64 } from "@s4tk/hashing";
import { formatAsHexString, formatStringKey } from "@s4tk/hashing/formatting";
import { StringTableResource } from "@s4tk/models";
import { StringTableLocale, BinaryResourceType } from "@s4tk/models/enums";
import { ResourceKey } from "@s4tk/models/types";
import { KeyStringPair } from "@s4tk/models/lib/resources/stbl/types";
import { randomFnv32, randomFnv64 } from "#helpers/hashing";

const _DEFAULT_LOCALE = "English";
const _DEFAULT_GROUP = "0x80000000";

interface StringTableJsonEntry {
  key: number | string;
  value: string;
}

export default class StringTableJson {
  public locale?: string;
  public group?: number | string;
  public instanceBase?: string;

  //#region Lifecycle

  constructor(public entries: StringTableJsonEntry[], options: {
    locale?: string;
    group?: number | string;
    instanceBase?: string;
  } = {}) {
    this.locale = options?.locale;
    this.group = options?.group;
    this.instanceBase = options?.instanceBase;
  }

  /**
   * Parses the given JSON content into a StringTableJson object.
   * 
   * @param content JSON content from which to parse a StringTableJson
   * @throws If JSON is malformed 
   */
  static parse(content: string): StringTableJson {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      return new StringTableJson(parsed);
    } else {
      const stblJson = new StringTableJson(parsed.entries);
      stblJson.locale = parsed.locale;
      stblJson.group = parsed.group;
      stblJson.instanceBase = parsed.instanceBase;
      return stblJson;
    }
  }

  /**
   * Generates a STBL JSON with a random instance and returns its contents as
   * a buffer.
   */
  static generateRandomContent(): Uint8Array {
    const json = {
      locale: _DEFAULT_LOCALE,
      group: _DEFAULT_GROUP,
      instanceBase: formatAsHexString(randomFnv64(56), 14, true),
      entries: []
    };

    return Buffer.from(JSON.stringify(json, null, 2));
  }

  //#endregion

  //#region Public Methods

  /**
   * Adds an entry with an optional value to this string table. The key will be
   * a random FNV32 hash.
   */
  addEntry(value = '', addToStart = false) {
    const entry = {
      key: formatStringKey(randomFnv32()),
      value
    };

    if (addToStart) {
      this.entries.unshift(entry);
    } else {
      this.entries.push(entry);
    }
  }

  /**
   * Returns a copy of `this.entries` where every key is a number.
   * 
   * @returns List of entries where every key is a number
   */
  getNormalizedEntries(): KeyStringPair[] {
    return this.entries.map(({ key, value }) => ({
      key: typeof key === "string"
        ? parseInt(key, 16)
        : key,
      value: value,
    }));
  }

  /**
   * Returns a resource key to use for this STBL JSON. If `group`,
   * `instanceBase`, and `locale` are defined, they will be used. Otherwise,
   * they will default to `0x80000000`, a random FNV64 hash, and
   * `StringTableLocale.English`.
   */
  getResourceKey(): ResourceKey {
    return {
      type: BinaryResourceType.StringTable,
      group: (typeof this.group === "string"
        ? parseInt(this.group, 16)
        : this.group) ?? 0x80000000,
      instance: StringTableLocale.setHighByte(
        //@ts-ignore
        StringTableLocale[this.locale] ?? StringTableLocale.English,
        this.instanceBase ? BigInt(this.instanceBase) : randomFnv64()
      )
    }
  }

  /**
   * Adds any missing metadata to this STBL by filling them in with defaults.
   */
  insertDefaultMetadata() {
    this.locale ??= _DEFAULT_LOCALE;
    this.group ??= _DEFAULT_GROUP;
    this.instanceBase ??= formatAsHexString(randomFnv64(56), 14, true);
  }

  /**
   * Converts this StringTableJson to a JSON string.
   * 
   * @param spaces Number of spaces to use in produced output
   */
  stringify(spaces = 2): string {
    const json: any = {};

    let hasCopiedProp = false;
    const copyProp = (propName: string) => {
      if ((this as any)[propName] != undefined) {
        json[propName] = (this as any)[propName];
        hasCopiedProp = true;
      }
    };

    copyProp('locale');
    copyProp('group');
    copyProp('instanceBase');

    if (hasCopiedProp) {
      json.entries = this.entries;
      return JSON.stringify(json, null, spaces);
    } else {
      return JSON.stringify(this.entries, null, spaces);
    }
  }

  /**
   * Converts this STBL JSON to a regular STBL.
   */
  toStringTableResource(): StringTableResource {
    return new StringTableResource(this.getNormalizedEntries());
  }

  //#endregion
}
