import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SickbayReport, CheckResult, Issue } from '@nebulord/sickbay-core';

// We mock 'util' so that promisify returns our controlled async function.
// fix.ts calls `promisify(execFile)` at module-load time, so mockExecFileAsync
// must be initialized before ANY mock factory runs — vi.hoisted() guarantees this.
const mockExecFileAsync = vi.hoisted(() => vi.fn());

vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util');
  return {
    ...actual,
    // fix.ts only calls promisify once (for execFile), so intercepting all
    // promisify calls is safe and avoids relying on fn.name inference.
    promisify: () => mockExecFileAsync,
  };
});

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { collectFixableIssues, executeFix } from './fix.js';

import type { FixableIssue } from './fix.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    severity: 'warning',
    message: 'Some issue',
    reportedBy: [],
    ...overrides,
  };
}

function makeCheck(
  id: string,
  issues: Issue[] = [],
  overrides: Partial<CheckResult> = {},
): CheckResult {
  return {
    id,
    name: `Check ${id}`,
    category: 'code-quality',
    score: 80,
    status: 'pass',
    issues,
    toolsUsed: [],
    duration: 0,
    ...overrides,
  };
}

function makeReport(checks: CheckResult[]): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project',
      version: '1.0.0',
      framework: 'react',
      packageManager: 'npm',
      totalDependencies: 5,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    },
    checks,
    overallScore: 80,
    summary: { critical: 0, warnings: 0, info: 0 },
  };
}

describe('collectFixableIssues', () => {
  it('returns empty array when no checks have issues', () => {
    const report = makeReport([makeCheck('eslint', [])]);
    expect(collectFixableIssues(report)).toEqual([]);
  });

  it('returns empty array when issues have no fix at all', () => {
    const issue = makeIssue({ message: 'No fix available' });
    const report = makeReport([makeCheck('eslint', [issue])]);
    expect(collectFixableIssues(report)).toEqual([]);
  });

  it('includes guidance-only issues (fix with description but no command)', () => {
    const issue = makeIssue({ fix: { description: 'Remove unused file' } });
    const report = makeReport([makeCheck('knip', [issue])]);
    const result = collectFixableIssues(report);
    expect(result).toHaveLength(1);
    expect(result[0].command).toBeUndefined();
    expect(result[0].issue.fix!.description).toBe('Remove unused file');
  });

  it('deduplicates guidance-only issues by description', () => {
    const issue1 = makeIssue({ message: 'Issue 1', fix: { description: 'Remove unused file' } });
    const issue2 = makeIssue({ message: 'Issue 2', fix: { description: 'Remove unused file' } });
    const report = makeReport([makeCheck('knip', [issue1, issue2])]);
    const result = collectFixableIssues(report);
    expect(result).toHaveLength(1);
  });

  it('includes issues that have a fix command', () => {
    const issue = makeIssue({
      fix: { command: 'npm audit fix', description: 'Fix vulnerabilities' },
    });
    const report = makeReport([makeCheck('npm-audit', [issue])]);
    const result = collectFixableIssues(report);
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe('npm audit fix');
    expect(result[0].checkId).toBe('npm-audit');
  });

  it('deduplicates issues with the same fix command', () => {
    const issue1 = makeIssue({
      message: 'Issue 1',
      fix: { command: 'npm install', description: 'Install deps' },
    });
    const issue2 = makeIssue({
      message: 'Issue 2',
      fix: { command: 'npm install', description: 'Install deps' },
    });
    const report = makeReport([makeCheck('deps', [issue1, issue2])]);
    const result = collectFixableIssues(report);
    expect(result).toHaveLength(1);
  });

  it('deduplicates across different checks', () => {
    const issue1 = makeIssue({ fix: { command: 'npm install', description: 'Install deps' } });
    const issue2 = makeIssue({ fix: { command: 'npm install', description: 'Install deps' } });
    const report = makeReport([makeCheck('check-a', [issue1]), makeCheck('check-b', [issue2])]);
    const result = collectFixableIssues(report);
    expect(result).toHaveLength(1);
  });

  it('collects unique commands from multiple checks', () => {
    const issue1 = makeIssue({ fix: { command: 'npm audit fix', description: 'Fix audits' } });
    const issue2 = makeIssue({ fix: { command: 'npm install', description: 'Install deps' } });
    const report = makeReport([makeCheck('check-a', [issue1]), makeCheck('check-b', [issue2])]);
    const result = collectFixableIssues(report);
    expect(result).toHaveLength(2);
  });

  it('sorts results with critical severity first', () => {
    const infoIssue = makeIssue({
      severity: 'info',
      fix: { command: 'cmd-info', description: 'info fix' },
    });
    const criticalIssue = makeIssue({
      severity: 'critical',
      fix: { command: 'cmd-critical', description: 'critical fix' },
    });
    const warningIssue = makeIssue({
      severity: 'warning',
      fix: { command: 'cmd-warning', description: 'warning fix' },
    });
    const report = makeReport([makeCheck('multi', [infoIssue, criticalIssue, warningIssue])]);
    const result = collectFixableIssues(report);
    expect(result[0].issue.severity).toBe('critical');
    expect(result[1].issue.severity).toBe('warning');
    expect(result[2].issue.severity).toBe('info');
  });

  it('includes checkName and checkId in each result', () => {
    const issue = makeIssue({ fix: { command: 'do-something', description: 'do it' } });
    const check = makeCheck('my-check', [issue], { name: 'My Check Name' });
    const report = makeReport([check]);
    const result = collectFixableIssues(report);
    expect(result[0].checkId).toBe('my-check');
    expect(result[0].checkName).toBe('My Check Name');
  });
});

