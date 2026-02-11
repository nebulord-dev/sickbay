import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { Header } from "./Header.js";
import {
  runDiagnostics,
  type DiagnosticResult,
} from "../commands/doctor.js";

interface DoctorAppProps {
  projectPath: string;
  autoFix: boolean;
  jsonOutput: boolean;
}

const STATUS_CONFIG = {
  pass: { icon: "✓", color: "green" as const },
  fail: { icon: "✗", color: "red" as const },
  warn: { icon: "⚠", color: "yellow" as const },
};

export function DoctorApp({ projectPath, jsonOutput }: DoctorAppProps) {
  const { exit } = useApp();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
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
  }, []);

  if (running) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header />
        <Text>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          {" "}Running project diagnostics...
        </Text>
      </Box>
    );
  }

  if (jsonOutput) return null;

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      <Text bold>Project Setup Diagnosis</Text>
      <Box flexDirection="column" marginTop={1} marginLeft={2}>
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

      <Box marginTop={1}>
        <Text dimColor>{"━".repeat(52)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="green"> ✓ {passed} passed</Text>
        <Text color="yellow">  ⚠ {warned} warnings</Text>
        <Text color="red">  ✗ {failed} failed</Text>
        <Text dimColor>  ({results.length} checks)</Text>
      </Box>
    </Box>
  );
}
