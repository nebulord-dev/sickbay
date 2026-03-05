import type { VitalsReport } from "@vitals/core";
import { SCORE_GOOD, SCORE_FAIR } from "@vitals/constants";

interface AboutProps {
  report: VitalsReport;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  security: 30,
  dependencies: 25,
  "code-quality": 25,
  performance: 15,
  git: 5,
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "bg-red-400",
  dependencies: "bg-blue-400",
  "code-quality": "bg-purple-400",
  performance: "bg-orange-400",
  git: "bg-gray-400",
};

const CHECK_DESCRIPTIONS: Record<string, string> = {
  knip: "Finds unused files, exports, and dependencies that can be safely removed.",
  depcheck: "Detects missing and unused npm packages in your dependency tree.",
  outdated: "Checks for outdated dependencies using your package manager.",
  "npm-audit": "Scans for known security vulnerabilities in your dependencies.",
  madge: "Detects circular dependencies in your module import graph.",
  "source-map-explorer":
    "Analyzes bundle composition and identifies large contributors.",
  coverage:
    "Runs your test suite and measures code coverage across lines, functions, and branches.",
  "license-checker":
    "Scans dependency licenses and flags GPL, AGPL, or other problematic types.",
  jscpd: "Detects copy-pasted code blocks (duplication) across your codebase.",
  git: "Analyzes git history for staleness, commit frequency, and branch hygiene.",
  eslint: "Runs your ESLint config and counts errors and warnings.",
  typescript:
    "Runs tsc --noEmit to surface type errors without emitting output.",
  "todo-scanner":
    "Finds TODO, FIXME, and HACK comments left in source code.",
  complexity:
    "Identifies oversized files by line count and flags candidates for splitting.",
  secrets:
    "Detects hardcoded credentials, API keys, and tokens in source files.",
  "heavy-deps":
    "Identifies heavy or outdated dependencies that have lighter modern alternatives.",
  "react-perf":
    "Analyzes React components for performance anti-patterns like inline objects and index as key.",
  "asset-size":
    "Checks static asset sizes (images, fonts, SVGs) and flags oversized files.",
};

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= SCORE_GOOD
      ? "text-green-400"
      : score >= SCORE_FAIR
        ? "text-yellow-400"
        : "text-red-400";
  return (
    <span className={`text-xs font-mono font-bold ${color}`}>{score}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pass: "bg-green-400/10 text-green-400",
    warning: "bg-yellow-400/10 text-yellow-400",
    fail: "bg-red-400/10 text-red-400",
    skipped: "bg-gray-500/10 text-gray-500",
  };
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-mono ${styles[status] ?? styles.skipped}`}
    >
      {status}
    </span>
  );
}

export function About({ report }: AboutProps) {
  const checksByCategory = report.checks.reduce<
    Record<string, typeof report.checks>
  >((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-10 max-w-3xl">
      {/* Intro */}
      <section>
        <h1 className="text-2xl font-bold text-green-400 tracking-wider mb-2">
          VITALS
        </h1>
        <p className="text-gray-400 leading-relaxed">
          Vitals is a zero-config project health dashboard. It runs a suite of
          checks across your codebase — dependencies, security, code quality,
          performance, and git hygiene — and produces a single weighted score so
          you can see the overall health of your project at a glance.
        </p>
      </section>

      {/* Scoring */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          How Scoring Works
        </h2>
        <p className="text-gray-500 text-sm mb-4">
          Each check scores 0–100. The overall score is a weighted average
          grouped by category:
        </p>
        <div className="space-y-3">
          {Object.entries(CATEGORY_WEIGHTS)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, weight]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-32 text-sm text-gray-400 capitalize">
                  {cat.replace("-", " ")}
                </div>
                <div className="flex-1 bg-surface rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-400"}`}
                    style={{ width: `${weight}%` }}
                  />
                </div>
                <div className="w-8 text-right text-sm font-mono text-gray-400">
                  {weight}%
                </div>
              </div>
            ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-gray-500">
          <span>
            <span className="text-green-400 font-mono font-bold">≥80</span> —
            healthy
          </span>
          <span>
            <span className="text-yellow-400 font-mono font-bold">60–79</span> —
            needs attention
          </span>
          <span>
            <span className="text-red-400 font-mono font-bold">&lt;60</span> —
            critical
          </span>
        </div>
      </section>

      {/* Checks catalog */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Checks
        </h2>
        <div className="space-y-6">
          {Object.entries(CATEGORY_WEIGHTS)
            .sort((a, b) => b[1] - a[1])
            .map(([cat]) => {
              const checks = checksByCategory[cat] ?? [];
              if (checks.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-xs text-gray-00 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-400"}`}
                    />
                    {cat.replace("-", " ")}
                  </div>
                  <div className="space-y-1">
                    {checks.map((check) => (
                      <div
                        key={check.id}
                        className="bg-card rounded-lg px-4 py-3 flex items-start gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-sm font-semibold">
                              {check.name}
                            </span>
                            <span className="text-sm text-[cadetblue] font-mono">
                              {check.toolsUsed.join(", ")}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {CHECK_DESCRIPTIONS[check.id] ??
                              "No description available."}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ScoreRing score={check.score} />
                          <StatusBadge status={check.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

    </div>
  );
}
