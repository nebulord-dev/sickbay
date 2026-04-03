import { basename, extname } from 'path';

export type FileType =
  | 'react-component'
  | 'custom-hook'
  | 'node-service'
  | 'route-file'
  | 'ts-utility'
  | 'config'
  | 'test'
  | 'general';

export const FILE_TYPE_THRESHOLDS: Record<FileType, { warn: number; critical: number }> = {
  'react-component': { warn: 300, critical: 500 },
  'custom-hook': { warn: 150, critical: 250 },
  'node-service': { warn: 500, critical: 800 },
  'route-file': { warn: 250, critical: 400 },
  'ts-utility': { warn: 600, critical: 1000 },
  config: { warn: Infinity, critical: Infinity },
  test: { warn: Infinity, critical: Infinity },
  general: { warn: 400, critical: 600 },
};

const TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/;
const CONFIG_PATTERN = /\.(config|rc)\.(ts|js|mjs|cjs|json)$/;
const CONFIG_NAMES = new Set([
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.prettierrc.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  'postcss.config.ts',
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'tsconfig.json',
]);
const HOOK_PATTERN = /^use[A-Z]/;
const ROUTE_NAMES = new Set([
  'page.tsx',
  'page.jsx',
  'layout.tsx',
  'layout.jsx',
  'loading.tsx',
  'error.tsx',
  'not-found.tsx',
]);
const ROUTE_PATH_PATTERN = /[/\\](routes?|router)[/\\]/i;
const SERVICE_PATTERN = /\.(service|controller|middleware|handler)\.(ts|js)$/;
const COMPONENT_EXTENSIONS = new Set(['.tsx', '.jsx']);

export function classifyFile(filePath: string): FileType {
  const name = basename(filePath);
  const ext = extname(name);

  // 1. Test files — must check before hooks (useAuth.test.tsx → test, not hook)
  if (TEST_PATTERN.test(name)) return 'test';

  // 2. Config files
  if (CONFIG_PATTERN.test(name) || CONFIG_NAMES.has(name)) return 'config';

  // 3. Custom hooks — use*.ts/tsx with uppercase after "use"
  if (HOOK_PATTERN.test(name) && (ext === '.ts' || ext === '.tsx')) return 'custom-hook';

  // 4. Route files — Next.js conventions + path-based detection
  if (ROUTE_NAMES.has(name)) return 'route-file';
  if (ROUTE_PATH_PATTERN.test(filePath)) return 'route-file';

  // 5. Node service files
  if (SERVICE_PATTERN.test(name)) return 'node-service';

  // 6. React components — .tsx/.jsx files (after ruling out hooks, routes, tests, config)
  if (COMPONENT_EXTENSIONS.has(ext)) return 'react-component';

  // 7. TypeScript/JavaScript utility files
  if (['.ts', '.js', '.mts', '.cts', '.mjs', '.cjs'].includes(ext)) return 'ts-utility';

  // 8. Anything else
  return 'general';
}

export function getThresholds(filePath: string): {
  warn: number;
  critical: number;
  fileType: FileType;
} {
  const fileType = classifyFile(filePath);
  return { ...FILE_TYPE_THRESHOLDS[fileType], fileType };
}

const FILE_TYPE_LABELS: Record<FileType, string> = {
  'react-component': 'React component',
  'custom-hook': 'custom hook',
  'node-service': 'service',
  'route-file': 'route file',
  'ts-utility': 'utility',
  config: 'config',
  test: 'test',
  general: 'file',
};

export function getFileTypeLabel(fileType: FileType): string {
  return FILE_TYPE_LABELS[fileType];
}
