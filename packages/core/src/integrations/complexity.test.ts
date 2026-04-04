import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ComplexityRunner } from './complexity.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
}));

vi.mock('../utils/exclude.js', () => ({
  createExcludeFilter: vi.fn(() => () => false),
}));

vi.mock('../utils/file-types.js', () => ({
  FILE_TYPE_THRESHOLDS: {
    'react-component': { warn: 300, critical: 500 },
    'custom-hook': { warn: 150, critical: 250 },
    'node-service': { warn: 500, critical: 800 },
    'route-file': { warn: 250, critical: 400 },
    'ts-utility': { warn: 600, critical: 1000 },
    config: { warn: Infinity, critical: Infinity },
    test: { warn: Infinity, critical: Infinity },
    general: { warn: 400, critical: 600 },
  },
  classifyFile: vi.fn((filePath: string) => {
    if (filePath.includes('use') && filePath.endsWith('.ts')) return 'custom-hook';
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) return 'react-component';
    if (filePath.includes('.service.')) return 'node-service';
    return 'general';
  }),
  getFileTypeLabel: vi.fn((fileType: string) => {
    const labels: Record<string, string> = {
      'react-component': 'React component',
      'custom-hook': 'custom hook',
      'node-service': 'service',
      'ts-utility': 'utility',
      general: 'file',
    };
    return labels[fileType] ?? 'file';
  }),
}));

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';

import { createExcludeFilter } from '../utils/exclude.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockCreateExcludeFilter = vi.mocked(createExcludeFilter);

/** Generate a string with N non-empty lines */
function makeLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `const x${i} = ${i};`).join('\n');
}

