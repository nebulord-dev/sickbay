import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecretsRunner } from './secrets.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
  WARN_LINES: 400,
}));

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('SecretsRunner', () => {
  let runner: SecretsRunner;

  beforeEach(() => {
    runner = new SecretsRunner();
    vi.clearAllMocks();
  });

  it('returns pass with score 100 when no src dir and no .env files', async () => {
    // No .env files, no src dir
    mockExistsSync.mockReturnValue(false);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('secrets');
  });

  it('returns pass with score 100 when src dir has no secrets', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['index.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const x = process.env.API_KEY;\n' as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('detects an AWS access key as a critical issue', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['config.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const key = "AKIAIOSFODNN7EXAMPLE";\n' as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].message).toContain('AWS Access Key');
    expect(result.score).toBe(75); // 100 - 1 * 25
  });

  it('detects a .env file not listed in .gitignore as a critical issue', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/.env')) return true;
      if (String(p).endsWith('/src')) return false;
      return false;
    });
    mockReadFileSync.mockImplementation((p: any) => {
      if (String(p).endsWith('/.gitignore')) return 'node_modules\ndist\n' as any;
      return '' as any;
    });

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].message).toContain('.env file not in .gitignore');
    expect(result.score).toBe(75); // 100 - 1 * 25
  });

  it('does not flag .env file when .gitignore contains .env', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/.env')) return true;
      if (String(p).endsWith('/src')) return false;
      return false;
    });
    mockReadFileSync.mockImplementation((p: any) => {
      if (String(p).endsWith('/.gitignore')) return 'node_modules\n.env\n' as any;
      return '' as any;
    });

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('skips test files when scanning for secrets', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['auth.test.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // Even though this file has an AWS key pattern, it should be skipped
    mockReadFileSync.mockReturnValue('const key = "AKIAIOSFODNN7EXAMPLE";\n' as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('skips lines containing process.env references', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['config.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const key = process.env.AKIA_FAKE;\n' as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('detects hardcoded password as a critical issue', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['db.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const password = "supersecretpassword123";\n' as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('fail');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].message).toContain('Hardcoded password');
  });

  it('caps score at 0 when there are 4 or more findings', async () => {
    // 4 .env files (not in .gitignore) = 4 findings → score = max(0, 100 - 4*25) = 0
    mockExistsSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith('/.env')) return true;
      if (s.endsWith('/.env.local')) return true;
      if (s.endsWith('/.env.production')) return true;
      if (s.endsWith('/src')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: any) => {
      if (String(p).endsWith('/.gitignore')) return 'node_modules\n' as any;
      return '' as any;
    });
    // src dir returns empty
    mockReaddirSync.mockReturnValue([] as any);

    const result = await runner.run('/project');

    expect(result.score).toBe(25); // 3 env files found: 100 - 3*25 = 25
    expect(result.status).toBe('fail');
  });

  it('issues include fix description to move secrets to env vars', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['api.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const key = "AKIAIOSFODNN7EXAMPLE";\n' as any);

    const result = await runner.run('/project');

    expect(result.issues[0].fix?.description).toContain('environment variables');
  });

  it('returns id and category correctly', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await runner.run('/project');

    expect(result.id).toBe('secrets');
    expect(result.category).toBe('security');
  });

  it('recurses into subdirectories when scanning src', async () => {
    mockExistsSync.mockImplementation((p) => {
      if (String(p).endsWith('/src')) return true;
      return false;
    });
    // First call returns a subdirectory, second call returns a file in that subdir
    mockReaddirSync
      .mockReturnValueOnce(['utils'] as any)
      .mockReturnValueOnce(['secrets.ts'] as any);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as any)
      .mockReturnValueOnce({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const tok = "AKIAIOSFODNN7EXAMPLE";\n' as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
  });
});
