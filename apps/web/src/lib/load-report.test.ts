import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadReport } from './load-report.js';
import type { SickbayReport } from '@nebulord/sickbay-core';

const mockReport: SickbayReport = {
  timestamp: '2024-01-01T00:00:00.000Z',
  projectPath: '/test/project',
  projectInfo: {
    name: 'test-project',
    version: '1.0.0',
    framework: 'react',
    packageManager: 'npm',
    totalDependencies: 10,
    dependencies: {},
    devDependencies: {},
    hasESLint: false,
    hasPrettier: false,
    hasTypeScript: true,
  },
  overallScore: 80,
  summary: { critical: 0, warnings: 1, info: 2 },
  checks: [],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadReport', () => {
  it('is a function', async () => {
    const { loadReport: fn } = await import('./load-report.js');
    expect(typeof fn).toBe('function');
  });

  describe('URL query param (highest priority)', () => {
    it('returns report decoded from a valid base64 query param', async () => {
      vi.stubGlobal('location', { search: `?report=${btoa(JSON.stringify(mockReport))}` });

      const result = await loadReport();

      expect(result).toEqual(mockReport);
    });

    it('does not call fetch when a valid base64 param is present', async () => {
      vi.stubGlobal('location', { search: `?report=${btoa(JSON.stringify(mockReport))}` });

      await loadReport();

      expect(fetch).not.toHaveBeenCalled();
    });

    it('falls through to fetch when the base64 param is malformed', async () => {
      vi.stubGlobal('location', { search: '?report=!!!not-base64!!!' });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockReport),
      } as unknown as Response);

      const result = await loadReport();

      expect(result).toEqual(mockReport);
    });
  });

  describe('server fetch (second priority)', () => {
    it('returns report from /sickbay-report.json', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockReport),
      } as unknown as Response);

      const result = await loadReport();

      expect(result).toEqual(mockReport);
      expect(fetch).toHaveBeenCalledWith('/sickbay-report.json');
    });

    it('falls through when the response status is not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        headers: { get: () => 'application/json' },
      } as unknown as Response);
      localStorage.setItem('sickbay-report', JSON.stringify(mockReport));

      const result = await loadReport();

      expect(result).toEqual(mockReport);
    });

    it('falls through when content-type is not json', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
      } as unknown as Response);
      localStorage.setItem('sickbay-report', JSON.stringify(mockReport));

      const result = await loadReport();

      expect(result).toEqual(mockReport);
    });

    it('falls through when fetch throws a network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      localStorage.setItem('sickbay-report', JSON.stringify(mockReport));

      const result = await loadReport();

      expect(result).toEqual(mockReport);
    });
  });

  describe('localStorage fallback (lowest priority)', () => {
    it('returns report from localStorage when other sources are unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'));
      localStorage.setItem('sickbay-report', JSON.stringify(mockReport));

      const result = await loadReport();

      expect(result).toEqual(mockReport);
    });

    it('returns null when localStorage contains corrupted JSON', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'));
      localStorage.setItem('sickbay-report', '{not valid json{{');

      const result = await loadReport();

      expect(result).toBeNull();
    });

    it('returns null when localStorage is empty', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'));

      const result = await loadReport();

      expect(result).toBeNull();
    });
  });

  describe('priority ordering', () => {
    it('prefers URL param over fetch', async () => {
      const urlReport = { ...mockReport, overallScore: 99 };
      vi.stubGlobal('location', { search: `?report=${btoa(JSON.stringify(urlReport))}` });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ ...mockReport, overallScore: 1 }),
      } as unknown as Response);

      const result = await loadReport();

      expect(result?.overallScore).toBe(99);
    });

    it('prefers fetch over localStorage', async () => {
      localStorage.setItem('sickbay-report', JSON.stringify({ ...mockReport, overallScore: 1 }));
      const fetchReport = { ...mockReport, overallScore: 99 };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(fetchReport),
      } as unknown as Response);

      const result = await loadReport();

      expect(result?.overallScore).toBe(99);
    });
  });
});
