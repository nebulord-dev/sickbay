import { describe, it, expect, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';

import { getDependencyTree } from './dep-tree.js';

const mockExeca = vi.mocked(execa);

describe('getDependencyTree', () => {
  it('parses pnpm ls --json --depth 1 output', async () => {
    const pnpmOutput = JSON.stringify([
      {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          react: {
            from: 'react',
            version: '19.0.0',
            resolved: '',
            dependencies: {
              'loose-envify': { from: 'loose-envify', version: '1.4.0', resolved: '' },
            },
          },
          lodash: { from: 'lodash', version: '4.17.21', resolved: '' },
        },
      },
    ]);

    mockExeca.mockResolvedValueOnce({ stdout: pnpmOutput } as any);

    const tree = await getDependencyTree('/test', 'pnpm');

    expect(tree.name).toBe('my-app');
    expect(tree.packageManager).toBe('pnpm');
    expect(tree.dependencies.react.version).toBe('19.0.0');
    expect(tree.dependencies.react.dependencies?.['loose-envify'].version).toBe('1.4.0');
    expect(tree.dependencies.lodash.version).toBe('4.17.21');
  });

  it('parses npm ls --json --depth 1 output', async () => {
    const npmOutput = JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      dependencies: {
        express: {
          version: '4.18.2',
          dependencies: {
            'body-parser': { version: '1.20.1' },
          },
        },
      },
    });

    mockExeca.mockResolvedValueOnce({ stdout: npmOutput } as any);

    const tree = await getDependencyTree('/test', 'npm');

    expect(tree.name).toBe('my-app');
    expect(tree.dependencies.express.version).toBe('4.18.2');
    expect(tree.dependencies.express.dependencies?.['body-parser'].version).toBe('1.20.1');
  });

  it('returns empty tree on error', async () => {
    mockExeca.mockRejectedValueOnce(new Error('command not found'));

    const tree = await getDependencyTree('/test', 'pnpm');

    expect(tree.dependencies).toEqual({});
  });

  it('returns empty tree for unsupported package manager (bun)', async () => {
    const tree = await getDependencyTree('/test', 'bun');
    expect(tree.dependencies).toEqual({});
  });
});
