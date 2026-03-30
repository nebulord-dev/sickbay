import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

import {
  loadHistory,
  saveEntry,
  detectRegressions,
  saveLastReport,
  saveDepTree,
} from './history.js';

import type { TrendEntry } from './history.js';
import type { SickbayReport } from '@nebulord/sickbay-core';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

function makeReport(overrides: Partial<SickbayReport> = {}): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project',
      version: '1.0.0',
      framework: 'react',
      packageManager: 'npm',
      totalDependencies: 10,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    },
    checks: [
      {
        id: 'knip',
        category: 'dependencies',
        name: 'Unused Code',
        score: 90,
        status: 'pass',
        issues: [],
        toolsUsed: ['knip'],
        duration: 0,
      },
      {
        id: 'eslint',
        category: 'code-quality',
        name: 'Lint',
        score: 80,
        status: 'pass',
        issues: [],
        toolsUsed: ['eslint'],
        duration: 0,
      },
    ],
    overallScore: 85,
    summary: { critical: 0, warnings: 2, info: 3 },
    ...overrides,
  };
}

function makeEntry(overallScore: number, categoryScores: Record<string, number> = {}): TrendEntry {
  return {
    timestamp: new Date().toISOString(),
    overallScore,
    categoryScores,
    summary: { critical: 0, warnings: 0, info: 0 },
    checksRun: 5,
  };
}

describe('loadHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when history file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    expect(loadHistory('/project')).toBeNull();
  });

  it('returns parsed history when file exists', () => {
    const history = { projectPath: '/project', projectName: 'test', entries: [] };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(history) as never);

    expect(loadHistory('/project')).toEqual(history);
  });

  it('returns null on malformed JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not-valid-json' as never);

    expect(loadHistory('/project')).toBeNull();
  });
});

describe('saveEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the history directory', () => {
    mockExistsSync.mockReturnValue(false);

    saveEntry(makeReport());

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.sickbay'), {
      recursive: true,
    });
  });

  it('writes a new history file with one entry when none existed', () => {
    mockExistsSync.mockReturnValue(false);

    saveEntry(makeReport());

    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.entries).toHaveLength(1);
    expect(written.entries[0].overallScore).toBe(85);
    expect(written.projectName).toBe('test-project');
  });

  it('appends to existing history', () => {
    const existing = {
      projectPath: '/test/project',
      projectName: 'test-project',
      entries: [makeEntry(70)],
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing) as never);

    saveEntry(makeReport());

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.entries).toHaveLength(2);
    expect(written.entries[1].overallScore).toBe(85);
  });

  it('trims history to the last 100 entries', () => {
    const entries = Array.from({ length: 101 }, (_, i) => makeEntry(80 + (i % 5)));
    const existing = { projectPath: '/test/project', projectName: 'test', entries };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing) as never);

    saveEntry(makeReport());

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.entries).toHaveLength(100);
  });

  it('computes category scores as averages per category', () => {
    mockExistsSync.mockReturnValue(false);

    saveEntry(makeReport());

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    const entry = written.entries[0];
    expect(entry.categoryScores.dependencies).toBe(90);
    expect(entry.categoryScores['code-quality']).toBe(80);
  });

  it('excludes skipped checks from category score calculation', () => {
    const report = makeReport({
      checks: [
        {
          id: 'knip',
          category: 'dependencies',
          name: 'Unused Code',
          score: 90,
          status: 'pass',
          issues: [],
          toolsUsed: ['knip'],
          duration: 0,
        },
        {
          id: 'skipped',
          category: 'dependencies',
          name: 'Skipped',
          score: 100,
          status: 'skipped',
          issues: [],
          toolsUsed: [],
          duration: 0,
        },
      ],
    });
    mockExistsSync.mockReturnValue(false);

    saveEntry(report);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    // Only knip (90) counted; skipped (100) excluded
    expect(written.entries[0].categoryScores.dependencies).toBe(90);
  });

  it('records the number of non-skipped checks run', () => {
    mockExistsSync.mockReturnValue(false);

    saveEntry(makeReport());

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.entries[0].checksRun).toBe(2);
  });

  it('stores the report timestamp in the entry', () => {
    mockExistsSync.mockReturnValue(false);

    saveEntry(makeReport({ timestamp: '2024-06-15T12:00:00.000Z' }));

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.entries[0].timestamp).toBe('2024-06-15T12:00:00.000Z');
  });
});

