import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { runSickbay } from "@nebulord/sickbay-core";
import { Header } from "./Header.js";
import { ProgressList } from "./ProgressList.js";
import {
  collectFixableIssues,
  executeFix,
  type FixableIssue,
  type FixResult,
} from "../commands/fix.js";
import { shortName } from "../lib/resolve-package.js";

interface FixAppProps {
  projectPath: string;
  checks?: string[];
  applyAll: boolean;
  dryRun: boolean;
  verbose: boolean;
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}

type Phase = "scanning" | "selecting" | "confirming" | "fixing" | "done" | "error";

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

interface MonorepoFixableIssue extends FixableIssue {
  packageName: string;
  packagePath: string;
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
  isMonorepo,
  packagePaths,
  packageNames,
}: FixAppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [fixableIssues, setFixableIssues] = useState<MonorepoFixableIssue[]>(
    [],
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [results, setResults] = useState<FixResult[]>([]);
  const [currentFixIndex, setCurrentFixIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [projectName, setProjectName] = useState<string | undefined>();

  // Confirmation state
  const [confirmQueue, setConfirmQueue] = useState<MonorepoFixableIssue[]>([]);
  const [confirmIndex, setConfirmIndex] = useState(0);
  const [confirmedFixes, setConfirmedFixes] = useState<MonorepoFixableIssue[]>([]);

  // Phase 1: Run scan
  useEffect(() => {
    if (isMonorepo && packagePaths && packageNames) {
      // Monorepo: scan each package
      const pkgItems = packagePaths.map((p) => ({
        name: shortName(packageNames.get(p) ?? p),
        status: "pending" as const,
      }));
      setProgress(pkgItems);

      (async () => {
        try {
          const allFixable: MonorepoFixableIssue[] = [];

          for (const pkgPath of packagePaths) {
            const pkgName = packageNames.get(pkgPath) ?? pkgPath;
            const display = shortName(pkgName);

            setProgress((prev) =>
              prev.map((p) =>
                p.name === display ? { ...p, status: "running" } : p,
              ),
            );

            const report = await runSickbay({
              projectPath: pkgPath,
              checks,
              verbose,
            });

            const fixable = collectFixableIssues(report);
            for (const fix of fixable) {
              allFixable.push({
                ...fix,
                packageName: pkgName,
                packagePath: pkgPath,
              });
            }

            setProgress((prev) =>
              prev.map((p) =>
                p.name === display ? { ...p, status: "done" } : p,
              ),
            );
          }

          setFixableIssues(allFixable);

          const hasActionable = allFixable.some((f) => f.command);
          if (!hasActionable) {
            setPhase("done");
          } else if (applyAll) {
            setSelected(new Set(allFixable.map((_, i) => i)));
            startConfirmation(allFixable, new Set(allFixable.map((_, i) => i)), true);
          } else {
            setPhase("selecting");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setPhase("error");
          setTimeout(() => exit(), 100);
        }
      })();
    } else {
      // Single project scan
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

      runSickbay({
        projectPath,
        checks,
        verbose,
        onCheckStart: (name) => {
          setProgress((prev) =>
            prev.map((p) =>
              p.name === name ? { ...p, status: "running" } : p,
            ),
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
          const tagged = fixable.map((f) => ({
            ...f,
            packageName: r.projectInfo.name,
            packagePath: projectPath,
          }));
          setFixableIssues(tagged);

          const hasActionable = tagged.some((f) => f.command);
          if (!hasActionable) {
            setPhase("done");
          } else if (applyAll) {
            setSelected(new Set(fixable.map((_, i) => i)));
            startConfirmation(tagged, new Set(fixable.map((_, i) => i)), true);
          } else {
            setPhase("selecting");
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setPhase("error");
          setTimeout(() => exit(), 100);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start confirmation flow for selected actionable fixes
  function startConfirmation(
    issues: MonorepoFixableIssue[],
    selectedSet: Set<number>,
    isApplyAll: boolean,
  ) {
    // Only actionable fixes (with command) need confirmation
    const actionable = issues.filter((f, i) => selectedSet.has(i) && f.command);

    if (isApplyAll) {
      // --apply-all: skip tier-1, but still confirm tier-2 (modifiesSource)
      const tier2 = actionable.filter((f) => f.issue.fix?.modifiesSource);
      const autoApproved = actionable.filter((f) => !f.issue.fix?.modifiesSource);
      if (tier2.length === 0) {
        // No tier-2 confirms needed, go straight to fixing
        setConfirmedFixes(autoApproved);
        setPhase("fixing");
        return;
      }
      setConfirmedFixes(autoApproved);
      setConfirmQueue(tier2);
    } else {
      setConfirmedFixes([]);
      setConfirmQueue(actionable);
    }
    setConfirmIndex(0);

    if (actionable.length === 0) {
      // All selected are guidance-only
      setPhase("done");
      setTimeout(() => exit(), 100);
      return;
    }

    setPhase("confirming");
  }

  // Phase 3: Execute fixes
  useEffect(() => {
    if (phase !== "fixing") return;

    const toFix = confirmedFixes;
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
          const result = await executeFix(toFix[i], toFix[i].packagePath);
          fixResults.push(result);
        }
        setResults([...fixResults]);
      }
      setPhase("done");
      setTimeout(() => exit(), 100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Handle keyboard input during selection and confirmation phases
  const handleInput = useCallback(
    (
      input: string,
      key: { upArrow: boolean; downArrow: boolean; return: boolean },
    ) => {
      if (phase === "selecting") {
        const actionable = fixableIssues.filter((f) => f.command);

        if (key.upArrow) {
          setCursor((c) => Math.max(0, c - 1));
        } else if (key.downArrow) {
          setCursor((c) => Math.min(actionable.length - 1, c + 1));
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
          setSelected(new Set(actionable.map((_, i) => i)));
        } else if (input === "n") {
          setSelected(new Set());
        } else if (key.return) {
          if (selected.size > 0) {
            // Map selected indices back to the actionable items
            const selectedIssues = actionable.filter((_, i) => selected.has(i));
            startConfirmation(selectedIssues, new Set(selectedIssues.map((_, i) => i)), false);
          }
        }
      } else if (phase === "confirming") {
        const lower = input.toLowerCase();
        if (lower === "y" || key.return) {
          // Confirm current fix
          setConfirmedFixes((prev) => [...prev, confirmQueue[confirmIndex]]);
          if (confirmIndex + 1 < confirmQueue.length) {
            setConfirmIndex((i) => i + 1);
          } else {
            setPhase("fixing");
          }
        } else if (lower === "n") {
          // Skip current fix
          if (confirmIndex + 1 < confirmQueue.length) {
            setConfirmIndex((i) => i + 1);
          } else {
            setPhase("fixing");
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, cursor, selected, confirmIndex, confirmQueue, fixableIssues],
  );

  useInput(handleInput);

  const currentConfirmFix = confirmQueue[confirmIndex];
  const isTier2 = currentConfirmFix?.issue.fix?.modifiesSource;

  return (
    <Box flexDirection="column" padding={1}>
      <Header projectName={projectName} />

      {/* Scanning phase */}
      {phase === "scanning" && (
        <Box flexDirection="column">
          <Text dimColor>
            Scanning for fixable issues
            {isMonorepo ? ` across ${packagePaths?.length} packages` : ""}...
          </Text>
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
      {phase === "selecting" && (() => {
        const actionable = fixableIssues.filter((f) => f.command);
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="yellow">⚠ </Text>
              <Text dimColor>
                Sickbay can make mistakes. Review each fix before applying —
                false positives exist and some commands modify your project.
              </Text>
            </Box>
            <Text bold>
              Select fixes to apply ({actionable.length} available)
            </Text>
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              {actionable.map((fix, i) => (
                <Box key={`${fix.packageName}-${fix.checkId}-${fix.command}`}>
                  <Text color={i === cursor ? "cyan" : undefined}>
                    {i === cursor ? "❯ " : "  "}
                  </Text>
                  <Text color={i === cursor ? "cyan" : undefined}>
                    {selected.has(i) ? "[✓] " : "[ ] "}
                  </Text>
                  {isMonorepo && (
                    <Text color="magenta" dimColor>
                      [{shortName(fix.packageName)}]{" "}
                    </Text>
                  )}
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
        );
      })()}

      {/* Confirmation phase */}
      {phase === "confirming" && currentConfirmFix && (
        <Box flexDirection="column">
          <Text bold>
            Confirming fixes ({confirmIndex + 1}/{confirmQueue.length})
          </Text>
          <Box marginTop={1} marginLeft={2} flexDirection="column">
            <Text>
              {currentConfirmFix.issue.fix!.description} ({currentConfirmFix.command})
            </Text>
            {isTier2 ? (
              <Text color="yellow">⚠ This will modify source files. Proceed? (Y/n)</Text>
            ) : (
              <Text dimColor>→ Proceed? (Y/n)</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Fixing phase */}
      {phase === "fixing" && !dryRun && (
        <Box marginBottom={1}>
          <Text color="yellow">⚠ </Text>
          <Text dimColor>
            Sickbay can make mistakes — verify results afterwards and revert
            anything that looks wrong.
          </Text>
        </Box>
      )}
      {phase === "fixing" && (
        <Box flexDirection="column">
          <Text bold>
            {dryRun ? "Dry run" : "Applying fixes"}... ({results.length}/
            {confirmedFixes.length})
          </Text>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {results.map((r) => (
              <Box key={`${r.fixable.checkId}-${r.fixable.command ?? r.fixable.issue.fix?.description}`} flexDirection="column">
                <Box>
                  <Text color={r.success ? "green" : "red"}>
                    {r.success ? "✓" : "✗"}{" "}
                  </Text>
                  {isMonorepo && (
                    <Text color="magenta" dimColor>
                      [{shortName((r.fixable as MonorepoFixableIssue).packageName)}]{" "}
                    </Text>
                  )}
                  <Text>{r.fixable.issue.fix!.description}</Text>
                </Box>
                {r.success && r.fixable.issue.fix?.nextSteps && (
                  <Box marginLeft={2}>
                    <Text dimColor>  → Next: {r.fixable.issue.fix.nextSteps}</Text>
                  </Box>
                )}
              </Box>
            ))}
            {results.length < confirmedFixes.length && (
              <Box>
                <Text color="green">
                  <Spinner type="dots" />
                </Text>
                <Text>
                  {" "}
                  {confirmedFixes[currentFixIndex]?.issue.fix!.description}
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Done phase */}
      {phase === "done" && (
        <Box flexDirection="column">
          {results.length === 0 ? (
            <Box flexDirection="column">
              <Box>
                <Text color="green">✓ </Text>
                <Text>
                  No auto-fixable issues found
                  {isMonorepo ? " across any package" : ""}
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  Run <Text color="cyan">sickbay</Text> to see the full report — there may be issues that require manual attention.
                </Text>
              </Box>
            </Box>
          ) : (
            <>
              <Text bold>{dryRun ? "Dry Run Results" : "Fix Results"}</Text>
              <Box flexDirection="column" marginTop={1} marginLeft={2}>
                {results.map((r) => (
                  <Box key={`${r.fixable.checkId}-${r.fixable.command ?? r.fixable.issue.fix?.description}`} flexDirection="column">
                    <Box>
                      <Text color={r.success ? "green" : "red"}>
                        {r.success ? "✓" : "✗"}{" "}
                      </Text>
                      {isMonorepo && (
                        <Text color="magenta" dimColor>
                          [{shortName((r.fixable as MonorepoFixableIssue).packageName)}]{" "}
                        </Text>
                      )}
                      <Text>{r.fixable.issue.fix!.description}</Text>
                      {r.duration > 0 && (
                        <Text dimColor> ({r.duration}ms)</Text>
                      )}
                    </Box>
                    {r.success && r.fixable.issue.fix?.nextSteps && (
                      <Box marginLeft={2}>
                        <Text dimColor>  → Next: {r.fixable.issue.fix.nextSteps}</Text>
                      </Box>
                    )}
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
                  <Text color="cyan">sickbay</Text>
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
