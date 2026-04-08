interface SuppressSnippetInput {
  checkId: string;
  suppressMatch?: string;
  message?: string;
  file?: string;
}

/**
 * Escape a string so it can be safely embedded inside a single-quoted
 * JavaScript/TypeScript string literal. Handles backslash, single quote,
 * newline, carriage return, and lone \u2028/\u2029 line terminators (which
 * break JS string literals even though they render as whitespace).
 *
 * Order matters: backslash must be escaped first, otherwise subsequent
 * replacements (which introduce their own backslashes) would be double-escaped.
 */
function escapeForSingleQuoted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildSuppressSnippet({
  checkId,
  suppressMatch,
  message,
  file,
}: SuppressSnippetInput): string {
  const match = escapeForSingleQuoted(suppressMatch ?? message ?? '');
  const escapedFile = file === undefined ? undefined : escapeForSingleQuoted(file);
  const pathComment = escapedFile ? ` /* path: '${escapedFile}', */` : '';
  return `// sickbay.config.ts → checks.${checkId}.suppress\n{ match: '${match}',${pathComment} reason: '' }`;
}
