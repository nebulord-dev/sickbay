import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OutdatedRunner } from './outdated.js';

vi.mock('execa', () => ({ execa: vi.fn() }));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

vi.mock('../utils/detect-project.js', () => ({
  detectPackageManager: vi.fn(),
}));

import { execa } from 'execa';

import { detectPackageManager } from '../utils/detect-project.js';

const mockExeca = vi.mocked(execa);
const mockDetectPM = vi.mocked(detectPackageManager);

function makeOutdated(packages: Record<string, { current: string; latest: string }>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(packages).map(([name, { current, latest }]) => [
        name,
        { current, latest, type: 'dependencies' },
      ]),
    ),
  );
}

describe('OutdatedRunner', () => {
  let runner: OutdatedRunner;

  beforeEach(() => {
    runner = new OutdatedRunner();
    vi.clearAllMocks();
    mockDetectPM.mockReturnValue('npm');
  });

  it('skips for yarn', async () => {
    mockDetectPM.mockReturnValue('yarn');

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(result.score).toBe(100);
  });

  it('skips for bun', async () => {
    mockDetectPM.mockReturnValue('bun');

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
  });

  it('returns pass when no packages are outdated', async () => {
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when some packages are outdated', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeOutdated({ lodash: { current: '4.17.10', latest: '4.17.21' } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues[0].message).toContain('lodash');
    expect(result.issues[0].message).toContain('4.17.10');
    expect(result.issues[0].message).toContain('4.17.21');
  });

  it('marks major version bumps as warning severity with (major) suffix', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeOutdated({ react: { current: '17.0.2', latest: '18.0.0' } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('(major)');
  });

  it('marks minor bumps as info severity with (minor) suffix', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeOutdated({ lodash: { current: '4.0.0', latest: '4.1.0' } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('(minor)');
  });

  it('marks patch bumps as info severity with (patch) suffix', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeOutdated({ lodash: { current: '4.17.10', latest: '4.17.21' } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('(patch)');
  });

  it('returns fail when more than 15 packages are outdated', async () => {
    const packages = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [`pkg-${i}`, { current: '1.0.0', latest: '2.0.0' }]),
    );
    mockExeca.mockResolvedValue({ stdout: makeOutdated(packages) } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
  });

  it('reduces score by 3 per outdated package', async () => {
    const packages = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`pkg-${i}`, { current: '1.0.0', latest: '1.1.0' }]),
    );
    mockExeca.mockResolvedValue({ stdout: makeOutdated(packages) } as never);

    const result = await runner.run('/project');

    expect(result.score).toBe(85); // 100 - 5 * 3
  });

  it('uses detected package manager in the fix command', async () => {
    mockDetectPM.mockReturnValue('pnpm');
    mockExeca.mockResolvedValue({
      stdout: makeOutdated({ pkg: { current: '1.0.0', latest: '1.1.0' } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.command).toBe('pnpm update pkg');
    expect(result.issues[0].fix?.nextSteps).toBe('Run tests to verify nothing broke');
    expect(result.toolsUsed[0]).toBe('pnpm');
  });

  it('handles empty stdout without crashing', async () => {
    mockExeca.mockResolvedValue({ stdout: '' } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('handles invalid JSON stdout without crashing', async () => {
    mockExeca.mockResolvedValue({ stdout: 'not json output' } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('returns fail with score 0 when execa throws', async () => {
    mockExeca.mockRejectedValue(new Error('network error'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('uses maxOutdated threshold from config', async () => {
    const packages = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [`pkg-${i}`, { current: '1.0.0', latest: '2.0.0' }]),
    );
    mockExeca.mockResolvedValue({ stdout: makeOutdated(packages) } as never);

    const result = await runner.run('/project', {
      checkConfig: { thresholds: { maxOutdated: 20 } },
    });

    expect(result.status).toBe('warning');
  });
});
