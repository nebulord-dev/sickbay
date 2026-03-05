/**
 * This module provides utility functions for generating sparklines and trend arrows based on numerical data.
 * The sparkline function converts an array of numbers into a string of characters that visually represent the relative values,
 * while the trendArrow function analyzes the trend of the values and returns an arrow indicating whether the trend is upward, downward, or stable.
 */

const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map(
      (v) =>
        SPARKLINE_CHARS[
          Math.round(((v - min) / range) * (SPARKLINE_CHARS.length - 1))
        ],
    )
    .join("");
}

export function trendArrow(values: number[]): {
  direction: "up" | "down" | "stable";
  label: string;
} {
  if (values.length < 2) return { direction: "stable", label: "—" };
  const latest = values[values.length - 1];
  const first = values[0];
  const diff = latest - first;
  if (diff > 2) return { direction: "up", label: `↑${diff}` };
  if (diff < -2) return { direction: "down", label: `↓${Math.abs(diff)}` };
  return { direction: "stable", label: "±0" };
}
