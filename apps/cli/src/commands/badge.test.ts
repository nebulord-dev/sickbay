import { describe, it, expect, vi, beforeEach } from 'vitest';

// Force POSIX path semantics so mocks comparing forward-slash literals
// (e.g. `.sickbay/last-report.json`) match the path.join output on Windows.
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from 'fs';

import {
  getScoreColor,
  badgeUrl,
  badgeMarkdown,
  badgeHtml,
  loadScoreFromLastReport,
} from './badge.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getScoreColor', () => {
  it('returns brightgreen for scores >= 90', () => {
    expect(getScoreColor(90)).toBe('brightgreen');
    expect(getScoreColor(95)).toBe('brightgreen');
    expect(getScoreColor(100)).toBe('brightgreen');
  });

  it('returns green for scores 80-89', () => {
    expect(getScoreColor(80)).toBe('green');
    expect(getScoreColor(85)).toBe('green');
    expect(getScoreColor(89)).toBe('green');
  });

  it('returns yellow for scores 60-79', () => {
    expect(getScoreColor(60)).toBe('yellow');
    expect(getScoreColor(70)).toBe('yellow');
    expect(getScoreColor(79)).toBe('yellow');
  });

  it('returns red for scores below 60', () => {
    expect(getScoreColor(0)).toBe('red');
    expect(getScoreColor(40)).toBe('red');
    expect(getScoreColor(59)).toBe('red');
  });
});

describe('badgeUrl', () => {
  it('generates a shields.io static badge URL', () => {
    const url = badgeUrl(92);
    expect(url).toBe('https://img.shields.io/badge/sickbay-92%2F100-brightgreen');
  });

  it('uses custom label when provided', () => {
    const url = badgeUrl(75, 'project health');
    expect(url).toBe('https://img.shields.io/badge/project%20health-75%2F100-yellow');
  });

  it('encodes special characters in label', () => {
    const url = badgeUrl(85, 'my-app');
    expect(url).toBe('https://img.shields.io/badge/my--app-85%2F100-green');
  });

  it('uses correct color for each threshold', () => {
    expect(badgeUrl(95)).toContain('brightgreen');
    expect(badgeUrl(82)).toContain('green');
    expect(badgeUrl(65)).toContain('yellow');
    expect(badgeUrl(30)).toContain('red');
  });
});

describe('badgeMarkdown', () => {
  it('wraps badge URL in markdown image syntax', () => {
    const md = badgeMarkdown(92);
    expect(md).toBe('![sickbay](https://img.shields.io/badge/sickbay-92%2F100-brightgreen)');
  });

  it('uses custom label in alt text', () => {
    const md = badgeMarkdown(75, 'project health');
    expect(md).toContain('![project health]');
  });
});

describe('badgeHtml', () => {
  it('wraps badge URL in an img tag', () => {
    const html = badgeHtml(92);
    expect(html).toBe(
      '<img src="https://img.shields.io/badge/sickbay-92%2F100-brightgreen" alt="sickbay" />',
    );
  });

  it('uses custom label in alt attribute', () => {
    const html = badgeHtml(75, 'project health');
    expect(html).toContain('alt="project health"');
  });

  it('escapes HTML-dangerous characters in the label', () => {
    // --label is user-controlled. An unescaped interpolation like
    // alt="${label}" turns `" onload="alert(1)` into an executable handler
    // when the resulting snippet is pasted into a README rendered as HTML.
    const html = badgeHtml(80, '" onload="alert(1)');
    expect(html).not.toContain('onload="alert(1)');
    expect(html).toContain('&quot; onload=&quot;alert(1)');
  });

  it('escapes angle brackets and ampersands in the label', () => {
    const html = badgeHtml(80, '<script>&"\'');
    expect(html).toContain('&lt;script&gt;&amp;&quot;&#39;');
    expect(html).not.toContain('<script>');
  });
});

describe('loadScoreFromLastReport', () => {
  it('returns score from last-report.json when it exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ overallScore: 87 }) as never);

    const score = loadScoreFromLastReport('/test/project');
    expect(score).toBe(87);
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.sickbay/last-report.json'),
      'utf-8',
    );
  });

  it('returns null when last-report.json does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const score = loadScoreFromLastReport('/test/project');
    expect(score).toBeNull();
  });

  it('returns null when file is malformed', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not json' as never);

    const score = loadScoreFromLastReport('/test/project');
    expect(score).toBeNull();
  });

  it('returns null when overallScore is missing', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ timestamp: '2026-01-01' }) as never);

    const score = loadScoreFromLastReport('/test/project');
    expect(score).toBeNull();
  });
});
