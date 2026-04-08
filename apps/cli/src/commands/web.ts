import { readFileSync, existsSync } from 'fs';
import http from 'http';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

import type { AIService } from '../services/ai.js';
import type { SickbayReport, MonorepoReport, SickbayConfig } from 'sickbay-core';

/**
 * This module implements a simple HTTP server to serve a web dashboard for visualizing Sickbay reports.
 * It dynamically serves the report data as JSON and provides endpoints for AI-generated summaries and chat interactions if an AI service is available.
 * The server also serves static files from the built dashboard located in the sickbay-web package. This allows users to interact with their health reports in a user-friendly web interface.
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
  // Resolve relative to this file's location
  const thisFile = fileURLToPath(import.meta.url);
  const candidates = [
    join(thisFile, '..', 'web'), // published: dist/web/ (embedded at build time)
    join(thisFile, '..', '..', '..', 'web', 'dist'), // monorepo dev: apps/web/dist/
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
  pkg: import('sickbay-core').PackageReport,
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
    throw new Error('Web dashboard assets not found. Try reinstalling: npx sickbay@latest --web');
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

    // Serve project config
    if (url === '/sickbay-config.json') {
      const basePath = 'isMonorepo' in report ? report.rootPath : report.projectPath;
      try {
        const { loadConfig } = await import('sickbay-core');
        const config = await loadConfig(basePath);
        if (config) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(config));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end('{}');
        }
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
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
      // Cap request body to prevent unbounded memory growth from a malicious
      // or misbehaving client on the loopback interface.
      const MAX_BODY = 1024 * 1024; // 1 MB
      let body = '';
      let aborted = false;
      req.on('data', (chunk) => {
        if (aborted) return;
        body += chunk;
        if (Buffer.byteLength(body) > MAX_BODY) {
          aborted = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });
      req.on('end', async () => {
        if (aborted) return;
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
    // SECURITY: bind explicitly to loopback so the dashboard (which contains
    // file paths, dep lists, and secret-scan results) is not exposed to other
    // hosts on the LAN, container networks, or VPN peers.
    server.listen(port, '127.0.0.1', () => {
      resolve(`http://localhost:${port}`);
    });
  });
}
