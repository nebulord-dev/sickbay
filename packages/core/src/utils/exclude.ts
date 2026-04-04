import picomatch from 'picomatch';

/**
 * Creates a filter function that tests file paths against glob exclude patterns.
 * Returns a function: (filePath) => true if the file should be excluded.
 */
export function createExcludeFilter(patterns: string[]): (filePath: string) => boolean {
  if (patterns.length === 0) return () => false;
  const isMatch = picomatch(patterns);
  return (filePath: string) => isMatch(filePath);
}
