import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NpmAuditRunner } from './npm-audit.js';

// Force POSIX path semantics so mocks comparing forward-slash literals
// (e.g. `endsWith('/src')`) match the path.join output on Windows.
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});

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
  // path is mocked to posix above, so relative() returns forward-slash paths —
  // relativeFromRoot's normalize step is a no-op in this context.
  relativeFromRoot: (root: string, full: string) => {
    const { relative } = require('path');
    return relative(root, full);
  },
}));

vi.mock('../utils/detect-project.js', () => ({
  detectPackageManager: vi.fn().mockReturnValue('npm'),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

import { existsSync } from 'fs';

import { execa } from 'execa';

import { detectPackageManager } from '../utils/detect-project.js';

const mockExeca = vi.mocked(execa);
const mockExistsSync = vi.mocked(existsSync);
const mockDetectPM = vi.mocked(detectPackageManager);

const makeNpmAuditOutput = (
  vulnerabilities: Record<string, unknown> = {},
  meta: { info?: number; low?: number; moderate?: number; high?: number; critical?: number } = {},
) =>
  JSON.stringify({
    vulnerabilities,
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...meta },
    },
  });

const makePnpmAuditOutput = (
  advisories: Record<string, unknown> = {},
  meta: { info?: number; low?: number; moderate?: number; high?: number; critical?: number } = {},
) =>
  JSON.stringify({
    advisories,
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, ...meta },
    },
  });

