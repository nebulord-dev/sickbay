import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { LOADING_MESSAGES } from "../../lib/messages.js";
import type { CheckResult } from "@sickbay/core";

interface HealthPanelProps {
  checks: CheckResult[];
  isScanning: boolean;
  progress: Array<{ name: string; status: string }>;
  scrollOffset: number;
  availableHeight: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function scoreBar(score: number, width = 10): string {
  const filled = Math.round((score / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "\u2026" : str;
}

function statusIcon(status: string): string {
  switch (status) {
    case "pass":
      return "\u2713";
    case "fail":
      return "\u2717";
    case "warning":
      return "\u26A0";
    case "skipped":
      return "\u25CB";
    default:
      return "?";
  }
}

export function HealthPanel({
  checks,
  isScanning,
  progress,
  scrollOffset,
  availableHeight,
}: HealthPanelProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!isScanning || progress.length > 0) return;
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isScanning, progress.length]);

  if (isScanning && checks.length === 0) {
    if (progress.length === 0) {
      return (
        <Box>
          <Text dimColor>{LOADING_MESSAGES[msgIdx]}</Text>
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        {progress.map((p) => (
          <Box key={p.name}>
            <Text
              color={
                p.status === "done"
                  ? "green"
                  : p.status === "running"
                    ? "yellow"
                    : "gray"
              }
            >
              {p.status === "done"
                ? "\u2713"
                : p.status === "running"
                  ? "\u25CC"
                  : "\u25CB"}
            </Text>
            <Text> {p.name}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  if (checks.length === 0) {
    return (
      <Box>
        <Text dimColor>No results yet. Press [r] to scan.</Text>
      </Box>
    );
  }

  const maxVisible = Math.max(1, availableHeight);
  const visible = checks.slice(scrollOffset, scrollOffset + maxVisible);
  const hasMore = scrollOffset + maxVisible < checks.length;
  const hasLess = scrollOffset > 0;

  return (
    <Box flexDirection="column">
      {hasLess && <Text dimColor> \u25B2 {scrollOffset} more above</Text>}
      {visible.map((check) => (
        <Box key={check.id}>
          <Text
            color={
              check.status === "pass"
                ? "green"
                : check.status === "fail"
                  ? "red"
                  : "yellow"
            }
          >
            {statusIcon(check.status)}
          </Text>
          <Text> </Text>
          <Box width={26}>
            <Text wrap="truncate">{truncate(check.name, 26)}</Text>
          </Box>
          <Text> </Text>
          <Text color={scoreColor(check.score)}>{scoreBar(check.score)}</Text>
          <Text color={scoreColor(check.score)}>
            {" "}
            {String(check.score).padStart(3)}
          </Text>
        </Box>
      ))}
      {hasMore && (
        <Text dimColor>
          {"  \u25BC "}
          {checks.length - scrollOffset - maxVisible} more below
        </Text>
      )}
      {isScanning && <Text color="yellow">{"  \u25CC Re-scanning..."}</Text>}
    </Box>
  );
}
