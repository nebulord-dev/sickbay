import React from "react";
import { Box, Text } from "ink";
import type { SickbayReport } from "@sickbay/core";

/**
 * Component to display quick wins based on the report's issues that have fixes available.
 * It shows up to 5 fixable issues, sorted by severity (critical > warning > info).
 */

interface QuickWinsProps {
  report: SickbayReport;
}

function replacePackageManager(cmd: string, pm: string): string {
  if (pm === "npm") return cmd;
  const install = pm === "pnpm" ? "pnpm add" : pm === "yarn" ? "yarn add" : "bun add";
  const uninstall = pm === "pnpm" ? "pnpm remove" : pm === "yarn" ? "yarn remove" : "bun remove";
  const update = pm === "pnpm" ? "pnpm update" : pm === "yarn" ? "yarn upgrade" : "bun update";
  const auditFix = pm === "pnpm" ? "pnpm audit --fix" : pm === "yarn" ? "yarn npm audit --fix" : "bun audit";
  return cmd
    .replace(/^npm install(?=\s)/, install)
    .replace(/^npm uninstall(?=\s)/, uninstall)
    .replace(/^npm update(?=\s)/, update)
    .replace(/^npm audit fix/, auditFix);
}

export function QuickWins({ report }: QuickWinsProps) {
  const pm = report.projectInfo?.packageManager ?? "npm";
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
          {fix.fix!.command && <Text dimColor>: {replacePackageManager(fix.fix!.command, pm)}</Text>}
        </Box>
      ))}
    </Box>
  );
}
