const _COMMENT_REPLACEMENTS: { regex: RegExp; replacement: string; }[] = [
  { regex: /--/g, replacement: "&dash;&dash;" },
  { regex: /\n/g, replacement: "\\n" },
];

/**
 * Returns a string that is safe to use in an XML comment.
 * 
 * @param comment XML comment content to sanitize
 */
export function sanitizeXmlComment(comment: string): string {
  let sanitized = comment;
  _COMMENT_REPLACEMENTS.forEach(({ regex, replacement }) => {
    sanitized = sanitized.replace(regex, replacement);
  });
  return sanitized;
}
