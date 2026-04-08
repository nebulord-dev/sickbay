import { describe, it, expect } from 'vitest';

import { buildSuppressSnippet } from './suppress-snippet.js';

describe('buildSuppressSnippet', () => {
  it('generates snippet with suppressMatch and file', () => {
    const result = buildSuppressSnippet({
      checkId: 'npm-audit',
      suppressMatch: 'lodash',
      file: 'src/utils.ts',
    });
    expect(result).toBe(
      `// sickbay.config.ts → checks.npm-audit.suppress\n{ match: 'lodash', /* path: 'src/utils.ts', */ reason: '' }`,
    );
  });

  it('generates snippet without file', () => {
    const result = buildSuppressSnippet({
      checkId: 'outdated',
      suppressMatch: 'vitest',
    });
    expect(result).toBe(
      `// sickbay.config.ts → checks.outdated.suppress\n{ match: 'vitest', reason: '' }`,
    );
  });

  it('falls back to message when suppressMatch is not provided', () => {
    const result = buildSuppressSnippet({
      checkId: 'git',
      message: 'Last commit was 45 days ago',
    });
    expect(result).toBe(
      `// sickbay.config.ts → checks.git.suppress\n{ match: 'Last commit was 45 days ago', reason: '' }`,
    );
  });

  it('escapes single quotes in match value', () => {
    const result = buildSuppressSnippet({
      checkId: 'test',
      suppressMatch: "it's broken",
    });
    expect(result).toContain("match: 'it\\'s broken'");
  });

  it('escapes single quotes in file path', () => {
    const result = buildSuppressSnippet({
      checkId: 'test',
      suppressMatch: 'foo',
      file: "src/it's-a-file.ts",
    });
    expect(result).toContain("/* path: 'src/it\\'s-a-file.ts', */");
  });

  it('escapes backslashes before quotes so the output is parseable', () => {
    // Windows-style path with backslash. Previously this would produce
    // `match: 'C:\foo'` which is syntactically ambiguous (\f is a JS escape).
    const result = buildSuppressSnippet({
      checkId: 'test',
      suppressMatch: 'C:\\foo\\bar',
    });
    expect(result).toContain("match: 'C:\\\\foo\\\\bar'");
  });

  it('does not double-escape a single quote that follows a backslash', () => {
    // Input: don\'t  → previous buggy version would emit a malformed literal.
    // Now the backslash becomes \\ and the quote becomes \', so together: \\\'
    const result = buildSuppressSnippet({
      checkId: 'test',
      suppressMatch: "don\\'t",
    });
    expect(result).toContain("match: 'don\\\\\\'t'");
  });

  it('escapes newlines and carriage returns', () => {
    const result = buildSuppressSnippet({
      checkId: 'test',
      suppressMatch: 'line one\nline two\r\nline three',
    });
    expect(result).toContain("match: 'line one\\nline two\\r\\nline three'");
  });

  it('escapes U+2028 and U+2029 line terminators', () => {
    const result = buildSuppressSnippet({
      checkId: 'test',
      suppressMatch: 'foo\u2028bar\u2029baz',
    });
    expect(result).toContain("match: 'foo\\u2028bar\\u2029baz'");
  });
});
