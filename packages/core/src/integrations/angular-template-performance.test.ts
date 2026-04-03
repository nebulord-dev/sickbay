import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularTemplatePerformanceRunner } from './angular-template-performance.js';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/file-helpers.js', () => ({
  timer: vi.fn(() => () => 100),
}));

import { readdirSync, statSync, readFileSync } from 'fs';

const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe('AngularTemplatePerformanceRunner', () => {
  let runner: AngularTemplatePerformanceRunner;

  beforeEach(() => {
    runner = new AngularTemplatePerformanceRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('performance');
    expect(runner.name).toBe('angular-template-performance');
  });

  it('returns pass when no component files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('detects *ngFor without trackBy', async () => {
    const content = `
      @Component({
        template: \`<li *ngFor="let item of items">{{ item.name }}</li>\`,
      })
      export class ListComponent {}
    `;
    mockReaddirSync.mockReturnValue(['list.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('*ngFor without trackBy');
  });

  it('passes when *ngFor has trackBy', async () => {
    const content = `
      @Component({
        template: \`<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>\`,
      })
      export class ListComponent {}
    `;
    mockReaddirSync.mockReturnValue(['list.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    const ngForIssues = result.issues.filter((i) => i.message.includes('ngFor'));
    expect(ngForIssues).toHaveLength(0);
  });

  it('detects @for without track', async () => {
    const content = `
      @Component({
        template: \`@for (item of items) { <li>{{ item.name }}</li> }\`,
      })
      export class ListComponent {}
    `;
    mockReaddirSync.mockReturnValue(['list.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('@for without track'))).toBe(true);
  });

  it('passes when @for has track', async () => {
    const content = `
      @Component({
        template: \`@for (item of items; track item.id) { <li>{{ item.name }}</li> }\`,
      })
      export class ListComponent {}
    `;
    mockReaddirSync.mockReturnValue(['list.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    const forIssues = result.issues.filter((i) => i.message.includes('@for'));
    expect(forIssues).toHaveLength(0);
  });

  it('detects function calls in interpolations', async () => {
    const content = `
      @Component({
        template: \`<span>{{ getLabel() }}</span>\`,
      })
      export class MyComponent {
        getLabel() { return 'hi'; }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('getLabel()'))).toBe(true);
  });

  it('skips $any() built-in in interpolations', async () => {
    const content = `
      @Component({
        template: \`<span>{{ $any(value) }}</span>\`,
      })
      export class MyComponent {}
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    const fnCallIssues = result.issues.filter((i) => i.message.includes('function call'));
    expect(fnCallIssues).toHaveLength(0);
  });

  it('detects function calls in property bindings', async () => {
    const content = `
      @Component({
        template: \`<div [title]="computeTitle()"></div>\`,
      })
      export class MyComponent {
        computeTitle() { return 'x'; }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues.some((i) => i.message.includes('computeTitle()'))).toBe(true);
  });

  it('does not flag event bindings like (click)="handler()"', async () => {
    const content = `
      @Component({
        template: \`<button (click)="handleClick()">Go</button>\`,
      })
      export class MyComponent {
        handleClick() {}
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    const fnCallIssues = result.issues.filter((i) => i.message.includes('function call'));
    expect(fnCallIssues).toHaveLength(0);
  });

  it('scores: max(20, 100 - count * 15)', async () => {
    // 2 violations → score 70
    const content = `
      @Component({
        template: \`
          <li *ngFor="let item of items">{{ getName() }}</li>
        \`,
      })
      export class C {}
    `;
    mockReaddirSync.mockReturnValue(['c.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues).toHaveLength(2);
    expect(result.score).toBe(70);
  });

  it('returns fail on unexpected error', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
  });
});
