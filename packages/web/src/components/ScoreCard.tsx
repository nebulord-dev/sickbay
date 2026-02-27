import type { CheckResult } from '@vitals/core';

const CATEGORY_ICONS: Record<string, string> = {
  dependencies: '📦',
  security: '🔒',
  'code-quality': '🔄',
  performance: '⚡',
  git: '🌿',
};

interface ScoreCardProps {
  check: CheckResult;
  onClick?: () => void;
  active?: boolean;
}

export function ScoreCard({ check, onClick, active }: ScoreCardProps) {
  const color =
    check.score >= 80 ? 'text-green-400' : check.score >= 60 ? 'text-yellow-400' : 'text-red-400';
  const ring =
    check.score >= 80 ? 'stroke-green-400' : check.score >= 60 ? 'stroke-yellow-400' : 'stroke-red-400';
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (check.score / 100) * circumference;

  const criticalIssues = check.issues.filter((issue) => issue.severity === 'critical');

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all cursor-pointer text-left w-full
        ${active ? 'border-accent bg-card' : 'border-border bg-surface hover:border-accent/50'}`}
    >
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#2a2a2a" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-700 ${ring}`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}>
          {check.score}
        </span>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold">{CATEGORY_ICONS[check.category]} {check.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{check.toolsUsed.join(', ')}</div>
      </div>
      {check.issues.length > 0 && (
        <div className="text-xs text-gray-400">
          {check.issues.length} issue{check.issues.length !== 1 ? 's' : ''}
        </div>
      )}

      {criticalIssues.length > 0 && (
        <div className="w-full mt-2 pt-3 border-t border-red-900/30">
          <div className="text-xs text-red-400 font-semibold mb-1.5 text-center">
            🚨 {criticalIssues.length} Critical
          </div>
          <ul className="space-y-1 text-left">
            {criticalIssues.slice(0, 2).map((issue) => (
              <li key={issue.message} className="text-xs text-gray-400 truncate">
                • {issue.message}
              </li>
            ))}
            {criticalIssues.length > 2 && (
              <li className="text-xs text-gray-500">
                +{criticalIssues.length - 2} more
              </li>
            )}
          </ul>
        </div>
      )}
    </button>
  );
}
