import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactPerfRunner } from './react-perf.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  WARN_LINES: 400,
}));

import { readdirSync, statSync, readFileSync } from 'fs';
import { WARN_LINES } from '@sickbay/constants';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('ReactPerfRunner', () => {
  let runner: ReactPerfRunner;

  beforeEach(() => {
    runner = new ReactPerfRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for react, next, and remix', () => {
    const runner = new ReactPerfRunner();
    expect(runner.applicableFrameworks).toContain('react');
    expect(runner.applicableFrameworks).toContain('next');
    expect(runner.applicableFrameworks).toContain('remix');
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

    it('detects large component files (>400 lines) as info', async () => {
      // Build a file with 401 lines
      const lines = Array.from({ length: 401 }, (_, i) => `// line ${i}`);
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

    it('calculates score correctly: 100 - warnings*3 - info*1, floor at 20', async () => {
      // 2 warnings: inline object on 2 lines, no info
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

      // 2 warnings → 100 - 2*3 = 94
      expect(result.score).toBe(94);
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
      mockReadFileSync
        .mockReturnValueOnce(pkg as never)
        .mockReturnValue(content as never);
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

      mockReadFileSync
        .mockReturnValueOnce(pkg as never)
        .mockReturnValue(content as never);
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

      mockReadFileSync
        .mockReturnValueOnce(pkg as never)
        .mockReturnValue(content as never);
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
  });
});
