import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NodeSecurityRunner } from './node-security.js';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { existsSync, readFileSync } from 'fs';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

function makePkg(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): string {
  return JSON.stringify({ dependencies: deps, devDependencies: devDeps });
}

describe('NodeSecurityRunner', () => {
  let runner: NodeSecurityRunner;

  beforeEach(() => {
    runner = new NodeSecurityRunner();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('only applies to node runtime', () => {
    expect(runner.applicableRuntimes).toContain('node');
  });

  it('is in the security category', () => {
    expect(runner.category).toBe('security');
  });

  it('scores 100 when all three security packages are present', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ helmet: '^7.0.0', cors: '^2.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('scores 0 when no security packages are present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ express: '^4.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(0);
    expect(result.status).toBe('fail');
    expect(result.issues).toHaveLength(3);
  });

  it('deducts 35 points for missing helmet and marks it critical', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ cors: '^2.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(65);
    const helmetIssue = result.issues.find((i) => i.message.toLowerCase().includes('helmet'));
    expect(helmetIssue?.severity).toBe('critical');
  });

  it('deducts 30 points for missing cors and marks it warning', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ helmet: '^7.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(70);
    const corsIssue = result.issues.find((i) => i.message.toLowerCase().includes('cors'));
    expect(corsIssue?.severity).toBe('warning');
  });

  it('deducts 35 points for missing rate limiting and marks it warning', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ helmet: '^7.0.0', cors: '^2.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(65);
    const rateIssue = result.issues.find((i) => i.message.toLowerCase().includes('rate limit'));
    expect(rateIssue?.severity).toBe('warning');
  });

  it('accepts alternative helmet package (koa-helmet)', async () => {
    mockReadFileSync.mockReturnValue(
      makePkg({ 'koa-helmet': '^7.0.0', cors: '^2.0.0', 'express-rate-limit': '^7.0.0' }) as never,
    );
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
  });

  it('returns skipped when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('skipped');
  });
});
