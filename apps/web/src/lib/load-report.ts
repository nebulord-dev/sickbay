import type { VitalsReport, MonorepoReport } from "@vitals/core";

/**
 * loadReport attempts to retrieve a VitalsReport or MonorepoReport from multiple potential
 * sources in a prioritized manner:
 * 1. URL Query Parameter: It checks if there's a 'report' parameter in the URL, which can
 *    contain a base64-encoded JSON string of the report.
 * 2. Server Fetch: If the query parameter is not present or invalid, it tries to fetch a
 *    'vitals-report.json' file from the server root.
 * 3. Local Storage: As a fallback, it looks for a 'vitals-report' entry in localStorage.
 */

export async function loadReport(): Promise<VitalsReport | MonorepoReport | null> {
  // 1. Try URL query param: ?report=<base64 or path>
  const params = new URLSearchParams(window.location.search);
  const reportParam = params.get("report");

  if (reportParam) {
    try {
      return JSON.parse(atob(reportParam)) as VitalsReport | MonorepoReport;
    } catch {
      // not base64, try as path
    }
  }

  // 2. Try fetching vitals-report.json from the server root
  try {
    const res = await fetch("/vitals-report.json");
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.includes("json"))
      return res.json() as Promise<VitalsReport | MonorepoReport>;
  } catch {
    // not available
  }

  // 3. Try localStorage
  const stored = localStorage.getItem("vitals-report");
  if (stored) {
    try {
      return JSON.parse(stored) as VitalsReport | MonorepoReport;
    } catch {
      // corrupted
    }
  }

  return null;
}
