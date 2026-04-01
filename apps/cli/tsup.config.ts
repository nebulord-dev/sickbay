import { cpSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  noExternal: ['@nebulord/sickbay-core'],
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
