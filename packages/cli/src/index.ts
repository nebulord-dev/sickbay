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
  config({ path: globalConfigPath, debug: false, quiet: true });
}

// Load .env from current directory (overrides global)
config({ debug: false, quiet: true });

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

      // Auto-save to trend history
      try {
        const { saveEntry } = await import("./lib/history.js");
        saveEntry(report);
      } catch {
        // Non-critical
      }

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

// --- vitals fix ---
program
  .command("fix")
  .description("Interactively fix issues found by vitals scan")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("-c, --checks <checks>", "comma-separated list of checks to run")
  .option("--all", "apply all available fixes without prompting")
  .option("--dry-run", "show what would be fixed without executing")
  .option("--verbose", "show verbose output")
  .action(async (options) => {
    const { FixApp } = await import("./components/FixApp.js");
    const checks = options.checks
      ? options.checks.split(",").map((s: string) => s.trim())
      : undefined;
    render(
      React.createElement(FixApp, {
        projectPath: options.path,
        checks,
        applyAll: options.all ?? false,
        dryRun: options.dryRun ?? false,
        verbose: options.verbose ?? false,
      }),
    );
  });

// --- vitals trend ---
program
  .command("trend")
  .description("Show score history and trends over time")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("-n, --last <count>", "number of recent scans to show", "20")
  .option("--json", "output trend data as JSON")
  .action(async (options) => {
    const { TrendApp } = await import("./components/TrendApp.js");
    render(
      React.createElement(TrendApp, {
        projectPath: options.path,
        last: parseInt(options.last, 10),
        jsonOutput: options.json ?? false,
      }),
    );
  });

// --- vitals stats ---
program
  .command("stats")
  .description("Show a quick codebase overview and project summary")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("--json", "output stats as JSON")
  .action(async (options) => {
    const { StatsApp } = await import("./components/StatsApp.js");
    render(
      React.createElement(StatsApp, {
        projectPath: options.path,
        jsonOutput: options.json ?? false,
      }),
    );
  });

// --- vitals doctor ---
program
  .command("doctor")
  .description("Diagnose project setup and configuration issues")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("--fix", "auto-scaffold missing configuration files")
  .option("--json", "output diagnostic results as JSON")
  .action(async (options) => {
    const { DoctorApp } = await import("./components/DoctorApp.js");
    render(
      React.createElement(DoctorApp, {
        projectPath: options.path,
        autoFix: options.fix ?? false,
        jsonOutput: options.json ?? false,
      }),
    );
  });

program.parse();