describe('detectRegressions', () => {
  it('returns empty array with fewer than 2 entries', () => {
    expect(detectRegressions([])).toEqual([]);
    expect(detectRegressions([makeEntry(80)])).toEqual([]);
  });

  it('detects overall score regression when drop exceeds 5', () => {
    const regressions = detectRegressions([makeEntry(85), makeEntry(78)]);

    expect(regressions).toHaveLength(1);
    expect(regressions[0].category).toBe('overall');
    expect(regressions[0].drop).toBe(7);
    expect(regressions[0].from).toBe(85);
    expect(regressions[0].to).toBe(78);
  });

  it('does not flag regression when drop is exactly 5', () => {
    expect(detectRegressions([makeEntry(85), makeEntry(80)])).toHaveLength(0);
  });

  it('does not flag improvement', () => {
    expect(detectRegressions([makeEntry(70), makeEntry(90)])).toHaveLength(0);
  });

  it('detects category-level regression', () => {
    const regressions = detectRegressions([
      makeEntry(85, { security: 90 }),
      makeEntry(85, { security: 70 }),
    ]);

    const sec = regressions.find((r) => r.category === 'security');
    expect(sec).toBeDefined();
    expect(sec?.drop).toBe(20);
  });

  it('ignores new categories with no prior score', () => {
    const regressions = detectRegressions([
      makeEntry(85, {}),
      makeEntry(85, { 'code-quality': 70 }),
    ]);

    expect(regressions).toHaveLength(0);
  });

  it('uses only the last two entries regardless of total length', () => {
    // 50 → 90 → 70: regression is 90 → 70 = drop of 20
    const regressions = detectRegressions([makeEntry(50), makeEntry(90), makeEntry(70)]);

    expect(regressions[0]?.drop).toBe(20);
  });

  it('can detect both overall and category regressions simultaneously', () => {
    const regressions = detectRegressions([
      makeEntry(90, { security: 95, 'code-quality': 88 }),
      makeEntry(75, { security: 60, 'code-quality': 88 }),
    ]);

    const categories = regressions.map((r) => r.category);
    expect(categories).toContain('overall');
    expect(categories).toContain('security');
    expect(categories).not.toContain('code-quality'); // only dropped by 0
  });
});

describe('saveLastReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the .sickbay directory', () => {
    saveLastReport(makeReport());

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.sickbay'), {
      recursive: true,
    });
  });

  it('writes report JSON to last-report.json', () => {
    const report = makeReport({ overallScore: 72 });

    saveLastReport(report);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('last-report.json'),
      expect.stringContaining('"overallScore": 72'),
    );
  });

  it('overwrites on second call (always latest)', () => {
    saveLastReport(makeReport({ overallScore: 70 }));
    saveLastReport(makeReport({ overallScore: 85 }));

    const paths = mockWriteFileSync.mock.calls.map((c) => c[0] as string);
    expect(paths.every((p) => p.endsWith('last-report.json'))).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
  });

  it('writes to projectPath/.sickbay/last-report.json', () => {
    const report = makeReport({ projectPath: '/my/project' });

    saveLastReport(report);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/my/project/.sickbay/last-report.json',
      expect.any(String),
    );
  });
});

describe('saveDepTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the .sickbay directory', () => {
    saveDepTree('/my/project', { name: 'test', dependencies: {} });

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.sickbay'), {
      recursive: true,
    });
  });

  it('writes dep tree JSON to dep-tree.json', () => {
    saveDepTree('/my/project', { name: 'test', dependencies: {} });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/my/project/.sickbay/dep-tree.json',
      expect.any(String),
    );
  });

  it('serializes the tree as formatted JSON', () => {
    const tree = { name: 'test', dependencies: { react: '18.0.0' } };
    saveDepTree('/my/project', tree);

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.name).toBe('test');
    expect(written.dependencies.react).toBe('18.0.0');
  });
});
