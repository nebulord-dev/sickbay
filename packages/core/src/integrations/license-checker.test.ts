import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicenseCheckerRunner } from './license-checker.js';

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

describe('LicenseCheckerRunner', () => {
  let runner: LicenseCheckerRunner;

  beforeEach(() => {
    runner = new LicenseCheckerRunner();
    vi.clearAllMocks();
  });

  it('returns a skipped result when license-checker is not installed', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(result.score).toBe(100);
    expect(result.id).toBe('license-checker');
  });

  it('returns pass with score 100 when all licenses are clean', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'react@18.0.0': { licenses: 'MIT', repository: 'https://github.com/facebook/react' },
        'lodash@4.17.21': { licenses: 'MIT', repository: 'https://github.com/lodash/lodash' },
        'axios@1.0.0': { licenses: 'Apache-2.0', repository: 'https://github.com/axios/axios' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('flags GPL-3.0 as a warning issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'some-gpl-pkg@1.0.0': { licenses: 'GPL-3.0', repository: 'https://github.com/example/pkg' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('GPL-3.0');
    expect(result.issues[0].message).toContain('some-gpl-pkg@1.0.0');
  });

  it('flags GPL-2.0 as a warning issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'old-gpl-pkg@2.0.0': { licenses: 'GPL-2.0' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('GPL-2.0');
  });

  it('flags AGPL-3.0 as a warning issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'agpl-pkg@1.0.0': { licenses: 'AGPL-3.0' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('AGPL-3.0');
  });

  it('flags LGPL-2.1 as a warning issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'lgpl-pkg@1.0.0': { licenses: 'LGPL-2.1' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('LGPL-2.1');
  });

  it('flags LGPL-3.0 as a warning issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'lgpl3-pkg@1.0.0': { licenses: 'LGPL-3.0' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('LGPL-3.0');
  });

  it('flags CC-BY-NC as a warning issue', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'cc-pkg@1.0.0': { licenses: 'CC-BY-NC' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('CC-BY-NC');
  });

  it('returns warning status (not fail) for problematic licenses', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'gpl-pkg@1.0.0': { licenses: 'GPL-3.0' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
  });

  it('reduces score by 10 per flagged license, with a floor of 60', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'pkg-a@1.0.0': { licenses: 'GPL-3.0' },
        'pkg-b@1.0.0': { licenses: 'AGPL-3.0' },
        'pkg-c@1.0.0': { licenses: 'GPL-2.0' },
      }),
    } as never);

    const result = await runner.run('/project');

    // 3 issues × 10 = 30; 100 - 30 = 70
    expect(result.score).toBe(70);
  });

  it('does not let score drop below 60 for many flagged licenses', async () => {
    mockIsAvailable.mockResolvedValue(true);
    const pkgs: Record<string, { licenses: string }> = {};
    for (let i = 0; i < 10; i++) {
      pkgs[`gpl-pkg-${i}@1.0.0`] = { licenses: 'GPL-3.0' };
    }
    mockExeca.mockResolvedValue({ stdout: JSON.stringify(pkgs) } as never);

    const result = await runner.run('/project');

    // 10 issues × 10 = 100; 100 - 100 = 0, but floor is 60
    expect(result.score).toBe(60);
  });

  it('issue includes fix description referencing the package name', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'bad-pkg@2.0.0': { licenses: 'GPL-3.0' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.description).toContain('bad-pkg');
  });

  it('includes totalPackages and flagged count in metadata', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'react@18.0.0': { licenses: 'MIT' },
        'gpl-pkg@1.0.0': { licenses: 'GPL-3.0' },
        'lodash@4.17.21': { licenses: 'MIT' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.metadata).toMatchObject({ totalPackages: 3, flagged: 1 });
  });

  it('handles empty license output gracefully', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('does not flag MIT, ISC, Apache-2.0, or BSD licenses', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        'pkg-mit@1.0.0': { licenses: 'MIT' },
        'pkg-isc@1.0.0': { licenses: 'ISC' },
        'pkg-apache@1.0.0': { licenses: 'Apache-2.0' },
        'pkg-bsd@1.0.0': { licenses: 'BSD-3-Clause' },
      }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(0);
    expect(result.status).toBe('pass');
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
