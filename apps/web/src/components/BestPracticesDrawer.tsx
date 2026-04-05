import type { Recommendation } from '@nebulord/sickbay-core';

interface BestPracticesDrawerProps {
  recommendations: Recommendation[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

const severityBadge: Record<string, string> = {
  recommend: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  suggest: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function groupByFramework(recs: Recommendation[]): Record<string, Recommendation[]> {
  const groups: Record<string, Recommendation[]> = {};
  for (const rec of recs) {
    const key = rec.framework;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rec);
  }
  return groups;
}

export function BestPracticesDrawer({
  recommendations,
  isOpen,
  onToggle,
}: BestPracticesDrawerProps) {
  if (!isOpen) return null;

  const sorted = [...recommendations].sort((a, b) => {
    const order = { recommend: 0, suggest: 1 };
    return order[a.severity] - order[b.severity];
  });
  const grouped = groupByFramework(sorted);

  return (
    <div className="fixed top-6 right-6 w-104 max-h-[calc(100vh-3rem)] bg-surface border border-border rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-teal-500/10 to-emerald-500/10 border-b border-teal-500/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <span className="font-semibold text-base text-gray-200">Advisor</span>
          <span className="text-xs text-gray-500">
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => onToggle(false)}
          className="text-gray-500 hover:text-white transition-colors text-xl w-6 h-6 flex items-center justify-center rounded-sm hover:bg-teal-500/10"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(grouped).map(([framework, recs]) => (
          <div key={framework}>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{framework}</div>
            <div className="space-y-3">
              {recs.map((rec) => (
                <div key={rec.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${severityBadge[rec.severity]}`}
                    >
                      {rec.severity}
                    </span>
                    <span className="font-medium text-sm text-white">{rec.title}</span>
                  </div>
                  <p className="text-sm text-gray-400 leading-snug pl-0.5">{rec.message}</p>
                  {rec.learnMoreUrl && (
                    <a
                      href={rec.learnMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-400 hover:text-teal-300 transition-colors pl-0.5"
                    >
                      Learn more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
