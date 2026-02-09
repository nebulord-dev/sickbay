import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import type { VitalsReport } from '@vitals/core';
import type { AIService } from '../services/ai.js';

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

export async function serveWeb(
  report: VitalsReport,
  preferredPort = 3030,
  aiService?: AIService
): Promise<string> {
  const distDir = findWebDist();
  if (!distDir) {
    throw new Error(
      'Web dashboard not built. Run: pnpm --filter @vitals/web build'
    );
  }

  const reportJson = JSON.stringify(report);
  const port = await getFreePort(preferredPort);

  // Generate AI summary on startup if service is available
  let aiSummary: string | null = null;
  if (aiService) {
    try {
      aiSummary = await aiService.generateSummary(report);
    } catch (err) {
      console.warn('AI summary generation failed:', err);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';

    // Serve the report JSON directly from memory
    if (url === '/vitals-report.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(reportJson);
      return;
    }

    // AI summary endpoint
    if (url === '/ai/summary' && aiSummary) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ summary: aiSummary }));
      return;
    }

    // AI chat endpoint
    if (url === '/ai/chat' && req.method === 'POST' && aiService) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { message, history } = JSON.parse(body);
          const response = await aiService.chat(message, report, history ?? []);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ response }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
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
