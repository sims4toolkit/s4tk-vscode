import { StringTableResource } from "@s4tk/models";
import { randomFnv32 } from "#helpers/hashing";
import { S4TKSettings } from "#helpers/settings";
import StringTableJson from "./stbl-json";

/**
 * A STBL model that can be used in place of binary or JSON stbls.
 */
export default class StringTableProxy {
  private readonly _stbl: StringTableJson | StringTableResource;
  private readonly _type: "json" | "binary";

  constructor(data: Uint8Array) {
    if (data.slice(0, 4).toString() === "STBL") {
      this._type = "binary";
      this._stbl = StringTableResource.from(Buffer.from(data));
    } else {
      this._type = "json";
      this._stbl = StringTableJson.parse(data.toString());
    }
  }

  /**
   * Adds the given value to the STBL and returns its generated key.
   * 
   * @param value Value to add to STBL
   */
  addValue(value: string): number {
    if (this._type === "binary") {
      const key = randomFnv32();
      (this._stbl as StringTableResource).add(key, value);
      return key;
    } else {
      const position = S4TKSettings.get("newStringsToStartOfStringTable") ? "start" : "end";
      return (this._stbl as StringTableJson).addEntry({ value, position });
    }
  }

  /**
   * Writes this STBL to a byte array.
   */
  serialize(): Uint8Array {
    if (this._type === "binary") {
      return (this._stbl as StringTableResource).getBuffer();
    } else {
      return Buffer.from((this._stbl as StringTableJson).stringify());
    }
  }
}
