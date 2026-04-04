import { existsSync } from 'fs';
import { join, resolve } from 'path';

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

export function isCheckDisabled(config: SickbayConfig | null, checkId: string): boolean {
  if (!config?.checks) return false;
  const entry = config.checks[checkId];
  if (entry === false) return true;
  if (typeof entry === 'object' && entry.enabled === false) return true;
  return false;
}

export function resolveConfigMeta(config: SickbayConfig | null): ResolvedConfigMeta {
  if (!config) {
    return { hasCustomConfig: false, overriddenChecks: [], disabledChecks: [] };
  }

  const disabledChecks: string[] = [];
  const overriddenChecks: string[] = [];

  if (config.checks) {
    for (const [id, entry] of Object.entries(config.checks)) {
      if (entry === false || (typeof entry === 'object' && entry.enabled === false)) {
        disabledChecks.push(id);
      } else if (typeof entry === 'object') {
        if (entry.thresholds || entry.exclude?.length || entry.suppress?.length) {
          overriddenChecks.push(id);
        }
      }
    }
  }

  const hasCustomConfig =
    disabledChecks.length > 0 ||
    overriddenChecks.length > 0 ||
    (config.weights !== undefined && Object.keys(config.weights).length > 0) ||
    (config.exclude !== undefined && config.exclude.length > 0);

  return { hasCustomConfig, overriddenChecks, disabledChecks };
}

export function validateConfig(config: SickbayConfig, knownCheckIds: string[]): void {
  if (config.weights) {
    for (const [category, value] of Object.entries(config.weights)) {
      if (value !== undefined && value <= 0) {
        throw new Error(`Invalid weight for category "${category}": must be > 0, got ${value}`);
      }
    }
  }

  if (config.checks) {
    for (const checkId of Object.keys(config.checks)) {
      if (!knownCheckIds.includes(checkId)) {
        process.stderr.write(
          `Warning: Unknown check "${checkId}" in sickbay.config — it will be ignored.\n`,
        );
      }
    }
  }
}

export async function loadConfig(projectPath: string): Promise<SickbayConfig | null> {
  const absProjectPath = resolve(projectPath);
  const configPath = CONFIG_FILES.map((f) => join(absProjectPath, f)).find((p) => existsSync(p));

  if (!configPath) return null;

  try {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(absProjectPath);
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
