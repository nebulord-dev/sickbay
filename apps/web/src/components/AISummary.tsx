import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';

import type { SickbayReport } from '@nebulord/sickbay-core';

interface AISummaryProps {
  report: SickbayReport;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  packageName?: string;
}

interface ParsedSection {
  title: string;
  content: string;
}

function parseStructuredSummary(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = text.split('\n').filter((line) => line.trim());

  let currentSection: ParsedSection | null = null;

  for (const line of lines) {
    // Check if line is a heading (starts with ** or is all caps)
    const headingMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (headingMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: headingMatch[1].trim(), content: '' };
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

// Custom markdown components for styling
const markdownComponents: Partial<Components> = {
  code: ({ children, ...props }) => (
    <code
      className="px-1.5 py-0.5 bg-gray-800/60 text-purple-300 rounded-sm text-xs font-mono border border-gray-700/50"
      {...props}
    >
      {children}
    </code>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-medium text-gray-100" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-1 last:mb-0" {...props}>
      {children}
    </p>
  ),
};

function SectionIcon({ title }: { title: string }) {
  const icons: Record<string, string> = {
    'Health Assessment': '●',
    'Critical Issues': '●',
    "What's Going Well": '●',
    'Next Steps': '●',
  };
  const colors: Record<string, string> = {
    'Health Assessment': 'text-green-500',
    'Critical Issues': 'text-red-500',
    "What's Going Well": 'text-green-400',
    'Next Steps': 'text-blue-400',
  };
  return (
    <span className={`text-xs ${colors[title] || 'text-gray-400'}`}>{icons[title] || '●'}</span>
  );
}

export function AISummary({ report, isOpen, onToggle, packageName }: AISummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const summaryUrl = packageName
    ? `/ai/summary?package=${encodeURIComponent(packageName)}`
    : '/ai/summary';
  const cacheKeySuffix = packageName ? `${report.timestamp}-${packageName}` : report.timestamp;

  const fetchSummary = useCallback(async () => {
    const cacheKey = `sickbay-ai-summary-${cacheKeySuffix}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached && !regenerating) {
      setSummary(cached);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(summaryUrl);
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        localStorage.setItem(`sickbay-ai-summary-${cacheKeySuffix}`, data.summary);
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, [summaryUrl, cacheKeySuffix, regenerating]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRegenerate = () => {
    setRegenerating(true);
    setLoading(true);
    localStorage.removeItem(`sickbay-ai-summary-${cacheKeySuffix}`);
    fetchSummary();
  };

  const sections = summary ? parseStructuredSummary(summary) : [];

  return (
    <>
      {/* Drawer */}
      {isOpen && (
        <div className="fixed top-6 right-6 w-104 max-h-[calc(100vh-3rem)] bg-surface border border-border rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-purple-500/10 to-blue-500/10 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    d="M9.6 6.112c.322-.816 1.478-.816 1.8 0l.91 2.31a5.8 5.8 0 0 0 3.268 3.268l2.31.91c.816.322.816 1.478 0 1.8l-2.31.91a5.8 5.8 0 0 0-3.268 3.268l-.91 2.31c-.322.816-1.478.816-1.8 0l-.91-2.31a5.8 5.8 0 0 0-3.268-3.268l-2.31-.91c-.816-.322-.816-1.478 0-1.8l2.31-.91A5.8 5.8 0 0 0 8.69 8.422zm8.563-3.382a.363.363 0 0 1 .674 0l.342.866c.221.56.665 1.004 1.225 1.225l.866.342a.363.363 0 0 1 0 .674l-.866.342a2.18 2.18 0 0 0-1.225 1.225l-.342.866a.363.363 0 0 1-.674 0l-.342-.866a2.18 2.18 0 0 0-1.225-1.225l-.867-.342a.363.363 0 0 1 0-.674l.867-.342a2.18 2.18 0 0 0 1.225-1.225z"
                  />
                </svg>
              </span>
              <span className="font-semibold text-base text-gray-200">AI Insights</span>
            </div>
            <div className="flex items-center gap-2">
              {!loading && summary && (
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="text-xl text-gray-500 hover:text-accent transition-colors disabled:opacity-50 px-2 py-1 rounded-sm hover:bg-purple-500/10"
                  title="Regenerate insights"
                >
                  {regenerating ? '⠋' : '↻'}
                </button>
              )}
              <button
                onClick={() => onToggle(false)}
                className="text-gray-500 hover:text-white transition-colors text-xl w-6 h-6 flex items-center justify-center rounded-sm hover:bg-purple-500/10"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-base text-gray-500">
                <span className="animate-pulse">⠋</span>
                <span>Generating insights...</span>
              </div>
            ) : !summary ? (
              <div className="space-y-2">
                <div className="text-base text-gray-400">
                  AI insights are not available. This feature requires an Anthropic API key.
                </div>
                <div className="text-base text-gray-500 bg-card p-2.5 rounded-sm border border-border font-mono">
                  <div className="mb-1.5 text-gray-400">To enable AI features:</div>
                  <div>export ANTHROPIC_API_KEY=sk-ant-...</div>
                  <div>sickbay --path ~/project --web</div>
                </div>
              </div>
            ) : (
              sections.map((section, i) => (
                <div key={section.title} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <SectionIcon title={section.title} />
                    <h3 className="text-base font-semibold text-white uppercase tracking-wide">
                      {section.title}
                    </h3>
                  </div>
                  <div className="text-base text-gray-300 leading-snug pl-4">
                    <ReactMarkdown components={markdownComponents}>{section.content}</ReactMarkdown>
                  </div>
                  {i < sections.length - 1 && <div className="border-t border-border/50 mt-2" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
