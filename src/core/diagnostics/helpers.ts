import DiagnoticsData from "./data";

/**
 * Returns the maximum number of bits that the instance ID for a tuning of the
 * given class type can be. If not explicitly set in data, then defaults to 64.
 * 
 * @param cls Name of tuning class
 */
export function maxBitsForClass(cls: string): number {
  for (const limit of DiagnoticsData.bitLimits)
    if (limit.classes.has(cls)) return limit.bits;
  return 64;
}

/**
 * Returns whether or not a tuning file with the given type and class is
 * required to have a SimData file.
 * 
 * @param type Name of tuning type, as it appears in `i`
 * @param cls Name of tuning class, as it appears in `c`
 */
export function requiresSimData(type: string, cls: string): boolean {
  if (!DiagnoticsData.requiredSimData.has(type)) return false;
  return DiagnoticsData.requiredSimData.get(type)!.has(cls);
}
