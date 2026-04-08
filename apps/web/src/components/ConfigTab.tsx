import { useState, useEffect, useCallback } from 'react';

import { DEFAULT_WEIGHTS } from '../lib/constants.js';

import type { SickbayReport } from 'sickbay-core';

interface CheckConfig {
  enabled?: boolean;
  thresholds?: Record<string, unknown>;
  exclude?: string[];
  suppress?: Array<{ path?: string; match?: string; reason: string }>;
}

interface RawConfig {
  checks?: Record<string, boolean | CheckConfig>;
  exclude?: string[];
  weights?: Record<string, number>;
}

interface ConfigTabProps {
  report: SickbayReport;
}

function Badge({ label, color }: { label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-500/20 text-red-300',
    blue: 'bg-blue-500/20 text-blue-300',
    yellow: 'bg-yellow-500/20 text-yellow-300',
    purple: 'bg-purple-500/20 text-purple-300',
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-xs font-mono ${colorClasses[color] ?? 'bg-gray-500/20 text-gray-300'}`}
    >
      {label}
    </span>
  );
}

function SectionHeader({
  label,
  collapsed,
  onToggle,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 w-full text-left group mb-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`text-gray-500 group-hover:text-gray-300 transition-transform shrink-0 ${collapsed ? '-rotate-90' : ''}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-200 transition-colors">
        {label}
      </h2>
    </button>
  );
}

function isCheckConfig(entry: boolean | CheckConfig): entry is CheckConfig {
  return typeof entry === 'object';
}

function isDisabled(entry: boolean | CheckConfig): boolean {
  if (entry === false) return true;
  if (isCheckConfig(entry) && entry.enabled === false) return true;
  return false;
}

function formatThresholdValue(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return String(value);
}

export function ConfigTab({ report }: ConfigTabProps) {
  const [config, setConfig] = useState<RawConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [checksCollapsed, setChecksCollapsed] = useState(false);
  const [weightsCollapsed, setWeightsCollapsed] = useState(false);
  const [excludesCollapsed, setExcludesCollapsed] = useState(false);

  const fetchConfig = useCallback(() => {
    fetch('/sickbay-config.json')
      .then((r) => (r.ok ? (r.json() as Promise<RawConfig>) : null))
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch(() => {
        /* no config available */
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // No custom config — show empty state
  if (!report.config?.hasCustomConfig) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm font-mono">
        No custom configuration — Sickbay is running with all defaults
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm font-mono">
        Loading configuration...
      </div>
    );
  }

  const disabledCount = report.config.disabledChecks.length;
  const overriddenCount = report.config.overriddenChecks.length;

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center gap-3">
          <div className="text-green-400 text-lg">&#9881;</div>
          <div>
            <div className="text-sm font-semibold">Custom configuration active</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {disabledCount > 0 && <span className="text-red-400">{disabledCount} disabled</span>}
              {disabledCount > 0 && overriddenCount > 0 && <span> · </span>}
              {overriddenCount > 0 && (
                <span className="text-blue-400">{overriddenCount} overridden</span>
              )}
              {disabledCount === 0 && overriddenCount === 0 && (
                <span>Weight or exclude overrides active</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Checks Section */}
      {config?.checks && Object.keys(config.checks).length > 0 && (
        <section>
          <SectionHeader
            label="Checks"
            collapsed={checksCollapsed}
            onToggle={() => setChecksCollapsed((v) => !v)}
          />
          {!checksCollapsed && (
            <div className="bg-card rounded-lg divide-y divide-border">
              {Object.entries(config.checks).map(([checkId, entry]) => {
                const disabled = isDisabled(entry);
                const cfg = isCheckConfig(entry) ? entry : null;
                const hasThresholds = cfg?.thresholds && Object.keys(cfg.thresholds).length > 0;
                const hasSuppress = cfg?.suppress && cfg.suppress.length > 0;
                const hasExclude = cfg?.exclude && cfg.exclude.length > 0;

                return (
                  <div key={checkId} className={`px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{checkId}</span>
                      <div className="flex gap-1.5">
                        {disabled && <Badge label="disabled" color="red" />}
                        {hasThresholds && <Badge label="thresholds" color="blue" />}
                        {hasSuppress && (
                          <Badge label={`${cfg!.suppress!.length} suppressed`} color="yellow" />
                        )}
                        {hasExclude && <Badge label="exclude" color="purple" />}
                      </div>
                    </div>

                    {/* Expandable threshold details */}
                    {hasThresholds && (
                      <div className="mt-2 pl-2 border-l-2 border-blue-500/30">
                        {Object.entries(cfg!.thresholds!).map(([key, value]) => (
                          <div key={key} className="text-xs text-gray-400 font-mono">
                            <span className="text-gray-500">{key}:</span>{' '}
                            {formatThresholdValue(value)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suppress details */}
                    {hasSuppress && (
                      <div className="mt-2 pl-2 border-l-2 border-yellow-500/30 space-y-1">
                        {cfg!.suppress!.map((rule, i) => (
                          <div
                            key={`${rule.path ?? ''}-${rule.match ?? ''}-${i}`}
                            className="text-xs"
                          >
                            <div className="text-gray-400 font-mono">
                              {rule.path && <span>path: {rule.path}</span>}
                              {rule.path && rule.match && <span> · </span>}
                              {rule.match && <span>match: {rule.match}</span>}
                            </div>
                            <div className="text-gray-500 italic">{rule.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Exclude details */}
                    {hasExclude && (
                      <div className="mt-2 pl-2 border-l-2 border-purple-500/30">
                        {cfg!.exclude!.map((pattern) => (
                          <div key={pattern} className="text-xs text-gray-400 font-mono">
                            {pattern}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Weights Section */}
      {config?.weights && Object.keys(config.weights).length > 0 && (
        <section>
          <SectionHeader
            label="Scoring Weights"
            collapsed={weightsCollapsed}
            onToggle={() => setWeightsCollapsed((v) => !v)}
          />
          {!weightsCollapsed && (
            <div className="bg-card rounded-lg p-4">
              <div className="space-y-2">
                {Object.entries(config.weights).map(([category, value]) => {
                  const defaultValue = DEFAULT_WEIGHTS[category] ?? 0;
                  const increased = value > defaultValue;
                  const decreased = value < defaultValue;
                  return (
                    <div key={category} className="flex items-center justify-between">
                      <span className="font-mono text-sm text-gray-300">{category}</span>
                      <div className="flex items-center gap-2 text-sm font-mono">
                        <span className="text-gray-500">{defaultValue}</span>
                        <span className="text-gray-600">&rarr;</span>
                        <span
                          className={
                            increased
                              ? 'text-green-400'
                              : decreased
                                ? 'text-red-400'
                                : 'text-gray-300'
                          }
                        >
                          {value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Global Excludes Section */}
      {config?.exclude && config.exclude.length > 0 && (
        <section>
          <SectionHeader
            label="Global Excludes"
            collapsed={excludesCollapsed}
            onToggle={() => setExcludesCollapsed((v) => !v)}
          />
          {!excludesCollapsed && (
            <div className="bg-card rounded-lg p-4">
              <div className="space-y-1">
                {config.exclude.map((pattern) => (
                  <div key={pattern} className="text-sm font-mono text-gray-400">
                    {pattern}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
