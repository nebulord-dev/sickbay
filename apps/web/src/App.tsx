import { useState, useEffect } from 'react';

import { Dashboard } from './components/Dashboard.js';
import { loadReport } from './lib/load-report.js';

import type { SickbayReport, MonorepoReport } from '@nebulord/sickbay-core';

export function App() {
  const [report, setReport] = useState<SickbayReport | MonorepoReport | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-green-400">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">SICKBAY</div>
          <div className="text-sm text-gray-500 animate-pulse">Loading report...</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="text-green-400 text-3xl font-bold mb-4">SICKBAY</div>
          <div className="text-gray-400 mb-6">
            No report found. Run sickbay in your project first:
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-left">
            <div className="text-green-400 font-mono text-sm">
              $ npx sickbay --json {'>'} sickbay-report.json
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-4">
            Or drop a sickbay-report.json in this directory
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard report={report} />;
}
