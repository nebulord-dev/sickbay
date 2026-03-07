import { useState, lazy, Suspense, useEffect, useRef, useCallback } from "react";
import type { VitalsReport, MonorepoReport, PackageReport } from "@vitals/core";
import { SCORE_GOOD, SCORE_FAIR } from "@vitals/constants";

function getScoreColor(score: number) {
  if (score >= SCORE_GOOD) return "green";
  if (score >= SCORE_FAIR) return "yellow";
  return "red";
}

function getMeta(report: VitalsReport, id: string): Record<string, unknown> {
  return (report.checks.find((c) => c.id === id)?.metadata ?? {}) as Record<
    string,
    unknown
  >;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

import { ScoreCard } from "./ScoreCard.js";
import { IssuesList } from "./IssuesList.js";
import { DependencyList } from "./DependencyList.js";
import { CodebaseStats } from "./CodebaseStats.js";
import { About } from "./About.js";
import { AISummary } from "./AISummary.js";
import { CriticalIssues } from "./CriticalIssues.js";
import { HistoryChart } from "./HistoryChart.js";
import type { TrendHistory } from "./HistoryChart.js";

// Lazy load heavy components
const ChatDrawer = lazy(() =>
  import("./ChatDrawer.js").then((m) => ({ default: m.ChatDrawer })),
);

interface DashboardProps {
  report: VitalsReport | MonorepoReport;
}

type View = "overview" | "issues" | "dependencies" | "codebase" | "history" | "about";

function isMonorepoReport(r: VitalsReport | MonorepoReport): r is MonorepoReport {
  return "isMonorepo" in r;
}

/** Build a minimal VitalsReport from a PackageReport for use in existing Dashboard components */
function packageReportToVitalsReport(pkg: PackageReport, parentReport: MonorepoReport): VitalsReport {
  return {
    timestamp: parentReport.timestamp,
    projectPath: pkg.path,
    projectInfo: {
      name: pkg.name,
      version: "unknown",
      hasTypeScript: false,
      hasESLint: false,
      hasPrettier: false,
      framework: pkg.framework,
      packageManager: parentReport.packageManager,
      totalDependencies: Object.keys(pkg.dependencies).length + Object.keys(pkg.devDependencies).length,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
    },
    checks: pkg.checks,
    overallScore: pkg.score,
    summary: pkg.summary,
  };
}

export function Dashboard({ report }: DashboardProps) {
  const monorepo = isMonorepoReport(report) ? report : null;
  // For monorepo: -1 = overview, 0..n-1 = package index
  const [selectedPackageIdx, setSelectedPackageIdx] = useState(-1);

  // Resolve the active single-project report: from monorepo package or direct
  const activeReport: VitalsReport | null = monorepo
    ? selectedPackageIdx >= 0
      ? packageReportToVitalsReport(monorepo.packages[selectedPackageIdx], monorepo)
      : null
    : (report as VitalsReport);
  const [view, setView] = useState<View>("overview");
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [history, setHistory] = useState<TrendHistory | null>(null);
  const historyFetched = useRef(false);
  const scoreColor = getScoreColor(activeReport?.overallScore ?? report.overallScore);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Reset view when switching packages
  useEffect(() => {
    setView("overview");
    setSelectedCheck(null);
    setIsAIDrawerOpen(false);
  }, [selectedPackageIdx]);

  // Scroll to top when view changes
  useEffect(() => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  // Lazily fetch history when History tab is first activated
  const fetchHistory = useCallback(() => {
    if (historyFetched.current) return;
    historyFetched.current = true;
    fetch("/vitals-history.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TrendHistory | null) => {
        if (data && Array.isArray(data.entries) && data.entries.length > 0) {
          setHistory(data);
        }
      })
      .catch(() => {/* no history available */});
  }, []);

  const complexityMeta = activeReport ? getMeta(activeReport, "complexity") : {};
  const gitMeta = activeReport ? getMeta(activeReport, "git") : {};
  const coverageMeta = activeReport ? getMeta(activeReport, "coverage") : {};

  const filteredChecks = activeReport
    ? selectedCheck
      ? activeReport.checks.filter((c) => c.id === selectedCheck)
      : activeReport.checks
    : [];

  const handleCriticalCheckClick = (checkId: string) => {
    setSelectedCheck(checkId);
    setView("overview");
  };

  const displayReport = activeReport ?? report;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border flex flex-col shrink-0 bg-surface">
        <div className="p-4 border-b border-border">
          <div className="text-green-400 font-bold text-xl tracking-wider">
            VITALS
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            {monorepo ? "Monorepo Health Dashboard" : "Project Health Dashboard"}
          </div>
        </div>

        {monorepo ? (
          /* Monorepo sidebar: package list */
          <>
            <div className="p-4 border-b border-border">
              <div className="text-xs text-gray-500 mb-1">monorepo</div>
              <div className="font-semibold text-sm">{monorepo.monorepoType} workspaces</div>
              <div className="text-xs text-gray-500">{monorepo.packages.length} packages · {monorepo.packageManager}</div>
            </div>
            <div className="p-4 border-b border-border">
              <div className="text-xs text-gray-500 mb-2">overall score</div>
              <div className={`text-4xl font-bold ${scoreColor === "green" ? "text-green-400" : scoreColor === "yellow" ? "text-yellow-400" : "text-red-400"}`}>
                {monorepo.overallScore}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-red-400">{monorepo.summary.critical} critical</span>
                {" · "}
                <span className="text-yellow-400">{monorepo.summary.warnings} warnings</span>
              </div>
            </div>
            <nav className="p-2 flex-1 overflow-y-auto">
              <div className="text-xs text-gray-500 px-2 py-1">packages</div>
              <button
                onClick={() => setSelectedPackageIdx(-1)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors
                  ${selectedPackageIdx === -1 ? "bg-card text-white" : "text-gray-400 hover:text-white hover:bg-card/50"}`}
              >
                <span className="font-mono">overview</span>
              </button>
              {monorepo.packages.map((pkg, i) => {
                const color = pkg.score >= SCORE_GOOD ? "text-green-400" : pkg.score >= SCORE_FAIR ? "text-yellow-400" : "text-red-400";
                return (
                  <button
                    key={pkg.path}
                    onClick={() => setSelectedPackageIdx(i)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors
                      ${selectedPackageIdx === i ? "bg-card text-white" : "text-gray-400 hover:text-white hover:bg-card/50"}`}
                  >
                    <span className="font-mono truncate text-left">{pkg.name}</span>
                    <span className={`text-xs font-bold ml-2 shrink-0 ${color}`}>{pkg.score}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border text-xs text-gray-600">
              {new Date(monorepo.timestamp).toLocaleString()}
            </div>
          </>
        ) : activeReport ? (
          /* Single-project sidebar */
          <>
            <div className="p-4 border-b border-border">
              <div className="text-xs text-gray-500 mb-1">project</div>
              <div className="font-semibold">{activeReport.projectInfo.name}</div>
              <div className="text-xs text-gray-500">
                v{activeReport.projectInfo.version}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {activeReport.projectInfo.framework} · {activeReport.projectInfo.packageManager}
              </div>
              <div className="text-xs text-gray-500">
                {activeReport.projectInfo.totalDependencies} deps
              </div>
            </div>

            {/* Stats strip */}
            <div className="px-4 py-3 border-b border-border grid grid-cols-2 gap-x-3 gap-y-2">
              {complexityMeta.totalFiles != null && (
                <>
                  <div>
                    <div className="text-xs text-gray-500">files</div>
                    <div className="text-sm font-mono font-semibold">
                      {fmt(complexityMeta.totalFiles as number)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">lines</div>
                    <div className="text-sm font-mono font-semibold">
                      {fmt(complexityMeta.totalLines as number)}
                    </div>
                  </div>
                </>
              )}
              {gitMeta.contributorCount != null && (
                <>
                  <div>
                    <div className="text-xs text-gray-500">contributors</div>
                    <div className="text-sm font-mono font-semibold">
                      {String(gitMeta.contributorCount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">last commit</div>
                    <div className="text-sm font-mono font-semibold truncate">
                      {String(gitMeta.lastCommit)}
                    </div>
                  </div>
                </>
              )}
              {coverageMeta.lines != null && (
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">coverage</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-card rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-green-400"
                        style={{ width: `${coverageMeta.lines}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-semibold">
                      {Math.round(coverageMeta.lines as number)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-b border-border">
              <div className="text-xs text-gray-500 mb-2">overall score</div>
              <div
                className={`text-4xl font-bold ${scoreColor === "green" ? "text-green-400" : scoreColor === "yellow" ? "text-yellow-400" : "text-red-400"}`}
              >
                {activeReport.overallScore}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-red-400">
                  {activeReport.summary.critical} critical
                </span>
                {" · "}
                <span className="text-yellow-400">
                  {activeReport.summary.warnings} warnings
                </span>
                {" · "}
                <span className="text-gray-400">{activeReport.summary.info} info</span>
              </div>
            </div>

            <nav className="p-2 flex-1 overflow-y-auto">
              <div className="text-xs text-gray-500 px-2 py-1">checks</div>
              {activeReport.checks.map((check) => {
                const color =
                  check.score >= SCORE_GOOD
                    ? "text-green-400"
                    : check.score >= SCORE_FAIR
                      ? "text-yellow-400"
                      : "text-red-400";
                return (
                  <button
                    key={check.id}
                    onClick={() => {
                      setSelectedCheck(
                        selectedCheck === check.id ? null : check.id,
                      );
                      setView("issues");
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors
                      ${selectedCheck === check.id ? "bg-card text-white" : "text-gray-400 hover:text-white hover:bg-card/50"}`}
                  >
                    <span className="font-mono">{check.name}</span>
                    <span className={`text-xs font-bold ${color}`}>
                      {check.score}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-border text-xs text-gray-600">
              {new Date(activeReport.timestamp).toLocaleString()}
            </div>
          </>
        ) : null}
      </aside>

      {/* Main content */}
      <main ref={mainContentRef} className="flex-1 overflow-y-auto">
        {/* Monorepo overview mode — show MonorepoOverview */}
        {monorepo && selectedPackageIdx === -1 ? (
          <MonorepoOverviewWrapper report={monorepo} onSelectPackage={setSelectedPackageIdx} />
        ) : activeReport ? (
          <>
            <div className="p-4 border-b border-border flex items-center">
              <div className="flex gap-2 flex-1">
                {(["overview", "issues", "dependencies", "codebase"] as View[]).map(
                  (v) => (
                    <button
                      key={v}
                      onClick={() => {
                        setView(v);
                        if (v === "overview") {
                          setSelectedCheck(null);
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm font-mono transition-colors
                      ${view === v ? "bg-accent text-black font-semibold" : "text-gray-400 hover:text-white"}`}
                    >
                      {v}
                    </button>
                  ),
                )}
                {/* History tab only for root single-project (not per-package in monorepo) */}
                {!monorepo && (
                  <button
                    onClick={() => {
                      setView("history");
                      fetchHistory();
                    }}
                    className={`px-3 py-1 rounded text-sm font-mono transition-colors
                      ${view === "history" ? "bg-accent text-black font-semibold" : "text-gray-400 hover:text-white"}`}
                  >
                    history
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {(!monorepo || selectedPackageIdx >= 0) && (
                  <button
                    onClick={() => setIsAIDrawerOpen(!isAIDrawerOpen)}
                    className={`px-3 py-1 rounded text-sm font-mono transition-colors flex items-center gap-1.5
                      ${isAIDrawerOpen ? "bg-purple-500/20 text-purple-300 font-semibold" : "text-gray-400 hover:text-white"}`}
                  >
                    <span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          d="M9.6 6.112c.322-.816 1.478-.816 1.8 0l.91 2.31a5.8 5.8 0 0 0 3.268 3.268l2.31.91c.816.322.816 1.478 0 1.8l-2.31.91a5.8 5.8 0 0 0-3.268 3.268l-.91 2.31c-.322.816-1.478.816-1.8 0l-.91-2.31a5.8 5.8 0 0 0-3.268-3.268l-2.31-.91c-.816-.322-.816-1.478 0-1.8l2.31-.91A5.8 5.8 0 0 0 8.69 8.422zm8.563-3.382a.363.363 0 0 1 .674 0l.342.866c.221.56.665 1.004 1.225 1.225l.866.342a.363.363 0 0 1 0 .674l-.866.342a2.18 2.18 0 0 0-1.225 1.225l-.342.866a.363.363 0 0 1-.674 0l-.342-.866a2.18 2.18 0 0 0-1.225-1.225l-.867-.342a.363.363 0 0 1 0-.674l.867-.342a2.18 2.18 0 0 0 1.225-1.225z"
                        />
                      </svg>
                    </span>
                    <span>ai insights</span>
                  </button>
                )}
                <button
                  onClick={() => setView("about")}
                  className={`px-3 py-1 rounded text-sm font-mono transition-colors
                    ${view === "about" ? "bg-accent text-black font-semibold" : "text-gray-400 hover:text-white"}`}
                >
                  about
                </button>
              </div>
            </div>

            <div className="p-6">
              {view === "overview" && (
                <>
                  <CriticalIssues
                    report={activeReport}
                    onCheckClick={handleCriticalCheckClick}
                  />
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredChecks.map((check) => (
                      <ScoreCard
                        key={check.id}
                        check={check}
                        onClick={() => {
                          setSelectedCheck(
                            selectedCheck === check.id ? null : check.id,
                          );
                          setView("overview");
                        }}
                        active={selectedCheck === check.id}
                      />
                    ))}
                  </div>
                </>
              )}

              {view === "issues" && <IssuesList checks={filteredChecks} />}

              {view === "dependencies" && <DependencyList report={activeReport} />}

              {view === "codebase" && <CodebaseStats report={activeReport} />}

              {view === "history" && !monorepo && (
                history
                  ? <HistoryChart history={history} />
                  : (
                    <div className="flex items-center justify-center h-48 text-gray-500 text-sm font-mono">
                      No history found — run <code className="mx-1 px-1 bg-card rounded">vitals init</code> then scan at least once
                    </div>
                  )
              )}

              {view === "about" && <About report={activeReport} />}
            </div>
          </>
        ) : null}
      </main>

      {/* AI Insights Drawer */}
      {activeReport && (!monorepo || selectedPackageIdx >= 0) && (
        <AISummary
          report={activeReport}
          isOpen={isAIDrawerOpen}
          onToggle={setIsAIDrawerOpen}
          packageName={monorepo ? monorepo.packages[selectedPackageIdx]?.name : undefined}
        />
      )}

      {/* AI Chat Drawer */}
      {activeReport && (!monorepo || selectedPackageIdx >= 0) && (
        <Suspense fallback={null}>
          <ChatDrawer
            report={activeReport}
            packageName={monorepo ? monorepo.packages[selectedPackageIdx]?.name : undefined}
          />
        </Suspense>
      )}
    </div>
  );
}

/** Thin wrapper that lazily loads MonorepoOverview to avoid bundling it in the main chunk */
function MonorepoOverviewWrapper({
  report,
  onSelectPackage,
}: {
  report: MonorepoReport;
  onSelectPackage: (idx: number) => void;
}) {
  const MonorepoOverview = lazy(() =>
    import("./MonorepoOverview.js").then((m) => ({ default: m.MonorepoOverview })),
  );
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading overview...</div>}>
      <MonorepoOverview report={report} onSelectPackage={onSelectPackage} />
    </Suspense>
  );
}
