import React, { useState, useEffect } from "react";
import type { VitalsReport } from "@vitals/core";

interface CriticalIssuesProps {
  report: VitalsReport;
  onCheckClick: (checkId: string) => void;
}

export function CriticalIssues({ report, onCheckClick }: CriticalIssuesProps) {
  // Aggregate all critical issues by check
  const checksWithCriticals = report.checks
    .map((check) => ({
      ...check,
      criticalIssues: check.issues.filter(
        (issue) => issue.severity === "critical",
      ),
    }))
    .filter((check) => check.criticalIssues.length > 0);

  if (checksWithCriticals.length === 0) {
    return null;
  }

  const totalCriticals = checksWithCriticals.reduce(
    (sum, check) => sum + check.criticalIssues.length,
    0,
  );

  // Collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem("vitals-critical-issues-collapsed");
    return stored !== "false";
  });

  useEffect(() => {
    localStorage.setItem(
      "vitals-critical-issues-collapsed",
      String(isCollapsed),
    );
  }, [isCollapsed]);

  return (
    <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-4 mb-6">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <span className="text-lg">🚨</span>
        <h2 className="text-lg font-semibold text-red-400">Critical Issues</h2>
        <span className="text-sm text-gray-400">({totalCriticals} total)</span>
        <span
          className={`ml-auto text-gray-500 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
        >
          ▼
        </span>
      </button>

      {!isCollapsed && (
        <>
          <div className="space-y-3">
            {checksWithCriticals.map((check) => (
              <div key={check.id} className="space-y-1.5">
                <button
                  onClick={() => onCheckClick(check.id)}
                  className="text-accent hover:underline text-sm font-semibold flex items-center gap-2"
                >
                  {check.name}
                  <span className="text-xs text-gray-500">
                    ({check.criticalIssues.length} critical)
                  </span>
                </button>
                <ul className="space-y-1 ml-4">
                  {check.criticalIssues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="text-sm text-gray-300">
                      <span className="text-red-400 mr-2">•</span>
                      {issue.message}
                    </li>
                  ))}
                  {check.criticalIssues.length > 3 && (
                    <li className="text-xs text-gray-500">
                      +{check.criticalIssues.length - 3} more critical issues
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-red-800/30 text-xs text-gray-500">
            Click on a check name to view all issues in detail
          </div>
        </>
      )}
    </div>
  );
}
