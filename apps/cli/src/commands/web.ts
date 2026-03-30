import { readFileSync, existsSync } from 'fs';
import http from 'http';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

import type { AIService } from '../services/ai.js';
import type { SickbayReport, MonorepoReport } from '@nebulord/sickbay-core';

/**
 * This module implements a simple HTTP server to serve a web dashboard for visualizing Sickbay reports.
 * It dynamically serves the report data as JSON and provides endpoints for AI-generated summaries and chat interactions if an AI service is available.
 * The server also serves static files from the built dashboard located in the @nebulord/sickbay-web package. This allows users to interact with their health reports in a user-friendly web interface.
 */

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
  // Resolve relative to this file's location: apps/cli/dist/index.js → apps/web/dist
  const thisFile = fileURLToPath(import.meta.url);
  const candidates = [
    join(thisFile, '..', '..', '..', '..', '..', 'web', 'dist'), // from dist/commands/
    join(thisFile, '..', '..', '..', 'web', 'dist'), // from src/commands/
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

function packageReportToSickbayReport(
  pkg: import('@nebulord/sickbay-core').PackageReport,
  parent: MonorepoReport,
): SickbayReport {
  return {
    timestamp: parent.timestamp,
    projectPath: pkg.path,
    projectInfo: {
      name: pkg.name,
      version: 'unknown',
      hasTypeScript: false,
      hasESLint: false,
      hasPrettier: false,
      framework: pkg.framework,
      packageManager: parent.packageManager,
      totalDependencies:
        Object.keys(pkg.dependencies).length + Object.keys(pkg.devDependencies).length,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
    },
    checks: pkg.checks,
    overallScore: pkg.score,
    summary: pkg.summary,
  };
}

export async function serveWeb(
  report: SickbayReport | MonorepoReport,
  preferredPort = 3030,
  aiService?: AIService,
): Promise<string> {
  const distDir = findWebDist();
  if (!distDir) {
    throw new Error('Web dashboard not built. Run: pnpm --filter @nebulord/sickbay-web build');
  }

  const reportJson = JSON.stringify(report);
  const port = await getFreePort(preferredPort);

  // Generate AI summary on startup if service is available (single-project only)
  let aiSummary: string | null = null;
  if (aiService && !('isMonorepo' in report)) {
    try {
      aiSummary = await aiService.generateSummary(report);
    } catch (err) {
      console.warn('AI summary generation failed:', err);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';

    // Serve the report JSON directly from memory
    if (url === '/sickbay-report.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(reportJson);
      return;
    }

    // Serve project-local history
    if (url === '/sickbay-history.json') {
      const basePath = 'isMonorepo' in report ? report.rootPath : report.projectPath;
      const historyPath = join(basePath, '.sickbay', 'history.json');
      if (existsSync(historyPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(readFileSync(historyPath, 'utf-8'));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{}');
      }
      return;
    }

    // Serve dependency tree
    if (url === '/sickbay-dep-tree.json') {
      const basePath = 'isMonorepo' in report ? report.rootPath : report.projectPath;
      const treePath = join(basePath, '.sickbay', 'dep-tree.json');
      if (existsSync(treePath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(readFileSync(treePath, 'utf-8'));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{}');
      }
      return;
    }

    // AI summary endpoint
    const parsedUrl = new URL(url, 'http://localhost');
    const packageName = parsedUrl.searchParams.get('package');

    if (parsedUrl.pathname === '/ai/summary') {
      if (req.method === 'HEAD') {
        // Availability check
        if (aiService) {
          res.writeHead(200);
        } else {
          res.writeHead(404);
        }
        res.end();
        return;
      }
      if (packageName && aiService && 'isMonorepo' in report) {
        // Per-package summary: generate on demand
        const pkg = report.packages.find((p) => p.name === packageName);
        if (!pkg) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Package not found' }));
          return;
        }
        try {
          const pkgReport = packageReportToSickbayReport(pkg, report);
          const summary = await aiService.generateSummary(pkgReport);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ summary }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }
      if (aiSummary) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ summary: aiSummary }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }

    // AI chat endpoint
    if (parsedUrl.pathname === '/ai/chat' && req.method === 'POST' && aiService) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { message, history } = JSON.parse(body);
          let chatReport: SickbayReport;
          if (packageName && 'isMonorepo' in report) {
            const pkg = report.packages.find((p) => p.name === packageName);
            if (!pkg) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Package not found' }));
              return;
            }
            chatReport = packageReportToSickbayReport(pkg, report);
          } else if (!('isMonorepo' in report)) {
            chatReport = report;
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Package name required for monorepo' }));
            return;
          }
          const response = await aiService.chat(message, chatReport, history ?? []);
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
