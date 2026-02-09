import React, { useState } from "react";
import type { VitalsReport } from "@vitals/core";

function getScoreColor(score: number) {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
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
import { ChatDrawer } from "./ChatDrawer.js";
import { CriticalIssues } from "./CriticalIssues.js";

interface DashboardProps {
  report: VitalsReport;
}

type View = "overview" | "issues" | "dependencies" | "codebase" | "about";

export function Dashboard({ report }: DashboardProps) {
  const [view, setView] = useState<View>("overview");
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const scoreColor = getScoreColor(report.overallScore);

  const complexityMeta = getMeta(report, "complexity");
  const gitMeta = getMeta(report, "git");
  const coverageMeta = getMeta(report, "coverage");

  const filteredChecks = selectedCheck
    ? report.checks.filter((c) => c.id === selectedCheck)
    : report.checks;

  const handleCriticalCheckClick = (checkId: string) => {
    setSelectedCheck(checkId);
    setView("overview");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border flex flex-col shrink-0 bg-surface">
        <div className="p-4 border-b border-border">
          <div className="text-green-400 font-bold text-xl tracking-wider">
            VITALS
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            Project Health Dashboard
          </div>
        </div>

        <div className="p-4 border-b border-border">
          <div className="text-xs text-gray-500 mb-1">project</div>
          <div className="font-semibold">{report.projectInfo.name}</div>
          <div className="text-xs text-gray-500">
            v{report.projectInfo.version}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {report.projectInfo.framework} · {report.projectInfo.packageManager}
          </div>
          <div className="text-xs text-gray-500">
            {report.projectInfo.totalDependencies} deps
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
            {report.overallScore}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            <span className="text-red-400">
              {report.summary.critical} critical
            </span>
            {" · "}
            <span className="text-yellow-400">
              {report.summary.warnings} warnings
            </span>
            {" · "}
            <span className="text-gray-400">{report.summary.info} info</span>
          </div>
        </div>

        <nav className="p-2 flex-1 overflow-y-auto">
          <div className="text-xs text-gray-500 px-2 py-1">checks</div>
          {report.checks.map((check) => {
            const color =
              check.score >= 80
                ? "text-green-400"
                : check.score >= 60
                  ? "text-yellow-400"
                  : "text-red-400";
            return (
              <button
                key={check.id}
                onClick={() => {
                  setSelectedCheck(
                    selectedCheck === check.id ? null : check.id,
                  );
                  setView("overview");
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
          {new Date(report.timestamp).toLocaleString()}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center">
          <div className="flex gap-2 flex-1">
            {(["overview", "issues", "dependencies", "codebase"] as View[]).map(
              (v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded text-sm font-mono transition-colors
                  ${view === v ? "bg-accent text-black font-semibold" : "text-gray-400 hover:text-white"}`}
                >
                  {v}
                </button>
              ),
            )}
          </div>
          <div className="flex gap-2">
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
                    stroke-width="1.5"
                    d="M9.6 6.112c.322-.816 1.478-.816 1.8 0l.91 2.31a5.8 5.8 0 0 0 3.268 3.268l2.31.91c.816.322.816 1.478 0 1.8l-2.31.91a5.8 5.8 0 0 0-3.268 3.268l-.91 2.31c-.322.816-1.478.816-1.8 0l-.91-2.31a5.8 5.8 0 0 0-3.268-3.268l-2.31-.91c-.816-.322-.816-1.478 0-1.8l2.31-.91A5.8 5.8 0 0 0 8.69 8.422zm8.563-3.382a.363.363 0 0 1 .674 0l.342.866c.221.56.665 1.004 1.225 1.225l.866.342a.363.363 0 0 1 0 .674l-.866.342a2.18 2.18 0 0 0-1.225 1.225l-.342.866a.363.363 0 0 1-.674 0l-.342-.866a2.18 2.18 0 0 0-1.225-1.225l-.867-.342a.363.363 0 0 1 0-.674l.867-.342a2.18 2.18 0 0 0 1.225-1.225z"
                  />
                </svg>
              </span>
              <span>ai insights</span>
            </button>
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
                report={report}
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

          {view === "dependencies" && <DependencyList report={report} />}

          {view === "codebase" && <CodebaseStats report={report} />}

          {view === "about" && <About report={report} />}
        </div>
      </main>

      {/* AI Insights Drawer */}
      <AISummary
        report={report}
        isOpen={isAIDrawerOpen}
        onToggle={setIsAIDrawerOpen}
      />

      {/* AI Chat Drawer */}
      <ChatDrawer report={report} />
    </div>
  );
}
