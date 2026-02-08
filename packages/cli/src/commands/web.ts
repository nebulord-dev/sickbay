import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import type { VitalsReport } from '@vitals/core';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function findWebDist(): string | null {
  // Resolve relative to this file's location: packages/cli/src/commands/web.ts → packages/web/dist
  const thisFile = fileURLToPath(import.meta.url);
  const candidates = [
    join(thisFile, '..', '..', '..', '..', '..', 'web', 'dist'),  // from dist/commands/
    join(thisFile, '..', '..', '..', 'web', 'dist'),              // from src/commands/
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'index.html'))) return p;
  }
  return null;
}

async function getFreePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(preferred, () => {
      const addr = server.address() as { port: number };
      server.close(() => resolve(addr.port));
    });
    server.on('error', () => resolve(getFreePort(preferred + 1)));
  });
}

export async function serveWeb(report: VitalsReport, preferredPort = 3030): Promise<string> {
  const distDir = findWebDist();
  if (!distDir) {
    throw new Error(
      'Web dashboard not built. Run: pnpm --filter @vitals/web build'
    );
  }

  const reportJson = JSON.stringify(report);
  const port = await getFreePort(preferredPort);

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // Serve the report JSON directly from memory
    if (url === '/vitals-report.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(reportJson);
      return;
    }

    // Serve static files from dist
    const filePath = join(distDir, url === '/' ? 'index.html' : url);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(readFileSync(filePath));
    } else {
      // SPA fallback — serve index.html for all unknown routes
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(distDir, 'index.html')));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(`http://localhost:${port}`);
    });
  });
}
