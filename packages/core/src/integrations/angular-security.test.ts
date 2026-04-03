import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularSecurityRunner } from './angular-security.js';

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

describe('AngularSecurityRunner', () => {
  let runner: AngularSecurityRunner;

  beforeEach(() => {
    runner = new AngularSecurityRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('security');
    expect(runner.name).toBe('angular-security');
  });

  it('returns pass when no source files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('detects bypassSecurityTrustHtml calls', async () => {
    const content = `
      import { DomSanitizer } from '@angular/platform-browser';
      export class MyService {
        trust(s: DomSanitizer, html: string) {
          return s.bypassSecurityTrustHtml(html);
        }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.service.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('bypassSecurityTrustHtml');
  });

  it('detects all bypass method variants', async () => {
    const content = [
      'bypassSecurityTrustHtml(x)',
      'bypassSecurityTrustScript(x)',
      'bypassSecurityTrustUrl(x)',
      'bypassSecurityTrustResourceUrl(x)',
      'bypassSecurityTrustStyle(x)',
    ].join('\n');
    mockReaddirSync.mockReturnValue(['service.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.issues).toHaveLength(5);
  });

  it('detects [innerHTML] bindings', async () => {
    const content = `
      @Component({
        template: '<div [innerHTML]="content"></div>',
      })
      export class MyComponent {}
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('[innerHTML]');
  });

  it('scans both .ts and .html files', async () => {
    mockReaddirSync.mockReturnValue(['my.component.ts', 'my.component.html'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue('safe content' as never);
    const result = await runner.run('/project');
    expect(result.metadata?.filesScanned).toBe(2);
  });

  it('scores: max(20, 100 - count * 20)', async () => {
    // 3 violations → score 40
    const content = 'bypassSecurityTrustHtml(x)\nbypassSecurityTrustScript(x)\n[innerHTML]="y"';
    mockReaddirSync.mockReturnValue(['file.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(40);
  });

  it('score floors at 20', async () => {
    const content = Array(6).fill('bypassSecurityTrustHtml(x)').join('\n');
    mockReaddirSync.mockReturnValue(['file.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(20);
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
