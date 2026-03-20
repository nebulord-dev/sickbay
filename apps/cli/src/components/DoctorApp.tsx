import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { Header } from "./Header.js";
import { runDiagnostics, type DiagnosticResult } from "../commands/doctor.js";
import { shortName } from "../lib/resolve-package.js";

interface DoctorAppProps {
  projectPath: string;
  autoFix: boolean;
  jsonOutput: boolean;
  isMonorepo?: boolean;
  packagePaths?: string[];
  packageNames?: Map<string, string>;
}

interface PackageDiagnostics {
  name: string;
  path: string;
  results: DiagnosticResult[];
}

const STATUS_CONFIG = {
  pass: { icon: "✓", color: "green" as const },
  fail: { icon: "✗", color: "red" as const },
  warn: { icon: "⚠", color: "yellow" as const },
};

function DiagnosticsList({ results }: { results: DiagnosticResult[] }) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      {results.map((r) => {
        const { icon, color } = STATUS_CONFIG[r.status];
        return (
          <Box key={r.id} flexDirection="column">
            <Box>
              <Text color={color}>{icon} </Text>
              <Text bold={r.status !== "pass"}>{r.label}</Text>
              <Text dimColor> — {r.message}</Text>
            </Box>
            {r.status !== "pass" && r.fixCommand && (
              <Box marginLeft={4}>
                <Text dimColor>fix: </Text>
                <Text color="cyan">{r.fixCommand}</Text>
              </Box>
            )}
            {r.status !== "pass" && !r.fixCommand && r.fixDescription && (
              <Box marginLeft={4}>
                <Text dimColor>→ {r.fixDescription}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function DiagnosticsSummary({ results }: { results: DiagnosticResult[] }) {
  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  return (
    <Box>
      <Text color="green"> ✓ {passed} passed</Text>
      <Text color="yellow"> ⚠ {warned} warnings</Text>
      <Text color="red"> ✗ {failed} failed</Text>
      <Text dimColor> ({results.length} checks)</Text>
    </Box>
  );
}

export function DoctorApp({
  projectPath,
  jsonOutput,
  isMonorepo,
  packagePaths,
  packageNames,
}: DoctorAppProps) {
  const { exit } = useApp();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [packageResults, setPackageResults] = useState<PackageDiagnostics[]>(
    [],
  );
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (isMonorepo && packagePaths && packageNames) {
      Promise.all(
        packagePaths.map(async (pkgPath) => {
          const name = packageNames.get(pkgPath) ?? pkgPath;
          const r = await runDiagnostics(pkgPath);
          return { name, path: pkgPath, results: r };
        }),
      )
        .then((all) => {
          setPackageResults(all);
          setRunning(false);

          if (jsonOutput) {
            const output = all.map((p) => ({
              package: p.name,
              path: p.path,
              results: p.results,
            }));
            process.stdout.write(JSON.stringify(output, null, 2) + "\n");
          }

          setTimeout(() => exit(), 100);
        })
        .catch((err) => {
          setPackageResults([
            {
              name: "error",
              path: projectPath,
              results: [
                {
                  id: "error",
                  label: "Doctor",
                  status: "fail",
                  message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
                },
              ],
            },
          ]);
          setRunning(false);
          setTimeout(() => exit(), 100);
        });
    } else {
      runDiagnostics(projectPath)
        .then((r) => {
          setResults(r);
          setRunning(false);

          if (jsonOutput) {
            process.stdout.write(JSON.stringify(r, null, 2) + "\n");
          }

          setTimeout(() => exit(), 100);
        })
        .catch((err) => {
          setResults([
            {
              id: "error",
              label: "Doctor",
              status: "fail",
              message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ]);
          setRunning(false);
          setTimeout(() => exit(), 100);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (running) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>{" "}
          Running project diagnostics
          {isMonorepo ? ` across ${packagePaths?.length} packages` : ""}...
        </Text>
      </Box>
    );
  }

  if (jsonOutput) return null;

  // Monorepo: show per-package results
  if (isMonorepo && packageResults.length > 0) {
    const allResults = packageResults.flatMap((p) => p.results);

    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text bold>Monorepo Setup Diagnosis</Text>

        {packageResults.map((pkg) => (
          <Box key={pkg.path} flexDirection="column" marginTop={1}>
            <Text bold color="cyan">
              {shortName(pkg.name)}
            </Text>
            <DiagnosticsList results={pkg.results} />
          </Box>
        ))}

        <Box marginTop={1}>
          <Text dimColor>{"━".repeat(52)}</Text>
        </Box>
        <DiagnosticsSummary results={allResults} />
      </Box>
    );
  }

  // Single project
  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      <Text bold>Project Setup Diagnosis</Text>
      <Box flexDirection="column" marginTop={1}>
        <DiagnosticsList results={results} />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{"━".repeat(52)}</Text>
      </Box>
      <Box marginTop={1}>
        <DiagnosticsSummary results={results} />
      </Box>
    </Box>
  );
}
