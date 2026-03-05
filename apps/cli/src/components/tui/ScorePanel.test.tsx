import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScorePanel } from "./ScorePanel.js";
import type { VitalsReport } from "@vitals/core";

const createMockReport = (
  overallScore: number,
  summary: { critical: number; warnings: number; info: number } = {
    critical: 0,
    warnings: 0,
    info: 0,
  }
): VitalsReport => ({
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
  checks: [],
  overallScore,
  summary,
});

describe("ScorePanel", () => {
  it("shows waiting state when report is null", () => {
    const { lastFrame } = render(
      <ScorePanel report={null} previousScore={null} />
    );
    expect(lastFrame()).toContain("Waiting for scan...");
  });

  it("displays score as X/100", () => {
    const report = createMockReport(85);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).toContain("85/100");
  });

  it("shows positive delta when score improved", () => {
    const report = createMockReport(90);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={85} />
    );
    expect(lastFrame()).toContain("+5");
    expect(lastFrame()).toContain("since last scan");
  });

  it("shows negative delta when score dropped", () => {
    const report = createMockReport(72);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={75} />
    );
    expect(lastFrame()).toContain("-3");
    expect(lastFrame()).toContain("since last scan");
  });

  it("shows zero delta when score is unchanged", () => {
    const report = createMockReport(70);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={70} />
    );
    expect(lastFrame()).toContain("since last scan");
    expect(lastFrame()).toContain("±0");
  });

  it("does not show delta when previousScore is null", () => {
    const report = createMockReport(80);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).not.toContain("since last scan");
  });

  it("shows critical count in summary", () => {
    const report = createMockReport(60, { critical: 3, warnings: 2, info: 5 });
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).toContain("3 critical");
  });

  it("shows warnings count in summary", () => {
    const report = createMockReport(60, { critical: 0, warnings: 7, info: 2 });
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).toContain("7 warn");
  });

  it("shows info count in summary", () => {
    const report = createMockReport(75, { critical: 0, warnings: 0, info: 4 });
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).toContain("4 info");
  });

  it("renders score bar characters for non-zero score", () => {
    const report = createMockReport(85);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    // Score bar uses block characters
    expect(lastFrame()).toContain("█");
  });

  it("renders score of 0", () => {
    const report = createMockReport(0);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).toContain("0/100");
  });

  it("renders score of 100", () => {
    const report = createMockReport(100);
    const { lastFrame } = render(
      <ScorePanel report={report} previousScore={null} />
    );
    expect(lastFrame()).toContain("100/100");
  });
});
