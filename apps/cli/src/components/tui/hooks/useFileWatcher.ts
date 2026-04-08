import { useState, useEffect, useRef } from 'react';

import type { FSWatcher } from 'chokidar';

interface UseFileWatcherOptions {
  projectPath: string;
  enabled: boolean;
  debounceMs?: number;
  onFilesChanged?: (files: string[]) => void;
}

export function useFileWatcher({
  projectPath,
  enabled,
  debounceMs = 2000,
  onFilesChanged,
}: UseFileWatcherOptions) {
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<string[]>([]);
  const watcherRef = useRef<FSWatcher | null>(null);
  // Keep a ref so the debounce callback always calls the latest version,
  // even if the parent re-renders and passes a new function reference.
  const onFilesChangedRef = useRef(onFilesChanged);
  onFilesChangedRef.current = onFilesChanged;

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    (async () => {
      try {
        const { watch } = await import('chokidar');
        if (!mounted) return;

        const watcher = watch(['**/*.{ts,tsx,js,jsx,json}'], {
          cwd: projectPath,
          ignored: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**',
            '**/build/**',
            '**/.next/**',
            '**/.turbo/**',
            '**/coverage/**',
          ],
          ignoreInitial: true,
          persistent: true,
        });

        watcherRef.current = watcher;

        watcher.on('change', (path: string) => {
          pendingRef.current.push(path);
          setChangedFiles((prev) => [...prev, path]);

          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            const files = [...pendingRef.current];
            pendingRef.current = [];
            onFilesChangedRef.current?.(files);
          }, debounceMs);
        });
      } catch {
        // chokidar not available — silently skip
      }
    })();

    return () => {
      mounted = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (watcherRef.current) watcherRef.current.close();
    };
  }, [projectPath, enabled, debounceMs]);

  return changedFiles;
}
