import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ReactPerfRunner } from './react-perf.js';

// Force POSIX path semantics so mocks comparing forward-slash literals
// (e.g. `endsWith('/src')`) match the path.join output on Windows. The
// real cross-platform path handling is exercised by the relativeFromRoot
// unit tests in file-helpers.test.ts (which uses real `path`).
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return { ...actual.posix, default: actual.posix };
});

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  relativeFromRoot: (root: string, p: string) =>
    p.startsWith(root + '/') ? p.slice(root.length + 1) : p,
}));

vi.mock('../utils/exclude.js', () => ({
  createExcludeFilter: vi.fn(() => () => false),
}));

vi.mock('../utils/file-types.js', () => ({
  getThresholds: vi.fn(() => ({ warn: 300, critical: 500, fileType: 'react-component' })),
}));

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';

import { createExcludeFilter } from '../utils/exclude.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockCreateExcludeFilter = vi.mocked(createExcludeFilter);

describe('ReactPerfRunner', () => {
  let runner: ReactPerfRunner;

  beforeEach(() => {
    runner = new ReactPerfRunner();
    vi.clearAllMocks();
    // The runner walks SOURCE_DIRS = ['src', 'app', 'lib']. The existing tests
    // were written when only `src/` was scanned, so default existsSync to
    // return true ONLY for the `src` path — that preserves the original
    // single-directory walk semantics across the existing test bodies.
    mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('/src'));
  });

  it('declares applicableFrameworks for react, next, and remix', () => {
    const runner = new ReactPerfRunner();
    expect(runner.applicableFrameworks).toContain('react');
    expect(runner.applicableFrameworks).toContain('next');
    expect(runner.applicableFrameworks).toContain('remix');
  });

  describe('isApplicable', () => {
    it('returns true when any of src/, app/, or lib/ exists', async () => {
      // Next.js App Router projects use app/ instead of src/.
      // Regression: runner used to assume src/ exists and would fail with
      // score: 0 for app/-only projects.
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('/app'));
      expect(await runner.isApplicable('/project')).toBe(true);
    });

    it('returns false when no recognised source dir exists', async () => {
      mockExistsSync.mockReturnValue(false);
      expect(await runner.isApplicable('/project')).toBe(false);
    });
  });

  describe('run', () => {
    it('returns pass with score 100 when no tsx/jsx files exist', async () => {
      // src dir has no component files
      mockReaddirSync.mockReturnValue([] as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.id).toBe('react-perf');
    });

    it('returns pass with score 100 for a clean tsx file', async () => {
      const cleanContent = [
        "import React from 'react';",
        '',
        'const STYLE = { color: "red" };',
        '',
        'export function MyComponent() {',
        '  return <div style={STYLE}>Hello</div>;',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(cleanContent as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('detects inline object in JSX prop as a warning', async () => {
      const content = [
        "import React from 'react';",
        '',
        'export function MyComponent() {',
        '  return <div style={{ color: "red" }}>Hello</div>;',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('warning');
      const inlineIssue = result.issues.find((i) => i.message.includes('Inline object'));
      expect(inlineIssue).toBeDefined();
      expect(inlineIssue?.severity).toBe('warning');
    });

    it('detects key={index} as a warning', async () => {
      const content = [
        "import React from 'react';",
        '',
        'export function MyList({ items }) {',
        '  return (',
        '    <ul>',
        '      {items.map((item, index) => (',
        '        <li key={index}>{item}</li>',
        '      ))}',
        '    </ul>',
        '  );',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyList.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('warning');
      const keyIssue = result.issues.find((i) => i.message.includes('index as key'));
      expect(keyIssue).toBeDefined();
      expect(keyIssue?.severity).toBe('warning');
    });

    it('detects key={i} as a warning', async () => {
      const content = [
        "import React from 'react';",
        '',
        'export function MyList({ items }) {',
        '  return (',
        '    <ul>',
        '      {items.map((item, i) => (',
        '        <li key={i}>{item}</li>',
        '      ))}',
        '    </ul>',
        '  );',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyList.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      const keyIssue = result.issues.find((i) => i.message.includes('index as key'));
      expect(keyIssue).toBeDefined();
      expect(keyIssue?.severity).toBe('warning');
    });

    it('detects large component files (>300 lines) as info', async () => {
      // Build a file with 301 lines (above component threshold of 300)
      const lines = Array.from({ length: 301 }, (_, i) => `// line ${i}`);
      const content = lines.join('\n');

      mockReaddirSync.mockReturnValue(['BigComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 10000 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      const largeIssue = result.issues.find((i) => i.message.includes('Large component'));
      expect(largeIssue).toBeDefined();
      expect(largeIssue?.severity).toBe('info');
      // status is 'warning' when infoCount > 0
      expect(result.status).toBe('warning');
    });

    it('does NOT flag className={{ as an inline object warning', async () => {
      const content = [
        "import React from 'react';",
        "import cn from 'clsx';",
        '',
        'export function MyComponent({ active }) {',
        '  return <div className={{ active }}>Hello</div>;',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      const inlineIssue = result.issues.find((i) => i.message.includes('Inline object'));
      expect(inlineIssue).toBeUndefined();
    });

    it('calculates score with diminishing returns per unique pattern', async () => {
      // 2 warnings of the same pattern (inline object)
      const content = [
        "import React from 'react';",
        '',
        'export function MyComponent() {',
        '  return (',
        '    <div>',
        '      <span style={{ color: "red" }}>A</span>',
        '      <span data={{ val: 1 }}>B</span>',
        '    </div>',
        '  );',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      // 1 unique pattern, 2 instances → 100 - (10 + log2(2)*3) = 100 - 13 = 87
      expect(result.score).toBe(87);
    });

    it('uses diminishing returns: many identical warnings score higher than linear formula floor', async () => {
      // Create a file with 50 inline objects — old formula: 100 - 50*3 = floor 20
      // New formula should produce a score well above 20
      const lines = Array.from(
        { length: 50 },
        () => '      <span style={{ color: "red" }}>A</span>',
      );
      const content = [
        "import React from 'react';",
        '',
        'export function Big() {',
        '  return (',
        '    <div>',
        ...lines,
        '    </div>',
        '  );',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['Big.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      // 50 warnings of the same pattern → diminishing returns should give score > 40
      expect(result.score).toBeGreaterThan(40);
      // But still penalized — not a perfect score
      expect(result.score).toBeLessThan(90);
    });

    it('scores diverse warning patterns lower than repeated single pattern at same count', async () => {
      // Single pattern: 6 inline objects
      const singlePatternContent = [
        "import React from 'react';",
        'export function A() { return (<div>',
        '  <span style={{ a: 1 }}>1</span>',
        '  <span style={{ b: 2 }}>2</span>',
        '  <span style={{ c: 3 }}>3</span>',
        '  <span style={{ d: 4 }}>4</span>',
        '  <span style={{ e: 5 }}>5</span>',
        '  <span style={{ f: 6 }}>6</span>',
        '</div>); }',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['A.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(singlePatternContent as never);

      const singleResult = await runner.run('/project');

      // Diverse patterns: 3 inline objects + 3 index-as-key (2 unique patterns, 6 total)
      vi.clearAllMocks();
      mockExistsSync.mockImplementation((p: unknown) => String(p).endsWith('/src'));

      const diverseContent = [
        "import React from 'react';",
        'export function B({ items }) { return (<div>',
        '  <span style={{ a: 1 }}>1</span>',
        '  <span style={{ b: 2 }}>2</span>',
        '  <span style={{ c: 3 }}>3</span>',
        '  {items.map((x, index) => <li key={index}>{x}</li>)}',
        '  {items.map((x, i) => <p key={i}>{x}</p>)}',
        '  {items.map((x, idx) => <span key={idx}>{x}</span>)}',
        '</div>); }',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['B.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(diverseContent as never);

      const diverseResult = await runner.run('/project');

      // Diverse patterns should score lower (more penalty) than single pattern
      expect(diverseResult.score).toBeLessThan(singleResult.score);
    });

    it('does not scan .ts files (only .tsx and .jsx)', async () => {
      mockReaddirSync.mockReturnValue(['util.ts', 'helper.ts'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      // readFileSync should not have been called for the directory scan part
      // (it may be called 0 times since no .tsx/.jsx files are found)
      expect(result.metadata?.filesScanned).toBe(0);
    });

    it('also scans .jsx files (not just .tsx)', async () => {
      const content = [
        "import React from 'react';",
        '',
        'export function MyComponent() {',
        '  return <div style={{ color: "red" }}>Hello</div>;',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['MyComponent.jsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      expect(result.metadata?.filesScanned).toBe(1);
      const inlineIssue = result.issues.find((i) => i.message.includes('Inline object'));
      expect(inlineIssue).toBeDefined();
    });

    it('scans subdirectories recursively', async () => {
      const cleanContent = [
        "import React from 'react';",
        'export function Sub() { return <div />; }',
      ].join('\n');

      // First call: src dir contains a subdirectory 'pages'
      // Second call: pages dir contains a tsx file
      mockReaddirSync
        .mockReturnValueOnce(['pages'] as never)
        .mockReturnValueOnce(['Page.tsx'] as never);

      mockStatSync
        .mockReturnValueOnce({ isDirectory: () => true } as never)
        .mockReturnValueOnce({ isDirectory: () => false, size: 100 } as never);

      mockReadFileSync.mockReturnValue(cleanContent as never);

      const result = await runner.run('/project');

      expect(result.status).toBe('pass');
      expect(result.metadata?.filesScanned).toBe(1);
    });

    it('suppresses inline object warnings when React Compiler is detected', async () => {
      const pkg = JSON.stringify({
        devDependencies: { 'babel-plugin-react-compiler': '^1.0.0' },
      });
      const content = [
        "import React from 'react';",
        '',
        'export function MyComponent() {',
        '  return <div style={{ color: "red" }}>Hello</div>;',
        '}',
      ].join('\n');

      // First readFileSync call is package.json, second is the component file
      mockReadFileSync.mockReturnValueOnce(pkg as never).mockReturnValue(content as never);
      mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);

      const result = await runner.run('/project');

      expect(result.issues.find((i) => i.message.includes('Inline object'))).toBeUndefined();
      expect(result.metadata?.reactCompiler).toBe(true);
      expect(result.score).toBe(100);
    });

    it('still flags index-as-key when React Compiler is detected', async () => {
      const pkg = JSON.stringify({
        devDependencies: { 'babel-plugin-react-compiler': '^1.0.0' },
      });
      const content = [
        "import React from 'react';",
        '',
        'export function MyList({ items }) {',
        '  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;',
        '}',
      ].join('\n');

      mockReadFileSync.mockReturnValueOnce(pkg as never).mockReturnValue(content as never);
      mockReaddirSync.mockReturnValue(['MyList.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);

      const result = await runner.run('/project');

      expect(result.issues.find((i) => i.message.includes('index as key'))).toBeDefined();
      expect(result.metadata?.reactCompiler).toBe(true);
    });

    it('also detects @react-compiler/babel package name', async () => {
      const pkg = JSON.stringify({
        devDependencies: { '@react-compiler/babel': '^1.0.0' },
      });
      const content = [
        "import React from 'react';",
        'export function MyComponent() { return <div style={{ color: "red" }} />; }',
      ].join('\n');

      mockReadFileSync.mockReturnValueOnce(pkg as never).mockReturnValue(content as never);
      mockReaddirSync.mockReturnValue(['MyComponent.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);

      const result = await runner.run('/project');

      expect(result.metadata?.reactCompiler).toBe(true);
      expect(result.issues.find((i) => i.message.includes('Inline object'))).toBeUndefined();
    });

    it('sets reactCompiler: false in metadata when compiler not present', async () => {
      mockReaddirSync.mockReturnValue([] as never);

      const result = await runner.run('/project');

      expect(result.metadata?.reactCompiler).toBe(false);
    });

    it('detects lazy route opportunity in route file with many static imports', async () => {
      const content = [
        "import React from 'react';",
        "import { BrowserRouter, Route } from 'react-router-dom';",
        "import HomePage from './pages/Home';",
        "import AboutPage from './pages/About';",
        "import ContactPage from './pages/Contact';",
        "import ProfilePage from './pages/Profile';",
        '',
        'export function App() {',
        '  return (',
        '    <BrowserRouter>',
        '      <Route path="/" element={<HomePage />} />',
        '      <Route path="/about" element={<AboutPage />} />',
        '    </BrowserRouter>',
        '  );',
        '}',
      ].join('\n');

      mockReaddirSync.mockReturnValue(['App.tsx'] as never);
      mockStatSync.mockReturnValue({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      const result = await runner.run('/project');

      const lazyIssue = result.issues.find((i) => i.message.includes('lazy'));
      expect(lazyIssue).toBeDefined();
      expect(lazyIssue?.severity).toBe('info');
    });

    it('excludes files matching exclude patterns', async () => {
      const content = [
        "import React from 'react';",
        '',
        'export function Heavy() {',
        '  return <div style={{ color: "red" }}>Hello</div>;',
        '}',
      ].join('\n');

      // src dir contains a subdirectory "generated" with a tsx file inside
      mockReaddirSync
        .mockReturnValueOnce(['generated'] as never)
        .mockReturnValueOnce(['Heavy.tsx'] as never);
      mockStatSync
        .mockReturnValueOnce({ isDirectory: () => true } as never)
        .mockReturnValueOnce({ isDirectory: () => false, size: 100 } as never);
      mockReadFileSync.mockReturnValue(content as never);

      // Mock createExcludeFilter to return a function that excludes "generated" paths
      mockCreateExcludeFilter.mockReturnValue((p: string) => p.includes('generated'));

      const result = await runner.run('/project', {
        checkConfig: { exclude: ['src/generated/**'] },
      });

      expect(result.issues).toHaveLength(0);
      expect(result.status).toBe('pass');
    });
  });
});
