import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeInputValidationRunner } from './node-input-validation.js';

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

describe('NodeInputValidationRunner', () => {
  let runner: NodeInputValidationRunner;

  beforeEach(() => {
    runner = new NodeInputValidationRunner();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('only applies to node runtime', () => {
    expect(runner.applicableRuntimes).toContain('node');
  });

  it('is in the code-quality category', () => {
    expect(runner.category).toBe('code-quality');
  });

  it('scores 85 and passes when zod is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ zod: '^3.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(85);
    expect(result.status).toBe('pass');
  });

  it('scores 85 when joi is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ joi: '^17.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(85);
  });

  it('scores 85 when express-validator is present', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ 'express-validator': '^7.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(85);
  });

  it('scores 20 with a warning when no validation library is found', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ express: '^4.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(20);
    expect(result.status).toBe('warning');
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].fix?.command).toContain('npm install zod');
  });

  it('reports which library was found as an info issue', async () => {
    mockReadFileSync.mockReturnValue(makePkg({ zod: '^3.0.0' }) as never);
    const result = await runner.run('/project');
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('zod');
  });

  it('returns skipped when package.json is missing', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('skipped');
  });
});
