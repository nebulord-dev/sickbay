import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { ProjectStats } from "../commands/stats.js";

vi.mock("../commands/stats.js", () => ({
  gatherStats: vi.fn(),
}));

vi.mock("../lib/resolve-package.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/resolve-package.js")>("../lib/resolve-package.js");
  return { ...actual };
});

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

import { StatsApp } from "./StatsApp.js";
import { gatherStats } from "../commands/stats.js";

const mockGatherStats = vi.mocked(gatherStats);
const { act } = React;

function makeStats(overrides?: Partial<ProjectStats>): ProjectStats {
  return {
    project: {
      name: "my-project",
      version: "1.0.0",
      framework: "react",
      packageManager: "npm",
      totalDependencies: 10,
      dependencies: {},
      devDependencies: {},
      hasESLint: true,
      hasPrettier: false,
      hasTypeScript: true,
    },
    files: { total: 42, byExtension: { ".ts": 20, ".tsx": 15, ".css": 7 } },
    lines: { total: 4200, avgPerFile: 100 },
    components: { total: 5, functional: 5, classBased: 0 },
    dependencies: { prod: 5, dev: 5, total: 10 },
    git: { commits: 42, contributors: 3, age: "6 months ago", branch: "main" },
    testFiles: 10,
    sourceSize: "512 KB",
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

describe("StatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows scanning spinner while gathering stats", () => {
    mockGatherStats.mockReturnValue(new Promise(() => {}));

    const { lastFrame } = render(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(lastFrame()).toContain("Scanning project...");
  });

  it("shows Codebase Overview heading after loading", async () => {
    mockGatherStats.mockResolvedValue(makeStats());

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("Codebase Overview");
  });

  it("shows the framework name", async () => {
    mockGatherStats.mockResolvedValue(makeStats());

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    // framework: "react" maps to FRAMEWORK_LABELS["react"] = "React"
    expect(result.lastFrame()).toContain("React");
  });

  it("shows total file count", async () => {
    mockGatherStats.mockResolvedValue(makeStats({ files: { total: 99, byExtension: {} } }));

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("99");
  });

  it("shows Lines of Code label", async () => {
    mockGatherStats.mockResolvedValue(makeStats());

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("Lines of Code");
  });

  it("shows source size", async () => {
    mockGatherStats.mockResolvedValue(makeStats({ sourceSize: "1.2 MB" }));

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("1.2 MB");
  });

  it("shows git branch when git info is present", async () => {
    mockGatherStats.mockResolvedValue(
      makeStats({ git: { commits: 10, contributors: 1, age: "1 year ago", branch: "feature/my-branch" } }),
    );

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("feature/my-branch");
  });

  it("omits git section when git is null", async () => {
    mockGatherStats.mockResolvedValue(makeStats({ git: null }));

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).not.toContain("Git Branch");
  });

  it("shows error message when gatherStats rejects", async () => {
    mockGatherStats.mockRejectedValue(new Error("Permission denied"));

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("Permission denied");
  });

  it("does not render the UI when jsonOutput is true", async () => {
    mockGatherStats.mockResolvedValue(makeStats());

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={true} />);

    expect(result.lastFrame()).not.toContain("Codebase Overview");
  });

  it("shows tooling badges (TypeScript, ESLint)", async () => {
    mockGatherStats.mockResolvedValue(
      makeStats({ project: { ...makeStats().project, hasTypeScript: true, hasESLint: true, hasPrettier: false } }),
    );

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    const output = result.lastFrame()!;
    expect(output).toContain("TypeScript");
    expect(output).toContain("ESLint");
  });

  it("shows package manager label", async () => {
    mockGatherStats.mockResolvedValue(
      makeStats({ project: { ...makeStats().project, packageManager: "pnpm" } }),
    );

    const result = await renderAndFlush(<StatsApp projectPath="/test" jsonOutput={false} />);

    expect(result.lastFrame()).toContain("pnpm");
  });

  describe("monorepo mode", () => {
    const packagePaths = ["/root/packages/app-a", "/root/packages/app-b"];
    const packageNames = new Map([
      ["/root/packages/app-a", "@scope/app-a"],
      ["/root/packages/app-b", "app-b"],
    ]);

    it("shows monorepo scanning message with package count", () => {
      mockGatherStats.mockReturnValue(new Promise(() => {}));

      const { lastFrame } = render(
        <StatsApp
          projectPath="/root"
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      expect(lastFrame()).toContain("2 packages");
    });

    it("shows Monorepo Overview with per-package table", async () => {
      mockGatherStats
        .mockResolvedValueOnce(makeStats({ project: { ...makeStats().project, name: "app-a", framework: "react" } }))
        .mockResolvedValueOnce(makeStats({ project: { ...makeStats().project, name: "app-b", framework: "next" } }));

      const result = await renderAndFlush(
        <StatsApp
          projectPath="/root"
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain("Monorepo Overview");
      expect(output).toContain("app-a");
      expect(output).toContain("app-b");
      expect(output).toContain("Total");
    });

    it("shows aggregate totals row", async () => {
      mockGatherStats
        .mockResolvedValueOnce(makeStats({ files: { total: 10, byExtension: {} }, lines: { total: 500, avgPerFile: 50 } }))
        .mockResolvedValueOnce(makeStats({ files: { total: 20, byExtension: {} }, lines: { total: 1000, avgPerFile: 50 } }));

      const result = await renderAndFlush(
        <StatsApp
          projectPath="/root"
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain("30");
      expect(output).toContain("1,500");
    });
  });
});
