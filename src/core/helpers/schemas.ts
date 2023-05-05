import * as fs from "fs";
import * as vscode from "vscode";
import { Validator } from "jsonschema";

/**
 * Validates the given object against the schema at the given URI. If the object
 * is valid, nothing happens. If there is an error, an exception is thrown.
 * 
 * @param obj Object to validate against the schema
 * @param schemaUri URI of schema to validate against
 * @throws If object fails to validate against the schema
 */
export function validateSchema(obj: object, schemaUri: vscode.Uri) {
  const validator = new Validator();
  validator.validate(obj, _getSchema(schemaUri), {
    throwError: true,
  });
}

//#region Helpers

const _schemaCache = new Map<vscode.Uri, object>();

function _getSchema(uri: vscode.Uri): object {
  if (_schemaCache.has(uri)) return _schemaCache.get(uri)!;
  // intentionally using fs instead of vscode b/c it should be sync
  const buffer = fs.readFileSync(uri.fsPath);
  const schema = JSON.parse(buffer.toString());
  _schemaCache.set(uri, schema);
  return schema;
}

//#endregion
