import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('loadReport', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear any URL params
    vi.stubGlobal('location', {
      ...window.location,
      search: '',
    });
  });

  it('exports loadReport function', async () => {
    const module = await import('./load-report.js');
    expect(module.loadReport).toBeDefined();
    expect(typeof module.loadReport).toBe('function');
  });

  // Note: Full integration tests would require mocking fetch and localStorage
  // which is more appropriate for E2E tests. These are basic smoke tests.
});
