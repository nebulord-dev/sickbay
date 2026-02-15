import React, { lazy, Suspense } from 'react';
import type { VitalsReport } from '@vitals/core';

// Lazy load heavy graph visualization
const DependencyGraph = lazy(() => import('./DependencyGraph.js').then((m) => ({ default: m.DependencyGraph })));

interface CodebaseStatsProps {
  report: VitalsReport;
}

function getMeta(report: VitalsReport, id: string): Record<string, unknown> {
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

function CoverageBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? 'bg-green-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono font-semibold">{pct.toFixed(1)}%</span>
      </div>
      <div className="bg-surface rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function CodebaseStats({ report }: CodebaseStatsProps) {
  const complexity = getMeta(report, 'complexity');
  const git = getMeta(report, 'git');
  const coverage = getMeta(report, 'coverage');

  const topFiles = (complexity.topFiles as Array<{ path: string; lines: number }> | undefined) ?? [];
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
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Codebase</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="total files" value={complexity.totalFiles as number} />
            <StatCard label="total lines" value={(complexity.totalLines as number).toLocaleString()} />
            <StatCard label="avg file size" value={`${complexity.avgLines as number} loc`} />
            <StatCard
              label="oversized files"
              value={complexity.oversizedCount as number}
              sub="> 300 lines"
            />
          </div>

          {topFiles.length > 0 && (
            <div className="bg-card rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-3">largest files</div>
              <div className="space-y-2">
                {topFiles.slice(0, 10).map((f) => (
                  <div key={f.path} className="flex items-center gap-3">
                    <div className="w-48 text-xs font-mono text-gray-400 truncate shrink-0" title={f.path}>
                      {f.path.split('/').slice(-2).join('/')}
                    </div>
                    <div className="flex-1 bg-surface rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full flex items-center justify-end pr-2 text-xs font-mono text-black font-semibold
                          ${f.lines >= 500 ? 'bg-red-400' : f.lines >= 300 ? 'bg-yellow-400' : 'bg-green-400'}`}
                        style={{ width: `${Math.max(8, (f.lines / maxLines) * 100)}%` }}
                      >
                        {f.lines}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Git Stats */}
      {hasGit && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Git Activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="total commits" value={(git.commitCount as number).toLocaleString()} />
            <StatCard label="contributors" value={git.contributorCount as number} />
            <StatCard label="remote branches" value={git.remoteBranches as number} />
            <StatCard label="last commit" value={git.lastCommit as string} />
          </div>
        </section>
      )}

      {/* Coverage */}
      {hasCoverage && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Test Coverage</h2>
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
                <StatCard label="passing" value={coverage.passed as number} sub={`${coverage.failed} failing`} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Module Dependency Graph */}
      {hasGraph && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Module Graph
            <span className="text-xs font-normal text-gray-500 ml-2">
              {Object.keys(depGraph).length} modules
              {(madge.circularCount as number) > 0 && (
                <span className="text-red-400 ml-1">
                  · {madge.circularCount as number} circular
                </span>
              )}
            </span>
          </h2>
          <Suspense fallback={<div className="text-gray-500 text-sm">Loading graph...</div>}>
            <DependencyGraph
              graph={depGraph}
              circularCount={madge.circularCount as number}
            />
          </Suspense>
        </section>
      )}

      {!hasComplexity && !hasGit && !hasCoverage && !hasGraph && (
        <div className="text-gray-500 text-sm">No codebase stats available yet.</div>
      )}
    </div>
  );
}
