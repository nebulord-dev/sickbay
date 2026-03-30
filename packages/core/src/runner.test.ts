import { describe, it, expect, vi, beforeEach } from 'vitest';

const allMockRunners = vi.hoisted(() => {
  const makeRunner = (name: string) => ({
    name,
    category: 'code-quality' as const,
    isApplicableToContext: vi.fn().mockReturnValue(true),
    isApplicable: vi.fn().mockResolvedValue(true),
    run: vi.fn().mockResolvedValue({
      id: name,
      category: 'code-quality' as const,
      name: `${name} check`,
      score: 100,
      status: 'pass' as const,
      issues: [],
      toolsUsed: [name],
      duration: 0,
    }),
  });

  return {
    knip: makeRunner('knip'),
    outdated: makeRunner('outdated'),
    npmAudit: makeRunner('npm-audit'),
    depcheck: makeRunner('depcheck'),
    madge: makeRunner('madge'),
    sourceMapExplorer: makeRunner('source-map-explorer'),
    coverage: makeRunner('coverage'),
    licenseChecker: makeRunner('license-checker'),
    jscpd: makeRunner('jscpd'),
    git: makeRunner('git'),
    eslint: makeRunner('eslint'),
    typescript: makeRunner('typescript'),
    todoScanner: makeRunner('todo-scanner'),
    complexity: makeRunner('complexity'),
    secrets: makeRunner('secrets'),
    heavyDeps: makeRunner('heavy-deps'),
    reactPerf: makeRunner('react-perf'),
    assetSize: makeRunner('asset-size'),
  };
});

// Regular functions (not arrow functions) are required so they can be called with `new`
 
vi.mock('./integrations/knip.js', () => ({ KnipRunner: function () { return allMockRunners.knip; } }));
vi.mock('./integrations/outdated.js', () => ({ OutdatedRunner: function () { return allMockRunners.outdated; } }));
vi.mock('./integrations/npm-audit.js', () => ({ NpmAuditRunner: function () { return allMockRunners.npmAudit; } }));
vi.mock('./integrations/depcheck.js', () => ({ DepcheckRunner: function () { return allMockRunners.depcheck; } }));
vi.mock('./integrations/madge.js', () => ({ MadgeRunner: function () { return allMockRunners.madge; } }));
vi.mock('./integrations/source-map-explorer.js', () => ({ SourceMapExplorerRunner: function () { return allMockRunners.sourceMapExplorer; } }));
vi.mock('./integrations/coverage.js', () => ({ CoverageRunner: function () { return allMockRunners.coverage; } }));
vi.mock('./integrations/license-checker.js', () => ({ LicenseCheckerRunner: function () { return allMockRunners.licenseChecker; } }));
vi.mock('./integrations/jscpd.js', () => ({ JscpdRunner: function () { return allMockRunners.jscpd; } }));
vi.mock('./integrations/git.js', () => ({ GitRunner: function () { return allMockRunners.git; } }));
vi.mock('./integrations/eslint.js', () => ({ ESLintRunner: function () { return allMockRunners.eslint; } }));
vi.mock('./integrations/typescript.js', () => ({ TypeScriptRunner: function () { return allMockRunners.typescript; } }));
vi.mock('./integrations/todo-scanner.js', () => ({ TodoScannerRunner: function () { return allMockRunners.todoScanner; } }));
vi.mock('./integrations/complexity.js', () => ({ ComplexityRunner: function () { return allMockRunners.complexity; } }));
vi.mock('./integrations/secrets.js', () => ({ SecretsRunner: function () { return allMockRunners.secrets; } }));
vi.mock('./integrations/heavy-deps.js', () => ({ HeavyDepsRunner: function () { return allMockRunners.heavyDeps; } }));
vi.mock('./integrations/react-perf.js', () => ({ ReactPerfRunner: function () { return allMockRunners.reactPerf; } }));
vi.mock('./integrations/asset-size.js', () => ({ AssetSizeRunner: function () { return allMockRunners.assetSize; } }));
 

const mockProjectInfo = {
  name: 'test-project',
  version: '1.0.0',
  hasTypeScript: true,
  hasESLint: true,
  hasPrettier: false,
  framework: 'react' as const,
  packageManager: 'npm' as const,
  totalDependencies: 10,
  dependencies: {},
  devDependencies: {},
};

const mockContext = {
  frameworks: ['react' as const],
  runtime: 'browser' as const,
  buildTool: 'vite' as const,
  testFramework: null,
};

vi.mock('./utils/detect-project.js', () => ({
  detectProject: vi.fn(),
  detectContext: vi.fn(),
}));

vi.mock('./scoring.js', () => ({
  calculateOverallScore: vi.fn().mockReturnValue(90),
  buildSummary: vi.fn().mockReturnValue({ critical: 0, warnings: 0, info: 0 }),
}));

