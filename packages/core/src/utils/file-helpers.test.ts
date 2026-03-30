import { existsSync, readFileSync } from 'fs';

import { execa } from 'execa';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  timer,
  parseJsonOutput,
  readPackageJson,
  isCommandAvailable,
  fileExists,
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
    expect(readFileSync).toHaveBeenCalledWith('/some/project/package.json', 'utf-8');
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
    expect(existsSync).toHaveBeenCalledWith('/project/package.json');
  });

  it('returns false when the file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(fileExists('/project', 'missing.json')).toBe(false);
  });

  it('joins multiple path parts', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    fileExists('/root', 'src', 'index.ts');
    expect(existsSync).toHaveBeenCalledWith('/root/src/index.ts');
  });
});
