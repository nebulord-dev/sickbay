import type { MonorepoReport, PackageReport } from "@vitals/core";
import { SCORE_GOOD, SCORE_FAIR } from "@vitals/constants";

interface MonorepoOverviewProps {
  report: MonorepoReport;
  onSelectPackage: (idx: number) => void;
}

function getScoreColorClass(score: number) {
  if (score >= SCORE_GOOD) return "text-green-400";
  if (score >= SCORE_FAIR) return "text-yellow-400";
  return "text-red-400";
}

function getScoreRingClass(score: number) {
  if (score >= SCORE_GOOD) return "stroke-green-400";
  if (score >= SCORE_FAIR) return "stroke-yellow-400";
  return "stroke-red-400";
}

function PackageScoreCard({
  pkg,
  index,
  onClick,
}: {
  pkg: PackageReport;
  index: number;
  onClick: () => void;
}) {
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pkg.score / 100) * circumference;
  const colorClass = getScoreColorClass(pkg.score);
  const ringClass = getScoreRingClass(pkg.score);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-surface hover:border-accent/50 transition-all cursor-pointer text-left w-full"
    >
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#2a2a2a" strokeWidth="4" />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-700 ${ringClass}`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${colorClass}`}>
          {pkg.score}
        </span>
      </div>

      <div className="text-center w-full">
        <div className="text-sm font-semibold truncate">{pkg.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{pkg.framework} · {pkg.relativePath}</div>
      </div>

      <div className="flex gap-3 text-xs w-full justify-center">
        {pkg.summary.critical > 0 && (
          <span className="text-red-400">{pkg.summary.critical} critical</span>
        )}
        {pkg.summary.warnings > 0 && (
          <span className="text-yellow-400">{pkg.summary.warnings} warnings</span>
        )}
        {pkg.summary.critical === 0 && pkg.summary.warnings === 0 && (
          <span className="text-green-400">✓ clean</span>
        )}
      </div>

      <div className="text-xs text-gray-500">
        {index + 1 === 1 ? "click to inspect →" : ""}
      </div>
    </button>
  );
}

/** Collect the top quick wins across all packages, deduped by fix command */
function collectQuickWins(packages: PackageReport[], limit = 8) {
  const seen = new Set<string>();
  const wins: Array<{ pkg: string; message: string; command?: string }> = [];

  for (const pkg of packages) {
    for (const check of pkg.checks) {
      for (const issue of check.issues) {
        if (issue.severity === "critical" && issue.fix) {
          const key = issue.fix.command ?? issue.fix.description;
          if (!seen.has(key)) {
            seen.add(key);
            wins.push({
              pkg: pkg.name,
              message: issue.message,
              command: issue.fix.command,
            });
          }
        }
        if (wins.length >= limit) return wins;
      }
    }
  }
  return wins;
}

export function MonorepoOverview({ report, onSelectPackage }: MonorepoOverviewProps) {
  const quickWins = collectQuickWins(report.packages);
  const overallColor = getScoreColorClass(report.overallScore);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-4 mb-1">
          <div className={`text-5xl font-bold ${overallColor}`}>{report.overallScore}</div>
          <div className="text-gray-400 text-sm">
            monorepo health · {report.monorepoType} workspaces · {report.packages.length} packages
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-red-400">{report.summary.critical} critical</span>
          <span className="text-yellow-400">{report.summary.warnings} warnings</span>
          <span className="text-gray-500">{report.summary.info} info</span>
        </div>
      </div>

      {/* Package scoreboard */}
      <div className="mb-8">
        <h2 className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-3">
          packages
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {report.packages.map((pkg, i) => (
            <PackageScoreCard
              key={pkg.path}
              pkg={pkg}
              index={i}
              onClick={() => onSelectPackage(i)}
            />
          ))}
        </div>
      </div>

      {/* Quick wins across all packages */}
      {quickWins.length > 0 && (
        <div>
          <h2 className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-3">
            cross-package quick wins
          </h2>
          <div className="space-y-2">
            {quickWins.map((win, i) => (
              <div key={i} className="flex flex-col gap-0.5 p-3 rounded border border-border bg-surface">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-xs font-mono shrink-0">●</span>
                  <div>
                    <span className="text-sm text-gray-300">{win.message}</span>
                    <span className="text-xs text-gray-500 ml-2">({win.pkg})</span>
                  </div>
                </div>
                {win.command && (
                  <code className="text-xs text-green-400 font-mono ml-4 mt-0.5 block">
                    $ {win.command}
                  </code>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
