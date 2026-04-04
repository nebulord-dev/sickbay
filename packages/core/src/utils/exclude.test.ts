import { describe, it, expect } from 'vitest';

import { createExcludeFilter } from './exclude.js';

describe('createExcludeFilter', () => {
  it('returns false for everything when patterns is empty', () => {
    const isExcluded = createExcludeFilter([]);
    expect(isExcluded('src/foo.ts')).toBe(false);
    expect(isExcluded('anything')).toBe(false);
  });

  it('excludes files matching a directory glob', () => {
    const isExcluded = createExcludeFilter(['src/generated/**']);
    expect(isExcluded('src/generated/types.ts')).toBe(true);
    expect(isExcluded('src/generated/deep/nested.ts')).toBe(true);
    expect(isExcluded('src/app/foo.ts')).toBe(false);
  });

  it('excludes files matching an extension glob', () => {
    const isExcluded = createExcludeFilter(['**/*.test.ts']);
    expect(isExcluded('src/foo.test.ts')).toBe(true);
    expect(isExcluded('src/foo.ts')).toBe(false);
  });

  it('supports multiple patterns (union)', () => {
    const isExcluded = createExcludeFilter(['src/generated/**', 'src/vendor/**']);
    expect(isExcluded('src/generated/foo.ts')).toBe(true);
    expect(isExcluded('src/vendor/lib.ts')).toBe(true);
    expect(isExcluded('src/app/foo.ts')).toBe(false);
  });

  it('matches exact file paths', () => {
    const isExcluded = createExcludeFilter(['src/legacy.ts']);
    expect(isExcluded('src/legacy.ts')).toBe(true);
    expect(isExcluded('src/other.ts')).toBe(false);
  });
});
