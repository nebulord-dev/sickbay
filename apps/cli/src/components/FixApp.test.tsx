import React from 'react';

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { FixableIssue } from '../commands/fix.js';
import type { SickbayReport } from '@nebulord/sickbay-core';

vi.mock('@nebulord/sickbay-core', () => ({
  runSickbay: vi.fn(),
}));

vi.mock('../commands/fix.js', () => ({
  collectFixableIssues: vi.fn(),
  executeFix: vi.fn(),
}));

vi.mock('../lib/resolve-package.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/resolve-package.js')>(
    '../lib/resolve-package.js',
  );
  return { ...actual };
});

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    useApp: () => ({ exit: vi.fn() }),
    useInput: vi.fn(),
  };
});

import { runSickbay } from '@nebulord/sickbay-core';
import { useInput } from 'ink';

import { collectFixableIssues, executeFix } from '../commands/fix.js';
import { FixApp } from './FixApp.js';

const mockRunSickbay = vi.mocked(runSickbay);
const mockCollectFixableIssues = vi.mocked(collectFixableIssues);
const mockExecuteFix = vi.mocked(executeFix);
const { act } = React;

function makeReport(overrides: Partial<SickbayReport> = {}): SickbayReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project',
      version: '1.0.0',
      framework: 'react',
      packageManager: 'npm',
      totalDependencies: 0,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    },
    checks: [],
    overallScore: 85,
    summary: { critical: 0, warnings: 0, info: 0 },
    ...overrides,
  };
}

function makeFixableIssue(overrides: Partial<FixableIssue> = {}): FixableIssue {
  return {
    checkId: 'knip',
    checkName: 'Knip',
    command: 'npx knip --fix',
    issue: {
      severity: 'warning',
      message: 'Unused exports found',
      reportedBy: [],
      fix: { description: 'Remove unused exports', command: 'npx knip --fix' },
    },
    ...overrides,
  };
}