import { runSickbay } from './runner.js';
import { detectProject, detectContext } from './utils/detect-project.js';

describe('runSickbay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply detectProject/detectContext mocks (clearAllMocks clears call history but not
    // implementations; re-assert defaults for any runners that tests may have reconfigured)
    vi.mocked(detectProject).mockResolvedValue(mockProjectInfo);
    vi.mocked(detectContext).mockResolvedValue(mockContext);

    for (const runner of Object.values(allMockRunners)) {
      runner.isApplicableToContext.mockReturnValue(true);
      runner.isApplicable.mockResolvedValue(true);
      runner.run.mockResolvedValue({
        id: runner.name,
        category: 'code-quality' as const,
        name: `${runner.name} check`,
        score: 100,
        status: 'pass' as const,
        issues: [],
        toolsUsed: [runner.name],
        duration: 0,
      });
    }
  });

  it('uses process.cwd() as default project path', async () => {
    await runSickbay();
    expect(detectProject).toHaveBeenCalledWith(process.cwd());
  });

  it('uses provided projectPath', async () => {
    await runSickbay({ projectPath: '/my/project' });
    expect(detectProject).toHaveBeenCalledWith('/my/project');
  });

  it('returns a report with the correct shape', async () => {
    const report = await runSickbay({ projectPath: '/my/project' });

    expect(report).toMatchObject({
      projectPath: '/my/project',
      projectInfo: mockProjectInfo,
      overallScore: 90,
      summary: { critical: 0, warnings: 0, info: 0 },
    });
    expect(typeof report.timestamp).toBe('string');
    expect(Array.isArray(report.checks)).toBe(true);
  });

  it('filters runners when checks option is provided', async () => {
    const report = await runSickbay({ projectPath: '/p', checks: ['knip', 'git'] });

    const ids = report.checks.map((c) => c.id);
    expect(ids).toContain('knip');
    expect(ids).toContain('git');
    expect(ids).not.toContain('eslint');
    expect(ids).not.toContain('npm-audit');
  });

  it('excludes non-applicable runners from results', async () => {
    allMockRunners.eslint.isApplicable.mockResolvedValue(false);

    const report = await runSickbay({ projectPath: '/p' });

    expect(report.checks.map((c) => c.id)).not.toContain('eslint');
    expect(allMockRunners.eslint.run).not.toHaveBeenCalled();
  });

  it('excludes runner and skips isApplicable/run when isApplicableToContext returns false', async () => {
    allMockRunners.jscpd.isApplicableToContext.mockReturnValue(false);

    const report = await runSickbay({ projectPath: '/p' });

    expect(report.checks.map((c) => c.id)).not.toContain('jscpd');
    expect(allMockRunners.jscpd.isApplicable).not.toHaveBeenCalled();
    expect(allMockRunners.jscpd.run).not.toHaveBeenCalled();
  });

  it('calls onCheckStart before running each check', async () => {
    const onCheckStart = vi.fn();
    await runSickbay({ projectPath: '/p', checks: ['knip'], onCheckStart });

    expect(onCheckStart).toHaveBeenCalledWith('knip');
  });

  it('calls onCheckComplete after each check with the result', async () => {
    const onCheckComplete = vi.fn();
    await runSickbay({ projectPath: '/p', checks: ['knip'], onCheckComplete });

    expect(onCheckComplete).toHaveBeenCalledTimes(1);
    expect(onCheckComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'knip' }));
  });

  it('excludes a rejected runner without crashing', async () => {
    allMockRunners.eslint.run.mockRejectedValue(new Error('runner exploded'));

    const report = await runSickbay({ projectPath: '/p' });

    expect(report.checks.map((c) => c.id)).not.toContain('eslint');
  });

  it('includes results from all remaining runners when one fails', async () => {
    allMockRunners.eslint.run.mockRejectedValue(new Error('boom'));

    const report = await runSickbay({ projectPath: '/p', checks: ['knip', 'eslint', 'git'] });

    const ids = report.checks.map((c) => c.id);
    expect(ids).toContain('knip');
    expect(ids).toContain('git');
    expect(ids).not.toContain('eslint');
  });

  it('passes verbose option to runner.run', async () => {
    await runSickbay({ projectPath: '/p', checks: ['knip'], verbose: true });

    expect(allMockRunners.knip.run).toHaveBeenCalledWith('/p', { verbose: true });
  });

  it('includes quote on report by default', async () => {
    const report = await runSickbay({ projectPath: '/p' });

    expect(report.quote).toBeDefined();
    expect(report.quote).toHaveProperty('text');
    expect(report.quote).toHaveProperty('source');
    expect(report.quote).toHaveProperty('severity');
  });

  it('omits quote when quotes: false', async () => {
    const report = await runSickbay({ projectPath: '/p', quotes: false });

    expect(report.quote).toBeUndefined();
  });
});
