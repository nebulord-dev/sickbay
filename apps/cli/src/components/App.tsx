import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import type { VitalsReport } from "@vitals/core";
import { runVitals } from "@vitals/core";
import { Header } from "./Header.js";
import { ProgressList } from "./ProgressList.js";
import { CheckResultRow } from "./CheckResult.js";
import { Summary } from "./Summary.js";
import { QuickWins } from "./QuickWins.js";

interface AppProps {
  projectPath: string;
  checks?: string[];
  openWeb?: boolean;
  enableAI?: boolean;
  verbose?: boolean;
}

type Phase = "loading" | "results" | "opening-web" | "error";

interface ProgressItem {
  name: string;
  status: "pending" | "running" | "done";
}

export function App({
  projectPath,
  checks,
  openWeb,
  enableAI,
  verbose,
}: AppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("loading");
  const [report, setReport] = useState<VitalsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double execution (React 18+ can run effects twice in dev/certain conditions)
    if (hasRun.current) return;
    hasRun.current = true;
    runVitals({
      projectPath,
      checks,
      verbose,
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

        // Auto-save to trend history
        try {
          const { saveEntry } = await import("../lib/history.js");
          saveEntry(r);
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
          <Text dimColor>Running health checks...</Text>
          <Box marginTop={1} marginLeft={2}>
            <ProgressList items={progress} />
          </Box>
        </Box>
      )}

      {phase === "error" && (
        <Box>
          <Text color="red">✗ Error: {error}</Text>
        </Box>
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
            <Text color="cyan">vitals --web</Text>
          </Box>
        </Box>
      )}

      {phase === "opening-web" && report && (
        <Box flexDirection="column">
          {report.checks.filter((c) => c.status !== "skipped").map((check) => (
            <CheckResultRow key={check.id} result={check} />
          ))}
          <Summary report={report} />
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
