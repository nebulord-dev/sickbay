import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { runVitals } from "@vitals/core";
import { Header } from "./Header.js";
import { ProgressList } from "./ProgressList.js";
import {
  collectFixableIssues,
  executeFix,
  type FixableIssue,
  type FixResult,
} from "../commands/fix.js";

interface FixAppProps {
  projectPath: string;
  checks?: string[];
  applyAll: boolean;
  dryRun: boolean;
  verbose: boolean;
}

type Phase = "scanning" | "selecting" | "fixing" | "done" | "error";

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

const SEVERITY_COLOR = {
  critical: "red" as const,
  warning: "yellow" as const,
  info: "gray" as const,
};

export function FixApp({
  projectPath,
  checks,
  applyAll,
  dryRun,
  verbose,
}: FixAppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [fixableIssues, setFixableIssues] = useState<FixableIssue[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [results, setResults] = useState<FixResult[]>([]);
  const [currentFixIndex, setCurrentFixIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [projectName, setProjectName] = useState<string | undefined>();

  // Phase 1: Run scan
  useEffect(() => {
    const initial: ProgressItem[] = (
      checks ?? [
        "knip",
        "depcheck",
        "npm-check-updates",
        "npm-audit",
        "madge",
        "source-map-explorer",
        "coverage",
        "license-checker",
        "jscpd",
        "git",
        "eslint",
        "typescript",
        "todo-scanner",
        "complexity",
        "secrets",
        "heavy-deps",
        "react-perf",
        "asset-size",
      ]
    ).map((name) => ({ name, status: "pending" as const }));
    setProgress(initial);

    runVitals({
      projectPath,
      checks,
      verbose,
      onCheckStart: (name) => {
        setProgress((prev) =>
          prev.map((p) => (p.name === name ? { ...p, status: "running" } : p)),
        );
      },
      onCheckComplete: (result) => {
        setProgress((prev) =>
          prev.map((p) =>
            p.name === result.id ? { ...p, status: "done" } : p,
          ),
        );
      },
    })
      .then((r) => {
        setProjectName(r.projectInfo.name);
        const fixable = collectFixableIssues(r);
        setFixableIssues(fixable);

        if (fixable.length === 0) {
          setPhase("done");
        } else if (applyAll) {
          setSelected(new Set(fixable.map((_, i) => i)));
          setPhase("fixing");
        } else {
          setPhase("selecting");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        setTimeout(() => exit(), 100);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 3: Execute fixes
  useEffect(() => {
    if (phase !== "fixing") return;

    const toFix = fixableIssues.filter((_, i) => selected.has(i));
    if (toFix.length === 0) {
      setPhase("done");
      setTimeout(() => exit(), 100);
      return;
    }

    (async () => {
      const fixResults: FixResult[] = [];
      for (let i = 0; i < toFix.length; i++) {
        setCurrentFixIndex(i);
        if (dryRun) {
          fixResults.push({
            fixable: toFix[i],
            success: true,
            stdout: "(dry run)",
            stderr: "",
            duration: 0,
          });
        } else {
          const result = await executeFix(toFix[i], projectPath);
          fixResults.push(result);
        }
        setResults([...fixResults]);
      }
      setPhase("done");
      setTimeout(() => exit(), 100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Handle keyboard input during selection phase
  const handleInput = useCallback(
    (
      input: string,
      key: { upArrow: boolean; downArrow: boolean; return: boolean },
    ) => {
      if (phase !== "selecting") return;

      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (key.downArrow) {
        setCursor((c) => Math.min(fixableIssues.length - 1, c + 1));
      } else if (input === " ") {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(cursor)) {
            next.delete(cursor);
          } else {
            next.add(cursor);
          }
          return next;
        });
      } else if (input === "a") {
        setSelected(new Set(fixableIssues.map((_, i) => i)));
      } else if (input === "n") {
        setSelected(new Set());
      } else if (key.return) {
        if (selected.size > 0) {
          setPhase("fixing");
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, cursor, selected],
  );

  useInput(handleInput);

  return (
    <Box flexDirection="column" padding={1}>
      <Header projectName={projectName} />

      {/* Scanning phase */}
      {phase === "scanning" && (
        <Box flexDirection="column">
          <Text dimColor>Scanning for fixable issues...</Text>
          <Box marginTop={1} marginLeft={2}>
            <ProgressList items={progress} />
          </Box>
        </Box>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <Box>
          <Text color="red">✗ Error: {error}</Text>
        </Box>
      )}

      {/* Selection phase */}
      {phase === "selecting" && (
        <Box flexDirection="column">
          <Text bold>
            Select fixes to apply ({fixableIssues.length} available)
          </Text>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {fixableIssues.map((fix, i) => (
              <Box key={`${fix.checkId}-${fix.issue.message}`}>
                <Text color={i === cursor ? "cyan" : undefined}>
                  {i === cursor ? "❯ " : "  "}
                </Text>
                <Text color={i === cursor ? "cyan" : undefined}>
                  {selected.has(i) ? "[✓] " : "[ ] "}
                </Text>
                <Text color={SEVERITY_COLOR[fix.issue.severity]}>
                  {fix.issue.fix!.description}
                </Text>
                <Text dimColor> ({fix.command})</Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1} marginLeft={2}>
            <Text dimColor>
              ↑↓ navigate · space toggle · a all · n none · enter confirm
              {selected.size > 0 && ` (${selected.size} selected)`}
            </Text>
          </Box>
          {dryRun && (
            <Box marginLeft={2}>
              <Text color="yellow">
                ⚠ Dry run mode — no changes will be made
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Fixing phase */}
      {phase === "fixing" && (
        <Box flexDirection="column">
          <Text bold>
            {dryRun ? "Dry run" : "Applying fixes"}... ({results.length}/
            {fixableIssues.filter((_, i) => selected.has(i)).length})
          </Text>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {results.map((r, i) => (
              <Box key={i}>
                <Text color={r.success ? "green" : "red"}>
                  {r.success ? "✓" : "✗"}{" "}
                </Text>
                <Text>{r.fixable.issue.fix!.description}</Text>
              </Box>
            ))}
            {results.length <
              fixableIssues.filter((_, i) => selected.has(i)).length && (
              <Box>
                <Text color="green">
                  <Spinner type="dots" />
                </Text>
                <Text>
                  {" "}
                  {
                    fixableIssues.filter((_, i) => selected.has(i))[
                      currentFixIndex
                    ]?.issue.fix!.description
                  }
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Done phase */}
      {phase === "done" && (
        <Box flexDirection="column">
          {fixableIssues.length === 0 ? (
            <Box>
              <Text color="green">✓ </Text>
              <Text>No fixable issues found — your project looks great!</Text>
            </Box>
          ) : (
            <>
              <Text bold>{dryRun ? "Dry Run Results" : "Fix Results"}</Text>
              <Box flexDirection="column" marginTop={1} marginLeft={2}>
                {results.map((r, i) => (
                  <Box key={i}>
                    <Text color={r.success ? "green" : "red"}>
                      {r.success ? "✓" : "✗"}{" "}
                    </Text>
                    <Text>{r.fixable.issue.fix!.description}</Text>
                    {r.duration > 0 && <Text dimColor> ({r.duration}ms)</Text>}
                  </Box>
                ))}
              </Box>
              <Box marginTop={1}>
                <Text dimColor>{"━".repeat(52)}</Text>
              </Box>
              <Box marginTop={1}>
                <Text bold>
                  {results.filter((r) => r.success).length}/{results.length}{" "}
                  fixes {dryRun ? "would be applied" : "applied successfully"}
                </Text>
              </Box>
              {!dryRun && results.some((r) => r.success) && (
                <Box marginTop={1}>
                  <Text dimColor>Run </Text>
                  <Text color="cyan">vitals</Text>
                  <Text dimColor> to see your updated score</Text>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
