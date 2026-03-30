import { describe, it, expect } from 'vitest';

import { sparkline, trendArrow } from './trend.js';

describe('sparkline', () => {
  it('returns empty string for empty array', () => {
    expect(sparkline([])).toBe('');
  });

  it('returns a single character for a single value', () => {
    const result = sparkline([50]);
    expect(result).toHaveLength(1);
  });

  it('returns a string with the same length as the input array', () => {
    const values = [10, 20, 30, 40, 50];
    expect(sparkline(values)).toHaveLength(5);
  });

  it('uses the lowest bar character for the minimum value', () => {
    const result = sparkline([0, 100]);
    // first char should be lowest block, last should be highest
    expect(result[0]).toBe('▁');
    expect(result[1]).toBe('█');
  });

  it('uses the same character for all equal values (range collapses to 1)', () => {
    const result = sparkline([50, 50, 50]);
    // All identical values — range is 0, treated as 1, so index = 0 = '▁'
    expect(result).toBe('▁▁▁');
  });

  it('produces ascending characters for strictly increasing values', () => {
    const values = [0, 25, 50, 75, 100];
    const result = sparkline(values);
    // Each character code should be >= previous
    for (let i = 1; i < result.length; i++) {
      expect(result.charCodeAt(i)).toBeGreaterThanOrEqual(result.charCodeAt(i - 1));
    }
  });

  it('handles negative values correctly', () => {
    const result = sparkline([-10, 0, 10]);
    expect(result).toHaveLength(3);
    // First should be lowest, last should be highest
    expect(result.charCodeAt(0)).toBeLessThanOrEqual(result.charCodeAt(2));
  });
});

describe('trendArrow', () => {
  it('returns stable with fewer than 2 values', () => {
    expect(trendArrow([])).toEqual({ direction: 'stable', label: '—' });
    expect(trendArrow([80])).toEqual({ direction: 'stable', label: '—' });
  });

  it('returns up when latest minus first exceeds 2', () => {
    const result = trendArrow([70, 80]);
    expect(result.direction).toBe('up');
    expect(result.label).toBe('↑10');
  });

  it('returns down when first minus latest exceeds 2', () => {
    const result = trendArrow([80, 70]);
    expect(result.direction).toBe('down');
    expect(result.label).toBe('↓10');
  });

  it('returns stable when difference is exactly 2', () => {
    expect(trendArrow([80, 82])).toEqual({ direction: 'stable', label: '±0' });
    expect(trendArrow([80, 78])).toEqual({ direction: 'stable', label: '±0' });
  });

  it('returns stable when difference is 0', () => {
    expect(trendArrow([75, 75])).toEqual({ direction: 'stable', label: '±0' });
  });

  it('uses only the first and last values in a longer array', () => {
    // 50 → 90 → 40: diff = 40 - 50 = -10 → down
    const result = trendArrow([50, 90, 40]);
    expect(result.direction).toBe('down');
    expect(result.label).toBe('↓10');
  });

  it('returns up for a diff of exactly 3', () => {
    const result = trendArrow([77, 80]);
    expect(result.direction).toBe('up');
    expect(result.label).toBe('↑3');
  });

  it('returns down for a diff of exactly -3', () => {
    const result = trendArrow([80, 77]);
    expect(result.direction).toBe('down');
    expect(result.label).toBe('↓3');
  });

  it('label includes the absolute diff value when going down', () => {
    const result = trendArrow([100, 85]);
    expect(result.direction).toBe('down');
    expect(result.label).toBe('↓15');
  });

  it('label includes the diff value when going up', () => {
    const result = trendArrow([60, 95]);
    expect(result.direction).toBe('up');
    expect(result.label).toBe('↑35');
  });
});
