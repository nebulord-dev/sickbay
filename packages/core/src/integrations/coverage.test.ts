import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoverageRunner } from './coverage.js';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  readPackageJson: vi.fn(),
}));

vi.mock('../utils/detect-project.js', () => ({
  detectPackageManager: vi.fn(() => 'npm'),
}));

import { execa } from 'execa';
import { existsSync, readFileSync } from 'fs';
import { readPackageJson } from '../utils/file-helpers.js';
import { detectPackageManager } from '../utils/detect-project.js';

const mockExeca = vi.mocked(execa);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReadPackageJson = vi.mocked(readPackageJson);
const mockDetectPackageManager = vi.mocked(detectPackageManager);

const goodCoverage = {
  total: {
    lines: { pct: 92 },
    statements: { pct: 91 },
    functions: { pct: 95 },
    branches: { pct: 88 },
  },
};

const lowCoverage = {
  total: {
    lines: { pct: 55 },
    statements: { pct: 57 },
    functions: { pct: 50 },
    branches: { pct: 45 },
  },
};

describe('CoverageRunner', () => {
  let runner: CoverageRunner;

  beforeEach(() => {
    runner = new CoverageRunner();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadPackageJson.mockReturnValue({});
  });

  describe('isApplicable', () => {
    it('returns true when coverage-summary.json exists', async () => {
      mockExistsSync.mockImplementation((p) => String(p).endsWith('coverage-summary.json'));

      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns true when vitest is in devDependencies', async () => {
      mockReadPackageJson.mockReturnValue({ devDependencies: { vitest: '^1.0.0' } });

      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns true when jest is in dependencies', async () => {
      mockReadPackageJson.mockReturnValue({ dependencies: { jest: '^29.0.0' } });

      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns false with no test runner or coverage file', async () => {
      mockReadPackageJson.mockReturnValue({ dependencies: {}, devDependencies: {} });

      expect(await runner.isApplicable('/project')).toBe(false);
    });
  });

  it('reads existing coverage file when no test runner detected', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('coverage-summary.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify(goodCoverage) as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBeGreaterThan(80);
  });

  it('returns skipped when no test runner and no coverage file', async () => {
    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
  });

  it('returns skipped when coverage file has unrecognised format', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('coverage-summary.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({ weird: true }) as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
  });

  it('runs vitest and returns pass with good coverage', async () => {
    mockReadPackageJson.mockReturnValue({ devDependencies: { vitest: '^1.0.0' } });
    mockExistsSync.mockImplementation((p) =>
      String(p).includes('@vitest/coverage-v8') ||
      String(p).includes('vitals-test-') ||
      String(p).endsWith('coverage-summary.json'),
    );
    mockExeca.mockResolvedValue({} as never);
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).includes('vitals-test-'))
        return JSON.stringify({ numTotalTests: 10, numPassedTests: 10, numFailedTests: 0 }) as never;
      return JSON.stringify(goodCoverage) as never;
    });

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.metadata?.totalTests).toBe(10);
  });

  it('returns fail and critical issue when tests fail', async () => {
    mockReadPackageJson.mockReturnValue({ devDependencies: { vitest: '^1.0.0' } });
    mockExistsSync.mockImplementation((p) => String(p).includes('vitals-test-'));
    mockExeca.mockResolvedValue({} as never);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ numTotalTests: 5, numPassedTests: 3, numFailedTests: 2 }) as never,
    );

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    const failIssue = result.issues.find((i) => i.message.includes('failing'));
    expect(failIssue?.severity).toBe('critical');
    expect(failIssue?.fix?.description).toBe('Fix failing tests');
    expect(failIssue?.fix?.command).toBeUndefined();
  });

  it('warns about low line coverage', async () => {
    mockReadPackageJson.mockReturnValue({ devDependencies: { vitest: '^1.0.0' } });
    mockExistsSync.mockImplementation((p) =>
      String(p).includes('@vitest/coverage-v8') ||
      String(p).includes('vitals-test-') ||
      String(p).endsWith('coverage-summary.json'),
    );
    mockExeca.mockResolvedValue({} as never);
    mockReadFileSync.mockImplementation((p) => {
      if (String(p).includes('vitals-test-'))
        return JSON.stringify({ numTotalTests: 5, numPassedTests: 5, numFailedTests: 0 }) as never;
      return JSON.stringify(lowCoverage) as never;
    });

    const result = await runner.run('/project');

    const coverageIssue = result.issues.find((i) => i.message.toLowerCase().includes('coverage'));
    expect(coverageIssue).toBeDefined();
  });

  it('adds info issue when coverage provider is missing', async () => {
    mockReadPackageJson.mockReturnValue({ devDependencies: { vitest: '^1.0.0' } });
    // No coverage-v8, no coverage-summary — only the temp output file
    mockExistsSync.mockImplementation((p) => String(p).includes('vitals-test-'));
    mockExeca.mockResolvedValue({} as never);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ numTotalTests: 3, numPassedTests: 3, numFailedTests: 0 }) as never,
    );

    const result = await runner.run('/project');

    const infoIssue = result.issues.find((i) => i.severity === 'info');
    expect(infoIssue?.message).toContain('coverage-v8');
  });

  it('returns fail when execa throws', async () => {
    mockReadPackageJson.mockReturnValue({ devDependencies: { vitest: '^1.0.0' } });
    mockExeca.mockRejectedValue(new Error('vitest exploded'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.issues[0].severity).toBe('critical');
  });
});
