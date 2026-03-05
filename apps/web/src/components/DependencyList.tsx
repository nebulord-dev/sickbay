import type { VitalsReport } from '@vitals/core';

interface DependencyStatus {
  name: string;
  version: string;
  dev: boolean;
  unused: boolean;
  missing: boolean;
  outdatedTo?: string;
  majorBump: boolean;
}

function buildDependencyStatuses(report: VitalsReport): DependencyStatus[] {
  const { dependencies, devDependencies } = report.projectInfo;

  // Collect flags from check issues
  const unused = new Set<string>();
  const missing = new Set<string>();
  const outdated = new Map<string, { to: string; major: boolean }>();

  for (const check of report.checks) {
    for (const issue of check.issues) {
      const msg = issue.message;

      // knip / depcheck: "Unused dependency: react"
      const unusedMatch = msg.match(/^Unused (?:dev)?dependency:\s+(.+)/i);
      if (unusedMatch) unused.add(unusedMatch[1].trim());

      // depcheck: "Missing dependency: react"
      const missingMatch = msg.match(/^Missing dependency:\s+(.+)/i);
      if (missingMatch) missing.add(missingMatch[1].trim());

      // outdated: "react: 17.0.2 → 18.0.0"
      const ncuMatch = msg.match(/^([^:]+):\s*([^\s]+)\s*→\s*([^\s]+)/);
      if (ncuMatch) {
        const [, pkgName, , to] = ncuMatch;
        outdated.set(pkgName.trim(), { to: to.trim(), major: issue.severity === 'warning' });
      }
    }
  }

  const statuses: DependencyStatus[] = [];
  for (const [name, version] of Object.entries(dependencies)) {
    const od = outdated.get(name);
    statuses.push({
      name, version, dev: false,
      unused: unused.has(name),
      missing: missing.has(name),
      outdatedTo: od?.to,
      majorBump: od?.major ?? false,
    });
  }
  for (const [name, version] of Object.entries(devDependencies)) {
    const od = outdated.get(name);
    statuses.push({
      name, version, dev: true,
      unused: unused.has(name),
      missing: missing.has(name),
      outdatedTo: od?.to,
      majorBump: od?.major ?? false,
    });
  }

  // Sort: issues first, then alphabetical
  return statuses.sort((a, b) => {
    const aScore = (a.missing ? 3 : 0) + (a.unused ? 2 : 0) + (a.outdatedTo ? 1 : 0);
    const bScore = (b.missing ? 3 : 0) + (b.unused ? 2 : 0) + (b.outdatedTo ? 1 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return a.name.localeCompare(b.name);
  });
}

interface Props {
  report: VitalsReport;
}

export function DependencyList({ report }: Props) {
  const deps = buildDependencyStatuses(report);
  const issueCount = deps.filter(d => d.unused || d.missing || d.outdatedTo).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Dependencies
          <span className="ml-2 text-sm font-normal text-gray-400">
            {deps.length} total
          </span>
        </h2>
        {issueCount > 0 && (
          <div className="relative group inline-flex">
            <span className="text-xs text-yellow-400 flex items-center gap-1 cursor-help">
              {issueCount} with issues
              <span className="text-gray-500">ℹ</span>
            </span>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 z-10">
              <div className="bg-gray-900 text-gray-200 text-xs rounded px-3 py-2 shadow-lg border border-gray-700">
                Dependencies that are <strong className="text-yellow-400">unused</strong>, <strong className="text-red-400">missing</strong>, or <strong className="text-blue-400">outdated</strong>
                <div className="absolute top-full right-4 -mt-1 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Package</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Version</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {deps.map((dep) => (
              <tr
                key={`${dep.dev ? 'dev' : 'prod'}-${dep.name}`}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <a
                    href={`https://www.npmjs.com/package/${dep.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-green-400 hover:text-green-300 hover:underline"
                  >
                    {dep.name}
                  </a>
                </td>
                <td className="px-4 py-2.5 font-mono text-gray-300">
                  {dep.version}
                  {dep.outdatedTo && (
                    <span className="ml-2 text-gray-500">→ {dep.outdatedTo}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${dep.dev ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-gray-500'}`}>
                    {dep.dev ? 'dev' : 'prod'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadges dep={dep} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadges({ dep }: { dep: DependencyStatus }) {
  const badges = [];

  if (dep.missing) {
    badges.push(
      <span key="missing" className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800">
        missing
      </span>
    );
  }
  if (dep.unused) {
    badges.push(
      <span key="unused" className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-500 border border-yellow-800">
        unused
      </span>
    );
  }
  if (dep.outdatedTo) {
    badges.push(
      <span key="outdated" className={`text-xs px-2 py-0.5 rounded-full border ${dep.majorBump ? 'bg-orange-900/40 text-orange-400 border-orange-800' : 'bg-blue-900/30 text-blue-400 border-blue-800'}`}>
        {dep.majorBump ? 'major update' : 'outdated'}
      </span>
    );
  }
  if (badges.length === 0) {
    badges.push(
      <span key="ok" className="text-xs text-gray-600">✓</span>
    );
  }

  return <div className="flex gap-1.5 flex-wrap">{badges}</div>;
}
