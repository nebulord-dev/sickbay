import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryChart } from "./HistoryChart";
import type { TrendHistory } from "./HistoryChart";

function makeHistory(overrides: Partial<TrendHistory> = {}): TrendHistory {
  return {
    projectPath: "/test/project",
    projectName: "test-project",
    entries: [],
    ...overrides,
  };
}

function makeEntry(
  overallScore: number,
  categoryScores: Record<string, number> = {},
  timestamp = "2024-06-01T12:00:00.000Z",
) {
  return {
    timestamp,
    overallScore,
    categoryScores,
    summary: { critical: 0, warnings: 0, info: 0 },
    checksRun: 5,
  };
}

describe("HistoryChart", () => {
  describe("empty state", () => {
    it("shows empty message when no entries", () => {
      render(<HistoryChart history={makeHistory()} />);

      expect(screen.getByText(/No history yet/)).toBeInTheDocument();
    });

    it("does not render an SVG when no entries", () => {
      const { container } = render(<HistoryChart history={makeHistory()} />);

      expect(container.querySelector("svg")).not.toBeInTheDocument();
    });
  });

  describe("with data", () => {
    it("renders an SVG chart when entries exist", () => {
      const history = makeHistory({
        entries: [makeEntry(80, { security: 90, dependencies: 75 })],
      });
      const { container } = render(<HistoryChart history={history} />);

      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("renders Y-axis score labels", () => {
      const history = makeHistory({
        entries: [makeEntry(80)],
      });
      render(<HistoryChart history={history} />);

      // Y-axis labels at 0, 20, 40, 60, 80, 100
      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("60")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("renders the overall score in the summary cards", () => {
      const history = makeHistory({
        entries: [makeEntry(85, { security: 90 })],
      });
      render(<HistoryChart history={history} />);

      expect(screen.getByText("85")).toBeInTheDocument();
    });

    it("shows delta from previous entry", () => {
      const history = makeHistory({
        entries: [
          makeEntry(70, {}, "2024-06-01T12:00:00.000Z"),
          makeEntry(80, {}, "2024-06-02T12:00:00.000Z"),
        ],
      });
      render(<HistoryChart history={history} />);

      expect(screen.getByText("+10")).toBeInTheDocument();
    });

    it("shows negative delta when score drops", () => {
      const history = makeHistory({
        entries: [
          makeEntry(80, {}, "2024-06-01T12:00:00.000Z"),
          makeEntry(70, {}, "2024-06-02T12:00:00.000Z"),
        ],
      });
      render(<HistoryChart history={history} />);

      expect(screen.getByText("-10")).toBeInTheDocument();
    });

    it("renders category legend buttons for each category", () => {
      const history = makeHistory({
        entries: [
          makeEntry(80, { security: 90, dependencies: 75, "code-quality": 85 }),
        ],
      });
      render(<HistoryChart history={history} />);

      expect(screen.getByRole("button", { name: /security/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /dependencies/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /code-quality/ })).toBeInTheDocument();
    });

    it("toggles category visibility when legend button is clicked", () => {
      const history = makeHistory({
        entries: [makeEntry(80, { security: 90 })],
      });
      const { container } = render(<HistoryChart history={history} />);

      const btn = screen.getByRole("button", { name: /security/ });
      const polylinesBefore = container.querySelectorAll("polyline").length;

      fireEvent.click(btn);

      const polylinesAfter = container.querySelectorAll("polyline").length;
      // One category line hidden — overall line remains
      expect(polylinesAfter).toBe(polylinesBefore - 1);
    });

    it("renders category score cards for each category", () => {
      const history = makeHistory({
        entries: [makeEntry(85, { security: 92, dependencies: 78 })],
      });
      render(<HistoryChart history={history} />);

      // "security" appears in both legend and score card
      expect(screen.getAllByText("security").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("92")).toBeInTheDocument();
      expect(screen.getAllByText("dependencies").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("78")).toBeInTheDocument();
    });

    it("renders X-axis date label for the entry", () => {
      const history = makeHistory({
        entries: [makeEntry(80, {}, "2024-06-15T12:00:00.000Z")],
      });
      render(<HistoryChart history={history} />);

      // Date formatted as M/D
      expect(screen.getByText("6/15")).toBeInTheDocument();
    });
  });
});
