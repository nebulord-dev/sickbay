import React from 'react';

import { Box, Text } from 'ink';

import type { SickbayReport } from 'sickbay-core';

interface QuickWinsPanelProps {
  report: SickbayReport | null;
  availableWidth?: number;
}

function replacePackageManager(cmd: string, pm: string): string {
  if (pm === 'npm') return cmd;
  const install = pm === 'pnpm' ? 'pnpm add' : pm === 'yarn' ? 'yarn add' : 'bun add';
  const uninstall = pm === 'pnpm' ? 'pnpm remove' : pm === 'yarn' ? 'yarn remove' : 'bun remove';
  const update = pm === 'pnpm' ? 'pnpm update' : pm === 'yarn' ? 'yarn upgrade' : 'bun update';
  const auditFix =
    pm === 'pnpm' ? 'pnpm audit --fix' : pm === 'yarn' ? 'yarn npm audit --fix' : 'bun audit';
  return cmd
    .replace(/^npm install(?=\s)/, install)
    .replace(/^npm uninstall(?=\s)/, uninstall)
    .replace(/^npm update(?=\s)/, update)
    .replace(/^npm audit fix/, auditFix);
}

function shortenPath(filepath: string): string {
  const parts = filepath.split('/');
  if (parts.length <= 2) return filepath;
  return '\u2026/' + parts.slice(-2).join('/');
}

function smartTruncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  // If it contains a file path, shorten the path but keep the filename
  const pathMatch = str.match(/(\S*\/\S+)/);
  if (pathMatch) {
    const shortened = str.replace(pathMatch[1], shortenPath(pathMatch[1]));
    if (shortened.length <= maxLen) return shortened;
    return shortened.slice(0, maxLen - 1) + '\u2026';
  }
  return str.slice(0, maxLen - 1) + '\u2026';
}

function shortenCommand(cmd: string, maxLen: number): string {
  if (cmd.length <= maxLen) return cmd;
  // Shorten any file paths in the command first
  const shortened = cmd.replace(/(\S*\/\S+)/g, (match) => shortenPath(match));
  if (shortened.length <= maxLen) return shortened;
  return shortened.slice(0, maxLen - 1) + '\u2026';
}

export function QuickWinsPanel({ report, availableWidth }: QuickWinsPanelProps) {
  if (!report) {
    return (
      <Box>
        <Text dimColor>Waiting for scan...</Text>
      </Box>
    );
  }

  const fixes: Array<{
    description: string;
    command: string;
    severity: string;
  }> = [];

  for (const check of report.checks) {
    for (const issue of check.issues) {
      if (issue.fix?.command) {
        fixes.push({
          description: issue.fix.description,
          command: issue.fix.command,
          severity: issue.severity,
        });
      }
    }
  }

  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  fixes.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  const top = fixes.slice(0, 5);

  if (top.length === 0) {
    return (
      <Box>
        <Text color="green">Looking good!</Text>
      </Box>
    );
  }

  const pm = report.projectInfo?.packageManager ?? 'npm';
  const maxTextLen = Math.max(16, (availableWidth ?? 26) - 4);

  return (
    <Box flexDirection="column">
      {top.map((fix, i) => (
        <Box key={i} flexDirection="column" marginBottom={i < top.length - 1 ? 1 : 0}>
          <Text>
            <Text
              color={
                fix.severity === 'critical' ? 'red' : fix.severity === 'warning' ? 'yellow' : 'gray'
              }
            >
              {'\u2192'}{' '}
            </Text>
            {smartTruncate(fix.description, maxTextLen)}
          </Text>
          <Text dimColor>
            {'  '}
            {shortenCommand(replacePackageManager(fix.command, pm), maxTextLen)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
