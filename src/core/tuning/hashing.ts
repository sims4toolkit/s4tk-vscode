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
  const rule = _getCustomHashingRule(root, options?.hashingRules);
  return rule !== undefined
    ? _getInstanceTuningHashWithRule(root, rule)
    : _getInstanceTuningHash(root.name, maxBitsForClass(root.attributes.c));
}

//#region Helpers

function _getModuleTuningHash(filename: string): bigint {
  return fnv64(filename.replace(/\./g, "-"));
}

function _getInstanceTuningHash(filename: string, maxBits: number): bigint {
  return reduceBits(fnv64(filename), maxBits);
}

function _getCustomHashingRule(root: XmlNode, hashingRules: HashingRuleInfo[] | undefined): HashingRuleInfo | undefined {
  if (!hashingRules?.length) return;
  for (const rule of hashingRules) {
    const { className, instanceType, modulePath, tuningNameRegex } = rule.conditions;
    if (className && className !== root.attributes.c) continue;
    if (instanceType && instanceType !== root.attributes.i) continue;
    if (modulePath && modulePath !== root.attributes.m) continue;
    if (tuningNameRegex && !(new RegExp(tuningNameRegex).test(root.name))) continue;
    return rule;
  }
}

function _getInstanceTuningHashWithRule(root: XmlNode, rule: HashingRuleInfo): bigint {
  const textToHash = rule.transformText
    ? _safeTransform("filename", rule.transformText, root.name, "string")
    : root.name;
  const bitsToHashWith = rule.bits ?? maxBitsForClass(root.attributes.c);
  const hash = _getInstanceTuningHash(textToHash, bitsToHashWith);
  return rule.transformHash
    ? _safeTransform("hash", rule.transformHash, hash, "bigint")
    : hash;
}

function _safeTransform<T>(arg: string, logic: string, value: T, type: "bigint" | "string"): T {
  try {
    const newValue = Function(arg, `return (${logic});`)(value);
    return typeof newValue === type ? newValue : value;
  } catch (_) {
    return value;
  }
}

//#endregion
