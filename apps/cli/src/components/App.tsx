import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import type { SickbayReport, MonorepoReport, PackageReport } from "@sickbay/core";
import { runSickbay, runSickbayMonorepo } from "@sickbay/core";
import { Header } from "./Header.js";
import { ProgressList } from "./ProgressList.js";
import { CheckResultRow } from "./CheckResult.js";
import { Summary } from "./Summary.js";
import { QuickWins } from "./QuickWins.js";
import { LOADING_MESSAGES } from "../lib/messages.js";

interface AppProps {
  projectPath: string;
  checks?: string[];
  openWeb?: boolean;
  enableAI?: boolean;
  verbose?: boolean;
  quotes?: boolean;
  isMonorepo?: boolean;
}

type Phase = "loading" | "results" | "opening-web" | "error";


interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

function scoreBar(score: number, width = 10): string {
  const filled = Math.round((score / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function App({
  projectPath,
  checks,
  openWeb,
  enableAI,
  verbose,
  quotes,
  isMonorepo,
}: AppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("loading");
  const [report, setReport] = useState<SickbayReport | null>(null);
  const [monorepoReport, setMonorepoReport] = useState<MonorepoReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const [scanningPackage, setScanningPackage] = useState<string | undefined>();
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!isMonorepo) return;
    const id = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isMonorepo]);

  useEffect(() => {
    // Prevent double execution (React 18+ can run effects twice in dev/certain conditions)
    if (hasRun.current) return;
    hasRun.current = true;

    if (isMonorepo) {
      runSickbayMonorepo({
        projectPath,
        checks,
        verbose,
        quotes,
        onPackageStart: (name) => setScanningPackage(name),
        onPackageComplete: () => setScanningPackage(undefined),
      })
        .then(async (r) => {
          setMonorepoReport(r);
          setProjectName(`monorepo (${r.packages.length} packages)`);

          if (openWeb) {
            setPhase("opening-web");
            try {
              const { serveWeb } = await import("../commands/web.js");
              const { default: openBrowser } = await import("open");

              let aiService;
              if (enableAI && process.env.ANTHROPIC_API_KEY) {
                const { createAIService } = await import("../services/ai.js");
                aiService = createAIService(process.env.ANTHROPIC_API_KEY);
              }

              const url = await serveWeb(r, 3030, aiService);
              setWebUrl(url);
              await openBrowser(url);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
              setPhase("error");
              setTimeout(() => exit(), 100);
            }
          } else {
            setPhase("results");
            setTimeout(() => exit(), 100);
          }
        })
        .catch((err) => {
          setError(err.message ?? String(err));
          setPhase("error");
          setTimeout(() => exit(err), 100);
        });
      return;
    }

    runSickbay({
      projectPath,
      checks,
      verbose,
      quotes,
      onRunnersReady: (names) => {
        setProgress(names.map((name) => ({ name, status: "pending" as const })));
      },
      onCheckStart: (name) => {
        setProgress((prev) =>
          prev.map((p) => (p.name === name ? { ...p, status: "running" } : p)),
        );
      },
      onCheckComplete: (result) => {
        if (result.status === "skipped") {
          setProgress((prev) => prev.filter((p) => p.name !== result.id));
        } else {
          setProgress((prev) =>
            prev.map((p) =>
              p.name === result.id ? { ...p, status: "done" } : p,
            ),
          );
        }
      },
    })
      .then(async (r) => {
        setProjectName(r.projectInfo.name);
        setReport(r);

        // Auto-save to trend history and last-report snapshot
        try {
          const { saveEntry, saveLastReport } = await import("../lib/history.js");
          saveEntry(r);
          saveLastReport(r);
        } catch {
          // Non-critical — silently ignore history save failures
        }

        if (openWeb) {
          setPhase("opening-web");
          try {
            const { serveWeb } = await import("../commands/web.js");
            const { default: openBrowser } = await import("open");

            // Create AI service if enabled and API key exists
            let aiService;
            if (enableAI && process.env.ANTHROPIC_API_KEY) {
              const { createAIService } = await import("../services/ai.js");
              aiService = createAIService(process.env.ANTHROPIC_API_KEY);
            }

            const url = await serveWeb(r, 3030, aiService);
            setWebUrl(url);
            await openBrowser(url);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setPhase("error");
            setTimeout(() => exit(), 100);
            return;
          }
          // Keep process alive — user closes with Ctrl+C
        } else {
          setPhase("results");
          setTimeout(() => exit(), 100);
        }
      })
      .catch((err) => {
        setError(err.message ?? String(err));
        setPhase("error");
        setTimeout(() => exit(err), 100);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Header projectName={projectName} />

      {phase === "loading" && (
        <Box flexDirection="column">
          {isMonorepo ? (
            <Box flexDirection="column">
              <Box>
                <Text color="magenta"><Spinner type="dots" /></Text>
                <Text dimColor> {LOADING_MESSAGES[loadingMsgIdx]}</Text>
              </Box>
              {scanningPackage && (
                <Box marginTop={1} marginLeft={2}>
                  <Text dimColor>→ </Text>
                  <Text color="cyan">{scanningPackage}</Text>
                </Box>
              )}
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>Running health checks...</Text>
              <Box marginTop={1} marginLeft={2}>
                <ProgressList items={progress} />
              </Box>
            </Box>
          )}
        </Box>
      )}

      {phase === "error" && (
        <Box>
          <Text color="red">✗ Error: {error}</Text>
        </Box>
      )}

      {phase === "results" && monorepoReport && (
        <MonorepoSummaryTable report={monorepoReport} />
      )}

      {phase === "results" && report && (
        <Box flexDirection="column">
          {report.checks.filter((c) => c.status !== "skipped").map((check) => (
            <CheckResultRow key={check.id} result={check} />
          ))}
          <Summary report={report} />
          <QuickWins report={report} />
          <Box marginTop={1}>
            <Text dimColor>View detailed report: </Text>
            <Text color="cyan">sickbay --web</Text>
          </Box>
        </Box>
      )}

      {phase === "opening-web" && (monorepoReport ?? report) && (
        <Box flexDirection="column">
          {monorepoReport ? (
            <MonorepoSummaryTable report={monorepoReport} />
          ) : report ? (
            <>
              {report.checks.filter((c) => c.status !== "skipped").map((check) => (
                <CheckResultRow key={check.id} result={check} />
              ))}
              <Summary report={report} />
            </>
          ) : null}
          <Box marginTop={1}>
            {webUrl ? (
              <>
                <Text color="green">✓ Dashboard running at </Text>
                <Text color="cyan">{webUrl}</Text>
                <Text dimColor> (Ctrl+C to stop)</Text>
              </>
            ) : (
              <Text>
                <Text color="magenta">
                  <Spinner type="dots" />
                </Text>{" "}
                <Gradient name="retro">
                  Launching dashboard with AI insights...
                </Gradient>
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function MonorepoSummaryTable({ report }: { report: MonorepoReport }) {
  const scoreColor = (score: number) =>
    score >= 80 ? "green" : score >= 60 ? "yellow" : "red";

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Monorepo · </Text>
        <Text dimColor>{report.monorepoType} workspaces · </Text>
        <Text>{report.packages.length} packages</Text>
      </Box>
      {report.packages.map((pkg: PackageReport) => (
        <Box key={pkg.path} marginLeft={2} gap={1}>
          <Text color={scoreColor(pkg.score)}>{scoreBar(pkg.score)}</Text>
          <Text bold color={scoreColor(pkg.score)}>{String(pkg.score).padStart(3)}</Text>
          <Text>{pkg.name}</Text>
          <Text dimColor>{pkg.framework}</Text>
          {pkg.summary.critical > 0 && (
            <Text color="red">  {pkg.summary.critical} critical</Text>
          )}
        </Box>
      ))}
      <Box marginTop={1} gap={2}>
        <Text bold>Overall: </Text>
        <Text color={scoreColor(report.overallScore)} bold>{report.overallScore}</Text>
        <Text dimColor>· </Text>
        <Text color="red">{report.summary.critical} critical</Text>
        <Text dimColor>· </Text>
        <Text color="yellow">{report.summary.warnings} warnings</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Per-package details: </Text>
        <Text color="cyan">sickbay --web</Text>
      </Box>
    </Box>
  );
}
