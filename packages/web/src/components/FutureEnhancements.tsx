import React from "react";

interface Enhancement {
  title: string;
  description: string;
  category: "feature" | "integration" | "performance" | "ux";
  status: "planned" | "in-progress" | "considering";
}

const ENHANCEMENTS: Enhancement[] = [
  {
    title: "Historical Trends",
    description:
      "Track score changes over time. Store past reports locally and visualize trends in a line chart. See which metrics are improving or degrading across commits.",
    category: "feature",
    status: "planned",
  },
  {
    title: "CI/CD Integration Guide",
    description:
      "Pre-built GitHub Actions and GitLab CI templates. Auto-comment PR summaries with score deltas. Fail builds on critical thresholds.",
    category: "integration",
    status: "planned",
  },
  {
    title: "Custom Check API",
    description:
      "Plugin system for adding your own checks. Define custom runners with a simple interface and integrate them seamlessly into the dashboard.",
    category: "feature",
    status: "considering",
  },
  {
    title: "AI Quick Fixes",
    description:
      "Let Claude suggest and apply one-click fixes for simple issues like unused imports, outdated deps, or missing docs.",
    category: "feature",
    status: "considering",
  },
  {
    title: "Team Dashboard",
    description:
      "Multi-project view for engineering teams. Compare health across repos, spot patterns, and track org-wide improvement goals.",
    category: "feature",
    status: "considering",
  },
  {
    title: "Lighthouse Integration",
    description:
      "Run Lighthouse audits for web vitals (LCP, FID, CLS) alongside your code health checks. Unified performance scoring.",
    category: "integration",
    status: "planned",
  },
  {
    title: "Dependency Tree Visualization",
    description:
      "Interactive graph of your dependency tree. Highlight security vulns, outdated packages, and circular imports visually.",
    category: "ux",
    status: "considering",
  },
  {
    title: "Incremental Checks",
    description:
      "Only re-run checks on changed files between commits. Speed up analysis by 10x for large codebases.",
    category: "performance",
    status: "planned",
  },
  {
    title: "Slack/Discord Notifications",
    description:
      "Post daily health reports to team channels. Alert on critical score drops or new security vulnerabilities.",
    category: "integration",
    status: "considering",
  },
  {
    title: "VS Code Extension",
    description:
      "Inline warnings in your editor. Run checks on save and show issues directly in the gutter.",
    category: "integration",
    status: "considering",
  },
  {
    title: "SMS Status Checks",
    description:
      "Text a number to get instant health stats. Ask 'How's my-app?' and get back overall score, critical issues, and quick summaries. Perfect for on-call engineers checking prod at 2am.",
    category: "integration",
    status: "considering",
  },
];

const CATEGORY_COLORS: Record<Enhancement["category"], string> = {
  feature: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  integration: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  performance: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  ux: "bg-green-400/10 text-green-400 border-green-400/20",
};

const STATUS_COLORS: Record<Enhancement["status"], string> = {
  planned: "bg-green-500/10 text-green-400",
  "in-progress": "bg-yellow-500/10 text-yellow-400",
  considering: "bg-gray-500/10 text-gray-400",
};

export function FutureEnhancements() {
  const grouped = ENHANCEMENTS.reduce<Record<string, Enhancement[]>>(
    (acc, enh) => {
      (acc[enh.status] ??= []).push(enh);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Intro */}
      <section>
        <h1 className="text-2xl font-bold text-green-400 tracking-wider mb-2">
          FUTURE ENHANCEMENTS
        </h1>
        <p className="text-gray-400 leading-relaxed">
          Vitals is actively evolving. Below are features and integrations we're
          considering or actively building. Have ideas? Open an issue on GitHub.
        </p>
      </section>

      {/* Roadmap by status */}
      {(["in-progress", "planned", "considering"] as const).map((status) => {
        const items = grouped[status] ?? [];
        if (items.length === 0) return null;

        const statusLabels = {
          "in-progress": "In Progress",
          planned: "Planned",
          considering: "Under Consideration",
        };

        return (
          <section key={status}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${STATUS_COLORS[status]}`}
              >
                {statusLabels[status]}
              </span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((enh, idx) => (
                <div
                  key={idx}
                  className="bg-card rounded-lg p-4 border border-border hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white">{enh.title}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase ${CATEGORY_COLORS[enh.category]}`}
                    >
                      {enh.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {enh.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Footer CTA */}
      <section className="border-t border-border pt-6">
        <div className="bg-surface rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-3">
            Want to contribute or suggest a feature?
          </p>
          <a
            href="https://github.com/anthropics/vitals"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-accent text-black font-mono text-sm rounded hover:bg-accent/90 transition-colors"
          >
            Open an Issue on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