async function renderAndFlush(element: React.ReactElement) {
  const result = render(element);
  // Flush enough ticks for useEffect + async runSickbay().then() chains to settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}

describe('FixApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectFixableIssues.mockReturnValue([]);
    mockExecuteFix.mockResolvedValue({
      fixable: makeFixableIssue(),
      success: true,
      stdout: '',
      stderr: '',
      duration: 100,
    });
  });

  it('shows scanning spinner while running', () => {
    mockRunSickbay.mockReturnValue(new Promise(() => {}));

    const { lastFrame } = render(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(lastFrame()).toContain('Scanning for fixable issues...');
  });

  it('shows no-fixable-issues message when done with empty list', async () => {
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('No auto-fixable issues found');
  });

  it('shows selection phase heading when issues exist and applyAll is false', async () => {
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([makeFixableIssue()]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('Select fixes to apply');
  });

  it('shows fix description in selection list', async () => {
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([
      makeFixableIssue({
        issue: {
          severity: 'warning',
          message: 'Unused exports found',
          reportedBy: [],
          fix: { description: 'Remove unused exports', command: 'npx knip --fix' },
        },
      }),
    ]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('Remove unused exports');
  });

  it('shows count of available issues in selection heading', async () => {
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([makeFixableIssue(), makeFixableIssue()]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('2 available');
  });

  it('shows dry run warning in selection phase when dryRun is true', async () => {
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([makeFixableIssue()]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={true} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('Dry run mode');
  });

  it('shows error message when runSickbay rejects', async () => {
    mockRunSickbay.mockRejectedValue(new Error('Scan failed'));

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('Scan failed');
  });

  it('passes projectPath and checks to runSickbay', async () => {
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([]);

    await renderAndFlush(
      <FixApp
        projectPath="/my/project"
        checks={['eslint', 'knip']}
        applyAll={false}
        dryRun={false}
        verbose={false}
      />,
    );

    expect(mockRunSickbay).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: '/my/project', checks: ['eslint', 'knip'] }),
    );
  });

  it('shows Fix Results heading in done phase after applyAll', async () => {
    const fix = makeFixableIssue();
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([fix]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={true} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('Fix Results');
  });

  it('shows Dry Run Results heading in done phase when dryRun is true and applyAll', async () => {
    const fix = makeFixableIssue();
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([fix]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={true} dryRun={true} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('Dry Run Results');
  });

  describe('keyboard navigation in selection phase', () => {
    type KeyEvent = { upArrow: boolean; downArrow: boolean; return: boolean };
    const noKey: KeyEvent = { upArrow: false, downArrow: false, return: false };

    async function renderInSelectingPhase() {
      let latestHandler: ((input: string, key: KeyEvent) => void) | undefined;
      vi.mocked(useInput).mockImplementation(((handler: (input: string, key: KeyEvent) => void) => {
        // Always update — component recreates handleInput when selected/cursor changes
        latestHandler = handler;
      }) as typeof useInput);

      mockRunSickbay.mockResolvedValue(makeReport() as never);
      mockCollectFixableIssues.mockReturnValue([makeFixableIssue(), makeFixableIssue()]);

      const result = await renderAndFlush(
        <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
      );

      // Wrap so callers always invoke the latest handler (re-captured after each re-render)
      const fire = (input: string, key: KeyEvent) => latestHandler!(input, key);
      return { result, fire };
    }

    it('moves cursor down with downArrow key', async () => {
      const { result, fire } = await renderInSelectingPhase();

      await act(async () => {
        fire('', { ...noKey, downArrow: true });
        await Promise.resolve();
      });

      // Still in selecting phase — no crash
      expect(result.lastFrame()).toContain('Select fixes to apply');
    });

    it('moves cursor up with upArrow key', async () => {
      const { result, fire } = await renderInSelectingPhase();

      await act(async () => {
        fire('', { ...noKey, upArrow: true });
        await Promise.resolve();
      });

      expect(result.lastFrame()).toContain('Select fixes to apply');
    });

    it('toggles item selection with space key', async () => {
      const { result, fire } = await renderInSelectingPhase();

      await act(async () => {
        fire(' ', noKey);
        await Promise.resolve();
      });

      expect(result.lastFrame()).toContain('Select fixes to apply');
    });

    it("selects all items with 'a' key", async () => {
      const { result, fire } = await renderInSelectingPhase();

      await act(async () => {
        fire('a', noKey);
        await Promise.resolve();
      });

      expect(result.lastFrame()).toContain('Select fixes to apply');
    });

    it("deselects all items with 'n' key", async () => {
      const { result, fire } = await renderInSelectingPhase();

      await act(async () => {
        fire('n', noKey);
        await Promise.resolve();
      });

      expect(result.lastFrame()).toContain('Select fixes to apply');
    });

    it('does nothing on Enter when nothing is selected', async () => {
      const { result, fire } = await renderInSelectingPhase();

      await act(async () => {
        fire('', { ...noKey, return: true });
        await Promise.resolve();
      });

      // Stays in selecting phase — selected.size === 0
      expect(result.lastFrame()).toContain('Select fixes to apply');
    });

    it('enters confirmation phase on Enter when items are selected', async () => {
      const { result, fire } = await renderInSelectingPhase();

      // Space selects item — flush fully so React re-renders and latestHandler updates
      await act(async () => {
        fire(' ', noKey);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Now latestHandler has selected={0} in its closure — Enter transitions to confirming
      await act(async () => {
        fire('', { ...noKey, return: true });
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show confirmation prompt
      expect(result.lastFrame()).toContain('Proceed?');
    });

    it('enters fixing phase after confirming with Y', async () => {
      const { result, fire } = await renderInSelectingPhase();

      // Select first item
      await act(async () => {
        fire(' ', noKey);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Press Enter to go to confirmation
      await act(async () => {
        fire('', { ...noKey, return: true });
        await Promise.resolve();
        await Promise.resolve();
      });

      // Confirm with Y
      await act(async () => {
        fire('y', noKey);
        await Promise.resolve();
        await Promise.resolve();
      });

      // executeFix resolves immediately so component reaches done phase
      expect(result.lastFrame()).toContain('Fix Results');
    });
  });

  it('shows fix count summary in done phase', async () => {
    const fix = makeFixableIssue();
    mockRunSickbay.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([fix]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={true} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain('1/1');
  });

  describe('guidance-only issues', () => {
    it('excludes guidance-only items from the selection list', async () => {
      mockRunSickbay.mockResolvedValue(makeReport() as never);
      mockCollectFixableIssues.mockReturnValue([
        // One actionable fix so we reach the selecting phase
        makeFixableIssue(),
        makeFixableIssue({
          command: undefined,
          issue: {
            severity: 'warning',
            message: 'Remove unused file',
            reportedBy: [],
            fix: { description: 'Remove unused file' },
          },
        }),
      ]);

      const result = await renderAndFlush(
        <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
      );

      const output = result.lastFrame()!;
      // Only 1 actionable fix should appear in the selection list
      expect(output).toContain('1 available');
      // Guidance-only item should not appear
      expect(output).not.toContain('Remove unused file');
    });
  });

  describe('confirmation flow', () => {
    it('shows tier-2 warning for modifiesSource fixes', async () => {
      mockRunSickbay.mockResolvedValue(makeReport() as never);
      mockCollectFixableIssues.mockReturnValue([
        makeFixableIssue({
          command: 'eslint src/App.tsx --fix',
          issue: {
            severity: 'warning',
            message: 'ESLint issues',
            reportedBy: [],
            fix: {
              description: 'Fix ESLint issues',
              command: 'eslint src/App.tsx --fix',
              modifiesSource: true,
            },
          },
        }),
      ]);

      const result = await renderAndFlush(
        <FixApp projectPath="/test" applyAll={true} dryRun={false} verbose={false} />,
      );

      // --apply-all skips tier-1 but still shows tier-2
      expect(result.lastFrame()).toContain('modify source files');
    });
  });

  describe('nextSteps display', () => {
    it('shows nextSteps after successful execution', async () => {
      const fix = makeFixableIssue({
        command: 'npm install helmet',
        issue: {
          severity: 'critical',
          message: 'Missing helmet',
          reportedBy: [],
          fix: {
            description: 'Install helmet',
            command: 'npm install helmet',
            nextSteps: 'Add app.use(helmet())',
          },
        },
      });
      mockRunSickbay.mockResolvedValue(makeReport() as never);
      mockCollectFixableIssues.mockReturnValue([fix]);
      mockExecuteFix.mockResolvedValue({
        fixable: fix,
        success: true,
        stdout: '',
        stderr: '',
        duration: 100,
      });

      const result = await renderAndFlush(
        <FixApp projectPath="/test" applyAll={true} dryRun={false} verbose={false} />,
      );

      expect(result.lastFrame()).toContain('Add app.use(helmet())');
    });
  });

  describe('monorepo mode', () => {
    const packagePaths = ['/root/packages/app-a', '/root/packages/app-b'];
    const packageNames = new Map([
      ['/root/packages/app-a', '@scope/app-a'],
      ['/root/packages/app-b', 'app-b'],
    ]);

    it('shows monorepo scanning message with package count', () => {
      mockRunSickbay.mockReturnValue(new Promise(() => {}));

      const { lastFrame } = render(
        <FixApp
          projectPath="/root"
          applyAll={false}
          dryRun={false}
          verbose={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      expect(lastFrame()).toContain('across 2 packages');
    });

    it('shows no-fixable message for clean monorepo', async () => {
      mockRunSickbay.mockResolvedValue(makeReport() as never);
      mockCollectFixableIssues.mockReturnValue([]);

      const result = await renderAndFlush(
        <FixApp
          projectPath="/root"
          applyAll={false}
          dryRun={false}
          verbose={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      expect(result.lastFrame()).toContain('No auto-fixable issues found');
      expect(result.lastFrame()).toContain('across any package');
    });

    it('shows package name labels in selection phase', async () => {
      mockRunSickbay.mockResolvedValue(makeReport() as never);
      mockCollectFixableIssues.mockReturnValueOnce([makeFixableIssue()]).mockReturnValueOnce([]);

      const result = await renderAndFlush(
        <FixApp
          projectPath="/root"
          applyAll={false}
          dryRun={false}
          verbose={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain('Select fixes to apply');
      expect(output).toContain('[app-a]');
    });
  });
});
