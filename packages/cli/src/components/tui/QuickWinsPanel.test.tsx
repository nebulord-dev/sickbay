import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { QuickWinsPanel } from "./QuickWinsPanel.js";
import type { VitalsReport, CheckResult, Issue } from "@vitals/core";

const createMockReport = (checks: CheckResult[]): VitalsReport => ({
  timestamp: new Date().toISOString(),
  projectPath: "/test/project",
  projectInfo: {
    name: "test-project",
    version: "1.0.0",
    framework: "react",
    packageManager: "npm",
    totalDependencies: 50,
    devDependencies: {},
    dependencies: {},
    hasESLint: false,
    hasPrettier: false,
    hasTypeScript: false,
  },
  checks,
  overallScore: 75,
  summary: { critical: 0, warnings: 0, info: 0 },
});

const createCheckWithIssues = (issues: Issue[]): CheckResult => ({
  id: "test-check",
  name: "Test Check",
  category: "dependencies",
  score: 80,
  status: "pass",
  issues,
  toolsUsed: ["test"],
  duration: 100,
});

describe("QuickWinsPanel", () => {
  it("shows waiting state when report is null", () => {
    const { lastFrame } = render(<QuickWinsPanel report={null} />);
    expect(lastFrame()).toContain("Waiting for scan...");
  });

  it("shows 'Looking good!' when there are no fixable issues", () => {
    const report = createMockReport([
      createCheckWithIssues([
        { severity: "info", message: "No fix here", reportedBy: ["test"] },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    expect(lastFrame()).toContain("Looking good!");
  });

  it("shows fix description when fixable issues exist", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "warning",
          message: "Outdated package",
          fix: { description: "Update lodash", command: "npm update lodash" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    expect(lastFrame()).toContain("Update lodash");
  });

  it("shows fix command when fixable issues exist", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "warning",
          message: "Outdated package",
          fix: { description: "Update lodash", command: "npm update lodash" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    expect(lastFrame()).toContain("npm update lodash");
  });

  it("prioritizes critical issues before warnings", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "warning",
          message: "Warning issue",
          fix: { description: "Warning fix", command: "cmd-warn" },
          reportedBy: ["test"],
        },
        {
          severity: "critical",
          message: "Critical issue",
          fix: { description: "Critical fix", command: "cmd-crit" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    const output = lastFrame() ?? "";
    const criticalPos = output.indexOf("Critical fix");
    const warningPos = output.indexOf("Warning fix");
    expect(criticalPos).toBeLessThan(warningPos);
  });

  it("prioritizes warnings before info", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "info",
          message: "Info issue",
          fix: { description: "Info fix", command: "cmd-info" },
          reportedBy: ["test"],
        },
        {
          severity: "warning",
          message: "Warning issue",
          fix: { description: "Warning fix", command: "cmd-warn" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    const output = lastFrame() ?? "";
    const warningPos = output.indexOf("Warning fix");
    const infoPos = output.indexOf("Info fix");
    expect(warningPos).toBeLessThan(infoPos);
  });

  it("shows at most 5 fixes", () => {
    const issues: Issue[] = Array.from({ length: 10 }, (_, i) => ({
      severity: "warning" as const,
      message: `Issue ${i}`,
      fix: { description: `Fix ${i}`, command: `cmd${i}` },
      reportedBy: ["test"],
    }));
    const report = createMockReport([createCheckWithIssues(issues)]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Fix 0");
    expect(output).toContain("Fix 4");
    expect(output).not.toContain("Fix 5");
  });

  it("aggregates fixes from multiple checks", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "critical",
          message: "Issue A",
          fix: { description: "Fix from check A", command: "cmd-a" },
          reportedBy: ["test"],
        },
      ]),
      createCheckWithIssues([
        {
          severity: "warning",
          message: "Issue B",
          fix: { description: "Fix from check B", command: "cmd-b" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Fix from check A");
    expect(output).toContain("Fix from check B");
  });

  it("does not show issues without fix commands", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "critical",
          message: "No fix available",
          reportedBy: ["test"],
        },
        {
          severity: "warning",
          message: "Has fix",
          fix: { description: "Do the fix", command: "fix-cmd" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Do the fix");
    expect(output).not.toContain("No fix available");
  });

  it("renders without error with empty checks array", () => {
    const report = createMockReport([]);
    const { lastFrame } = render(<QuickWinsPanel report={report} />);
    expect(lastFrame()).toContain("Looking good!");
  });

  it("accepts availableWidth prop without error", () => {
    const report = createMockReport([
      createCheckWithIssues([
        {
          severity: "warning",
          message: "Issue",
          fix: { description: "Short fix", command: "cmd" },
          reportedBy: ["test"],
        },
      ]),
    ]);
    const { lastFrame } = render(
      <QuickWinsPanel report={report} availableWidth={40} />
    );
    expect(lastFrame()).toContain("Short fix");
  });
});
