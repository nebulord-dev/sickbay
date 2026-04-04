/**
 * Scoring categories. Excludes 'unknown-category' from CheckResult['category']
 * because unknown categories have no configurable weight (they fall back to 0.1 in scoring.ts).
 */
export type Category = 'dependencies' | 'performance' | 'code-quality' | 'security' | 'git';

export interface SickbayConfig {
  checks?: Record<string, boolean | CheckConfig>;
  exclude?: string[];
  weights?: Partial<Record<Category, number>>;
}

export interface CheckConfig {
  enabled?: boolean;
  thresholds?: Record<string, unknown>;
  exclude?: string[];
  suppress?: SuppressionRule[];
}

export interface SuppressionRule {
  path?: string;
  match?: string;
  reason: string;
}

export interface ResolvedConfigMeta {
  hasCustomConfig: boolean;
  overriddenChecks: string[];
  disabledChecks: string[];
}

export function defineConfig(config: SickbayConfig): SickbayConfig {
  return config;
}
