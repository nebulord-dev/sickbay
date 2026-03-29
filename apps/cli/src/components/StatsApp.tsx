import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { Header } from "./Header.js";
import { gatherStats, type ProjectStats } from "../commands/stats.js";
import { shortName } from "../lib/resolve-package.js";

interface StatsAppProps {
  projectPath: string;
  jsonOutput: boolean;
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}

interface PackageStats {
  name: string;
  path: string;
  stats: ProjectStats;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  next: "Next.js",
  vite: "Vite",
  cra: "Create React App",
  react: "React",
  unknown: "Unknown",
};

const PM_LABELS: Record<string, string> = {
  npm: "npm",
  pnpm: "pnpm",
  yarn: "Yarn",
};

function StatRow({
  label,
  value,
  dimValue,
}: {
  label: string;
  value: string;
  dimValue?: string;
}) {
  return (
    <Box>
      <Text dimColor>{label.padEnd(18)}</Text>
      <Text bold>{value}</Text>
      {dimValue && <Text dimColor> {dimValue}</Text>}
    </Box>
  );
}

function formatExtBreakdown(byExtension: Record<string, number>): string {
  const sorted = Object.entries(byExtension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  return sorted.map(([ext, count]) => `${ext}: ${count}`).join(", ");
}

function ToolBadges({ project }: { project: ProjectStats["project"] }) {
  const badges: Array<{ label: string; active: boolean }> = [
    { label: "TypeScript", active: project.hasTypeScript },
    { label: "ESLint", active: project.hasESLint },
    { label: "Prettier", active: project.hasPrettier },
  ];

  return (
    <Box>
      <Text dimColor>{"Tooling".padEnd(18)}</Text>
      {badges.map((b, i) => (
        <React.Fragment key={b.label}>
          {i > 0 && <Text dimColor> </Text>}
          <Text color={b.active ? "green" : "red"}>
            {b.active ? "✓" : "✗"} {b.label}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

function SingleProjectStats({ stats }: { stats: ProjectStats }) {
  const {
    project,
    files,
    lines,
    components,
    dependencies,
    git,
    testFiles,
    sourceSize,
  } = stats;

  const frameworkLabel =
    FRAMEWORK_LABELS[project.framework] ?? project.framework;
  const techStack = [frameworkLabel];
  if (project.hasTypeScript) {
    const tsVersion = { ...project.dependencies, ...project.devDependencies }[
      "typescript"
    ];
    techStack.push(
      `TypeScript${tsVersion ? ` ${tsVersion.replace("^", "")}` : ""}`,
    );
  }

  const reactVersion =
    project.dependencies["react"] ?? project.devDependencies["react"];

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <StatRow
          label="Framework"
          value={frameworkLabel}
          dimValue={
            reactVersion
              ? `(React ${reactVersion.replace("^", "")})`
              : undefined
          }
        />
        <StatRow
          label="Package Manager"
          value={PM_LABELS[project.packageManager] ?? project.packageManager}
        />
        <ToolBadges project={project} />
      </Box>

      <Box marginTop={1} marginLeft={2} flexDirection="column">
        <Text dimColor>{"━".repeat(48)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <StatRow
          label="Files"
          value={`${files.total}`}
          dimValue={`(${formatExtBreakdown(files.byExtension)})`}
        />
        <StatRow
          label="Lines of Code"
          value={lines.total.toLocaleString()}
          dimValue={`(avg ${lines.avgPerFile}/file)`}
        />
        <StatRow label="Source Size" value={sourceSize} />
      </Box>

      {components.total > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <StatRow
            label="Components"
            value={`${components.total}`}
            dimValue={`(${components.functional} functional${components.classBased > 0 ? `, ${components.classBased} class` : ""})`}
          />
        </Box>
      )}

      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <StatRow
          label="Dependencies"
          value={`${dependencies.total}`}
          dimValue={`(prod: ${dependencies.prod}, dev: ${dependencies.dev})`}
        />
        <StatRow
          label="Test Files"
          value={`${testFiles}`}
          dimValue={
            files.total > 0
              ? `(covering ${Math.round((testFiles / files.total) * 100)}% of files)`
              : undefined
          }
        />
      </Box>

      {git && (
        <>
          <Box marginTop={1} marginLeft={2} flexDirection="column">
            <Text dimColor>{"━".repeat(48)}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            <StatRow label="Git Branch" value={git.branch} />
            <StatRow
              label="Commits"
              value={`${git.commits}`}
              dimValue={`by ${git.contributors} contributor${git.contributors !== 1 ? "s" : ""}`}
            />
            <StatRow label="Project Age" value={git.age} />
          </Box>
        </>
      )}
    </Box>
  );
}

export function StatsApp({
  projectPath,
  jsonOutput,
  isMonorepo,
  packagePaths,
  packageNames,
}: StatsAppProps) {
  const { exit } = useApp();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [packageStats, setPackageStats] = useState<PackageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isMonorepo && packagePaths && packageNames) {
      Promise.all(
        packagePaths.map(async (pkgPath) => {
          const name = packageNames.get(pkgPath) ?? pkgPath;
          const s = await gatherStats(pkgPath);
          return { name, path: pkgPath, stats: s };
        }),
      )
        .then((all) => {
          setPackageStats(all);
          setLoading(false);

          if (jsonOutput) {
            const output = all.map((p) => ({
              package: p.name,
              path: p.path,
              stats: p.stats,
            }));
            process.stdout.write(JSON.stringify(output, null, 2) + "\n");
          }

          setTimeout(() => exit(), 100);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
          setTimeout(() => exit(), 100);
        });
    } else {
      gatherStats(projectPath)
        .then((s) => {
          setStats(s);
          setLoading(false);

          if (jsonOutput) {
            process.stdout.write(JSON.stringify(s, null, 2) + "\n");
          }

          setTimeout(() => exit(), 100);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
          setTimeout(() => exit(), 100);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>{" "}
          Scanning project
          {isMonorepo ? ` (${packagePaths?.length} packages)` : ""}...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text color="red">✗ Error: {error}</Text>
      </Box>
    );
  }

  if (jsonOutput) return null;

  // Monorepo: show per-package stats with summary table
  if (isMonorepo && packageStats.length > 0) {
    const totals = packageStats.reduce(
      (acc, p) => ({
        files: acc.files + p.stats.files.total,
        lines: acc.lines + p.stats.lines.total,
        deps: acc.deps + p.stats.dependencies.total,
        tests: acc.tests + p.stats.testFiles,
      }),
      { files: 0, lines: 0, deps: 0, tests: 0 },
    );

    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text bold>Monorepo Overview</Text>
        <Text dimColor>
          {packageStats.length} packages
        </Text>

        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Box>
            <Text bold>{"Package".padEnd(36)}</Text>
            <Text bold>{"Framework".padEnd(14)}</Text>
            <Text bold>{"Files".padEnd(8)}</Text>
            <Text bold>{"LOC".padEnd(10)}</Text>
            <Text bold>{"Deps".padEnd(8)}</Text>
            <Text bold>Tests</Text>
          </Box>
          <Text dimColor>{"━".repeat(84)}</Text>
          {packageStats.map((pkg) => {
            const fw =
              FRAMEWORK_LABELS[pkg.stats.project.framework] ??
              pkg.stats.project.framework;
            return (
              <Box key={pkg.path}>
                <Text color="cyan">
                  {shortName(pkg.name).padEnd(36)}
                </Text>
                <Text>{fw.padEnd(14)}</Text>
                <Text>{String(pkg.stats.files.total).padEnd(8)}</Text>
                <Text>
                  {pkg.stats.lines.total.toLocaleString().padEnd(10)}
                </Text>
                <Text>{String(pkg.stats.dependencies.total).padEnd(8)}</Text>
                <Text>{pkg.stats.testFiles}</Text>
              </Box>
            );
          })}
          <Text dimColor>{"━".repeat(84)}</Text>
          <Box>
            <Text bold>{"Total".padEnd(36)}</Text>
            <Text>{"".padEnd(14)}</Text>
            <Text bold>{String(totals.files).padEnd(8)}</Text>
            <Text bold>{totals.lines.toLocaleString().padEnd(10)}</Text>
            <Text bold>{String(totals.deps).padEnd(8)}</Text>
            <Text bold>{totals.tests}</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Single project
  if (!stats) return null;

  return (
    <Box flexDirection="column" padding={1}>
      <Header projectName={stats.project.name} />
      <Text bold>Codebase Overview</Text>
      <SingleProjectStats stats={stats} />
    </Box>
  );
}
