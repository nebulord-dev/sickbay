#!/usr/bin/env node
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';

// Load .env from global config first (~/.vitals/.env)
const globalConfigPath = join(homedir(), '.vitals', '.env');
if (existsSync(globalConfigPath)) {
  config({ path: globalConfigPath });
}

// Load .env from current directory (overrides global)
config();

const program = new Command();

program
  .name('vitals')
  .description('React project health check CLI')
  .version('0.0.1')
  .option('-p, --path <path>', 'project path to analyze', process.cwd())
  .option('-c, --checks <checks>', 'comma-separated list of checks to run')
  .option('--json', 'output raw JSON report')
  .option('--web', 'open web dashboard after scan')
  .option('--no-ai', 'disable AI features')
  .option('--verbose', 'show verbose output')
  .action(async (options) => {
    const checks = options.checks ? options.checks.split(',').map((s: string) => s.trim()) : undefined;

    if (options.json) {
      const { runVitals } = await import('@vitals/core');
      const report = await runVitals({ projectPath: options.path, checks, verbose: options.verbose });
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      process.exit(0);
    }

    render(
      React.createElement(App, {
        projectPath: options.path,
        checks,
        openWeb: options.web,
        enableAI: options.ai !== false,
        verbose: options.verbose,
      })
    );
  });

program.parse();
