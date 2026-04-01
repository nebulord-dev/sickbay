import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

import { isNewerVersion, checkForUpdate } from './update-check.js';

import type { UpdateInfo } from './update-check.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

describe('isNewerVersion', () => {
  it('returns true when latest has higher major (1.3.1 vs 2.0.0)', () => {
    expect(isNewerVersion('1.3.1', '2.0.0')).toBe(true);
  });

  it('returns true when latest has higher minor (1.3.1 vs 1.4.0)', () => {
    expect(isNewerVersion('1.3.1', '1.4.0')).toBe(true);
  });

  it('returns true when latest has higher patch (1.3.1 vs 1.3.2)', () => {
    expect(isNewerVersion('1.3.1', '1.3.2')).toBe(true);
  });

  it('returns false when versions are equal (1.3.1 vs 1.3.1)', () => {
    expect(isNewerVersion('1.3.1', '1.3.1')).toBe(false);
  });

  it('returns false when current is newer (2.0.0 vs 1.3.1)', () => {
    expect(isNewerVersion('2.0.0', '1.3.1')).toBe(false);
  });

  it('returns false for invalid version strings', () => {
    expect(isNewerVersion('not-a-version', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', 'not-a-version')).toBe(false);
    expect(isNewerVersion('', '')).toBe(false);
  });

  it('strips prerelease suffix before comparing (1.3.1 vs 1.4.0-beta.1)', () => {
    expect(isNewerVersion('1.3.1', '1.4.0-beta.1')).toBe(true);
  });
});

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns null when cache is fresh and versions match', async () => {
    const now = Date.now();
    const cache = { latestVersion: '1.3.1', checkedAt: now - 1000 }; // 1 second ago
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(cache) as never);

    const result = await checkForUpdate('1.3.1');

    expect(result).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('returns update info when cache shows newer version', async () => {
    const now = Date.now();
    const cache = { latestVersion: '2.0.0', checkedAt: now - 1000 }; // 1 second ago, fresh
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(cache) as never);

    const result = await checkForUpdate('1.3.1');

    expect(result).toEqual<UpdateInfo>({
      currentVersion: '1.3.1',
      latestVersion: '2.0.0',
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('fetches from registry when cache is stale (>24h)', async () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const cache = { latestVersion: '1.3.1', checkedAt: staleTime };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(cache) as never);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);

    const result = await checkForUpdate('1.3.1');

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://registry.npmjs.org/sickbay/latest',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual<UpdateInfo>({
      currentVersion: '1.3.1',
      latestVersion: '2.0.0',
    });
  });

  it('fetches from registry when no cache file exists', async () => {
    mockExistsSync.mockReturnValue(false);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.5.0' }),
    } as Response);

    const result = await checkForUpdate('1.3.1');

    expect(vi.mocked(fetch)).toHaveBeenCalled();
    expect(result).toEqual<UpdateInfo>({
      currentVersion: '1.3.1',
      latestVersion: '1.5.0',
    });
  });

  it('returns null when fetch fails (network error)', async () => {
    mockExistsSync.mockReturnValue(false);

    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    const result = await checkForUpdate('1.3.1');

    expect(result).toBeNull();
  });

  it('returns null when registry returns non-ok response', async () => {
    mockExistsSync.mockReturnValue(false);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await checkForUpdate('1.3.1');

    expect(result).toBeNull();
  });

  it('writes cache after successful fetch', async () => {
    mockExistsSync.mockReturnValue(false);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);

    await checkForUpdate('1.3.1');

    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('.sickbay'), {
      recursive: true,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('update-check.json'),
      expect.stringContaining('"latestVersion"'),
    );
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.latestVersion).toBe('2.0.0');
    expect(typeof written.checkedAt).toBe('number');
  });
});
