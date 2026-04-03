import React, { lazy, Suspense, useState } from 'react';

import type { SickbayReport } from '@nebulord/sickbay-core';

// Lazy load heavy graph visualization
const DependencyGraph = lazy(() =>
  import('./DependencyGraph.js').then((m) => ({ default: m.DependencyGraph })),
);

interface CodebaseStatsProps {
  report: SickbayReport;
}

function getMeta(report: SickbayReport, id: string): Record<string, unknown> {
  return (report.checks.find((c) => c.id === id)?.metadata ?? {}) as Record<string, unknown>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-mono font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function SectionHeader({
  label,
  extra,
  collapsed,
  onToggle,
}: {
  label: string;
  extra?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 w-full text-left group mb-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`text-gray-500 group-hover:text-gray-300 transition-transform shrink-0 ${collapsed ? '-rotate-90' : ''}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-200 transition-colors">
        {label}
      </h2>
      {extra}
    </button>
  );
}

function CoverageBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? 'bg-green-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono font-semibold">{pct.toFixed(1)}%</span>
      </div>
      <div className="bg-surface rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function CodebaseStats({ report }: CodebaseStatsProps) {
  const [codebaseCollapsed, setCodebaseCollapsed] = useState(false);
  const [gitCollapsed, setGitCollapsed] = useState(false);
  const [coverageCollapsed, setCoverageCollapsed] = useState(false);
  const [graphCollapsed, setGraphCollapsed] = useState(false);

  const complexity = getMeta(report, 'complexity');
  const git = getMeta(report, 'git');
  const coverage = getMeta(report, 'coverage');

  const topFiles =
    (complexity.topFiles as
      | Array<{ path: string; lines: number; fileType?: string; warn?: number; critical?: number }>
      | undefined) ?? [];
  const maxLines = topFiles[0]?.lines ?? 1;

  const madge = getMeta(report, 'madge');
  const depGraph = madge.graph as Record<string, string[]> | undefined;
  const hasGraph = depGraph && Object.keys(depGraph).length > 0;

  const hasComplexity = complexity.totalFiles != null;
  const hasGit = git.commitCount != null;
  const hasCoverage = coverage.lines != null;

  return (
    <div className="space-y-8">
      {/* File Stats */}
      {hasComplexity && (
        <section>
          <SectionHeader
            label="Codebase"
            collapsed={codebaseCollapsed}
            onToggle={() => setCodebaseCollapsed((v) => !v)}
          />
          {!codebaseCollapsed && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatCard label="total files" value={complexity.totalFiles as number} />
                <StatCard
                  label="total lines"
                  value={(complexity.totalLines as number).toLocaleString()}
                />
                <StatCard label="avg file size" value={`${complexity.avgLines as number} loc`} />
                <StatCard
                  label="oversized files"
                  value={complexity.oversizedCount as number}
                  sub="over threshold"
                />
              </div>

              {topFiles.length > 0 && (
                <div className="bg-card rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-3">largest files</div>
                  <div className="space-y-2">
                    {topFiles.slice(0, 10).map((f) => {
                      const warn = f.warn ?? 400;
                      const critical = f.critical ?? 600;
                      const barColor =
                        f.lines >= critical
                          ? 'bg-red-400'
                          : f.lines >= warn
                            ? 'bg-yellow-400'
                            : 'bg-green-400';
                      return (
                        <div key={f.path} className="flex items-center gap-3">
                          <div
                            className="w-72 text-xs font-mono text-gray-400 truncate shrink-0"
                            title={f.path}
                          >
                            {f.path.split('/').slice(-2).join('/')}
                          </div>
                          <div className="flex-1 bg-surface rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-4 rounded-full flex items-center justify-end pr-2 text-xs font-mono text-black font-semibold ${barColor}`}
                              style={{ width: `${Math.max(8, (f.lines / maxLines) * 100)}%` }}
                            >
                              {f.lines}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Git Stats */}
      {hasGit && (
        <section>
          <SectionHeader
            label="Git Activity"
            collapsed={gitCollapsed}
            onToggle={() => setGitCollapsed((v) => !v)}
          />
          {!gitCollapsed && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="total commits"
                value={(git.commitCount as number).toLocaleString()}
              />
              <StatCard label="contributors" value={git.contributorCount as number} />
              <StatCard label="remote branches" value={git.remoteBranches as number} />
              <StatCard label="last commit" value={git.lastCommit as string} />
            </div>
          )}
        </section>
      )}

      {/* Coverage */}
      {hasCoverage && (
        <section>
          <SectionHeader
            label="Test Coverage"
            collapsed={coverageCollapsed}
            onToggle={() => setCoverageCollapsed((v) => !v)}
          />
          {!coverageCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg p-4 space-y-3">
                <CoverageBar label="Lines" pct={coverage.lines as number} />
                <CoverageBar label="Statements" pct={coverage.statements as number} />
                <CoverageBar label="Functions" pct={coverage.functions as number} />
                <CoverageBar label="Branches" pct={coverage.branches as number} />
              </div>
              {coverage.totalTests != null && (
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="total tests" value={coverage.totalTests as number} />
                  <StatCard
                    label="passing"
                    value={coverage.passed as number}
                    sub={`${coverage.failed} failing`}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Module Dependency Graph */}
      {hasGraph && (
        <section>
          <SectionHeader
            label="Module Graph"
            extra={
              <span className="text-xs font-normal text-gray-500">
                {Object.keys(depGraph).length} modules
                {(madge.circularCount as number) > 0 && (
                  <span className="text-red-400 ml-1">
                    · {madge.circularCount as number} circular
                  </span>
                )}
              </span>
            }
            collapsed={graphCollapsed}
            onToggle={() => setGraphCollapsed((v) => !v)}
          />
          {!graphCollapsed && (
            <Suspense fallback={<div className="text-gray-500 text-sm">Loading graph...</div>}>
              <DependencyGraph graph={depGraph} circularCount={madge.circularCount as number} />
            </Suspense>
          )}
        </section>
      )}

      {!hasComplexity && !hasGit && !hasCoverage && !hasGraph && (
        <div className="text-gray-500 text-sm">No codebase stats available yet.</div>
      )}
    </div>
  );
}
