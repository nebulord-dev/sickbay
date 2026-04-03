import { describe, it, expect } from 'vitest';

import {
  classifyFile,
  getThresholds,
  getFileTypeLabel,
  FILE_TYPE_THRESHOLDS,
} from './file-types.js';

describe('classifyFile', () => {
  describe('test files (highest priority)', () => {
    it('classifies .test.ts files', () => {
      expect(classifyFile('src/utils/format.test.ts')).toBe('test');
    });

    it('classifies .spec.tsx files', () => {
      expect(classifyFile('src/components/App.spec.tsx')).toBe('test');
    });

    it('classifies hook test files as test, not hook', () => {
      expect(classifyFile('src/hooks/useAuth.test.ts')).toBe('test');
    });

    it('classifies component test files as test, not component', () => {
      expect(classifyFile('src/components/Button.test.tsx')).toBe('test');
    });

    it('classifies .test.js files', () => {
      expect(classifyFile('src/index.test.js')).toBe('test');
    });
  });

  describe('config files', () => {
    it('classifies .config.ts files', () => {
      expect(classifyFile('vite.config.ts')).toBe('config');
    });

    it('classifies .config.js files', () => {
      expect(classifyFile('vitest.config.js')).toBe('config');
    });

    it('classifies .rc.js files', () => {
      expect(classifyFile('.eslintrc.js')).toBe('config');
    });

    it('classifies known config filenames', () => {
      expect(classifyFile('tailwind.config.ts')).toBe('config');
      expect(classifyFile('next.config.mjs')).toBe('config');
      expect(classifyFile('tsconfig.json')).toBe('config');
    });

    it('classifies postcss config', () => {
      expect(classifyFile('postcss.config.js')).toBe('config');
    });
  });

  describe('custom hooks', () => {
    it('classifies useAuth.ts as hook', () => {
      expect(classifyFile('src/hooks/useAuth.ts')).toBe('custom-hook');
    });

    it('classifies useData.tsx as hook', () => {
      expect(classifyFile('src/hooks/useData.tsx')).toBe('custom-hook');
    });

    it('does not classify "username.ts" as hook', () => {
      expect(classifyFile('src/utils/username.ts')).not.toBe('custom-hook');
    });

    it('does not classify "useLower.js" as hook (must be .ts/.tsx)', () => {
      expect(classifyFile('src/hooks/useLower.js')).not.toBe('custom-hook');
    });

    it('classifies useFileWatcher.ts in nested path', () => {
      expect(classifyFile('src/components/tui/hooks/useFileWatcher.ts')).toBe('custom-hook');
    });
  });

  describe('route files', () => {
    it('classifies page.tsx as route file (Next.js)', () => {
      expect(classifyFile('app/dashboard/page.tsx')).toBe('route-file');
    });

    it('classifies layout.tsx as route file (Next.js)', () => {
      expect(classifyFile('app/layout.tsx')).toBe('route-file');
    });

    it('classifies loading.tsx as route file', () => {
      expect(classifyFile('app/loading.tsx')).toBe('route-file');
    });

    it('classifies error.tsx as route file', () => {
      expect(classifyFile('app/error.tsx')).toBe('route-file');
    });

    it('classifies files in routes/ directory', () => {
      expect(classifyFile('src/routes/users.ts')).toBe('route-file');
    });

    it('classifies files in route/ directory', () => {
      expect(classifyFile('src/route/index.ts')).toBe('route-file');
    });

    it('classifies files in router/ directory', () => {
      expect(classifyFile('src/router/config.ts')).toBe('route-file');
    });
  });

  describe('node service files', () => {
    it('classifies .service.ts files', () => {
      expect(classifyFile('src/services/auth.service.ts')).toBe('node-service');
    });

    it('classifies .controller.ts files', () => {
      expect(classifyFile('src/controllers/users.controller.ts')).toBe('node-service');
    });

    it('classifies .middleware.ts files', () => {
      expect(classifyFile('src/auth.middleware.ts')).toBe('node-service');
    });

    it('classifies .handler.ts files', () => {
      expect(classifyFile('src/events/webhook.handler.ts')).toBe('node-service');
    });

    it('classifies .service.js files', () => {
      expect(classifyFile('src/services/data.service.js')).toBe('node-service');
    });
  });

  describe('react components', () => {
    it('classifies .tsx files as components', () => {
      expect(classifyFile('src/components/Button.tsx')).toBe('react-component');
    });

    it('classifies .jsx files as components', () => {
      expect(classifyFile('src/components/Card.jsx')).toBe('react-component');
    });

    it('classifies App.tsx as component', () => {
      expect(classifyFile('src/App.tsx')).toBe('react-component');
    });
  });

  describe('ts-utility (fallback for .ts/.js)', () => {
    it('classifies plain .ts files', () => {
      expect(classifyFile('src/utils/helpers.ts')).toBe('ts-utility');
    });

    it('classifies plain .js files', () => {
      expect(classifyFile('src/utils/format.js')).toBe('ts-utility');
    });

    it('classifies .mts files', () => {
      expect(classifyFile('src/lib/parser.mts')).toBe('ts-utility');
    });

    it('classifies index.ts as utility', () => {
      expect(classifyFile('src/index.ts')).toBe('ts-utility');
    });
  });

  describe('general (non-JS/TS)', () => {
    it('classifies .json files as general', () => {
      expect(classifyFile('data/records.json')).toBe('general');
    });

    it('classifies .css files as general', () => {
      expect(classifyFile('src/styles/app.css')).toBe('general');
    });
  });
});

