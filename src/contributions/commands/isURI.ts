import { URL } from "node:url";

export function isURI(something: any): boolean {
  try {
    new URL(something);
    return true;
  } catch (error) {
    return false;
  }
}
