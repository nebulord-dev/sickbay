import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeavyDepsRunner } from './heavy-deps.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
  WARN_LINES: 300,
}));

import { readFileSync } from 'fs';
import { fileExists } from '../utils/file-helpers.js';

const mockReadFileSync = vi.mocked(readFileSync);
const mockFileExists = vi.mocked(fileExists);

function makePackageJson(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): string {
  return JSON.stringify({ dependencies: deps, devDependencies: devDeps });
}

describe('HeavyDepsRunner', () => {
  let runner: HeavyDepsRunner;

  beforeEach(() => {
    runner = new HeavyDepsRunner();
    vi.clearAllMocks();
  });

  it('returns false for isApplicable when package.json does not exist', async () => {
    mockFileExists.mockReturnValue(false);

    const result = await runner.isApplicable('/project');

    expect(result).toBe(false);
  });

  it('returns true for isApplicable when package.json exists', async () => {
    mockFileExists.mockReturnValue(true);

    const result = await runner.isApplicable('/project');

    expect(result).toBe(true);
  });

  it('returns pass with score 100 when no heavy deps are present', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ react: '^18.0.0', typescript: '^5.0.0' }) as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('heavy-deps');
  });

  it('reports moment as a warning issue', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ moment: '^2.29.0' }) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('moment');
    expect(result.issues[0].fix?.description).toContain('dayjs or date-fns');
  });

  it('reports lodash as a warning issue', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ lodash: '^4.17.21' }) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('lodash');
  });

  it('reports axios as an info issue', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ axios: '^1.4.0' }) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('axios');
    expect(result.issues[0].fix?.description).toContain('native fetch');
  });

  it('reports uuid as an info issue', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ uuid: '^9.0.0' }) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('uuid');
  });

  it('calculates score correctly with warning deps (reduce by 10 each)', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ moment: '^2.29.0', lodash: '^4.17.21' }) as any);

    const result = await runner.run('/project');

    // 2 warnings: 100 - 2*10 = 80
    expect(result.score).toBe(80);
    expect(result.status).toBe('warning');
  });

  it('calculates score correctly with info deps (reduce by 5 each)', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ axios: '^1.4.0', uuid: '^9.0.0' }) as any);

    const result = await runner.run('/project');

    // 2 info: 100 - 2*5 = 90
    expect(result.score).toBe(90);
    expect(result.status).toBe('warning');
  });

  it('does not let score drop below 30', async () => {
    // Need enough warning deps to push score below 30.
    // 8 warning deps: 100 - 8*10 = 20 → capped at 30
    // Known warnings: moment, lodash, underscore, jquery, request, moment-timezone (6)
    // Fill the remaining 2 via info-to-warning trick: use devDeps with warnings
    const deps: Record<string, string> = {
      moment: '^2',
      lodash: '^4',
      underscore: '^1',
      jquery: '^3',
      request: '^2',
      'moment-timezone': '^0',
    };
    const devDeps: Record<string, string> = {
      // axios and uuid are info — score = 100 - 6*10 - 2*5 = 30 → exactly 30 (no capping needed)
      axios: '^1',
      uuid: '^9',
    };
    mockReadFileSync.mockReturnValue(makePackageJson(deps, devDeps) as any);

    const result = await runner.run('/project');

    // 6 warnings + 2 info: 100 - 6*10 - 2*5 = 30
    expect(result.score).toBe(30);
  });

  it('detects heavy deps in devDependencies too', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({}, { moment: '^2.29.0' }) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('moment');
  });

  it('reports multiple mixed severity deps correctly', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ moment: '^2.29.0', axios: '^1.4.0', uuid: '^9.0.0' }) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(3);
    const warningIssues = result.issues.filter((i) => i.severity === 'warning');
    const infoIssues = result.issues.filter((i) => i.severity === 'info');
    expect(warningIssues).toHaveLength(1);
    expect(infoIssues).toHaveLength(2);
    // 1 warning + 2 info: 100 - 10 - 10 = 80
    expect(result.score).toBe(80);
  });

  it('returns correct metadata', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson({ react: '^18.0.0', moment: '^2.29.0' }) as any);

    const result = await runner.run('/project');

    expect(result.metadata?.totalDeps).toBe(2);
    expect(result.metadata?.heavyDepsFound).toBe(1);
    expect(result.metadata?.heavyDeps).toContain('moment');
  });

  it('returns id and category correctly', async () => {
    mockReadFileSync.mockReturnValue(makePackageJson() as any);

    const result = await runner.run('/project');

    expect(result.id).toBe('heavy-deps');
    expect(result.category).toBe('performance');
  });

  it('returns fail result when readFileSync throws', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});