describe('getThresholds', () => {
  it('returns component thresholds for .tsx files', () => {
    const result = getThresholds('src/components/Button.tsx');
    expect(result).toEqual({
      warn: 300,
      critical: 500,
      fileType: 'react-component',
    });
  });

  it('returns hook thresholds for use*.ts files', () => {
    const result = getThresholds('src/hooks/useAuth.ts');
    expect(result).toEqual({
      warn: 150,
      critical: 250,
      fileType: 'custom-hook',
    });
  });

  it('returns Infinity for test files (exempt)', () => {
    const result = getThresholds('src/utils/format.test.ts');
    expect(result.warn).toBe(Infinity);
    expect(result.critical).toBe(Infinity);
    expect(result.fileType).toBe('test');
  });

  it('returns Infinity for config files (exempt)', () => {
    const result = getThresholds('vite.config.ts');
    expect(result.warn).toBe(Infinity);
    expect(result.critical).toBe(Infinity);
    expect(result.fileType).toBe('config');
  });

  it('returns utility thresholds for plain .ts files', () => {
    const result = getThresholds('src/utils/helpers.ts');
    expect(result).toEqual({
      warn: 600,
      critical: 1000,
      fileType: 'ts-utility',
    });
  });

  it('returns service thresholds for .service.ts files', () => {
    const result = getThresholds('src/services/auth.service.ts');
    expect(result).toEqual({
      warn: 500,
      critical: 800,
      fileType: 'node-service',
    });
  });

  it('returns route thresholds for page.tsx', () => {
    const result = getThresholds('app/dashboard/page.tsx');
    expect(result).toEqual({
      warn: 250,
      critical: 400,
      fileType: 'route-file',
    });
  });
});

describe('getFileTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(getFileTypeLabel('react-component')).toBe('React component');
    expect(getFileTypeLabel('custom-hook')).toBe('custom hook');
    expect(getFileTypeLabel('node-service')).toBe('service');
    expect(getFileTypeLabel('route-file')).toBe('route file');
    expect(getFileTypeLabel('ts-utility')).toBe('utility');
    expect(getFileTypeLabel('general')).toBe('file');
  });
});

describe('FILE_TYPE_THRESHOLDS', () => {
  it('has entries for all file types', () => {
    const types = [
      'react-component',
      'custom-hook',
      'node-service',
      'route-file',
      'ts-utility',
      'config',
      'test',
      'general',
    ] as const;

    for (const type of types) {
      expect(FILE_TYPE_THRESHOLDS[type]).toBeDefined();
      expect(FILE_TYPE_THRESHOLDS[type].warn).toBeTypeOf('number');
      expect(FILE_TYPE_THRESHOLDS[type].critical).toBeTypeOf('number');
    }
  });

  it('has warn < critical for non-exempt types', () => {
    const nonExempt = [
      'react-component',
      'custom-hook',
      'node-service',
      'route-file',
      'ts-utility',
      'general',
    ] as const;

    for (const type of nonExempt) {
      expect(FILE_TYPE_THRESHOLDS[type].warn).toBeLessThan(FILE_TYPE_THRESHOLDS[type].critical);
    }
  });
});
