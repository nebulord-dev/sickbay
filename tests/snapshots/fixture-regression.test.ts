import { resolve, relative } from 'path';
import { fileURLToPath } from 'url';

import { runSickbay } from '@nebulord/sickbay-core';

import type { SickbayReport, CheckResult } from '@nebulord/sickbay-core';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../fixtures/packages');

// --- Helpers ---

function relativize(filePath: string): string {
  return relative(FIXTURES_DIR, filePath);
}

function normalizeCheck(check: CheckResult): Record<string, unknown> {
  return {
    id: check.id,
    category: check.category,
    name: check.name,
    score: check.score,
    status: check.status,
    issues: check.issues.map((issue) => ({
      severity: issue.severity,
      message: issue.message,
      file: issue.file ? relativize(issue.file) : undefined,
      fix: issue.fix
        ? {
            description: issue.fix.description,
            command: issue.fix.command,
          }
        : undefined,
      reportedBy: issue.reportedBy,
    })),
    toolsUsed: check.toolsUsed,
  };
}

function normalizeProjectInfo(info: Record<string, unknown>): Record<string, unknown> {
  const { dependencies, devDependencies, totalDependencies, ...stable } = info as any;
  return stable;
}

function snapshotCheck(report: SickbayReport, id: string) {
  const check = report.checks.find((c) => c.id === id);
  if (!check) {
    expect(check).toBeUndefined();
    return;
  }
  expect(normalizeCheck(check)).toMatchSnapshot();
}

function assertUnstableCheck(report: SickbayReport, id: string, expectedCategory: string) {
  const check = report.checks.find((c) => c.id === id);
  if (!check) return;
  expect(check).toMatchObject({
    id,
    category: expectedCategory,
    score: expect.any(Number),
    status: expect.stringMatching(/^(pass|warning|fail|skipped)$/),
  });
  expect(check.score).toBeGreaterThanOrEqual(0);
  expect(check.score).toBeLessThanOrEqual(100);
}

// --- Stable checks to snapshot ---

const STABLE_CHECKS = [
  'depcheck',
  'madge',
  'jscpd',
  'complexity',
  'secrets',
  'todo-scanner',
  'heavy-deps',
  'react-perf',
  'node-security',
  'node-input-validation',
  'node-async-errors',
  'license-checker',
  'git',
  'typescript',
];

// These checks produce different results across environments (local vs CI)
// due to tool version differences, OS behavior, or transient fixture state.
const ENVIRONMENT_SENSITIVE_CHECKS = [
  { id: 'eslint', category: 'code-quality' },
  { id: 'coverage', category: 'code-quality' },
  { id: 'knip', category: 'dependencies' },
];

// --- react-app fixture ---

describe('react-app', () => {
  let report: SickbayReport;

  beforeAll(async () => {
    report = await runSickbay({
      projectPath: resolve(FIXTURES_DIR, 'react-app'),
    });
  }, 120_000);

  it('projectInfo', () => {
    expect(normalizeProjectInfo(report.projectInfo)).toMatchSnapshot();
  });

  // Stable checks
  for (const id of STABLE_CHECKS) {
    it(id, () => snapshotCheck(report, id));
  }

  // Environment-sensitive checks — structural assertions only
  for (const { id, category } of ENVIRONMENT_SENSITIVE_CHECKS) {
    it(`${id} has valid structure`, () => assertUnstableCheck(report, id, category));
  }

  // Unstable checks — structural assertions only
  it('npm-audit has valid structure', () => {
    assertUnstableCheck(report, 'npm-audit', 'security');
  });

  it('outdated has valid structure', () => {
    assertUnstableCheck(report, 'outdated', 'dependencies');
  });

  it('source-map-explorer has valid structure', () => {
    assertUnstableCheck(report, 'source-map-explorer', 'performance');
  });

  it('asset-size has valid structure', () => {
    assertUnstableCheck(report, 'asset-size', 'performance');
  });

  // Overall report
  it('overall score is in expected range', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(40);
    expect(report.overallScore).toBeLessThanOrEqual(95);
  });

  it('summary shape', () => {
    expect(report.summary).toMatchObject({
      critical: expect.any(Number),
      warnings: expect.any(Number),
      info: expect.any(Number),
    });
  });
});

// --- node-api fixture ---

