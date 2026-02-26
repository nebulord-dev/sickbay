import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { VitalsReport } from "@vitals/core";
import type { FixableIssue } from "../commands/fix.js";

vi.mock("@vitals/core", () => ({
  runVitals: vi.fn(),
}));

vi.mock("../commands/fix.js", () => ({
  collectFixableIssues: vi.fn(),
  executeFix: vi.fn(),
}));

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return {
    ...actual,
    useApp: () => ({ exit: vi.fn() }),
    useInput: vi.fn(),
  };
});

import { FixApp } from "./FixApp.js";
import { runVitals } from "@vitals/core";
import { collectFixableIssues, executeFix } from "../commands/fix.js";

const mockRunVitals = vi.mocked(runVitals);
const mockCollectFixableIssues = vi.mocked(collectFixableIssues);
const mockExecuteFix = vi.mocked(executeFix);
const { act } = React;

function makeReport(overrides: Partial<VitalsReport> = {}): VitalsReport {
  return {
    timestamp: "2024-01-01T00:00:00.000Z",
    projectPath: "/test/project",
    projectInfo: {
      name: "test-project",
      version: "1.0.0",
      framework: "react",
      packageManager: "npm",
      totalDependencies: 0,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    },
    checks: [],
    overallScore: 85,
    summary: { critical: 0, warnings: 0, info: 0 },
    ...overrides,
  };
}

function makeFixableIssue(overrides: Partial<FixableIssue> = {}): FixableIssue {
  return {
    checkId: "knip",
    checkName: "Knip",
    command: "npx knip --fix",
    issue: {
      severity: "warning",
      message: "Unused exports found",
      reportedBy: [],
      fix: { description: "Remove unused exports", command: "npx knip --fix" },
    },
    ...overrides,
  };
}

async function renderAndFlush(element: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(element);
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe("FixApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectFixableIssues.mockReturnValue([]);
    mockExecuteFix.mockResolvedValue({
      fixable: makeFixableIssue(),
      success: true,
      stdout: "",
      stderr: "",
      duration: 100,
    });
  });

  it("shows scanning spinner while running", () => {
    mockRunVitals.mockReturnValue(new Promise(() => {}));

    const { lastFrame } = render(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(lastFrame()).toContain("Scanning for fixable issues...");
  });

  it("shows no-fixable-issues message when done with empty list", async () => {
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("No fixable issues found");
  });

  it("shows selection phase heading when issues exist and applyAll is false", async () => {
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([makeFixableIssue()]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("Select fixes to apply");
  });

  it("shows fix description in selection list", async () => {
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([
      makeFixableIssue({
        issue: {
          severity: "warning",
          message: "Unused exports found",
          reportedBy: [],
          fix: { description: "Remove unused exports", command: "npx knip --fix" },
        },
      }),
    ]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("Remove unused exports");
  });

  it("shows count of available issues in selection heading", async () => {
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([makeFixableIssue(), makeFixableIssue()]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("2 available");
  });

  it("shows dry run warning in selection phase when dryRun is true", async () => {
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([makeFixableIssue()]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={true} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("Dry run mode");
  });

  it("shows error message when runVitals rejects", async () => {
    mockRunVitals.mockRejectedValue(new Error("Scan failed"));

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={false} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("Scan failed");
  });

  it("passes projectPath and checks to runVitals", async () => {
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([]);

    await renderAndFlush(
      <FixApp
        projectPath="/my/project"
        checks={["eslint", "knip"]}
        applyAll={false}
        dryRun={false}
        verbose={false}
      />,
    );

    expect(mockRunVitals).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: "/my/project", checks: ["eslint", "knip"] }),
    );
  });

  it("shows Fix Results heading in done phase after applyAll", async () => {
    const fix = makeFixableIssue();
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([fix]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={true} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("Fix Results");
  });

  it("shows Dry Run Results heading in done phase when dryRun is true and applyAll", async () => {
    const fix = makeFixableIssue();
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([fix]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={true} dryRun={true} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("Dry Run Results");
  });

  it("shows fix count summary in done phase", async () => {
    const fix = makeFixableIssue();
    mockRunVitals.mockResolvedValue(makeReport() as never);
    mockCollectFixableIssues.mockReturnValue([fix]);

    const result = await renderAndFlush(
      <FixApp projectPath="/test" applyAll={true} dryRun={false} verbose={false} />,
    );

    expect(result.lastFrame()).toContain("1/1");
  });
});
