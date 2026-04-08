import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MadgeRunner } from './madge.js';

// Force POSIX path semantics so mocks comparing forward-slash literals
// match the path.join output on Windows.
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  isCommandAvailable: vi.fn(),
  fileExists: vi.fn(),
  coreLocalDir: '/fake/node_modules',
  parseJsonOutput: (str: string, fallback: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return JSON.parse(fallback);
    }
  },
}));

import { existsSync } from 'fs';

import { execa } from 'execa';

import { isCommandAvailable, fileExists } from '../utils/file-helpers.js';

const mockExeca = vi.mocked(execa);
const mockIsAvailable = vi.mocked(isCommandAvailable);
const mockFileExists = vi.mocked(fileExists);
const mockExistsSync = vi.mocked(existsSync);

describe('MadgeRunner', () => {
  let runner: MadgeRunner;

  beforeEach(() => {
    runner = new MadgeRunner();
    vi.clearAllMocks();
    // Default: src/ exists, app/ and lib/ do not
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
  });

  it('returns a skipped result when madge is not installed', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(result.score).toBe(100);
    expect(result.id).toBe('madge');
  });

  it('returns pass with score 100 when no circular dependencies are found', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/c.ts'],
        'src/c.ts': [],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('uses tsconfig.app.json when it exists', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockImplementation((_path, file) => file === 'tsconfig.app.json');
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    await runner.run('/project');

    const call = mockExeca.mock.calls[0];
    const args = call[1] as string[];
    expect(args).toContain('tsconfig.app.json');
  });

  it('falls back to tsconfig.json when tsconfig.app.json does not exist', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockImplementation((_path, file) => file === 'tsconfig.json');
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    await runner.run('/project');

    const call = mockExeca.mock.calls[0];
    const args = call[1] as string[];
    expect(args).toContain('tsconfig.json');
    expect(args).not.toContain('tsconfig.app.json');
  });

  it('passes no tsconfig flag when neither tsconfig file exists', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    await runner.run('/project');

    const call = mockExeca.mock.calls[0];
    const args = call[1] as string[];
    expect(args).not.toContain('--ts-config');
  });

  it('returns warning status with 1-5 circular dependencies', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    // 3 simple A→B→A cycles by forming 3 separate pairs
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/a.ts'],
        'src/c.ts': ['src/d.ts'],
        'src/d.ts': ['src/c.ts'],
        'src/e.ts': ['src/f.ts'],
        'src/f.ts': ['src/e.ts'],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues.length).toBeLessThanOrEqual(5);
    expect(result.score).toBeLessThan(100);
  });

  it('returns fail status when more than 5 circular dependencies are found', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    // Build 6 simple cycles: a↔b, c↔d, e↔f, g↔h, i↔j, k↔l
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/a.ts'],
        'src/c.ts': ['src/d.ts'],
        'src/d.ts': ['src/c.ts'],
        'src/e.ts': ['src/f.ts'],
        'src/f.ts': ['src/e.ts'],
        'src/g.ts': ['src/h.ts'],
        'src/h.ts': ['src/g.ts'],
        'src/i.ts': ['src/j.ts'],
        'src/j.ts': ['src/i.ts'],
        'src/k.ts': ['src/l.ts'],
        'src/l.ts': ['src/k.ts'],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
  });

  it('computes score as 100 - count * 10', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    // 2 cycles: a↔b, c↔d → score = 100 - 2*10 = 80
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/a.ts'],
        'src/c.ts': ['src/d.ts'],
        'src/d.ts': ['src/c.ts'],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(80);
  });

  it('does not let score drop below 0', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    // 15 cycles would give 100 - 150 = -50, clamped to 0
    const graph: Record<string, string[]> = {};
    for (let i = 0; i < 15; i++) {
      graph[`src/x${i}.ts`] = [`src/y${i}.ts`];
      graph[`src/y${i}.ts`] = [`src/x${i}.ts`];
    }
    mockExeca.mockResolvedValue({ stdout: JSON.stringify(graph) } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(0);
  });

  it('reports each circular dependency as a warning issue with a descriptive message', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/a.ts'],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('Circular dependency');
    expect(result.issues[0].message).toContain('src/a.ts');
  });

  it('deduplicates cycles discovered from different starting nodes', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    // a → b → a forms one cycle that can be discovered starting from either a or b
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/a.ts'],
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
  });

  it('handles empty graph (no files) without errors', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns a fail result when execa throws', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    mockExeca.mockRejectedValue(new Error('spawn failed'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('scans app/ when src/ does not exist (Next.js App Router)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/app'));
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ 'app/page.tsx': [], 'app/layout.tsx': ['app/page.tsx'] }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.metadata?.graph).toHaveProperty('app/page.tsx');
    const call = mockExeca.mock.calls[0];
    expect(call[1]).toContain('app');
  });

  it('includes graph and circularCount in metadata', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    const graph = { 'src/a.ts': ['src/b.ts'], 'src/b.ts': ['src/a.ts'] };
    mockExeca.mockResolvedValue({ stdout: JSON.stringify(graph) } as never);

    const result = await runner.run('/project');

    expect(result.metadata).toMatchObject({ circularCount: 1 });
  });

  it('uses maxCircular threshold from config', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockFileExists.mockReturnValue(false);
    // Build 6 cycles: a↔b, c↔d, e↔f, g↔h, i↔j, k↔l
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': ['src/a.ts'],
        'src/c.ts': ['src/d.ts'],
        'src/d.ts': ['src/c.ts'],
        'src/e.ts': ['src/f.ts'],
        'src/f.ts': ['src/e.ts'],
        'src/g.ts': ['src/h.ts'],
        'src/h.ts': ['src/g.ts'],
        'src/i.ts': ['src/j.ts'],
        'src/j.ts': ['src/i.ts'],
        'src/k.ts': ['src/l.ts'],
        'src/l.ts': ['src/k.ts'],
      }),
    } as never);

    const result = await runner.run('/project', {
      checkConfig: { thresholds: { maxCircular: 10 } },
    });

    expect(result.status).toBe('warning');
  });
});
