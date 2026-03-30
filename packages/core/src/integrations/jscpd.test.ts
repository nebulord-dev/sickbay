import { describe, it, expect, vi, beforeEach } from 'vitest';

import { JscpdRunner } from './jscpd.js';

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

describe('JscpdRunner', () => {
  let runner: JscpdRunner;

  beforeEach(() => {
    runner = new JscpdRunner();
    vi.clearAllMocks();
  });

  it('returns a skipped result when jscpd is not installed', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(result.score).toBe(100);
    expect(result.id).toBe('jscpd');
  });

  it('returns pass with score 100 when percentage is 0', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 0, clones: 0 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns pass with no issues when percentage is between 1 and 5 (inclusive)', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 5, clones: 3 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning issue when percentage is just above 5', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 6, clones: 4 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('6.0%');
    expect(result.issues[0].message).toContain('4 clones');
  });

  it('returns critical issue when percentage is above 20', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 25, clones: 12 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].message).toContain('25.0%');
  });

  it('computes score as 100 - round(percentage * 3)', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 10, clones: 5 } } }),
    } as never);

    const result = await runner.run('/project');

    // score = 100 - round(10 * 3) = 100 - 30 = 70
    expect(result.score).toBe(70);
  });

  it('does not let score drop below 0', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 50, clones: 30 } } }),
    } as never);

    const result = await runner.run('/project');

    // score = max(0, 100 - round(50 * 3)) = max(0, -50) = 0
    expect(result.score).toBe(0);
  });

  it('uses singular "clone" when clones count is 1', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 10, clones: 1 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('1 clone)');
  });

  it('handles missing statistics gracefully (defaults to 0%)', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: JSON.stringify({}) } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('handles empty stdout gracefully', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({ stdout: '' } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
  });

  it('includes percentage and clones in metadata', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 8, clones: 6 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.metadata).toMatchObject({ percentage: 8, clones: 6 });
  });

  it('returns a fail result when execa throws', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockRejectedValue(new Error('spawn failed'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('issue message includes fix description about extracting duplicates', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ statistics: { total: { percentage: 15, clones: 7 } } }),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.description).toContain('duplicated');
  });
});
