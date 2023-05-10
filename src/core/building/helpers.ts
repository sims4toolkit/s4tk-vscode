import type { Warnable } from "./summary";

/**
 * Returns a new Error with the given message and adds a warning to a Warnable.
 * This is just for cleaner syntax in the build script.
 * 
 * @param message Message to include in error
 * @param kwargs Optional keyword args
 */
export function FatalBuildError(message: string, kwargs?: {
  addWarning?: Warnable;
}): Error {
  if (kwargs?.addWarning) kwargs.addWarning.warning = message;
  return new Error(message);
}

/**
 * Adds the given item to the given array and then returns it. This is nearly
 * pointless, but it helps a lot with TypeScript type checking.
 * 
 * @param array Array to add item to
 * @param item Item to add and return
 */
export function addAndGetItem<T>(array: T[], item: T): T {
  array.push(item);
  return item;
}
