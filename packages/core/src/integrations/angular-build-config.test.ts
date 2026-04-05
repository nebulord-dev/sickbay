import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularBuildConfigRunner } from './angular-build-config.js';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { readFileSync, existsSync } from 'fs';

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

describe('AngularBuildConfigRunner', () => {
  let runner: AngularBuildConfigRunner;

  beforeEach(() => {
    runner = new AngularBuildConfigRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('angular-build-config');
  });

  it('returns pass when angular.json does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.metadata?.reason).toBe('no angular.json found');
  });

  it('returns pass when production config is clean', async () => {
    const angularJson = {
      defaultProject: 'app',
      projects: {
        app: {
          architect: {
            build: {
              configurations: {
                production: {
                  sourceMap: false,
                  optimization: true,
                  budgets: [{ type: 'initial', maximumError: '500kb' }],
                  aot: true,
                },
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
  });

  it('detects sourceMap: true in production', async () => {
    const angularJson = {
      defaultProject: 'app',
      projects: {
        app: {
          architect: {
            build: {
              configurations: {
                production: { sourceMap: true, optimization: true, budgets: [] },
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('sourceMap'))).toBe(true);
    const issue = result.issues.find((i) => i.message.includes('sourceMap'));
    expect(issue?.fix?.command).toBe(
      'ng config projects.app.architect.build.configurations.production.sourceMap false',
    );
  });

  it('detects optimization: false in production', async () => {
    const angularJson = {
      defaultProject: 'app',
      projects: {
        app: {
          architect: {
            build: {
              configurations: {
                production: { optimization: false, budgets: [] },
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('optimization'))).toBe(true);
    const issue = result.issues.find((i) => i.message.includes('optimization'));
    expect(issue?.fix?.command).toBe(
      'ng config projects.app.architect.build.configurations.production.optimization true',
    );
  });

  it('detects missing budgets', async () => {
    const angularJson = {
      defaultProject: 'app',
      projects: {
        app: {
          architect: {
            build: {
              configurations: {
                production: {},
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('budgets'))).toBe(true);
  });

  it('detects aot: false', async () => {
    const angularJson = {
      defaultProject: 'app',
      projects: {
        app: {
          architect: {
            build: {
              configurations: {
                production: { aot: false, budgets: [] },
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('AOT'))).toBe(true);
    const issue = result.issues.find((i) => i.message.includes('AOT'));
    expect(issue?.fix?.command).toBe(
      'ng config projects.app.architect.build.configurations.production.aot true',
    );
  });

  it('detects all issues at once and scores correctly', async () => {
    const angularJson = {
      defaultProject: 'app',
      projects: {
        app: {
          architect: {
            build: {
              configurations: {
                production: {
                  sourceMap: true,
                  optimization: false,
                  aot: false,
                  // no budgets
                },
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.issues).toHaveLength(4);
    expect(result.score).toBe(20);
    expect(result.status).toBe('warning');
  });

  it('uses first project when defaultProject is absent', async () => {
    const angularJson = {
      projects: {
        'my-app': {
          architect: {
            build: {
              configurations: {
                production: { sourceMap: true, budgets: [] },
              },
            },
          },
        },
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(angularJson) as never);
    const result = await runner.run('/project');
    expect(result.metadata?.project).toBe('my-app');
    expect(result.issues.some((i) => i.message.includes('sourceMap'))).toBe(true);
  });

  it('returns pass when no projects found', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({}) as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.metadata?.reason).toBe('no projects found in angular.json');
  });

  it('returns fail on unexpected error', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('parse error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
