import { v4 as uuidv4 } from "uuid";
import { fnv32, fnv64 } from "@s4tk/hashing";

/**
 * Generates a unique, random FNV32 hash.
 * 
 * @param maxBits Maximum number of bits this hash may have
 */
export function randomFnv32(maxBits?: number): number {
  const hash = fnv32(_saltedUuid());
  return maxBits ? reduceBits(hash, maxBits) : hash;
}

/**
 * Generates a unique, random FNV64 hash.
 * 
 * @param maxBits Maximum number of bits this hash may have
 */
export function randomFnv64(maxBits?: number): bigint {
  const hash = fnv64(_saltedUuid());
  return maxBits ? reduceBits(hash, maxBits) : hash;
}

/**
 * Returns the given value after a bitwise AND with the given number of bits.
 * 
 * @param value Original value (number or bigint)
 * @param maxBits Maximum number of bits
 */
export function reduceBits<T>(value: T, maxBits: number): T {
  //@ts-ignore
  if (typeof value === "number") return value & ((2 ** maxBits) - 1);
  //@ts-ignore
  return value & ((2n ** BigInt(maxBits)) - 1n);
}

function _saltedUuid(): string {
  //@ts-ignore
  return `${Math.floor(new Date())}${uuidv4()}`;
}
