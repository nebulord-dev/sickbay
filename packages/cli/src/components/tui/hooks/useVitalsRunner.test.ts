import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useEffect, useRef } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { VitalsReport } from '@vitals/core';

vi.mock('@vitals/core', () => ({
  runVitals: vi.fn(),
}));

vi.mock('../../../lib/history.js', () => ({
  saveEntry: vi.fn(),
}));

import { runVitals } from '@vitals/core';
import { saveEntry } from '../../../lib/history.js';
import { useVitalsRunner } from './useVitalsRunner.js';

const mockRunVitals = vi.mocked(runVitals);
const mockSaveEntry = vi.mocked(saveEntry);

function makeReport(overrides: Partial<VitalsReport> = {}): VitalsReport {
  return {
    timestamp: '2024-01-01T00:00:00.000Z',
    projectPath: '/test/project',
    projectInfo: {
      name: 'test-project',
      version: '1.0.0',
      framework: 'react',
      packageManager: 'npm',
      totalDependencies: 0,
      dependencies: {},
      devDependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    },
    checks: [],
    overallScore: 85,
    summary: { critical: 0, warnings: 0, info: 0 },
    ...overrides,
  };
}

/**
 * Wrapper component that exposes hook state via rendered text.
 * It also stores the scan function on the ref so tests can call it externally.
 */
