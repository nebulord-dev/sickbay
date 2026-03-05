import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { projectHash } from './project-hash.js';

describe('projectHash', () => {
  it('returns a 16-character hex string', () => {
    expect(projectHash('/some/project')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns the same hash for the same path', () => {
    expect(projectHash('/project/a')).toBe(projectHash('/project/a'));
  });

  it('returns different hashes for different paths', () => {
    expect(projectHash('/project/a')).not.toBe(projectHash('/project/b'));
  });

  it('resolves relative paths before hashing so "." equals its absolute path', () => {
    const absolutePath = resolve('.');
    expect(projectHash('.')).toBe(projectHash(absolutePath));
  });

  it('matches a manually computed sha256 slice', () => {
    const path = '/test/project';
    const expected = createHash('sha256').update(resolve(path)).digest('hex').slice(0, 16);
    expect(projectHash(path)).toBe(expected);
  });
});
