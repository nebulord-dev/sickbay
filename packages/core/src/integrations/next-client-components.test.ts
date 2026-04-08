import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NextClientComponentsRunner } from './next-client-components.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
  relativeFromRoot: (root: string, p: string) =>
    p.startsWith(root + '/') ? p.slice(root.length + 1) : p,
}));

import { readdirSync, statSync, readFileSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('NextClientComponentsRunner', () => {
  let runner: NextClientComponentsRunner;

  beforeEach(() => {
    runner = new NextClientComponentsRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for next only', () => {
    expect(runner.applicableFrameworks).toEqual(['next']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('next-client-components');
  });

  it('returns pass with score 100 when no jsx files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe('next-client-components');
  });

  it('returns pass when file has no use-client directive', async () => {
    const content = `
      export default function MyComponent() {
        return <div>Hello</div>;
      }
    `;
    mockReaddirSync.mockReturnValueOnce(['component.tsx'] as never); // app/
    mockReaddirSync.mockReturnValueOnce([] as never); // src/
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns pass when file has "use client" AND useState (has hooks)', async () => {
    const content = `
      "use client";
      import { useState } from 'react';
      export default function MyComponent() {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      }
    `;
    mockReaddirSync.mockReturnValueOnce(['component.tsx'] as never); // app/
    mockReaddirSync.mockReturnValueOnce([] as never); // src/
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns pass when file has "use client" AND onClick={...} (has event handler)', async () => {
    const content = `
      "use client";
      export default function MyComponent() {
        return <button onClick={() => console.log('clicked')}>Click me</button>;
      }
    `;
    mockReaddirSync.mockReturnValueOnce(['component.tsx'] as never); // app/
    mockReaddirSync.mockReturnValueOnce([] as never); // src/
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns warning when file has "use client" with NO hooks and NO handlers', async () => {
    const content = `
      "use client";
      export default function MyComponent() {
        return <div>Static content</div>;
      }
    `;
    mockReaddirSync.mockReturnValueOnce(['component.tsx'] as never); // app/
    mockReaddirSync.mockReturnValueOnce([] as never); // src/
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
  });

  it('issue message contains "may not need \'use client\'" (soft language)', async () => {
    const content = `
      "use client";
      export default function MyComponent() {
        return <div>Static</div>;
      }
    `;
    mockReaddirSync.mockReturnValueOnce(['component.tsx'] as never); // app/
    mockReaddirSync.mockReturnValueOnce([] as never); // src/
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues[0].message).toContain("may not need 'use client'");
  });

  it('file where "use client" is NOT the first line (comment first) → NOT flagged', async () => {
    const content = `
      // This is a comment
      "use client";
      export default function MyComponent() {
        return <div>Hello</div>;
      }
    `;
    mockReaddirSync.mockReturnValueOnce(['component.tsx'] as never); // app/
    mockReaddirSync.mockReturnValueOnce([] as never); // src/
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.issues).toHaveLength(0);
  });

  it('scoring: 1 unnecessary → 85, 3 unnecessary → 55, 6 unnecessary → 20 (floor)', async () => {
    const unnecessaryFile = `
      "use client";
      export default function MyComponent() {
        return <div>Static</div>;
      }
    `;
    for (const [count, expected] of [
      [1, 85],
      [3, 55],
      [6, 20],
    ] as [number, number][]) {
      vi.clearAllMocks();
      const files = Array.from({ length: count }, (_, i) => `comp${i}.tsx`);
      mockReaddirSync.mockReturnValueOnce(files as never); // app/
      mockReaddirSync.mockReturnValueOnce([] as never); // src/
      mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
      mockReadFileSync.mockReturnValue(unnecessaryFile as never);
      const result = await runner.run('/project');
      expect(result.score).toBe(expected);
    }
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
