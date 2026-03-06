import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useInput } from "ink";
import type { VitalsReport } from "@vitals/core";
import { PanelBorder } from "./PanelBorder.js";
import { HotkeyBar, type PanelId } from "./HotkeyBar.js";
import { HealthPanel } from "./HealthPanel.js";
import { ScorePanel } from "./ScorePanel.js";
import { TrendPanel } from "./TrendPanel.js";
import { GitPanel } from "./GitPanel.js";
import { QuickWinsPanel } from "./QuickWinsPanel.js";
import { ActivityPanel, type ActivityEntry } from "./ActivityPanel.js";
import { useVitalsRunner } from "./hooks/useVitalsRunner.js";
import { useFileWatcher } from "./hooks/useFileWatcher.js";
import { useTerminalSize } from "./hooks/useTerminalSize.js";

interface TuiAppProps {
  projectPath: string;
  checks?: string[];
  watchEnabled: boolean;
  refreshInterval: number;
}

export function TuiApp({
  projectPath,
  checks,
  watchEnabled,
  refreshInterval,
}: TuiAppProps) {
  const { rows, columns } = useTerminalSize();
  const { report, isScanning, progress, scan } = useVitalsRunner({
    projectPath,
    checks,
  });

  const [focusedPanel, setFocusedPanel] = useState<PanelId | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<PanelId | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [healthScrollOffset, setHealthScrollOffset] = useState(0);
  const refreshRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const reportRef = useRef<VitalsReport | null>(null);

  // Keep reportRef in sync
  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  const addActivity = useCallback(
    (type: ActivityEntry["type"], message: string) => {
      setActivityLog((prev) => [
        ...prev,
        { timestamp: new Date(), type, message },
      ]);
    },
    [],
  );

  const handleScanComplete = useCallback(
    async (result: VitalsReport) => {
      const prevScore = reportRef.current?.overallScore ?? null;
      if (prevScore !== null) setPreviousScore(prevScore);
      setLastScanTime(new Date());

      const delta =
        prevScore !== null ? result.overallScore - prevScore : null;
      addActivity(
        "scan-complete",
        `Scan complete: ${result.overallScore}/100${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta})` : ""}`,
      );

      // Check for regressions
      try {
        const { loadHistory, detectRegressions } = await import(
          "../../lib/history.js"
        );
        const history = loadHistory(projectPath);
        if (history) {
          const regressions = detectRegressions(history.entries);
          for (const reg of regressions) {
            addActivity(
              "regression",
              `\u26A0 ${reg.category} regressed: ${reg.from} \u2192 ${reg.to}`,
            );
          }
        }
      } catch {
        // Non-critical
      }
    },
    [addActivity, projectPath],
  );

  // Initial scan
  useEffect(() => {
    addActivity("info", "TUI started");
    addActivity("scan-start", "Starting initial health scan...");
    scan().then((result) => {
      if (result) handleScanComplete(result);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (refreshInterval <= 0) return;
    refreshRef.current = setInterval(async () => {
      addActivity("scan-start", "Auto-scan triggered");
      const result = await scan();
      if (result) handleScanComplete(result);
    }, refreshInterval * 1000);

    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [refreshInterval, scan, handleScanComplete, addActivity]);

  // File watcher
  useFileWatcher({
    projectPath,
    enabled: watchEnabled,
    onFilesChanged: async (files) => {
      for (const f of files.slice(0, 3)) {
        addActivity("file-change", `File changed: ${f}`);
      }
      if (files.length > 3) {
        addActivity("file-change", `...and ${files.length - 3} more files`);
      }
      addActivity("scan-start", "Re-scan triggered (file change)");
      const result = await scan();
      if (result) handleScanComplete(result);
    },
  });

  // Manual re-scan
  const triggerRescan = useCallback(async () => {
    addActivity("scan-start", "Manual re-scan triggered");
    const result = await scan();
    if (result) handleScanComplete(result);
  }, [addActivity, scan, handleScanComplete]);

  // Keyboard input — only active when stdin supports raw mode (interactive TTY)
  const isTTY = !!(process.stdin.isTTY && process.stdin.setRawMode);
  useInput((input, key) => {
    // Expanded panel: escape or f to exit
    if (expandedPanel) {
      if (key.escape || input === "f") {
        setExpandedPanel(null);
        return;
      }
    }

    // Panel focus toggles
    if (input === "h")
      setFocusedPanel((prev) => (prev === "health" ? null : "health"));
    else if (input === "g")
      setFocusedPanel((prev) => (prev === "git" ? null : "git"));
    else if (input === "t")
      setFocusedPanel((prev) => (prev === "trend" ? null : "trend"));
    else if (input === "q")
      setFocusedPanel((prev) => (prev === "quickwins" ? null : "quickwins"));
    else if (input === "a")
      setFocusedPanel((prev) => (prev === "activity" ? null : "activity"));
    else if (input === "r") triggerRescan();
    else if (input === "f" && focusedPanel) setExpandedPanel(focusedPanel);
    else if (input === "w" || input === "W") {
      const withAI = input === "W";
      (async () => {
        if (!reportRef.current) return;
        try {
          const { serveWeb } = await import("../../commands/web.js");
          const { default: openBrowser } = await import("open");

          let aiService;
          if (withAI && process.env.ANTHROPIC_API_KEY) {
            const { createAIService } = await import("../../services/ai.js");
            aiService = createAIService(process.env.ANTHROPIC_API_KEY);
            addActivity("info", "Launching web dashboard with AI...");
          } else {
            addActivity("info", "Launching web dashboard...");
          }

          const url = await serveWeb(reportRef.current, 3030, aiService);
          await openBrowser(url);
          addActivity("info", `Web dashboard at ${url}${withAI && aiService ? " (AI enabled)" : ""}`);
        } catch (err) {
          addActivity(
            "info",
            `Failed to open web: ${err instanceof Error ? err.message : err}`,
          );
        }
      })();
    } else if (key.escape) {
      setFocusedPanel(null);
    }

    // Scrolling in focused health panel
    if (focusedPanel === "health") {
      if (key.upArrow)
        setHealthScrollOffset((prev) => Math.max(0, prev - 1));
      if (key.downArrow) {
        const maxOffset = Math.max(0, (report?.checks.length ?? 0) - 5);
        setHealthScrollOffset((prev) => Math.min(maxOffset, prev + 1));
      }
    }
  }, { isActive: isTTY });

  // Layout calculations
  const topHeight = Math.floor((rows - 1) * 0.6);
  const bottomHeight = rows - 1 - topHeight;

  // Full-screen expand mode
  if (expandedPanel) {
    return (
      <Box flexDirection="column" width={columns} height={rows}>
        <Box flexGrow={1}>
          {expandedPanel === "health" && (
            <PanelBorder title="HEALTH CHECKS" color="green" focused>
              <HealthPanel
                checks={report?.checks ?? []}
                isScanning={isScanning}
                progress={progress}
                scrollOffset={healthScrollOffset}
                availableHeight={rows - 4}
              />
            </PanelBorder>
          )}
          {expandedPanel === "git" && (
            <PanelBorder title="GIT STATUS" color="yellow" focused>
              <GitPanel projectPath={projectPath} />
            </PanelBorder>
          )}
          {expandedPanel === "trend" && (
            <PanelBorder title="TREND" color="magenta" focused>
              <TrendPanel
                projectPath={projectPath}
                lastScanTime={lastScanTime}
              />
            </PanelBorder>
          )}
          {expandedPanel === "quickwins" && (
            <PanelBorder title="QUICK WINS" color="red" focused>
              <QuickWinsPanel report={report} />
            </PanelBorder>
          )}
          {expandedPanel === "activity" && (
            <PanelBorder title="ACTIVITY" color="cyan" focused>
              <ActivityPanel
                entries={activityLog}
                availableHeight={rows - 4}
              />
            </PanelBorder>
          )}
        </Box>
        <HotkeyBar activePanel={expandedPanel} />
      </Box>
    );
  }

  // Normal grid layout
  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {/* Top Row */}
      <Box height={topHeight}>
        <Box width="55%">
          <PanelBorder
            title="HEALTH CHECKS"
            color="green"
            focused={focusedPanel === "health"}
          >
            <HealthPanel
              checks={report?.checks ?? []}
              isScanning={isScanning}
              progress={progress}
              scrollOffset={healthScrollOffset}
              availableHeight={topHeight - 4}
            />
          </PanelBorder>
        </Box>
        <Box width="45%" flexDirection="column">
          <Box height="50%">
            <PanelBorder title="SCORE" color="blue">
              <ScorePanel report={report} previousScore={previousScore} />
            </PanelBorder>
          </Box>
          <Box height="50%">
            <PanelBorder
              title="TREND"
              color="magenta"
              focused={focusedPanel === "trend"}
            >
              <TrendPanel
                projectPath={projectPath}
                lastScanTime={lastScanTime}
                availableHeight={Math.floor(topHeight / 2) - 3}
              />
            </PanelBorder>
          </Box>
        </Box>
      </Box>

      {/* Bottom Row */}
      <Box height={bottomHeight}>
        <Box width="25%">
          <PanelBorder
            title="GIT STATUS"
            color="yellow"
            focused={focusedPanel === "git"}
          >
            <GitPanel projectPath={projectPath} />
          </PanelBorder>
        </Box>
        <Box width="30%">
          <PanelBorder
            title="QUICK WINS"
            color="red"
            focused={focusedPanel === "quickwins"}
          >
            <QuickWinsPanel
              report={report}
              availableWidth={Math.floor(columns * 0.30) - 4}
            />
          </PanelBorder>
        </Box>
        <Box width="45%">
          <PanelBorder
            title="ACTIVITY"
            color="cyan"
            focused={focusedPanel === "activity"}
          >
            <ActivityPanel
              entries={activityLog}
              availableHeight={bottomHeight - 4}
            />
          </PanelBorder>
        </Box>
      </Box>

      {/* Hotkey Bar */}
      <HotkeyBar activePanel={focusedPanel} />
    </Box>
  );
}
