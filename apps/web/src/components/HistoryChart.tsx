import { useState } from "react";
import { SCORE_GOOD, SCORE_FAIR } from "@nebulord/sickbay-core";

export interface TrendEntry {
  timestamp: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  summary: { critical: number; warnings: number; info: number };
  checksRun: number;
}

export interface TrendHistory {
  projectPath: string;
  projectName: string;
  entries: TrendEntry[];
}

interface HistoryChartProps {
  history: TrendHistory;
}

const CATEGORY_COLORS: Record<string, string> = {
  dependencies: "#60a5fa",
  security: "#f87171",
  "code-quality": "#a78bfa",
  performance: "#fb923c",
  git: "#34d399",
};

const PAD = { top: 20, right: 24, bottom: 44, left: 44 };
const VIEW_W = 800;
const VIEW_H = 300;
const CHART_W = VIEW_W - PAD.left - PAD.right;
const CHART_H = VIEW_H - PAD.top - PAD.bottom;

function scoreToY(score: number): number {
  return PAD.top + (1 - score / 100) * CHART_H;
}

function entryToX(i: number, total: number): number {
  if (total === 1) return PAD.left + CHART_W / 2;
  return PAD.left + (i / (total - 1)) * CHART_W;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function scoreColor(score: number): string {
  if (score >= SCORE_GOOD) return "#4ade80";
  if (score >= SCORE_FAIR) return "#facc15";
  return "#f87171";
}

export function HistoryChart({ history }: HistoryChartProps) {
  const { entries } = history;

  const allCategories = Array.from(
    new Set(entries.flatMap((e) => Object.keys(e.categoryScores))),
  );

  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set(),
  );

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm font-mono">
        No history yet — run <code className="mx-1 px-1 bg-card rounded-sm">sickbay</code> to start tracking
      </div>
    );
  }

  const toggleCategory = (cat: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const n = entries.length;

  // X-axis labels — show at most 8 to avoid crowding
  const labelStep = Math.max(1, Math.ceil(n / 8));
  const xLabels = entries
    .map((e, i) => ({ i, timestamp: e.timestamp, label: formatDate(e.timestamp) }))
    .filter(({ i }) => i % labelStep === 0 || i === n - 1);

  // Y-axis labels
  const yLabels = [0, 20, 40, 60, 80, 100];

  // Build polyline points for a series
  function points(values: number[]): string {
    return values
      .map((v, i) => `${entryToX(i, n)},${scoreToY(v)}`)
      .join(" ");
  }

  const overallPoints = points(entries.map((e) => e.overallScore));

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-lg border border-border p-4">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          aria-label="Score history chart"
          role="img"
        >
          {/* Y-axis gridlines */}
          {yLabels.map((y) => (
            <g key={y}>
              <line
                x1={PAD.left}
                y1={scoreToY(y)}
                x2={PAD.left + CHART_W}
                y2={scoreToY(y)}
                stroke={y === 60 || y === 80 ? (y === 80 ? "#4ade8033" : "#facc1533") : "#ffffff0d"}
                strokeWidth={y === 60 || y === 80 ? 1.5 : 1}
                strokeDasharray={y === 60 || y === 80 ? "4 3" : undefined}
              />
              <text
                x={PAD.left - 8}
                y={scoreToY(y) + 4}
                textAnchor="end"
                fontSize={10}
                fill="#6b7280"
              >
                {y}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {xLabels.map(({ i, timestamp, label }) => (
            <text
              key={timestamp}
              x={entryToX(i, n)}
              y={VIEW_H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7280"
            >
              {label}
            </text>
          ))}

          {/* Category lines (behind overall) */}
          {allCategories.map((cat) => {
            if (hiddenCategories.has(cat)) return null;
            const values = entries.map(
              (e) => e.categoryScores[cat] ?? 0,
            );
            return (
              <polyline
                key={cat}
                points={points(values)}
                fill="none"
                stroke={CATEGORY_COLORS[cat] ?? "#9ca3af"}
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
            );
          })}

          {/* Overall score line (prominent) */}
          <polyline
            points={overallPoints}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.5}
          />

          {/* Overall score dots */}
          {entries.map((e, i) => (
            <circle
              key={e.timestamp}
              cx={entryToX(i, n)}
              cy={scoreToY(e.overallScore)}
              r={3}
              fill={scoreColor(e.overallScore)}
              stroke="#0d1117"
              strokeWidth={1}
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {/* Overall */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-white">
          <span className="inline-block w-5 h-0.5 bg-white rounded-sm" />
          overall
        </div>

        {allCategories.map((cat) => {
          const color = CATEGORY_COLORS[cat] ?? "#9ca3af";
          const hidden = hiddenCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`flex items-center gap-1.5 text-xs font-mono transition-opacity ${hidden ? "opacity-30" : "opacity-80 hover:opacity-100"}`}
              style={{ color }}
            >
              <span
                className="inline-block w-5 h-0.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Latest scores summary */}
      {entries.length > 0 && (() => {
        const latest = entries[entries.length - 1];
        const prev = entries.length > 1 ? entries[entries.length - 2] : null;
        const delta = prev ? latest.overallScore - prev.overallScore : null;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="bg-surface border border-border rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">current overall</div>
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: scoreColor(latest.overallScore) }}
              >
                {latest.overallScore}
                {delta !== null && (
                  <span
                    className="text-sm ml-1.5"
                    style={{ color: delta >= 0 ? "#4ade80" : "#f87171" }}
                  >
                    {delta >= 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
            </div>

            {allCategories.map((cat) => {
              const score = latest.categoryScores[cat];
              if (score == null) return null;
              return (
                <div
                  key={cat}
                  className="bg-surface border border-border rounded-lg p-3"
                >
                  <div className="text-xs text-gray-500 mb-1">{cat}</div>
                  <div
                    className="text-2xl font-bold font-mono"
                    style={{ color: CATEGORY_COLORS[cat] ?? scoreColor(score) }}
                  >
                    {score}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
