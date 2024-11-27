import { fnv64 } from "@s4tk/hashing";
import { XmlNode } from "@s4tk/xml-dom";
import { reduceBits } from "#helpers/hashing";
import { maxBitsForClass } from "#diagnostics/helpers";
import { HashingRuleInfo } from "#workspace/s4tk-config";

/**
 * Returns a hash for a tuning file with the given root node, taking the
 * optional hashing rules into account.
 * 
 * @param root Root node of tuning file to get hash for
 * @param options Optional arguments for hashing algorithm
 */
export function getTuningHash(root: XmlNode, options?: {
  hashingRules?: HashingRuleInfo[];
}): bigint {
  if (root.tag === "M") return _getModuleTuningHash(root.name);

  const maxBits = (options?.hashingRules?.length
    ? _getCustomRulesRequiredBits(root, options.hashingRules)
    : undefined) ?? maxBitsForClass(root.attributes.c);

  return _getDefaultTuningHash(root.name, maxBits);
}

//#region Helpers

function _getModuleTuningHash(filename: string): bigint {
  return fnv64(filename.replace(/\./g, "-"));
}

function _getDefaultTuningHash(filename: string, maxBits: number): bigint {
  return reduceBits(fnv64(filename), maxBits);
}

function _getCustomRulesRequiredBits(root: XmlNode, hashingRules: HashingRuleInfo[]): number | undefined {
  for (const rule of hashingRules) {
    if (rule.className && rule.className !== root.attributes.c) continue;
    if (rule.instanceType && rule.instanceType !== root.attributes.i) continue;
    if (rule.modulePath && rule.modulePath !== root.attributes.m) continue;
    if (rule.tuningNameRegex && !(new RegExp(rule.tuningNameRegex).test(root.name))) continue;
    return rule.bits;
  }
}

//#endregion