describe('NpmAuditRunner', () => {
  let runner: NpmAuditRunner;

  beforeEach(() => {
    runner = new NpmAuditRunner();
    vi.clearAllMocks();
    mockDetectPM.mockReturnValue('npm');
  });

  // --- npm tests ---

  it('returns pass with score 100 when no vulnerabilities', async () => {
    mockExeca.mockResolvedValue({ stdout: makeNpmAuditOutput() } as never);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('runs npm audit when package manager is npm', async () => {
    mockExeca.mockResolvedValue({ stdout: makeNpmAuditOutput() } as never);

    await runner.run('/project');

    expect(mockExeca).toHaveBeenCalledWith('npm', ['audit', '--json'], expect.any(Object));
  });

  it('returns fail when critical vulnerabilities are found', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeNpmAuditOutput(
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
      stdout: makeNpmAuditOutput(
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

  it('sets upgrade description when fix is available as object', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeNpmAuditOutput(
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

  it('sets no-fix description when no fix is available', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeNpmAuditOutput(
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
      stdout: makeNpmAuditOutput(
        { pkg: { name: 'pkg', severity: 'moderate', via: ['nested-dep'], fixAvailable: false } },
        { moderate: 1 },
      ),
    } as never);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain('pkg');
  });

  it('includes url from via object as file field', async () => {
    mockExeca.mockResolvedValue({
      stdout: makeNpmAuditOutput(
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
      stdout: makeNpmAuditOutput(
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
      stdout: makeNpmAuditOutput(
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
      stdout: makeNpmAuditOutput(
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
      stdout: makeNpmAuditOutput(
        {
          'nested-dep': {
            name: 'nested-dep',
            severity: 'moderate',
            via: ['some-parent-pkg'],
            fixAvailable: false,
          },
          'real-vuln': {
            name: 'real-vuln',
            severity: 'high',
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
    expect(vp['nested-dep']).toBe(1);
    expect(vp['real-vuln']).toBe(1);
  });

  // --- pnpm tests ---

  describe('pnpm audit', () => {
    beforeEach(() => {
      mockDetectPM.mockReturnValue('pnpm');
    });

    it('runs pnpm audit when package manager is pnpm', async () => {
      mockExeca.mockResolvedValue({ stdout: makePnpmAuditOutput() } as never);

      await runner.run('/project');

      expect(mockExeca).toHaveBeenCalledWith('pnpm', ['audit', '--json'], expect.any(Object));
    });

    it('returns pass with score 100 when no advisories', async () => {
      mockExeca.mockResolvedValue({ stdout: makePnpmAuditOutput() } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('parses pnpm advisory format and returns issues', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1088114': {
              id: 1088114,
              module_name: 'faker',
              severity: 'high',
              title: 'Removal of functional code in faker.js',
              url: 'https://github.com/advisories/GHSA-5w9c-rv96-fr7g',
              recommendation: 'Use @faker-js/faker instead',
              findings: [{ version: '6.6.6', paths: ['faker'] }],
            },
          },
          { high: 1 },
        ),
      } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('fail');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[0].message).toBe(
        '[faker] Removal of functional code in faker.js (GHSA-5w9c-rv96-fr7g)',
      );
      expect(result.issues[0].file).toBe('https://github.com/advisories/GHSA-5w9c-rv96-fr7g');
      expect(result.issues[0].fix?.description).toBe('Use @faker-js/faker instead');
    });

    it('calculates score from metadata like npm', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'a',
              severity: 'critical',
              title: 'A',
              url: '',
              recommendation: '',
              findings: [],
            },
            '2': {
              id: 2,
              module_name: 'b',
              severity: 'critical',
              title: 'B',
              url: '',
              recommendation: '',
              findings: [],
            },
          },
          { critical: 2 },
        ),
      } as never);

      const result = await runner.run('/project');

      // score = max(0, 60 - 2 * 15) = 30
      expect(result.score).toBe(30);
    });

    it('aggregates vulnerablePackages across multiple advisories for the same module', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '100': {
              id: 100,
              module_name: 'lodash',
              severity: 'high',
              title: 'Prototype Pollution',
              url: '',
              recommendation: '',
              findings: [],
            },
            '101': {
              id: 101,
              module_name: 'lodash',
              severity: 'moderate',
              title: 'ReDoS',
              url: '',
              recommendation: '',
              findings: [],
            },
          },
          { high: 1, moderate: 1 },
        ),
      } as never);

      const result = await runner.run('/project');

      const vp = (result.metadata as Record<string, unknown>).vulnerablePackages as Record<
        string,
        number
      >;
      expect(vp['lodash']).toBe(2);
    });

    it('uses "No automatic fix available" when recommendation is empty', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'pkg',
              severity: 'moderate',
              title: 'Vuln',
              url: '',
              recommendation: '',
              findings: [],
            },
          },
          { moderate: 1 },
        ),
      } as never);

      const result = await runner.run('/project');

      expect(result.issues[0].fix?.description).toBe('No automatic fix available');
    });

    it('reports pnpm-audit in toolsUsed', async () => {
      mockExeca.mockResolvedValue({ stdout: makePnpmAuditOutput() } as never);

      const result = await runner.run('/project');

      expect(result.toolsUsed).toEqual(['pnpm-audit']);
    });
  });

  // --- pnpm workspace filtering ---

  describe('pnpm workspace filtering', () => {
    beforeEach(() => {
      mockDetectPM.mockReturnValue('pnpm');
      // Simulate workspace root at /workspace with pnpm-workspace.yaml
      mockExistsSync.mockImplementation((p) => String(p) === '/workspace/pnpm-workspace.yaml');
    });

    it('only includes advisories affecting the target package', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'faker',
              severity: 'high',
              title: 'Faker sabotaged',
              url: '',
              recommendation: '',
              findings: [{ version: '6.6.6', paths: ['packages__react-app>faker'] }],
            },
            '2': {
              id: 2,
              module_name: 'jsonwebtoken',
              severity: 'critical',
              title: 'JWT forgery',
              url: '',
              recommendation: '',
              findings: [{ version: '8.0.0', paths: ['packages__node-api>jsonwebtoken'] }],
            },
            '3': {
              id: 3,
              module_name: 'angular',
              severity: 'high',
              title: 'Angular XSS',
              url: '',
              recommendation: '',
              findings: [{ version: '1.0.0', paths: ['packages__angular-app>angular'] }],
            },
          },
          { critical: 1, high: 2 },
        ),
      } as never);

      const result = await runner.run('/workspace/packages/react-app');

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toBe('[faker] Faker sabotaged');
    });

    it('recomputes score from filtered issues, not workspace-wide metadata', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'moderate-dep',
              severity: 'moderate',
              title: 'Minor issue',
              url: '',
              recommendation: '',
              findings: [{ version: '1.0.0', paths: ['packages__react-app>moderate-dep'] }],
            },
            '2': {
              id: 2,
              module_name: 'critical-dep',
              severity: 'critical',
              title: 'Critical issue',
              url: '',
              recommendation: '',
              findings: [{ version: '1.0.0', paths: ['packages__node-api>critical-dep'] }],
            },
          },
          // Metadata reflects workspace-wide counts (1 critical + 1 moderate)
          { critical: 1, moderate: 1 },
        ),
      } as never);

      const result = await runner.run('/workspace/packages/react-app');

      // Only the moderate issue affects react-app — score should not be penalized for the critical
      expect(result.issues).toHaveLength(1);
      expect(result.score).toBe(90); // 100 - 1 * 10 = 90
      expect(result.status).toBe('warning');
    });

    it('returns all advisories when project is the workspace root', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'a',
              severity: 'moderate',
              title: 'A',
              url: '',
              recommendation: '',
              findings: [{ version: '1.0.0', paths: ['packages__app-a>a'] }],
            },
            '2': {
              id: 2,
              module_name: 'b',
              severity: 'moderate',
              title: 'B',
              url: '',
              recommendation: '',
              findings: [{ version: '1.0.0', paths: ['packages__app-b>b'] }],
            },
          },
          { moderate: 2 },
        ),
      } as never);

      const result = await runner.run('/workspace');

      expect(result.issues).toHaveLength(2);
    });

    it('handles advisories with multiple findings across packages', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'shared-dep',
              severity: 'moderate',
              title: 'Shared vulnerability',
              url: '',
              recommendation: '',
              findings: [
                {
                  version: '1.0.0',
                  paths: ['packages__react-app>shared-dep', 'packages__node-api>shared-dep'],
                },
              ],
            },
          },
          { moderate: 1 },
        ),
      } as never);

      const result = await runner.run('/workspace/packages/react-app');

      // Advisory affects react-app (among others), so it should be included
      expect(result.issues).toHaveLength(1);
    });

    it('returns no issues when no advisories affect the target package', async () => {
      mockExeca.mockResolvedValue({
        stdout: makePnpmAuditOutput(
          {
            '1': {
              id: 1,
              module_name: 'angular-dep',
              severity: 'high',
              title: 'Angular issue',
              url: '',
              recommendation: '',
              findings: [{ version: '1.0.0', paths: ['packages__angular-app>angular-dep'] }],
            },
          },
          { high: 1 },
        ),
      } as never);

      const result = await runner.run('/workspace/packages/react-app');

      expect(result.issues).toHaveLength(0);
      expect(result.score).toBe(100);
      expect(result.status).toBe('pass');
    });
  });

  // --- yarn / bun skip ---

  it('skips when package manager is yarn', async () => {
    mockDetectPM.mockReturnValue('yarn');

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it('skips when package manager is bun', async () => {
    mockDetectPM.mockReturnValue('bun');

    const result = await runner.run('/project');

    expect(result.status).toBe('skipped');
    expect(mockExeca).not.toHaveBeenCalled();
  });
});
