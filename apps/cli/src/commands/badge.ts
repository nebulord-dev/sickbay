import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getScoreColor(score: number): string {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function encodeLabel(label: string): string {
  return label.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '%20');
}

/**
 * Escape characters that break out of HTML attributes when interpolated.
 * `--label` is user-controlled CLI input, so embedding it in `<img alt="...">`
 * without escaping turns `" onload="alert(1)` into an executable handler if
 * the generated snippet is pasted into a README rendered as HTML.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape characters that break the `![alt](url)` syntax when interpolated
 * into the alt-text position. A label like `](javascript:alert(1)` would
 * otherwise close the alt early and inject a link target — some renderers
 * strip `javascript:` URIs, but not all, so treat it as unsafe by default.
 * Backslash is escaped first so later escapes don't double up on it.
 */
function escapeMarkdownAlt(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function badgeUrl(score: number, label = 'sickbay'): string {
  const color = getScoreColor(score);
  const encoded = encodeLabel(label);
  return `https://img.shields.io/badge/${encoded}-${score}%2F100-${color}`;
}

export function badgeMarkdown(score: number, label = 'sickbay'): string {
  return `![${escapeMarkdownAlt(label)}](${badgeUrl(score, label)})`;
}

export function badgeHtml(score: number, label = 'sickbay'): string {
  return `<img src="${escapeHtml(badgeUrl(score, label))}" alt="${escapeHtml(label)}" />`;
}

export function loadScoreFromLastReport(projectPath: string): number | null {
  const filePath = join(projectPath, '.sickbay', 'last-report.json');
  if (!existsSync(filePath)) return null;
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (typeof data.overallScore !== 'number') return null;
    return data.overallScore;
  } catch {
    return null;
  }
}
