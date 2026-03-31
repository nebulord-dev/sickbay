import startrekQuotes from './startrek.json';

import type { Quote } from '../types.js';

export type SeverityTier = 'critical' | 'warning' | 'info' | 'allClear';

/**
 * Retrieves a quote based on the overall score. The quote's severity is determined by the score, and a random quote from the corresponding severity tier is returned.
 * @param overallScore
 * @returns
 */
export function getQuote(overallScore: number): Quote {
  const severity = scoreToTier(overallScore);
  const pool = startrekQuotes[severity];
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return {
    text: entry.text,
    source: entry.source,
    severity,
  };
}

function scoreToTier(score: number): SeverityTier {
  if (score < 60) return 'critical';
  if (score < 80) return 'warning';
  if (score < 90) return 'info';
  return 'allClear';
}
