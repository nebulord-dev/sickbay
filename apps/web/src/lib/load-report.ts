import type { SickbayReport, MonorepoReport } from 'sickbay-core';

/**
 * loadReport attempts to retrieve a SickbayReport or MonorepoReport from multiple potential
 * sources in a prioritized manner:
 * 1. URL Query Parameter: It checks if there's a 'report' parameter in the URL, which can
 *    contain a base64-encoded JSON string of the report.
 * 2. Server Fetch: If the query parameter is not present or invalid, it tries to fetch a
 *    'sickbay-report.json' file from the server root.
 * 3. Local Storage: As a fallback, it looks for a 'sickbay-report' entry in localStorage.
 */

/**
 * Minimal runtime shape guard. Checks that the parsed object has the fields
 * downstream components depend on — catching truncated, corrupted, or crafted
 * payloads before they cause cryptic render errors.
 */
function isValidReport(data: unknown): data is SickbayReport | MonorepoReport {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  // Both single-project and monorepo reports must have a timestamp string.
  if (typeof obj.timestamp !== 'string') return false;
  // Single-project reports have a `checks` array; monorepo reports have `packages`.
  return Array.isArray(obj.checks) || Array.isArray(obj.packages);
}

export async function loadReport(): Promise<SickbayReport | MonorepoReport | null> {
  // 1. Try URL query param: ?report=<base64>
  const params = new URLSearchParams(window.location.search);
  const reportParam = params.get('report');

  if (reportParam) {
    // Separate atob failure (not base64 — skip) from JSON.parse failure
    // (valid base64 but corrupt JSON — stop here, don't silently fall through
    // to a server report that has nothing to do with the shared link).
    let decoded: string | null = null;
    try {
      decoded = atob(reportParam);
    } catch {
      // not valid base64 — fall through to server fetch
    }
    if (decoded !== null) {
      try {
        const parsed = JSON.parse(decoded) as unknown;
        if (isValidReport(parsed)) return parsed;
        console.warn('sickbay: ?report= payload is missing required fields');
      } catch {
        console.warn('sickbay: ?report= parameter contains invalid JSON');
      }
      return null;
    }
  }

  // 2. Try fetching sickbay-report.json from the server root
  try {
    const res = await fetch('/sickbay-report.json');
    const ct = res.headers.get('content-type') ?? '';
    if (res.ok && ct.includes('json')) {
      const parsed = (await res.json()) as unknown;
      if (isValidReport(parsed)) return parsed;
    }
  } catch {
    // not available
  }

  // 3. Try localStorage
  const stored = localStorage.getItem('sickbay-report');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (isValidReport(parsed)) return parsed;
    } catch {
      // corrupted
    }
  }

  return null;
}
