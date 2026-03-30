import { execFile } from 'child_process';
import { promisify } from 'util';

import { useState, useEffect, useRef } from 'react';

const exec = promisify(execFile);

export interface GitStatus {
  branch: string;
  modified: number;
  staged: number;
  untracked: number;
  ahead: number;
  behind: number;
  stashes: number;
  lastCommit: string;
  lastCommitTime: string;
}

async function git(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await exec('git', args, { cwd, timeout: 5000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function fetchGitStatus(projectPath: string): Promise<GitStatus> {
  const [branch, porcelain, revList, stashList, logLine] = await Promise.all([
    git(['branch', '--show-current'], projectPath),
    git(['status', '--porcelain'], projectPath),
    git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], projectPath),
    git(['stash', 'list'], projectPath),
    git(['log', '-1', '--format=%s|%cr'], projectPath),
  ]);

  const lines = porcelain ? porcelain.split('\n') : [];
  const staged = lines.filter((l) => /^[MADRC]/.test(l)).length;
  const modified = lines.filter((l) => /^.[MD]/.test(l)).length;
  const untracked = lines.filter((l) => l.startsWith('??')).length;

  let ahead = 0;
  let behind = 0;
  if (revList) {
    const parts = revList.split(/\s+/);
    ahead = parseInt(parts[0], 10) || 0;
    behind = parseInt(parts[1], 10) || 0;
  }

  const stashes = stashList ? stashList.split('\n').filter(Boolean).length : 0;
  const [lastCommit, lastCommitTime] = logLine.split('|');

  return {
    branch: branch || 'unknown',
    modified,
    staged,
    untracked,
    ahead,
    behind,
    stashes,
    lastCommit: lastCommit || '',
    lastCommitTime: lastCommitTime || '',
  };
}

export function useGitStatus(projectPath: string, pollInterval = 10000) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    fetchGitStatus(projectPath).then(setStatus);

    intervalRef.current = setInterval(() => {
      fetchGitStatus(projectPath).then(setStatus);
    }, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [projectPath, pollInterval]);

  return status;
}
