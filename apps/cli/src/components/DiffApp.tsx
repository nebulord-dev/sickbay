import React, { useState, useEffect } from 'react';

import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';

import {
  loadBaseReport,
  compareReports,
  type DiffResult,
  type CheckDiff,
} from '../commands/diff.js';
import { Header } from './Header.js';

interface DiffAppProps {
  projectPath: string;
  branch: string;
  jsonOutput: boolean;
  checks?: string[];
  verbose?: boolean;
}

const STATUS_ICONS: Record<CheckDiff['status'], string> = {
  improved: '↑',
  regressed: '↓',
  unchanged: '=',
  new: '+',
  removed: '−',
};

const STATUS_COLORS: Record<CheckDiff['status'], string> = {
  improved: 'green',
  regressed: 'red',
  unchanged: 'gray',
  new: 'cyan',
  removed: 'yellow',
};

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '0';
}

function DiffTable({ diff }: { diff: DiffResult }) {
  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Text bold>Overall: </Text>
        <Text bold>{diff.baseScore}</Text>
        <Text dimColor> → </Text>
        <Text bold>{diff.currentScore}</Text>
        <Text> </Text>
        <Text color={diff.scoreDelta > 0 ? 'green' : diff.scoreDelta < 0 ? 'red' : 'gray'} bold>
          ({formatDelta(diff.scoreDelta)})
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <Box>
          <Text bold>{'  Check'.padEnd(30)}</Text>
          <Text bold>{'Current'.padEnd(10)}</Text>
          <Text bold>{'Base'.padEnd(10)}</Text>
          <Text bold>Delta</Text>
        </Box>
        <Text dimColor>{'━'.repeat(56)}</Text>
        {diff.checks.map((check) => (
          <Box key={check.id}>
            <Text color={STATUS_COLORS[check.status]}>{STATUS_ICONS[check.status]} </Text>
            <Text>{check.name.padEnd(28)}</Text>
            <Text>{String(check.currentScore || '—').padEnd(10)}</Text>
            <Text>{String(check.baseScore || '—').padEnd(10)}</Text>
            <Text color={STATUS_COLORS[check.status]} bold>
              {check.status === 'new'
                ? 'new'
                : check.status === 'removed'
                  ? 'removed'
                  : formatDelta(check.delta)}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1} marginLeft={2}>
        <Text dimColor>
          {diff.summary.improved > 0 && <Text color="green">{diff.summary.improved} improved</Text>}
          {diff.summary.improved > 0 && diff.summary.regressed > 0 && <Text>, </Text>}
          {diff.summary.regressed > 0 && (
            <Text color="red">{diff.summary.regressed} regressed</Text>
          )}
          {(diff.summary.improved > 0 || diff.summary.regressed > 0) &&
            diff.summary.unchanged > 0 && <Text>, </Text>}
          {diff.summary.unchanged > 0 && <Text>{diff.summary.unchanged} unchanged</Text>}
          {diff.summary.newChecks > 0 && <Text color="cyan">, {diff.summary.newChecks} new</Text>}
          {diff.summary.removedChecks > 0 && (
            <Text color="yellow">, {diff.summary.removedChecks} removed</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
}

export function DiffApp({ projectPath, branch, jsonOutput, checks, verbose }: DiffAppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<'scanning' | 'loading-base' | 'results' | 'error'>('scanning');
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Run fresh scan on current branch
        const { runSickbay } = await import('sickbay-core');
        const currentReport = await runSickbay({
          projectPath,
          checks,
          verbose,
        });

        // Save current report
        try {
          const { saveEntry, saveLastReport } = await import('../lib/history.js');
          saveEntry(currentReport);
          saveLastReport(currentReport);
        } catch {
          // Non-critical
        }

        setPhase('loading-base');

        // Load base report from target branch
        const baseReport = loadBaseReport(projectPath, branch);
        if (!baseReport) {
          setError(
            `No saved report found on "${branch}". Run \`sickbay\` on that branch and commit .sickbay/last-report.json so it can be read via git.`,
          );
          setPhase('error');
          setTimeout(() => exit(), 100);
          return;
        }

        const result = compareReports(currentReport, baseReport, branch);
        setDiff(result);
        setPhase('results');

        if (jsonOutput) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        }

        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'scanning') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>{' '}
          Scanning current branch...
        </Text>
      </Box>
    );
  }

  if (phase === 'loading-base') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>{' '}
          Loading {branch} baseline...
        </Text>
      </Box>
    );
  }

  if (phase === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (jsonOutput || !diff) return null;

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      <Text bold>Branch Diff: current vs {branch}</Text>
      <DiffTable diff={diff} />
    </Box>
  );
}
