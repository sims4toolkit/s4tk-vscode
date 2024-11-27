import type { ResourceKey } from "@s4tk/models/types";

export const TGI_REGEX = /(?<t>[0-9a-f]{8}).(?<g>[0-9a-f]{8}).(?<i>[0-9a-f]{16})/i;

/**
 * Parses a ResourceKey from a TGI filename, if possible. Returns undefined if
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
