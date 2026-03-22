import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('@sickbay/core', () => ({
  detectProject: vi.fn(),
}));

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { detectProject } from '@sickbay/core';
import { gatherStats } from './stats.js';

const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockExistsSync = vi.mocked(existsSync);
const mockExecSync = vi.mocked(execSync);
const mockDetectProject = vi.mocked(detectProject);

const PROJECT_PATH = '/test/project';

function makeProjectInfo(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-project',
    version: '1.0.0',
    framework: 'react',
    packageManager: 'npm',
    totalDependencies: 10,
    dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
    hasESLint: true,
    hasPrettier: true,
    hasTypeScript: true,
    ...overrides,
  };
}

// Helper to create a DirEntry mock
function makeDirEntry(name: string, isDir: boolean, isFile = !isDir) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => isFile,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDetectProject.mockResolvedValue(makeProjectInfo() as any);
  // Default: no .git directory
  mockExistsSync.mockReturnValue(false);
  // Default: empty directory
  mockReaddirSync.mockReturnValue([] as any);
});

describe('gatherStats', () => {
  it('returns a ProjectStats object with the expected shape', async () => {
    const stats = await gatherStats(PROJECT_PATH);

    expect(stats).toHaveProperty('project');
    expect(stats).toHaveProperty('files');
    expect(stats).toHaveProperty('lines');
    expect(stats).toHaveProperty('components');
    expect(stats).toHaveProperty('dependencies');
    expect(stats).toHaveProperty('git');
    expect(stats).toHaveProperty('testFiles');
    expect(stats).toHaveProperty('sourceSize');
  });

  it('returns zero file count when directory is empty', async () => {
    mockReaddirSync.mockReturnValue([] as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.files.total).toBe(0);
    expect(stats.lines.total).toBe(0);
    expect(stats.lines.avgPerFile).toBe(0);
  });

  it('counts source files by extension', async () => {
    mockReaddirSync.mockReturnValue([
      makeDirEntry('index.ts', false),
      makeDirEntry('App.tsx', false),
      makeDirEntry('styles.css', false),
    ] as any);

    mockReadFileSync.mockReturnValue('line1\nline2\nline3\n' as any);
    mockStatSync.mockReturnValue({ size: 100 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.files.total).toBe(3);
    expect(stats.files.byExtension['.ts']).toBe(1);
    expect(stats.files.byExtension['.tsx']).toBe(1);
    expect(stats.files.byExtension['.css']).toBe(1);
  });

  it('counts lines correctly across multiple files', async () => {
    mockReaddirSync.mockReturnValue([
      makeDirEntry('a.ts', false),
      makeDirEntry('b.ts', false),
    ] as any);

    // 3 lines + 5 lines = 8 total
    mockReadFileSync
      .mockReturnValueOnce('a\nb\nc\n' as any)
      .mockReturnValueOnce('1\n2\n3\n4\n5\n' as any);

    mockStatSync.mockReturnValue({ size: 50 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.lines.total).toBe(8); // split("\n") gives length of segments
    expect(stats.lines.avgPerFile).toBe(4); // Math.round(8/2)
  });

  it('counts functional React components in TSX files', async () => {
    const tsxContent = `
export function MyComponent() { return null; }
export const AnotherComponent = () => null;
export function notAComponent() { return 1; } // lowercase - not counted
`;
    mockReaddirSync.mockReturnValue([makeDirEntry('App.tsx', false)] as any);
    mockReadFileSync.mockReturnValue(tsxContent as any);
    mockStatSync.mockReturnValue({ size: 200 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.components.functional).toBeGreaterThanOrEqual(1);
  });

  it('counts class-based React components in TSX files', async () => {
    const tsxContent = `
class MyComponent extends React.Component {
  render() { return null; }
}
class AnotherComp extends Component {
  render() { return null; }
}
`;
    mockReaddirSync.mockReturnValue([makeDirEntry('App.tsx', false)] as any);
    mockReadFileSync.mockReturnValue(tsxContent as any);
    mockStatSync.mockReturnValue({ size: 200 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.components.classBased).toBe(2);
    expect(stats.components.total).toBe(stats.components.functional + stats.components.classBased);
  });

  it('identifies test files correctly', async () => {
    mockReaddirSync.mockReturnValue([
      makeDirEntry('app.ts', false),
      makeDirEntry('app.test.ts', false),
      makeDirEntry('utils.spec.ts', false),
    ] as any);

    mockReadFileSync.mockReturnValue('content\n' as any);
    mockStatSync.mockReturnValue({ size: 50 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.testFiles).toBe(2);
  });

  it('returns null for git info when .git directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.git).toBeNull();
  });

  it('returns git info when .git directory exists', async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      return String(p).endsWith('.git');
    });

    mockExecSync
      .mockReturnValueOnce('42\n' as any)      // git rev-list --count HEAD
      .mockReturnValueOnce('3\n' as any)       // contributors
      .mockReturnValueOnce('2 years ago\n' as any) // first commit
      .mockReturnValueOnce('main\n' as any);   // branch

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.git).not.toBeNull();
    expect(stats.git!.commits).toBe(42);
    expect(stats.git!.contributors).toBe(3);
    expect(stats.git!.age).toBe('2 years ago');
    expect(stats.git!.branch).toBe('main');
  });

  it('returns null git info when git commands fail', async () => {
    mockExistsSync.mockImplementation((p: unknown) => {
      return String(p).endsWith('.git');
    });

    mockExecSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.git).toBeNull();
  });

  it('returns dependency counts from project info', async () => {
    mockDetectProject.mockResolvedValue(makeProjectInfo({
      dependencies: { react: '^18', 'react-dom': '^18' },
      devDependencies: { typescript: '^5', vitest: '^1', eslint: '^8' },
      totalDependencies: 5,
    }) as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.dependencies.prod).toBe(2);
    expect(stats.dependencies.dev).toBe(3);
    expect(stats.dependencies.total).toBe(5);
  });

  it('formats source size as bytes for small files', async () => {
    mockReaddirSync.mockReturnValue([makeDirEntry('tiny.ts', false)] as any);
    mockReadFileSync.mockReturnValue('x\n' as any);
    mockStatSync.mockReturnValue({ size: 500 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.sourceSize).toMatch(/B$/);
  });

  it('formats source size as KB for medium files', async () => {
    mockReaddirSync.mockReturnValue([makeDirEntry('medium.ts', false)] as any);
    mockReadFileSync.mockReturnValue('x\n' as any);
    mockStatSync.mockReturnValue({ size: 2048 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.sourceSize).toMatch(/KB$/);
  });

  it('ignores node_modules and dist directories during walk', async () => {
    mockReaddirSync.mockImplementation((dir: unknown) => {
      const d = String(dir);
      if (d === PROJECT_PATH) {
        return [
          makeDirEntry('node_modules', true),
          makeDirEntry('dist', true),
          makeDirEntry('src', true),
        ] as any;
      }
      if (d.endsWith('src')) {
        return [makeDirEntry('index.ts', false)] as any;
      }
      return [] as any;
    });

    mockReadFileSync.mockReturnValue('line\n' as any);
    mockStatSync.mockReturnValue({ size: 10 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    // Only src/index.ts counted — node_modules and dist ignored
    expect(stats.files.total).toBe(1);
  });

  it('ignores hidden directories (starting with dot)', async () => {
    mockReaddirSync.mockImplementation((dir: unknown) => {
      const d = String(dir);
      if (d === PROJECT_PATH) {
        return [
          makeDirEntry('.turbo', true),
          makeDirEntry('src', true),
        ] as any;
      }
      if (d.endsWith('src')) {
        return [makeDirEntry('app.ts', false)] as any;
      }
      return [] as any;
    });

    mockReadFileSync.mockReturnValue('content\n' as any);
    mockStatSync.mockReturnValue({ size: 10 } as any);

    const stats = await gatherStats(PROJECT_PATH);

    expect(stats.files.total).toBe(1);
  });
});