describe('node-api', () => {
  let report: SickbayReport;

  beforeAll(async () => {
    report = await runSickbay({
      projectPath: resolve(FIXTURES_DIR, 'node-api'),
    });
  }, 120_000);

  it('projectInfo', () => {
    expect(normalizeProjectInfo(report.projectInfo)).toMatchSnapshot();
  });

  // Stable checks
  for (const id of STABLE_CHECKS) {
    it(id, () => snapshotCheck(report, id));
  }

  // Environment-sensitive checks — structural assertions only
  for (const { id, category } of ENVIRONMENT_SENSITIVE_CHECKS) {
    it(`${id} has valid structure`, () => assertUnstableCheck(report, id, category));
  }

  // Unstable checks — structural assertions only
  it('npm-audit has valid structure', () => {
    assertUnstableCheck(report, 'npm-audit', 'security');
  });

  it('outdated has valid structure', () => {
    assertUnstableCheck(report, 'outdated', 'dependencies');
  });

  it('source-map-explorer has valid structure', () => {
    assertUnstableCheck(report, 'source-map-explorer', 'performance');
  });

  it('asset-size has valid structure', () => {
    assertUnstableCheck(report, 'asset-size', 'performance');
  });

  // Overall report — lower expected range for intentionally broken project
  it('overall score is in expected range', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(20);
    expect(report.overallScore).toBeLessThanOrEqual(75);
  });

  it('summary shape', () => {
    expect(report.summary).toMatchObject({
      critical: expect.any(Number),
      warnings: expect.any(Number),
      info: expect.any(Number),
    });
  });
});

// --- angular-app fixture ---

describe('angular-app', () => {
  let report: SickbayReport;

  beforeAll(async () => {
    report = await runSickbay({
      projectPath: resolve(FIXTURES_DIR, 'angular-app'),
    });
  }, 120_000);

  it('projectInfo', () => {
    expect(normalizeProjectInfo(report.projectInfo)).toMatchSnapshot();
  });

  // Angular-specific checks — structural assertions (scores vary with ecosystem)
  const ANGULAR_CHECKS = [
    { id: 'angular-change-detection', category: 'performance' },
    { id: 'angular-lazy-routes', category: 'performance' },
    { id: 'angular-strict', category: 'code-quality' },
    { id: 'angular-subscriptions', category: 'code-quality' },
  ];

  for (const { id, category } of ANGULAR_CHECKS) {
    it(`${id} runs and is not skipped`, () => {
      const check = report.checks.find((c) => c.id === id);
      expect(check).toBeDefined();
      expect(check?.status).not.toBe('skipped');
      expect(check?.category).toBe(category);
      expect(check?.score).toBeGreaterThanOrEqual(0);
      expect(check?.score).toBeLessThanOrEqual(100);
    });
  }

  // Angular checks should produce warnings on our intentionally broken fixture
  it('angular-change-detection reports missing OnPush', () => {
    const check = report.checks.find((c) => c.id === 'angular-change-detection');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('angular-lazy-routes reports static routes', () => {
    const check = report.checks.find((c) => c.id === 'angular-lazy-routes');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('angular-strict reports missing strict settings', () => {
    const check = report.checks.find((c) => c.id === 'angular-strict');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  it('angular-subscriptions reports unguarded subscriptions', () => {
    const check = report.checks.find((c) => c.id === 'angular-subscriptions');
    expect(check?.status).toBe('warning');
    expect(check?.issues.length).toBeGreaterThan(0);
  });

  // React/Node-specific checks should not run on Angular
  it('react-perf is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'react-perf');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-security is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-security');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-async-errors is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-async-errors');
    if (check) expect(check.status).toBe('skipped');
  });

  it('node-input-validation is absent or skipped', () => {
    const check = report.checks.find((c) => c.id === 'node-input-validation');
    if (check) expect(check.status).toBe('skipped');
  });

  // Environment-sensitive checks
  for (const { id, category } of ENVIRONMENT_SENSITIVE_CHECKS) {
    it(`${id} has valid structure`, () => assertUnstableCheck(report, id, category));
  }

  // Overall report
  it('overall score is in expected range', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(20);
    expect(report.overallScore).toBeLessThanOrEqual(95);
  });

  it('summary shape', () => {
    expect(report.summary).toMatchObject({
      critical: expect.any(Number),
      warnings: expect.any(Number),
      info: expect.any(Number),
    });
  });

  it('checks array exists', () => {
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
  });
});
