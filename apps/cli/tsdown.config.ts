import { cpSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { defineConfig } from 'tsdown';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts', 'src/config.ts'],
  dts: true,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  deps: {
    alwaysBundle: ['sickbay-core'],
    neverBundle: ['jiti'],
  },
  define: {
    __VERSION__: JSON.stringify(version),
  },
  async onSuccess() {
    const webDist = join(process.cwd(), '..', 'web', 'dist');
    const targetDir = join(process.cwd(), 'dist', 'web');
    if (existsSync(webDist)) {
      cpSync(webDist, targetDir, { recursive: true });
    }
  },
});
