import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { TrendHistory, TrendEntry } from "../lib/history.js";

vi.mock("../lib/history.js", () => ({
  loadHistory: vi.fn(),
  detectRegressions: vi.fn(() => []),
}));

vi.mock("../lib/resolve-package.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/resolve-package.js")>("../lib/resolve-package.js");
  return { ...actual };
});

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

import { TrendApp } from "./TrendApp.js";
import { loadHistory, detectRegressions } from "../lib/history.js";

const mockLoadHistory = vi.mocked(loadHistory);
const mockDetectRegressions = vi.mocked(detectRegressions);
const { act } = React;

function makeTrendEntry(score: number, timestamp = "2024-01-15T00:00:00.000Z"): TrendEntry {
  return {
    timestamp,
    overallScore: score,
    categoryScores: { dependencies: 80, security: 90, "code-quality": 70 },
    summary: { critical: 0, warnings: 1, info: 2 },
    checksRun: 10,
  };
}

function makeTrendHistory(entries: TrendEntry[], projectName = "my-awesome-project"): TrendHistory {
  return { projectPath: "/test/project", projectName, entries };
}

async function renderAndFlush(element: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(element);
    await Promise.resolve();
  });
  return result;
}

describe("TrendApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectRegressions.mockReturnValue([]);
  });

  it("shows no-history message when loadHistory returns null", async () => {
    mockLoadHistory.mockReturnValue(null);

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("No scan history found");
  });

  it("shows no-history message when history has no entries", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([]));

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("No scan history found");
  });

  it("shows Score History heading when entries exist", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([makeTrendEntry(80)]));

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("Score History");
  });

  it("shows scan count", async () => {
    mockLoadHistory.mockReturnValue(
      makeTrendHistory([makeTrendEntry(80), makeTrendEntry(85), makeTrendEntry(90)]),
    );

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("3 scans recorded");
  });

  it("shows the latest overall score", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([makeTrendEntry(73)]));

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("73/100");
  });

  it("shows project name", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([makeTrendEntry(80)]));

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("my-awesome-project");
  });

  it("shows regression section when regressions are detected", async () => {
    mockLoadHistory.mockReturnValue(
      makeTrendHistory([makeTrendEntry(90), makeTrendEntry(70)]),
    );
    mockDetectRegressions.mockReturnValue([
      { category: "security", drop: 20, from: 90, to: 70 },
    ]);

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("Regressions Detected");
  });

  it("shows first scan and latest date labels", async () => {
    mockLoadHistory.mockReturnValue(
      makeTrendHistory([
        makeTrendEntry(80, "2024-01-01T00:00:00.000Z"),
        makeTrendEntry(85, "2024-06-15T00:00:00.000Z"),
      ]),
    );

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    const output = result.lastFrame()!;
    expect(output).toContain("First scan:");
    expect(output).toContain("Latest:");
  });

  it("respects the last parameter to limit entries shown", async () => {
    mockLoadHistory.mockReturnValue(
      makeTrendHistory([
        makeTrendEntry(60),
        makeTrendEntry(70),
        makeTrendEntry(80),
        makeTrendEntry(90),
      ]),
    );

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={2} jsonOutput={false} />,
    );

    // With last=2, only the final 2 entries are shown
    expect(result.lastFrame()).toContain("2 scans recorded");
  });

  it("does not render the UI when jsonOutput is true", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([makeTrendEntry(80)]));

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={true} />,
    );

    expect(result.lastFrame()).not.toContain("Score History");
  });

  it("shows singular 'scan recorded' for a single entry", async () => {
    mockLoadHistory.mockReturnValue(makeTrendHistory([makeTrendEntry(80)]));

    const result = await renderAndFlush(
      <TrendApp projectPath="/test" last={10} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("1 scan recorded");
  });

  describe("monorepo mode", () => {
    const packagePaths = ["/root/packages/app-a", "/root/packages/app-b"];
    const packageNames = new Map([
      ["/root/packages/app-a", "@scope/app-a"],
      ["/root/packages/app-b", "app-b"],
    ]);

    it("shows no-history message when no packages have history", async () => {
      mockLoadHistory.mockReturnValue(null);

      const result = await renderAndFlush(
        <TrendApp
          projectPath="/root"
          last={10}
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      expect(result.lastFrame()).toContain("No scan history found for any package");
    });

    it("shows Monorepo Score Trends heading with per-package sparklines", async () => {
      mockLoadHistory
        .mockReturnValueOnce(makeTrendHistory([makeTrendEntry(80), makeTrendEntry(85)], "app-a"))
        .mockReturnValueOnce(makeTrendHistory([makeTrendEntry(70), makeTrendEntry(75)], "app-b"));

      const result = await renderAndFlush(
        <TrendApp
          projectPath="/root"
          last={10}
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain("Monorepo Score Trends");
      expect(output).toContain("app-a");
      expect(output).toContain("app-b");
    });

    it("shows count of packages with vs without history", async () => {
      mockLoadHistory
        .mockReturnValueOnce(makeTrendHistory([makeTrendEntry(80)], "app-a"))
        .mockReturnValueOnce(null);

      const result = await renderAndFlush(
        <TrendApp
          projectPath="/root"
          last={10}
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain("1 of 2 packages have history");
      expect(output).toContain("1 package with no history yet");
    });
  });
});
