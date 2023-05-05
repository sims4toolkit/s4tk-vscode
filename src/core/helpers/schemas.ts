import * as fs from "fs";
import * as vscode from "vscode";
import { ValidationError, Validator } from "jsonschema";

//#region Types

interface JsonParseResult<T> {
  parsed?: T;
  error?: string;
}

//#endregion

//#region Exported Functions

/**
 * Parses the given string as a JSON object and validates it against the schema
 * at the given URI.
 * 
 * If the JSON is syntactically valid and passes the schema, it is returned as
 * `parsed` in the JsonParseResult.
 * 
 * If it either has a syntax error or does not pass the schema, a human-readable
 * error message is returned as `error` in the JsonParseResult.
 * 
 * @param content String content to parse as JSON
 * @param schemaUri URI of schema
 */
export function parseAndValidateJson<T = object>(
  content: string,
  schemaUri: vscode.Uri
): JsonParseResult<T> {
  try {
    const json = JSON.parse(content);
    validateJson(json, schemaUri);
    return { parsed: json };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { error: e.message };
    } else if (e instanceof ValidationError) {
      return { error: e.stack };
    } else {
      return { error: 'Unknown error occurred' };
    }
  }
}

/**
 * Validates the given JSON object against the schema at the given URI. If the
 * JSON is valid, nothing happens. If not, an exception is thrown.
 * 
 * @param json JSON to validate
 * @param schemaUri URI of schema
 * @throws If JSON is not valid
 */
export function validateJson(
  json: object,
  schemaUri: vscode.Uri
) {
  const validator = new Validator();
  validator.validate(json, _getSchema(schemaUri), {
    throwError: true,
  });
}

//#endregion

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
