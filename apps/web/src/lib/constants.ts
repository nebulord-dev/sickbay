// Duplicated from @nebulord/sickbay-core/constants to avoid pulling Node.js
// dependencies into the browser bundle. Keep in sync with core.

// File complexity thresholds
export const WARN_LINES = 400;
export const CRITICAL_LINES = 600;

// Score thresholds
export const SCORE_GOOD = 80;
export const SCORE_FAIR = 60;

// Default category weights — duplicated from core to avoid Node.js imports
export const DEFAULT_WEIGHTS: Record<string, number> = {
  security: 0.3,
  dependencies: 0.25,
  'code-quality': 0.25,
  performance: 0.15,
  git: 0.05,
};
