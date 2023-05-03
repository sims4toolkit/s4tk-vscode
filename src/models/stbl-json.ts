import { fnv32, fnv64 } from "@s4tk/hashing";
import { formatAsHexString, formatStringKey } from "@s4tk/hashing/formatting";
import { StringTableResource } from "@s4tk/models";
import { StringTableLocale, BinaryResourceType } from "@s4tk/models/enums";
import { ResourceKey } from "@s4tk/models/types";
import { KeyStringPair } from "@s4tk/models/lib/resources/stbl/types";
import { saltedUuid } from "@helpers/utils";

interface StringTableJsonEntry {
  key: number | string;
  value: string;
}

export default class StringTableJson {
  public group?: number | string;
  public instanceBase?: string;
  public locale?: string;

  //#region Lifecycle

  constructor(public entries: StringTableJsonEntry[], options: {
    group?: number | string;
    instanceBase?: string;
    locale?: string;
  } = {}) {
    this.group = options?.group;
    this.instanceBase = options?.instanceBase;
    this.locale = options?.locale;
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
      stblJson.group = parsed.group;
      stblJson.instanceBase = parsed.instanceBase;
      stblJson.locale = parsed.locale;
      return stblJson;
    }
  }

  /**
   * Generates a STBL JSON with a random instance and returns its contents as
   * a buffer.
   */
  static generateRandomContent(): Uint8Array {
    const json = {
      group: "0x80000000",
      instanceBase: formatAsHexString(
        StringTableLocale.getInstanceBase(fnv64(saltedUuid())),
        14,
        true
      ),
      locale: "English",
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
      key: formatStringKey(fnv32(saltedUuid())),
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
        this.instanceBase ? BigInt(this.instanceBase) : fnv64(saltedUuid())
      )
    }
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

    copyProp('group');
    copyProp('instanceBase');
    copyProp('locale');

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
