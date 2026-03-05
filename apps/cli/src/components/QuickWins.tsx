import React from "react";
import { Box, Text } from "ink";
import type { VitalsReport } from "@vitals/core";

/**
 * Component to display quick wins based on the report's issues that have fixes available.
 * It shows up to 5 fixable issues, sorted by severity (critical > warning > info).
 */

interface QuickWinsProps {
  report: VitalsReport;
}

export function QuickWins({ report }: QuickWinsProps) {
  const fixes = report.checks
    .flatMap((c) => c.issues)
    .filter((i) => i.fix?.command)
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 5);

  if (fixes.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>🔥 Quick Wins:</Text>
      {fixes.map((fix) => (
        <Box key={`${fix.severity}-${fix.message}`} marginLeft={2}>
          <Text dimColor>→ </Text>
          <Text>{fix.fix!.description}</Text>
          {fix.fix!.command && <Text dimColor>: {fix.fix!.command}</Text>}
        </Box>
      ))}
    </Box>
  );
}
