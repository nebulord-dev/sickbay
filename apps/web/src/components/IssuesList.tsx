import { useState } from 'react';
import type { CheckResult, Issue } from '@vitals/core';

interface IssuesListProps {
  checks: CheckResult[];
}

export function IssuesList({ checks }: IssuesListProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const allIssues = checks.flatMap((c) =>
    c.issues.map((issue) => ({ ...issue, checkName: c.name, checkId: c.id }))
  );

  const filtered = filter === 'all' ? allIssues : allIssues.filter((i) => i.severity === filter);

  const counts = {
    critical: allIssues.filter((i) => i.severity === 'critical').length,
    warning: allIssues.filter((i) => i.severity === 'warning').length,
    info: allIssues.filter((i) => i.severity === 'info').length,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors
              ${filter === f ? 'bg-accent text-black' : 'bg-surface border border-border text-gray-400 hover:border-accent/50'}`}
          >
            {f === 'all' ? `all (${allIssues.length})` : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <div className="text-gray-500 text-sm py-4 text-center">No issues found ✓</div>
        )}
        {filtered.map((issue) => (
          <IssueRow key={`${issue.checkName}-${issue.message}`} issue={issue} checkName={issue.checkName} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({ issue, checkName }: { issue: Issue; checkName: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (issue.fix?.command) {
      navigator.clipboard.writeText(issue.fix.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const color =
    issue.severity === 'critical'
      ? 'border-l-red-500 bg-red-500/5'
      : issue.severity === 'warning'
      ? 'border-l-yellow-500 bg-yellow-500/5'
      : 'border-l-gray-500 bg-gray-500/5';

  return (
    <div className={`flex flex-col gap-2 px-3 py-2 border-l-2 rounded-r ${color}`}>
      <div className="flex items-start gap-3">
        <span className="text-xs text-gray-500 shrink-0 pt-0.5">{checkName}</span>
        <span className="flex-1 text-sm">{issue.message}</span>
        {issue.fix?.command && (
          <button
            onClick={copy}
            className="shrink-0 text-xs text-gray-500 hover:text-accent font-mono transition-colors"
          >
            {copied ? '✓ copied' : issue.fix.command}
          </button>
        )}
      </div>

      {issue.file && (
        <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
          <span>📄</span>
          <span>{issue.file}</span>
        </div>
      )}

      {issue.fix?.codeChange && (
        <div className="bg-black/30 rounded p-3 font-mono text-xs border border-red-800/30">
          <div className="text-red-400 mb-2 flex items-center gap-1.5">
            <span>⚠️</span>
            <span className="font-semibold">Offensive code:</span>
          </div>
          <code className="text-gray-300 block whitespace-pre-wrap break-all">
            {issue.fix.codeChange.before}
          </code>
        </div>
      )}
    </div>
  );
}
