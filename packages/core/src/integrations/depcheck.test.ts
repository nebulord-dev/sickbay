import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepcheckRunner } from './depcheck.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  isCommandAvailable: vi.fn(),
  coreLocalDir: '/fake/node_modules',
  parseJsonOutput: (str: string, fallback: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return JSON.parse(fallback);
    }
  },
}));

import { execa } from 'execa';
import { isCommandAvailable } from '../utils/file-helpers.js';

const mockExeca = vi.mocked(execa);
const mockIsAvailable = vi.mocked(isCommandAvailable);

describe('DepcheckRunner', () => {
  let runner: DepcheckRunner;

  beforeEach(() => {
    runner = new DepcheckRunner();
    vi.clearAllMocks();
  });

  it('returns a skipped result when depcheck is not installed', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(result.score).toBe(100);
    expect(result.id).toBe('depcheck');
  });

  it('returns pass with score 100 when no missing dependencies', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ dependencies: [], devDependencies: [], missing: {} }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('reports each missing dependency as a critical issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { lodash: ['src/utils.ts'], axios: ['src/api.ts'] },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((i) => i.severity === 'critical')).toBe(true);
  });

  it('includes fix command for missing dependency', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { lodash: ['src/utils.ts'] },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.command).toBe('npm install lodash');
  });

  it('issue message reflects file count correctly for a single file', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { react: ['src/App.tsx'] },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('1 file');
    expect(result.issues[0].message).not.toContain('files');
  });

  it('issue message reflects file count correctly for multiple files', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { react: ['src/App.tsx', 'src/index.tsx'] },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('2 files');
  });

  it('skips virtual: prefixed modules', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { 'virtual:config': ['src/vite.config.ts'], lodash: ['src/utils.ts'] },
      }),
    } as never);

    const result = await runner.run('/project');

    const virtualIssue = result.issues.find((i) => i.message.includes('virtual:'));
    expect(virtualIssue).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('lodash');
  });

  it('skips node: prefixed modules', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { 'node:fs': ['src/io.ts'], lodash: ['src/utils.ts'] },
      }),
    } as never);

    const result = await runner.run('/project');

    const nodeIssue = result.issues.find((i) => i.message.includes('node:'));
    expect(nodeIssue).toBeUndefined();
    expect(result.issues).toHaveLength(1);
  });

  it('returns fail status when missing keys are present', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: { lodash: ['src/utils.ts'] },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
  });

  it('reduces score by 5 per missing dependency issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: [],
        devDependencies: [],
        missing: {
          lodash: ['src/utils.ts'],
          axios: ['src/api.ts'],
          react: ['src/App.tsx'],
          moment: ['src/date.ts'],
        },
      }),
    } as never);

    const result = await runner.run('/project');

    // 4 issues × 5 = 20; 100 - 20 = 80
    expect(result.score).toBe(80);
  });

  it('does not let score drop below 0', async () => {
    mockIsAvailable.mockResolvedValue(true);
    const missing: Record<string, string[]> = {};
    for (let i = 0; i < 25; i++) {
      missing[`pkg-${i}`] = ['src/index.ts'];
    }
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ dependencies: [], devDependencies: [], missing }),
    } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(0);
  });

  it('does not report unused dependencies (leaves that to knip)', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: ['lodash', 'moment'],
        devDependencies: ['jest'],
        missing: {},
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('includes unused and missing counts in metadata', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        dependencies: ['lodash', 'moment'],
        devDependencies: [],
        missing: { axios: ['src/api.ts'] },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.metadata).toMatchObject({ unused: 2, missing: 1 });
  });

  it('returns a fail result when execa throws', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockRejectedValue(new Error('spawn failed'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});
