import { existsSync } from 'fs';
import { join } from 'path';

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

const CONFIG_FILES = ['sickbay.config.ts', 'sickbay.config.js', 'sickbay.config.mjs'];

export async function loadConfig(projectPath: string): Promise<SickbayConfig | null> {
  const configPath = CONFIG_FILES.map((f) => join(projectPath, f)).find((p) => existsSync(p));

  if (!configPath) return null;

  try {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(projectPath);
    const mod = await jiti.import(configPath);
    const config = (mod as Record<string, unknown>).default ?? mod;
    return config as SickbayConfig;
  } catch (err) {
    process.stderr.write(
      `Warning: Failed to load ${configPath}: ${err instanceof Error ? err.message : err}\n` +
        `Falling back to defaults.\n`,
    );
    return null;
  }
}
