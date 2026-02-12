import React, { useState, useEffect } from "react";
import type { VitalsReport } from "@vitals/core";
import { loadReport } from "./lib/load-report.js";
import { Dashboard } from "./components/Dashboard.js";
import { CRTOverlay } from "./components/CRTOverlay.js";

export function App() {
  const [report, setReport] = useState<VitalsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCRT, setShowCRT] = useState(false);

  useEffect(() => {
    loadReport()
      .then((r) => {
        setReport(r);
        setLoading(false);
      })
      .catch(() => {
        // treat load failures the same as no report found
        setLoading(false);
      });
  }, []);

  // Easter egg: Cmd/Ctrl + Shift + V triggers CRT overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "v"
      ) {
        e.preventDefault();
        setShowCRT(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-green-400">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">VITALS</div>
          <div className="text-sm text-gray-500 animate-pulse">
            Loading report...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        <div className="text-center">
          <div className="text-xl mb-2">Error loading report</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="text-green-400 text-3xl font-bold mb-4">VITALS</div>
          <div className="text-gray-400 mb-6">
            No report found. Run vitals in your project first:
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-left">
            <div className="text-green-400 font-mono text-sm">
              $ npx vitals --json {">"} vitals-report.json
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-4">
            Or drop a vitals-report.json in this directory
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Dashboard report={report} />
      {showCRT && <CRTOverlay onClose={() => setShowCRT(false)} />}
    </>
  );
}
