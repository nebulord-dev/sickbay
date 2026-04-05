interface SuppressSnippetInput {
  checkId: string;
  suppressMatch?: string;
  message?: string;
  file?: string;
}

export function buildSuppressSnippet({
  checkId,
  suppressMatch,
  message,
  file,
}: SuppressSnippetInput): string {
  const match = (suppressMatch ?? message ?? '').replace(/'/g, "\\'");
  const escapedFile = file?.replace(/'/g, "\\'");
  const pathComment = escapedFile ? ` /* path: '${escapedFile}', */` : '';
  return `// sickbay.config.ts → checks.${checkId}.suppress\n{ match: '${match}',${pathComment} reason: '' }`;
}