describe('ComplexityRunner', () => {
  let runner: ComplexityRunner;

  beforeEach(() => {
    runner = new ComplexityRunner();
    vi.clearAllMocks();
  });

  it('returns false for isApplicable when no source dir exists', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await runner.isApplicable('/project');

    expect(result).toBe(false);
  });

  it('returns true for isApplicable when src dir exists', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));

    const result = await runner.isApplicable('/project');

    expect(result).toBe(true);
  });

  it('returns true for isApplicable when app dir exists (Next.js App Router)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/app'));

    const result = await runner.isApplicable('/project');

    expect(result).toBe(true);
  });

  it('returns pass with score 100 when all files are small', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['index.ts'] as unknown as ReturnType<typeof readdirSync>);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as unknown as ReturnType<
      typeof statSync
    >);
    mockReadFileSync.mockReturnValue(makeLines(50) as unknown as ReturnType<typeof readFileSync>);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('complexity');
  });

  it('returns warning with info severity for file exceeding warn threshold but below critical', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['big.ts'] as unknown as ReturnType<typeof readdirSync>);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as unknown as ReturnType<
      typeof statSync
    >);
    // 450 lines — above general warn (400), below general critical (600)
    mockReadFileSync.mockReturnValue(makeLines(450) as unknown as ReturnType<typeof readFileSync>);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('450 lines');
    expect(result.score).toBe(90); // 100 - 1*10
  });

  it('returns warning severity for file exceeding critical threshold', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['massive.ts'] as unknown as ReturnType<typeof readdirSync>);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as unknown as ReturnType<
      typeof statSync
    >);
    // 600 lines — at general critical (600)
    mockReadFileSync.mockReturnValue(makeLines(600) as unknown as ReturnType<typeof readFileSync>);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('600 lines');
  });

  it('calculates score as 100 - oversizedCount * 10', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['a.ts', 'b.ts', 'c.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(450) as any);

    const result = await runner.run('/project');

    expect(result.score).toBe(70); // 100 - 3*10
    expect(result.issues).toHaveLength(3);
  });

  it('does not let score drop below 0', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    const files = Array.from({ length: 11 }, (_, i) => `file${i}.ts`);
    mockReaddirSync.mockReturnValue(files as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(450) as any);

    const result = await runner.run('/project');

    expect(result.score).toBe(0);
  });

  it('skips test files when scanning', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['app.test.ts', 'app.spec.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(600) as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it('recurses into subdirectories', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync
      .mockReturnValueOnce(['components'] as any)
      .mockReturnValueOnce(['HugeComponent.tsx'] as any);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as any)
      .mockReturnValueOnce({ isDirectory: () => false } as any);
    // 300 lines — at react-component warn threshold
    mockReadFileSync.mockReturnValue(makeLines(300) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('300 lines');
  });

  it('reports correct metadata', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['index.ts', 'utils.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync
      .mockReturnValueOnce(makeLines(100) as any)
      .mockReturnValueOnce(makeLines(450) as any);

    const result = await runner.run('/project');

    expect(result.metadata?.totalFiles).toBe(2);
    expect(result.metadata?.oversizedCount).toBe(1);
    expect(result.metadata?.totalLines).toBe(550);
    expect(result.metadata?.avgLines).toBe(275);
  });

  it('scans app/ directory when src/ does not exist (Next.js App Router)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/app'));
    mockReaddirSync.mockReturnValue(['page.tsx'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(50) as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.metadata?.totalFiles).toBe(1);
  });

  it('returns pass with no issues when src dir is empty', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue([] as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('includes fix description in oversized file issues', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['bigfile.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(450) as any);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.description).toContain('smaller');
  });

  it('returns id and category correctly', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue([] as any);

    const result = await runner.run('/project');

    expect(result.id).toBe('complexity');
    expect(result.category).toBe('code-quality');
  });

  it('counts only non-empty lines', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['sparse.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 400 real lines plus blank lines — total non-empty should be 400 (>= general warn)
    const content = Array.from({ length: 400 }, (_, i) => `const x${i} = ${i};`).join('\n\n');
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('400 lines');
  });

  // --- File-type-specific threshold tests ---

  it('flags a hook file at 180 lines (above hook warn threshold of 150)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['useAuth.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(180) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('custom hook');
    expect(result.issues[0].message).toContain('180 lines');
    expect(result.issues[0].message).toContain('threshold: 150');
  });

  it('flags a hook file at 260 lines as warning (above hook critical threshold of 250)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['useData.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(260) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
  });

  it('does NOT flag a general .ts file at 350 lines (below general warn of 400)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['helpers.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(350) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it('flags a component at 310 lines (above component warn of 300)', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['Button.tsx'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(310) as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('React component');
    expect(result.issues[0].message).toContain('threshold: 300');
  });

  it('includes file type and threshold in issue messages', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['big.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(450) as any);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toMatch(/\(file\).*450 lines.*threshold: 400/);
  });

  it('handles mixed file types with different thresholds in one scan', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    // Hook at 180 (over 150 warn), component at 250 (under 300 warn), utility at 450 (over 400 warn)
    mockReaddirSync.mockReturnValue(['useAuth.ts', 'Button.tsx', 'helpers.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync
      .mockReturnValueOnce(makeLines(180) as any) // hook — over 150, flagged
      .mockReturnValueOnce(makeLines(250) as any) // component — under 300, safe
      .mockReturnValueOnce(makeLines(450) as any); // general — over 400, flagged

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(2);
    expect(result.score).toBe(80); // 100 - 2*10
    expect(result.issues[0].message).toContain('custom hook');
    expect(result.issues[1].message).toContain('file');
  });

  it('uses custom thresholds from config', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['BigComponent.tsx'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 450 lines — above default react-component warn (300) but below custom warn (500)
    mockReadFileSync.mockReturnValue(makeLines(450) as any);

    const result = await runner.run('/project', {
      checkConfig: {
        thresholds: {
          'react-component': { warn: 500, critical: 800 },
        },
      },
    });

    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.status).toBe('pass');
  });

  it('excludes files matching exclude patterns', async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('/src'));
    mockReaddirSync.mockReturnValue(['normal.ts', 'generated.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // Both files are 500 lines — above general warn (400)
    mockReadFileSync.mockReturnValue(makeLines(500) as any);

    // Mock createExcludeFilter to return a function that excludes "generated" paths
    mockCreateExcludeFilter.mockReturnValue((p: string) => p.includes('generated'));

    const result = await runner.run('/project', {
      checkConfig: { exclude: ['src/generated/**'] },
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('normal.ts');
    expect(result.issues.every((i) => !i.message.includes('generated.ts'))).toBe(true);
  });
});