describe('executeFix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeFixableIssue(command?: string): FixableIssue {
    return {
      issue: makeIssue({ fix: { command, description: 'test fix' } }),
      checkId: 'test-check',
      checkName: 'Test Check',
      command,
    };
  }

  it('returns success result when execFileAsync resolves', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: 'stdout output', stderr: '' });

    const fix = makeFixableIssue('npm install');
    const result = await executeFix(fix, '/project');

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('stdout output');
    expect(result.stderr).toBe('');
    expect(result.fixable).toBe(fix);
  });

  it('returns failure result when execFileAsync rejects with an Error', async () => {
    mockExecFileAsync.mockRejectedValue(new Error('command not found'));

    const fix = makeFixableIssue('nonexistent-cmd');
    const result = await executeFix(fix, '/project');

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('command not found');
  });

  it('includes duration in the result', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

    const fix = makeFixableIssue('npm install');
    const result = await executeFix(fix, '/project');

    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('calls execFileAsync with split cmd and args', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

    const fix = makeFixableIssue('npm audit fix');
    await executeFix(fix, '/project');

    const [cmd, args] = mockExecFileAsync.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('npm');
    expect(args).toEqual(['audit', 'fix']);
  });

  it('does not invoke execFileAsync with shell: true (command-injection guard)', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

    const fix = makeFixableIssue('npm audit fix');
    await executeFix(fix, '/project');

    const opts = mockExecFileAsync.mock.calls[0]?.[2] as { shell?: unknown } | undefined;
    expect(opts?.shell).toBeUndefined();
  });

  it('handles non-Error rejected values gracefully', async () => {
    mockExecFileAsync.mockRejectedValue('string error');

    const fix = makeFixableIssue('bad-cmd');
    const result = await executeFix(fix, '/project');

    expect(result.success).toBe(false);
    expect(result.stderr).toBe('string error');
  });

  it('returns failure for guidance-only fix (no command)', async () => {
    const fix = makeFixableIssue(undefined);
    const result = await executeFix(fix, '/project');

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('guidance-only');
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  it('returns empty stdout and stderr on success with no output', async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: undefined, stderr: undefined });

    const fix = makeFixableIssue('touch something');
    const result = await executeFix(fix, '/project');

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
