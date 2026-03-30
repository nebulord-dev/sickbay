import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NpmAuditRunner } from './npm-audit.js';

vi.mock('execa', () => ({ execa: vi.fn() }));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  parseJsonOutput: (str: string, fallback: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return JSON.parse(fallback);
    }
  },
}));

import { execa } from 'execa';
const mockExeca = vi.mocked(execa);

const makeAuditOutput = (
  vulnerabilities: Record<string, unknown> = {},
  meta: { info?: number; low?: number; moderate?: number; high?: number; critical?: number } = {},
) =>
  JSON.stringify({
    vulnerabilities,
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...meta },
    },
  });

describe('NpmAuditRunner', () => {
  let runner: NpmAuditRunner;

  beforeEach(() => {
    runner = new NpmAuditRunner();
    vi.clearAllMocks();
  });

  it('returns pass with score 100 when no vulnerabilities', async () => {
    mockExeca.mockResolvedValue({ stdout: makeAuditOutput() } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns fail when critical vulnerabilities are found', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          lodash: {
            name: 'lodash',
            severity: 'critical',
            via: [{ title: 'Prototype Pollution', url: 'https://example.com' }],
            fixAvailable: { name: 'lodash', version: '4.17.21' },
          },
        },
        { critical: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBeLessThan(60);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('returns warning for only moderate vulnerabilities', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          axios: {
            name: 'axios',
            severity: 'moderate',
            via: [{ title: 'SSRF' }],
            fixAvailable: false,
          },
        },
        { moderate: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues[0].severity).toBe('warning');
  });

  it('sets npm audit fix command when fix is available as object', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          pkg: {
            name: 'pkg',
            severity: 'high',
            via: [{ title: 'RCE' }],
            fixAvailable: { name: 'pkg', version: '2.0.0' },
          },
        },
        { high: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.command).toBeUndefined();
    expect(result.issues[0].fix?.description).toContain('pkg@2.0.0');
  });

  it('sets force fix command when no fix is available', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        { pkg: { name: 'pkg', severity: 'high', via: [{ title: 'Vuln' }], fixAvailable: false } },
        { high: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.command).toBeUndefined();
    expect(result.issues[0].fix?.description).toBe('No automatic fix available');
  });

  it('falls back to "Vulnerability in {name}" when via entry is a string', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        { pkg: { name: 'pkg', severity: 'moderate', via: ['nested-dep'], fixAvailable: false } },
        { moderate: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('pkg');
  });

  it('includes url from via object as file field', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          pkg: {
            name: 'pkg',
            severity: 'moderate',
            via: [{ title: 'Vuln', url: 'https://nvd.example.com' }],
            fixAvailable: false,
          },
        },
        { moderate: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].file).toBe('https://nvd.example.com');
  });

  it('calculates score correctly for multiple critical vulns', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          a: { name: 'a', severity: 'critical', via: [{ title: 'A' }], fixAvailable: false },
          b: { name: 'b', severity: 'critical', via: [{ title: 'B' }], fixAvailable: false },
        },
        { critical: 2 },
      ),
    } as never);

    const result = await runner.run('/project');

    // score = max(0, 60 - 2 * 15) = 30
    expect(result.score).toBe(30);
  });

  it('calculates score for moderate vulnerabilities only', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        { a: { name: 'a', severity: 'moderate', via: [{ title: 'A' }], fixAvailable: false } },
        { moderate: 3 },
      ),
    } as never);

    const result = await runner.run('/project');

    // score = max(0, 100 - 3 * 10) = 70
    expect(result.score).toBe(70);
  });

  it('returns fail with score 0 when execa throws', async () => {
    mockExeca.mockRejectedValue(new Error('network error'));

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('populates metadata.vulnerablePackages with advisory counts per package', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          lodash: {
            name: 'lodash',
            severity: 'high',
            via: [
              { title: 'Prototype Pollution', url: 'https://example.com/1' },
              { title: 'Command Injection', url: 'https://example.com/2' },
            ],
            fixAvailable: false,
          },
          express: {
            name: 'express',
            severity: 'moderate',
            via: [{ title: 'Open Redirect', url: 'https://example.com/3' }],
            fixAvailable: false,
          },
        },
        { high: 1, moderate: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.metadata).toBeDefined();
    expect((result.metadata as Record<string, unknown>).vulnerablePackages).toEqual({
      lodash: 2,
      express: 1,
    });
  });

  it('counts only advisory objects in via, not transitive string references', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeAuditOutput(
        {
          'nested-dep': {
            name: 'nested-dep',
            severity: 'moderate',
            // all strings — transitive references only, no real advisories
            via: ['some-parent-pkg'],
            fixAvailable: false,
          },
          'real-vuln': {
            name: 'real-vuln',
            severity: 'high',
            // mix: one advisory object + one transitive string
            via: [{ title: 'RCE' }, 'another-dep'],
            fixAvailable: false,
          },
        },
        { moderate: 1, high: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    const vp = (result.metadata as Record<string, unknown>).vulnerablePackages as Record<
      string,
      number
    >;
    // string-only via: falls back to Math.max(0, 1) = 1
    expect(vp['nested-dep']).toBe(1);
    // one advisory object in mixed via
    expect(vp['real-vuln']).toBe(1);
  });
});
