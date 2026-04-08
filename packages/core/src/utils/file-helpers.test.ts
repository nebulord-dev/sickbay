import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { execa } from 'execa';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  timer,
  parseJsonOutput,
  readPackageJson,
  isCommandAvailable,
  fileExists,
  relativeFromRoot,
} from './file-helpers.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe('timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns elapsed time in milliseconds', () => {
    const elapsed = timer();

    vi.advanceTimersByTime(500);

    expect(elapsed()).toBe(500);
  });

  it('can be called multiple times', () => {
    const elapsed = timer();

    vi.advanceTimersByTime(100);
    expect(elapsed()).toBe(100);

    vi.advanceTimersByTime(200);
    expect(elapsed()).toBe(300);
  });

  it('starts from zero', () => {
    const elapsed = timer();
    expect(elapsed()).toBe(0);
  });
});

describe('parseJsonOutput', () => {
  it('parses valid JSON string', () => {
    const result = parseJsonOutput('{"foo": "bar"}', '{}');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns fallback for invalid JSON', () => {
    const fallback = '{"default": "value"}';
    const result = parseJsonOutput('not valid json', fallback);
    expect(result).toEqual({ default: 'value' });
  });

  it('returns fallback for empty string', () => {
    const fallback = '{"empty": true}';
    const result = parseJsonOutput('', fallback);
    expect(result).toEqual({ empty: true });
  });

  it('handles nested JSON objects', () => {
    const input = '{"level1": {"level2": {"level3": "deep"}}}';
    const result = parseJsonOutput(input, '');
    expect(result).toEqual({
      level1: { level2: { level3: 'deep' } },
    });
  });

  it('handles JSON arrays', () => {
    const input = '[1, 2, 3, 4, 5]';
    const result = parseJsonOutput(input, '');
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles null values', () => {
    const input = '{"value": null}';
    const result = parseJsonOutput(input, '');
    expect(result).toEqual({ value: null });
  });

  it('preserves boolean values', () => {
    const input = '{"isTrue": true, "isFalse": false}';
    const result = parseJsonOutput(input, '');
    expect(result).toEqual({ isTrue: true, isFalse: false });
  });

  it('uses string fallback correctly', () => {
    const result = parseJsonOutput('invalid', '{"fallback": true}');
    expect(result).toEqual({ fallback: true });
  });

  it('uses default fallback {} when no fallback argument given', () => {
    const result = parseJsonOutput('not json');
    expect(result).toEqual({});
  });

  it('strips ANSI color codes before parsing', () => {
    const input = '\u001b[32m{"colored": true}\u001b[0m';
    expect(parseJsonOutput(input, '{}')).toEqual({ colored: true });
  });

  it('extracts JSON that appears after non-JSON text', () => {
    const input = 'info: running\n{"result": "ok"}';
    expect(parseJsonOutput(input, '{}')).toEqual({ result: 'ok' });
  });

  it('extracts a JSON array that appears after non-JSON text', () => {
    const input = 'Some log line\n[1, 2, 3]';
    expect(parseJsonOutput(input, '[]')).toEqual([1, 2, 3]);
  });

  it('extracts multi-line JSON that appears after non-JSON text', () => {
    const input = 'info: running checks\n{\n  "score": 95\n}';
    expect(parseJsonOutput(input, '{}')).toEqual({ score: 95 });
  });

  it('returns fallback when text contains only non-JSON lines', () => {
    const input = 'line one\nline two\nline three';
    expect(parseJsonOutput(input, '{"fallback": 1}')).toEqual({ fallback: 1 });
  });

  it('returns fallback for whitespace-only input', () => {
    expect(parseJsonOutput('   \n  ', '{"ws": true}')).toEqual({ ws: true });
  });
});

describe('readPackageJson', () => {
  it('reads and parses package.json from the given path', () => {
    vi.mocked(readFileSync).mockReturnValue('{"name": "my-app", "version": "1.0.0"}');
    const result = readPackageJson('/some/project');
    expect(result).toEqual({ name: 'my-app', version: '1.0.0' });
    // Use path.join so the expected value uses the platform-native separator
    // (forward slash on POSIX, backslash on Windows). The source code calls
    // path.join under the hood, so this test is platform-correct on both.
    expect(readFileSync).toHaveBeenCalledWith(join('/some/project', 'package.json'), 'utf-8');
  });

  it('throws when the file does not exist', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(() => readPackageJson('/missing')).toThrow('ENOENT');
  });

  it('throws when the file contains invalid JSON', () => {
    vi.mocked(readFileSync).mockReturnValue('not json');
    expect(() => readPackageJson('/bad')).toThrow(SyntaxError);
  });
});

describe('isCommandAvailable', () => {
  it('returns true when the command binary exists in local node_modules/.bin', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(await isCommandAvailable('knip')).toBe(true);
    expect(execa).not.toHaveBeenCalled();
  });

  it('returns true when the command is found via which on PATH', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execa).mockResolvedValue({} as never);
    expect(await isCommandAvailable('git')).toBe(true);
    expect(execa).toHaveBeenCalledWith('which', ['git']);
  });

  it('returns false when the command is not found anywhere', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execa).mockRejectedValue(new Error('not found'));
    expect(await isCommandAvailable('nonexistent-tool')).toBe(false);
  });
});

describe('fileExists', () => {
  it('returns true when the file exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(fileExists('/project', 'package.json')).toBe(true);
    expect(existsSync).toHaveBeenCalledWith(join('/project', 'package.json'));
  });

  it('returns false when the file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(fileExists('/project', 'missing.json')).toBe(false);
  });

  it('joins multiple path parts', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    fileExists('/root', 'src', 'index.ts');
    expect(existsSync).toHaveBeenCalledWith(join('/root', 'src', 'index.ts'));
  });
});

describe('relativeFromRoot', () => {
  // These tests use POSIX paths because the test runner is invoked from
  // POSIX systems (macOS/Linux) most of the time. The Windows-specific
  // behavior is exercised by the CI matrix on `windows-latest` — when
  // these same tests run there, `path.relative` produces backslashes
  // and the helper's split/join normalizes them, so the assertions
  // hold on both platforms.

  it('returns a project-relative path for a file inside the root', () => {
    expect(relativeFromRoot('/project', '/project/src/index.ts')).toBe('src/index.ts');
  });

  it('handles deeply nested files', () => {
    expect(relativeFromRoot('/project', '/project/src/components/ui/Button.tsx')).toBe(
      'src/components/ui/Button.tsx',
    );
  });

  it('returns just the filename when the file is directly in the root', () => {
    expect(relativeFromRoot('/project', '/project/package.json')).toBe('package.json');
  });

  it('returns "" when the path equals the root', () => {
    expect(relativeFromRoot('/project', '/project')).toBe('');
  });

  it('handles trailing slashes on the root', () => {
    expect(relativeFromRoot('/project/', '/project/src/index.ts')).toBe('src/index.ts');
  });

  it('always returns forward slashes (cross-platform invariant)', () => {
    // This is the property that prevents the original Windows bug:
    // every relative path returned must use `/`, never `\`, regardless
    // of which platform the runner is on.
    const result = relativeFromRoot('/project', '/project/src/components/Button.tsx');
    expect(result).not.toContain('\\');
    expect(result.split('/').length).toBeGreaterThan(1);
  });
});
