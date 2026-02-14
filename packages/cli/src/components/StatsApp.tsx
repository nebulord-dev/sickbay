import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { Header } from "./Header.js";
import { gatherStats, type ProjectStats } from "../commands/stats.js";

interface StatsAppProps {
  projectPath: string;
  jsonOutput: boolean;
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

export function StatsApp({ projectPath, jsonOutput }: StatsAppProps) {
  const { exit } = useApp();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
          Scanning project...
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

  if (jsonOutput || !stats) return null;

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
    <Box flexDirection="column" padding={1}>
      <Header projectName={project.name} />

      <Text bold>Codebase Overview</Text>

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
