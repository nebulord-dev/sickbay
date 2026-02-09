import type { VitalsReport } from '@vitals/core';

export async function loadReport(): Promise<VitalsReport | null> {
  // 1. Try URL query param: ?report=<base64 or path>
  const params = new URLSearchParams(window.location.search);
  const reportParam = params.get('report');

  if (reportParam) {
    try {
      return JSON.parse(atob(reportParam)) as VitalsReport;
    } catch {
      // not base64, try as path
    }
  }

  // 2. Try fetching vitals-report.json from the server root
  try {
    const res = await fetch('/vitals-report.json');
    const ct = res.headers.get('content-type') ?? '';
    if (res.ok && ct.includes('json')) return res.json() as Promise<VitalsReport>;
  } catch {
    // not available
  }

  // 3. Try localStorage
  const stored = localStorage.getItem('vitals-report');
  if (stored) {
    try {
      return JSON.parse(stored) as VitalsReport;
    } catch {
      // corrupted
    }
  }

  return null;
}
