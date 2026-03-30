import { describe, it, expect } from 'vitest';

import { getQuote } from './index.js';
import startrekQuotes from './startrek.json';

describe('getQuote', () => {
  it('returns a valid Quote object', () => {
    const quote = getQuote(50);
    expect(quote).toHaveProperty('text');
    expect(quote).toHaveProperty('source');
    expect(quote).toHaveProperty('severity');
  });

  it('returns critical tier for score < 60', () => {
    const quote = getQuote(59);
    expect(quote.severity).toBe('critical');
  });

  it('returns warning tier for score 60', () => {
    const quote = getQuote(60);
    expect(quote.severity).toBe('warning');
  });

  it('returns warning tier for score 79', () => {
    const quote = getQuote(79);
    expect(quote.severity).toBe('warning');
  });

  it('returns info tier for score 80', () => {
    const quote = getQuote(80);
    expect(quote.severity).toBe('info');
  });

  it('returns info tier for score 89', () => {
    const quote = getQuote(89);
    expect(quote.severity).toBe('info');
  });

  it('returns allClear tier for score 90', () => {
    const quote = getQuote(90);
    expect(quote.severity).toBe('allClear');
  });

  it('returns allClear tier for score 100', () => {
    const quote = getQuote(100);
    expect(quote.severity).toBe('allClear');
  });

  it('all severity tiers have quotes', () => {
    expect(startrekQuotes.critical.length).toBeGreaterThan(0);
    expect(startrekQuotes.warning.length).toBeGreaterThan(0);
    expect(startrekQuotes.info.length).toBeGreaterThan(0);
    expect(startrekQuotes.allClear.length).toBeGreaterThan(0);
  });

  it('returned quote text exists in the source data', () => {
    const quote = getQuote(75);
    const pool = startrekQuotes[quote.severity];
    expect(pool.some((q) => q.text === quote.text && q.source === quote.source)).toBe(true);
  });
});
