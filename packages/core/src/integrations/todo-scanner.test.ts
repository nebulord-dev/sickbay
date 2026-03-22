import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodoScannerRunner } from './todo-scanner.js';

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { WARN_LINES } from '@sickbay/constants';

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


const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('TodoScannerRunner', () => {
  let runner: TodoScannerRunner;

  beforeEach(() => {
    runner = new TodoScannerRunner();
    vi.clearAllMocks();
  });

  it('returns false for isApplicable when src dir does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await runner.isApplicable('/project');

    expect(result).toBe(false);
  });

  it('returns true for isApplicable when src dir exists', async () => {
    mockExistsSync.mockReturnValue(true);

    const result = await runner.isApplicable('/project');

    expect(result).toBe(true);
  });

  it('returns pass with score 100 when no todos are found', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['index.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const x = 1;\nconst y = 2;\n' as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('todo-scanner');
  });

  it('reports a TODO comment as an info issue', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['app.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('// TODO: refactor this function\nconst x = 1;\n' as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('info');
    expect(result.issues[0].message).toContain('TODO');
    expect(result.issues[0].message).toContain('refactor this function');
  });

  it('reports a FIXME comment as a warning issue', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['app.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('// FIXME: this is broken\nconst x = 1;\n' as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('FIXME');
    expect(result.issues[0].message).toContain('this is broken');
  });

  it('reports a HACK comment as a warning issue', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['utils.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('// HACK: temporary workaround\nconst y = 2;\n' as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('HACK');
  });

  it('returns warning status when todos.length > 20', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['big.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 21 TODO lines
    const content = Array.from({ length: 21 }, (_, i) => `// TODO: task ${i}`).join('\n');
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(21);
  });

  it('returns warning status when fixmeCount > 5', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['service.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 6 FIXME lines
    const content = Array.from({ length: 6 }, (_, i) => `// FIXME: problem ${i}`).join('\n');
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run('/project');

    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(6);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('calculates score correctly: 100 - todos.length * 3, min 50', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['app.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 5 TODOs: 100 - 5*3 = 85
    const content = Array.from({ length: 5 }, (_, i) => `// TODO: item ${i}`).join('\n');
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run('/project');

    expect(result.score).toBe(85);
  });

  it('does not let score drop below 50', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['app.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 25 TODOs: 100 - 25*3 = 25 → capped at 50
    const content = Array.from({ length: 25 }, (_, i) => `// TODO: item ${i}`).join('\n');
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run('/project');

    expect(result.score).toBe(50);
  });

  it('includes correct line numbers in issue messages', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['index.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('const a = 1;\n// TODO: fix me\nconst b = 2;\n' as any);

    const result = await runner.run('/project');

    expect(result.issues[0].message).toContain(':2');
  });

  it('reports correct metadata totals', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['app.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    const content = '// TODO: one\n// FIXME: two\n// HACK: three\n// TODO: four\n';
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run('/project');

    expect(result.metadata?.total).toBe(4);
    expect(result.metadata?.todo).toBe(2);
    // fixme metadata = FIXME + HACK combined (both treated as fixmeCount in the runner)
    expect(result.metadata?.fixme).toBe(2);
    expect(result.metadata?.hack).toBe(1);
  });

  it('recurses into subdirectories', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync
      .mockReturnValueOnce(['components'] as any)
      .mockReturnValueOnce(['Button.tsx'] as any);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as any)
      .mockReturnValueOnce({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue('// TODO: add accessibility\n' as any);

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('TODO');
  });

  it('returns id and category correctly', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([] as any);

    const result = await runner.run('/project');

    expect(result.id).toBe('todo-scanner');
    expect(result.category).toBe('code-quality');
  });

  it('does not flag TODO inside a double-quoted string literal', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['about.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // String value contains "TODO" but it is not a comment
    mockReadFileSync.mockReturnValue(
      'const desc = "Finds TODO, FIXME and HACK comments";\n' as any,
    );

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(0);
  });

  it('does not flag TODO inside a single-quoted string literal', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['labels.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(
      "const label = 'TODO: this is a label key';\n" as any,
    );

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(0);
  });

  it('does not flag TODO inside a template literal', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['template.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(
      'const msg = `TODO: ${name} needs attention`;\n' as any,
    );

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(0);
  });

  it('still flags TODO in a comment on the same line as a string', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['mixed.ts'] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(
      'const x = "some string"; // TODO: clean this up\n' as any,
    );

    const result = await runner.run('/project');

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('TODO');
  });
});
