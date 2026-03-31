import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AngularSubscriptionsRunner } from './angular-subscriptions.js';

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

describe('AngularSubscriptionsRunner', () => {
  let runner: AngularSubscriptionsRunner;

  beforeEach(() => {
    runner = new AngularSubscriptionsRunner();
    vi.clearAllMocks();
  });

  it('declares applicableFrameworks for angular only', () => {
    expect(runner.applicableFrameworks).toEqual(['angular']);
    expect(runner.category).toBe('code-quality');
    expect(runner.name).toBe('angular-subscriptions');
  });

  it('returns pass with score 100 when no component files exist', async () => {
    mockReaddirSync.mockReturnValue([] as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
    expect(result.id).toBe('angular-subscriptions');
  });

  it('returns pass when components have no subscriptions', async () => {
    const content = `
      @Component({ selector: 'app', template: '' })
      export class AppComponent {}
    `;
    mockReaddirSync.mockReturnValue(['app.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
    expect(result.score).toBe(100);
  });

  it('returns pass when subscription uses takeUntilDestroyed', async () => {
    const content = `
      export class MyComponent {
        constructor() {
          this.service.data$.pipe(takeUntilDestroyed()).subscribe(d => this.data = d);
        }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns pass when subscription uses takeUntil', async () => {
    const content = `
      export class MyComponent {
        ngOnInit() { this.svc.data$.pipe(takeUntil(this.destroy$)).subscribe(d => {}); }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns pass when component implements ngOnDestroy', async () => {
    const content = `
      export class MyComponent implements OnDestroy {
        sub = this.svc.data$.subscribe(d => this.data = d);
        ngOnDestroy() { this.sub.unsubscribe(); }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns pass when component injects DestroyRef', async () => {
    const content = `
      export class MyComponent {
        constructor(private destroyRef: DestroyRef) {
          this.svc.data$.subscribe(d => this.data = d);
        }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns pass when subscription is explicitly unsubscribed', async () => {
    const content = `
      export class MyComponent {
        private sub = this.svc.data$.subscribe(d => this.data = d);
        cleanup() { this.sub.unsubscribe(); }
      }
    `;
    mockReaddirSync.mockReturnValue(['my.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('pass');
  });

  it('returns warning when subscription has no cleanup', async () => {
    const content = `
      export class UserListComponent implements OnInit {
        ngOnInit() {
          this.dataService.getUsers().subscribe(users => { this.users = users; });
        }
      }
    `;
    mockReaddirSync.mockReturnValue(['user-list.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(content as never);
    const result = await runner.run('/project');
    expect(result.status).toBe('warning');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].message).toContain('possible unguarded subscription');
    expect(result.issues[0].fix?.description).toContain('takeUntilDestroyed');
  });

  it('scores: 2 leaky → 60, 5 leaky → 20 (floor)', async () => {
    const leaky = `export class C { ngOnInit() { this.svc.data$.subscribe(d => {}); } }`;

    mockReaddirSync.mockReturnValue(['a.component.ts', 'b.component.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(leaky as never);
    let result = await runner.run('/project');
    expect(result.score).toBe(60);

    vi.clearAllMocks();
    mockReaddirSync.mockReturnValue([
      'a.component.ts',
      'b.component.ts',
      'c.component.ts',
      'd.component.ts',
      'e.component.ts',
    ] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue(leaky as never);
    result = await runner.run('/project');
    expect(result.score).toBe(20);
  });

  it('does not flag .service.ts or .routes.ts files', async () => {
    mockReaddirSync.mockReturnValue(['data.service.ts', 'app.routes.ts'] as never);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    const result = await runner.run('/project');
    expect(result.score).toBe(100);
    expect(result.metadata?.filesScanned).toBe(0);
  });

  it('returns fail status when an unexpected error is thrown', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const result = await runner.run('/project');
    expect(result.status).toBe('fail');
  });
});
