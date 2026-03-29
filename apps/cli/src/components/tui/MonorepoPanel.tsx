import React from "react";
import { Box, Text } from "ink";
import type { MonorepoReport, PackageReport } from "@nebulord/sickbay-core";

interface MonorepoPanelProps {
  report: MonorepoReport | null;
  availableWidth?: number;
}

function scoreBar(score: number, width = 8): string {
  const filled = Math.round((score / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function scoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

export function MonorepoPanel({ report, availableWidth }: MonorepoPanelProps) {
  if (!report) {
    return (
      <Box>
        <Text dimColor>Waiting for scan...</Text>
      </Box>
    );
  }

  const nameWidth = Math.max(
    12,
    Math.min(20, (availableWidth ?? 36) - 22),
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{report.packages.length} packages</Text>
        <Text dimColor> · </Text>
        <Text dimColor>{report.monorepoType} workspaces</Text>
        <Text dimColor> · </Text>
        <Text color={scoreColor(report.overallScore)} bold>
          {report.overallScore}
        </Text>
        <Text dimColor> avg</Text>
      </Box>

      {report.packages.map((pkg: PackageReport) => {
        const name = pkg.name.includes("/")
          ? pkg.name.split("/").pop() ?? pkg.name
          : pkg.name;
        const truncatedName =
          name.length > nameWidth
            ? name.slice(0, nameWidth - 1) + "\u2026"
            : name.padEnd(nameWidth);

        return (
          <Box key={pkg.path} gap={1}>
            <Text color={scoreColor(pkg.score)}>{scoreBar(pkg.score)}</Text>
            <Text color={scoreColor(pkg.score)} bold>
              {String(pkg.score).padStart(3)}
            </Text>
            <Text>{truncatedName}</Text>
            {pkg.summary.critical > 0 && (
              <Text color="red"> ⚠</Text>
            )}
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <Text color="cyan">[w]</Text>
        <Text dimColor> for per-package web view</Text>
      </Box>
    </Box>
  );
}
