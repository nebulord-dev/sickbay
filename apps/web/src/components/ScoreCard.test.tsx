import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreCard } from "./ScoreCard";
import type { CheckResult } from "@nebulord/sickbay-core";

const createMockCheck = (overrides?: Partial<CheckResult>): CheckResult => ({
  id: "test-check",
  name: "Test Check",
  category: "dependencies",
  score: 85,
  status: "pass",
  issues: [],
  toolsUsed: ["test-tool"],
  duration: 100,
  ...overrides,
});

describe("ScoreCard", () => {
  it("renders check name", () => {
    const check = createMockCheck({ name: "Security Audit" });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.getByText(/Security Audit/)).toBeInTheDocument();
  });

  it("displays score value", () => {
    const check = createMockCheck({ score: 92 });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.getByText("92")).toBeInTheDocument();
  });

  it("displays tools used", () => {
    const check = createMockCheck({ toolsUsed: ["eslint", "prettier"] });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.getByText("eslint, prettier")).toBeInTheDocument();
  });

  it("shows issue count when issues present", () => {
    const check = createMockCheck({
      issues: [
        { severity: "warning", message: "Issue 1", reportedBy: ["test"] },
        { severity: "warning", message: "Issue 2", reportedBy: ["test"] },
        { severity: "info", message: "Issue 3", reportedBy: ["test"] },
      ],
    });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.getByText("3 issues")).toBeInTheDocument();
  });

  it('shows singular "issue" for one issue', () => {
    const check = createMockCheck({
      issues: [
        { severity: "info", message: "Single issue", reportedBy: ["test"] },
      ],
    });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.getByText("1 issue")).toBeInTheDocument();
  });

  it("hides issue count when no issues", () => {
    const check = createMockCheck({ issues: [] });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.queryByText(/issue/i)).not.toBeInTheDocument();
  });

  it("highlights critical issues separately", () => {
    const check = createMockCheck({
      issues: [
        {
          severity: "critical",
          message: "Critical issue 1",
          reportedBy: ["test"],
        },
        {
          severity: "critical",
          message: "Critical issue 2",
          reportedBy: ["test"],
        },
        { severity: "warning", message: "Warning", reportedBy: ["test"] },
      ],
    });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    expect(screen.getByText(/2 Critical/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical issue 1/)).toBeInTheDocument();
  });

  it("uses correct color class for high scores", () => {
    const check = createMockCheck({ score: 90 });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    const scoreElement = screen.getByText("90");
    expect(scoreElement).toHaveClass("text-green-400");
  });

  it("uses correct color class for medium scores", () => {
    const check = createMockCheck({ score: 70 });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    const scoreElement = screen.getByText("70");
    expect(scoreElement).toHaveClass("text-yellow-400");
  });

  it("uses correct color class for low scores", () => {
    const check = createMockCheck({ score: 40 });
    render(<ScoreCard check={check} onClick={() => {}} active={false} />);

    const scoreElement = screen.getByText("40");
    expect(scoreElement).toHaveClass("text-red-400");
  });
});
