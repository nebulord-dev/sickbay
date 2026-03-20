import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { DiagnosticResult } from "../commands/doctor.js";

vi.mock("../commands/doctor.js", () => ({
  runDiagnostics: vi.fn(),
}));

vi.mock("../lib/resolve-package.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/resolve-package.js")>("../lib/resolve-package.js");
  return { ...actual };
});

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

import { DoctorApp } from "./DoctorApp.js";
import { runDiagnostics } from "../commands/doctor.js";

const mockRunDiagnostics = vi.mocked(runDiagnostics);
const { act } = React;

function makeResult(overrides: Partial<DiagnosticResult> = {}): DiagnosticResult {
  return { id: "test", label: "Test Check", status: "pass", message: "All good", ...overrides };
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

describe("DoctorApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spinner while diagnostics are running", () => {
    mockRunDiagnostics.mockReturnValue(new Promise(() => {}));

    const { lastFrame } = render(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    expect(lastFrame()).toContain("Running project diagnostics...");
  });

  it("shows Project Setup Diagnosis heading after completion", async () => {
    mockRunDiagnostics.mockResolvedValue([makeResult()]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("Project Setup Diagnosis");
  });

  it("renders ✓ icon and label for a passing result", async () => {
    mockRunDiagnostics.mockResolvedValue([
      makeResult({ label: ".gitignore exists", status: "pass", message: "All standard entries present" }),
    ]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    const output = result.lastFrame()!;
    expect(output).toContain("✓");
    expect(output).toContain(".gitignore exists");
    expect(output).toContain("All standard entries present");
  });

  it("renders ✗ icon for a failing result", async () => {
    mockRunDiagnostics.mockResolvedValue([
      makeResult({ label: "Lockfile", status: "fail", message: "No lockfile found" }),
    ]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    const output = result.lastFrame()!;
    expect(output).toContain("✗");
    expect(output).toContain("No lockfile found");
  });

  it("renders ⚠ icon for a warning result", async () => {
    mockRunDiagnostics.mockResolvedValue([
      makeResult({ label: "Engines", status: "warn", message: "No engines field" }),
    ]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("⚠");
  });

  it("shows fixCommand for a non-passing result that has one", async () => {
    mockRunDiagnostics.mockResolvedValue([
      makeResult({ status: "fail", message: "No lockfile", fixCommand: "npm install" }),
    ]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("npm install");
  });

  it("shows fixDescription when there is no fixCommand", async () => {
    mockRunDiagnostics.mockResolvedValue([
      makeResult({ status: "warn", message: "No engines", fixDescription: "Add engines field to package.json" }),
    ]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("Add engines field to package.json");
  });

  it("shows correct summary counts", async () => {
    mockRunDiagnostics.mockResolvedValue([
      makeResult({ id: "a", status: "pass" }),
      makeResult({ id: "b", status: "pass" }),
      makeResult({ id: "c", status: "warn", message: "w" }),
      makeResult({ id: "d", status: "fail", message: "f" }),
    ]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    const output = result.lastFrame()!;
    expect(output).toContain("2 passed");
    expect(output).toContain("1 warnings");
    expect(output).toContain("1 failed");
  });

  it("does not render the UI when jsonOutput is true", async () => {
    mockRunDiagnostics.mockResolvedValue([makeResult()]);

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={true} />,
    );

    expect(result.lastFrame()).not.toContain("Project Setup Diagnosis");
  });

  it("shows error message when runDiagnostics rejects", async () => {
    mockRunDiagnostics.mockRejectedValue(new Error("Disk full"));

    const result = await renderAndFlush(
      <DoctorApp projectPath="/test" autoFix={false} jsonOutput={false} />,
    );

    expect(result.lastFrame()).toContain("Failed: Disk full");
  });

  describe("monorepo mode", () => {
    const packagePaths = ["/root/packages/app-a", "/root/packages/app-b"];
    const packageNames = new Map([
      ["/root/packages/app-a", "@scope/app-a"],
      ["/root/packages/app-b", "app-b"],
    ]);

    it("shows monorepo scanning message", () => {
      mockRunDiagnostics.mockReturnValue(new Promise(() => {}));

      const { lastFrame } = render(
        <DoctorApp
          projectPath="/root"
          autoFix={false}
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      expect(lastFrame()).toContain("across 2 packages");
    });

    it("shows Monorepo Setup Diagnosis heading with per-package results", async () => {
      mockRunDiagnostics
        .mockResolvedValueOnce([makeResult({ id: "git-a", label: "Gitignore", status: "pass", message: "OK" })])
        .mockResolvedValueOnce([makeResult({ id: "git-b", label: "Gitignore", status: "fail", message: "Missing" })]);

      const result = await renderAndFlush(
        <DoctorApp
          projectPath="/root"
          autoFix={false}
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain("Monorepo Setup Diagnosis");
      expect(output).toContain("app-a");
      expect(output).toContain("app-b");
    });

    it("shows aggregate summary counts across packages", async () => {
      mockRunDiagnostics
        .mockResolvedValueOnce([
          makeResult({ id: "a1", status: "pass" }),
          makeResult({ id: "a2", status: "fail", message: "x" }),
        ])
        .mockResolvedValueOnce([
          makeResult({ id: "b1", status: "warn", message: "w" }),
        ]);

      const result = await renderAndFlush(
        <DoctorApp
          projectPath="/root"
          autoFix={false}
          jsonOutput={false}
          isMonorepo={true}
          packagePaths={packagePaths}
          packageNames={packageNames}
        />,
      );

      const output = result.lastFrame()!;
      expect(output).toContain("1 passed");
      expect(output).toContain("1 warnings");
      expect(output).toContain("1 failed");
    });
  });
});
