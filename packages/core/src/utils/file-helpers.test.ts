import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timer, parseJsonOutput } from './file-helpers.js';

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
});
