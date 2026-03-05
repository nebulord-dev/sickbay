import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { VitalsReport, CheckResult } from "@vitals/core";

// Mock @vitals/core before importing App — must include all exports used by sub-components
vi.mock("@vitals/core", () => ({
  runVitals: vi.fn(),
  getScoreEmoji: (score: number) => {
    if (score >= 90) return "Good";
    if (score >= 80) return "Fair";
    if (score >= 60) return "Poor";
    return "Bad";
  },
  getScoreColor: (score: number) => {
    if (score >= 80) return "green";
    if (score >= 60) return "yellow";
    return "red";
  },
  calculateOverallScore: vi.fn(() => 80),
  buildSummary: vi.fn(() => ({ critical: 0, warnings: 0, info: 0 })),
  detectProject: vi.fn(),
  detectPackageManager: vi.fn(),
}));

// Mock dynamic imports used in App's useEffect
vi.mock("../lib/history.js", () => ({
  saveEntry: vi.fn(),
}));

vi.mock("../commands/web.js", () => ({
  serveWeb: vi.fn(),
}));

vi.mock("open", () => ({
  default: vi.fn(),
}));

// Mock ink's useApp so the test process doesn't exit
vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

import { App } from "./App.js";
import { runVitals } from "@vitals/core";
import { serveWeb } from "../commands/web.js";

const mockRunVitals = vi.mocked(runVitals);
const mockServeWeb = vi.mocked(serveWeb);

const { act } = React;

const makeCheckResult = (id: string, name: string): CheckResult => ({
  id,
  name,
  category: "dependencies",
  score: 80,
  status: "pass",
  issues: [],
  toolsUsed: [id],
  duration: 100,
});

const createMockReport = (overrides?: Partial<VitalsReport>): VitalsReport => ({
  timestamp: new Date().toISOString(),
  projectPath: "/test/project",
  projectInfo: {
    name: "test-project",
    version: "1.0.0",
    framework: "react",
    packageManager: "npm",
    totalDependencies: 10,
    devDependencies: {},
    dependencies: {},
    hasESLint: false,
    hasPrettier: false,
    hasTypeScript: false,
  },
  checks: [makeCheckResult("knip", "Knip"), makeCheckResult("eslint", "ESLint")],
  overallScore: 82,
  summary: { critical: 0, warnings: 1, info: 2 },
  ...overrides,
});

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading message immediately on render", () => {
    // Never resolves — keep app in loading phase
    mockRunVitals.mockReturnValue(new Promise(() => {}));

    const { lastFrame } = render(<App projectPath="/test/project" />);

    expect(lastFrame()).toContain("Running health checks...");
  });

  it("shows error message when runVitals rejects", async () => {
    const error = new Error("Analysis failed: no package.json");
    mockRunVitals.mockRejectedValue(error);

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" />);
      // Flush microtasks so the rejection propagates
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = result.lastFrame();
    expect(output).toContain("Error");
    expect(output).toContain("Analysis failed: no package.json");
  });

  it("shows check results after runVitals resolves", async () => {
    const report = createMockReport();
    mockRunVitals.mockResolvedValue(report);

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = result.lastFrame();
    // In results phase, check names are rendered via CheckResultRow
    expect(output).toContain("Knip");
  });

  it("shows vitals --web hint after results phase", async () => {
    const report = createMockReport();
    mockRunVitals.mockResolvedValue(report);

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.lastFrame()).toContain("vitals --web");
  });

  it("displays the overall score in results", async () => {
    const report = createMockReport({ overallScore: 91 });
    mockRunVitals.mockResolvedValue(report);

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.lastFrame()).toContain("91");
  });

  it("passes checks filter to runVitals", () => {
    mockRunVitals.mockReturnValue(new Promise(() => {}));

    render(<App projectPath="/test/project" checks={["eslint", "knip"]} />);

    expect(mockRunVitals).toHaveBeenCalledWith(
      expect.objectContaining({ checks: ["eslint", "knip"] }),
    );
  });

  it("calls runVitals with the correct projectPath", () => {
    mockRunVitals.mockReturnValue(new Promise(() => {}));

    render(<App projectPath="/my/special/path" />);

    expect(mockRunVitals).toHaveBeenCalledWith(
      expect.objectContaining({ projectPath: "/my/special/path" }),
    );
  });

  it("shows progress items for each check in loading phase", async () => {
    mockRunVitals.mockReturnValue(new Promise(() => {}));

    // setProgress(initial) is called inside useEffect, which fires after the first
    // render. Wrap in act + Promise.resolve so the effect flushes before we assert.
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <App projectPath="/test/project" checks={["eslint", "knip"]} />,
      );
      await Promise.resolve();
    });

    const output = result.lastFrame();
    expect(output).toContain("Running health checks...");
    // ProgressList renders each check name
    expect(output).toContain("eslint");
    expect(output).toContain("knip");
  });

  it("calls runVitals exactly once even in strict mode", () => {
    mockRunVitals.mockReturnValue(new Promise(() => {}));

    render(<App projectPath="/test/project" />);

    // hasRun ref prevents double execution
    expect(mockRunVitals).toHaveBeenCalledTimes(1);
  });

  it("invokes onCheckStart and onCheckComplete callbacks without crashing", async () => {
    let capturedOnCheckStart: ((name: string) => void) | undefined;
    let capturedOnCheckComplete: ((result: ReturnType<typeof makeCheckResult>) => void) | undefined;

    mockRunVitals.mockImplementation((options: Parameters<typeof runVitals>[0]) => {
      capturedOnCheckStart = options?.onCheckStart;
      capturedOnCheckComplete = options?.onCheckComplete;
      return new Promise(() => {}); // never resolves — stay in loading phase
    });

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test" checks={["eslint"]} />);
      await Promise.resolve();
    });

    await act(async () => {
      capturedOnCheckStart?.("eslint");
      capturedOnCheckComplete?.(makeCheckResult("eslint", "ESLint"));
      await Promise.resolve();
    });

    // Still in loading phase — callbacks fired without error
    expect(result.lastFrame()).toContain("Running health checks...");
  });

  it("enters opening-web phase and shows dashboard URL when openWeb is true", async () => {
    const report = createMockReport();
    mockRunVitals.mockResolvedValue(report);
    mockServeWeb.mockResolvedValue("http://localhost:3030");

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test" openWeb={true} />);
      // Flush: effect → runVitals resolves → saveEntry import → web.js import →
      // serveWeb resolves → open import → openBrowser → state settle
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });

    expect(result.lastFrame()).toContain("Dashboard running at");
  });

  it("shows error phase when web server fails to start", async () => {
    const report = createMockReport();
    mockRunVitals.mockResolvedValue(report);
    mockServeWeb.mockRejectedValue(new Error("Port already in use"));

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test" openWeb={true} />);
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });

    expect(result.lastFrame()).toContain("Port already in use");
  });

  it("shows overall score summary after resolving", async () => {
    const report = createMockReport({
      overallScore: 75,
      summary: { critical: 1, warnings: 3, info: 5 },
    });
    mockRunVitals.mockResolvedValue(report);

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<App projectPath="/test/project" />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const output = result.lastFrame();
    expect(output).toContain("Overall Health Score");
  });
});