function RunnerDisplay({
  projectPath,
  checks,
  scanRef,
  onScanComplete,
}: {
  projectPath: string;
  checks?: string[];
  scanRef?: React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;
  onScanComplete?: (result: VitalsReport | null) => void;
}) {
  const { report, isScanning, progress, error, scan } = useVitalsRunner({ projectPath, checks });

  // Expose scan function via ref
  useEffect(() => {
    if (scanRef) scanRef.current = scan;
  }, [scan, scanRef]);

  return React.createElement(
    Text,
    null,
    `scanning:${isScanning} report:${report ? report.overallScore : 'null'} error:${error ?? 'null'} progress:${progress.length}`,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useVitalsRunner', () => {
  it('initial state: not scanning, no report, no error, empty progress', () => {
    // runVitals will never resolve so state stays initial
    mockRunVitals.mockReturnValue(new Promise(() => {}) as any);

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project' }),
    );

    expect(lastFrame()).toContain('scanning:false');
    expect(lastFrame()).toContain('report:null');
    expect(lastFrame()).toContain('error:null');
    expect(lastFrame()).toContain('progress:0');
  });

  it('sets isScanning to true while scan is running', async () => {
    let resolveVitals!: (r: VitalsReport) => void;
    mockRunVitals.mockReturnValue(
      new Promise<VitalsReport>((res) => { resolveVitals = res; }) as any,
    );

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    // Wait for scanRef to be populated
    await new Promise((r) => setImmediate(r));

    // Kick off scan (don't await — it's still pending)
    scanRef.current?.();
    // React 18 batches and schedules re-renders via its internal scheduler.
    // setTimeout(0) runs after React's scheduler has flushed the pending render.
    await new Promise((r) => setTimeout(r, 0));

    expect(lastFrame()).toContain('scanning:true');

    // Clean up — resolve so the hook doesn't leak
    resolveVitals(makeReport());
    await new Promise((r) => setImmediate(r));
  });

  it('sets report after successful scan', async () => {
    const report = makeReport({ overallScore: 72 });
    mockRunVitals.mockResolvedValue(report as any);

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));
    await scanRef.current?.();
    await new Promise((r) => setImmediate(r));

    expect(lastFrame()).toContain('report:72');
    expect(lastFrame()).toContain('scanning:false');
  });

  it('sets error message when runVitals throws', async () => {
    mockRunVitals.mockRejectedValue(new Error('Analysis failed'));

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));
    await scanRef.current?.();
    await new Promise((r) => setImmediate(r));

    expect(lastFrame()).toContain('error:Analysis failed');
    expect(lastFrame()).toContain('scanning:false');
    expect(lastFrame()).toContain('report:null');
  });

  it('clears error on subsequent successful scan', async () => {
    mockRunVitals
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce(makeReport({ overallScore: 90 }) as any);

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));

    // First scan — should fail
    await scanRef.current?.();
    await new Promise((r) => setImmediate(r));
    expect(lastFrame()).toContain('error:First failure');

    // Second scan — should succeed and clear error
    await scanRef.current?.();
    await new Promise((r) => setImmediate(r));
    expect(lastFrame()).toContain('error:null');
    expect(lastFrame()).toContain('report:90');
  });

  it('populates progress items from the checks array', async () => {
    // Use a pending promise so we can observe the mid-scan state.
    // mockResolvedValue completes synchronously in microtasks before the Ink
    // renderer flushes, so lastFrame() would still show the pre-render state.
    let resolveVitals!: (r: VitalsReport) => void;
    mockRunVitals.mockReturnValue(
      new Promise<VitalsReport>((res) => { resolveVitals = res; }) as any,
    );

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, {
        projectPath: '/test/project',
        checks: ['eslint', 'knip', 'typescript'],
        scanRef,
      }),
    );

    await new Promise((r) => setImmediate(r));

    // Start scan but don't await so we can observe mid-scan state
    const scanPromise = scanRef.current?.();
    await new Promise((r) => setTimeout(r, 0));

    // Progress should be set to the 3 check names
    expect(lastFrame()).toContain('progress:3');

    // Cleanup — resolve so the hook doesn't leak
    resolveVitals(makeReport());
    await scanPromise;
  });

  it('calls saveEntry with the report after a successful scan', async () => {
    const report = makeReport({ overallScore: 80 });
    mockRunVitals.mockResolvedValue(report as any);

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));
    await scanRef.current?.();
    await new Promise((r) => setImmediate(r));

    expect(mockSaveEntry).toHaveBeenCalledWith(report);
  });

  it('does not call runVitals a second time while first scan is in progress', async () => {
    let resolveFirst!: (r: VitalsReport) => void;
    mockRunVitals.mockReturnValue(
      new Promise<VitalsReport>((res) => { resolveFirst = res; }) as any,
    );

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));

    // Fire two scans without waiting
    scanRef.current?.();
    scanRef.current?.();
    await new Promise((r) => setImmediate(r));

    // Only one call to runVitals
    expect(mockRunVitals).toHaveBeenCalledTimes(1);

    // Cleanup
    resolveFirst(makeReport());
    await new Promise((r) => setImmediate(r));
  });

  it('handles non-Error thrown values (string errors)', async () => {
    mockRunVitals.mockRejectedValue('plain string error');

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    const { lastFrame } = render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));
    await scanRef.current?.();
    await new Promise((r) => setImmediate(r));

    expect(lastFrame()).toContain('error:plain string error');
  });

  it('returns the report from scan()', async () => {
    const report = makeReport({ overallScore: 99 });
    mockRunVitals.mockResolvedValue(report as any);

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;
    let returnedReport: VitalsReport | null | undefined = undefined;

    render(
      React.createElement(RunnerDisplay, {
        projectPath: '/test/project',
        scanRef,
        onScanComplete: (r) => { returnedReport = r; },
      }),
    );

    await new Promise((r) => setImmediate(r));
    returnedReport = await scanRef.current?.() ?? null;
    await new Promise((r) => setImmediate(r));

    expect(returnedReport).toMatchObject({ overallScore: 99 });
  });

  it('returns null from scan() when runVitals throws', async () => {
    mockRunVitals.mockRejectedValue(new Error('boom'));

    const scanRef = React.createRef<(() => Promise<VitalsReport | null>) | null>() as React.MutableRefObject<(() => Promise<VitalsReport | null>) | null>;

    render(
      React.createElement(RunnerDisplay, { projectPath: '/test/project', scanRef }),
    );

    await new Promise((r) => setImmediate(r));
    const result = await scanRef.current?.();

    expect(result).toBeNull();
  });
});
