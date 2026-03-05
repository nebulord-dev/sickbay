import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeAsyncErrorsRunner } from './node-async-errors.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);

function makePkg(deps: Record<string, string> = {}): string {
  return JSON.stringify({ dependencies: deps });
}

describe('NodeAsyncErrorsRunner', () => {
  let runner: NodeAsyncErrorsRunner;

  beforeEach(() => {
    runner = new NodeAsyncErrorsRunner();
    vi.clearAllMocks();
    mockExistsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith('package.json') || s.endsWith('src');
    });
    mockReadFileSync.mockReturnValue(makePkg() as never);
    mockReaddirSync.mockReturnValue([] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
  });

  it('only applies to node runtime', () => {
    expect(runner.applicableRuntimes).toContain('node');
  });

  it('is in the code-quality category', () => {
    expect(runner.category).toBe('code-quality');
  });

  it('scores 100 when express-async-errors is in deps', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ 'express-async-errors': '^3.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.status).toBe('pass');
  });

  it('scores 90 when no async route handlers are found in source files', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ express: '^4.0.0' }) as never);
    // No source files — mockReaddirSync returns []
    const result = await runner.run('/project');
    expect(result.score).toBe(90);
    expect(result.status).toBe('pass');
  });

  it('scores low when async route handlers exist without try/catch', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if (String(p).endsWith('package.json')) return makePkg({ express: '^4.0.0' }) as never;
      return `
        const router = require('express').Router();
        router.get('/users', async (req, res) => {
          const users = await db.find();
          res.json(users);
        });
      ` as never;
    });
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['routes.js'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);

    const result = await runner.run('/project');
    expect(result.score).toBeLessThan(50);
    expect(result.issues.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('scores high when async route handlers have try/catch', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if (String(p).endsWith('package.json')) return makePkg({ express: '^4.0.0' }) as never;
      return `
        router.get('/users', async (req, res) => {
          try {
            const users = await db.find();
            res.json(users);
          } catch (err) {
            next(err);
          }
        });
      ` as never;
    });
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['routes.js'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);

    const result = await runner.run('/project');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('returns skipped when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('skipped');
  });
});
