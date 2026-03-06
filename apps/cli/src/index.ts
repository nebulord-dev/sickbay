#!/usr/bin/env node
import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { App } from "./components/App.js";

/**
 * Entry point for the Vitals CLI application.
 * This script sets up the command-line interface using Commander, loads environment variables, and renders the appropriate Ink components based on user commands.
 * It supports multiple commands including the default scan, trend analysis, stats overview, and a doctor command for diagnosing project issues.
 * Each command can output results in JSON format or render an interactive UI in the terminal.
 */

// Load .env from global config first (~/.vitals/.env)
const globalConfigPath = join(homedir(), ".vitals", ".env");
if (existsSync(globalConfigPath)) {
  config({ path: globalConfigPath, debug: false, quiet: true });
}

// Load .env from current directory (overrides global)
config({ debug: false, quiet: true });

const program = new Command();

program
  .name("vitals")
  .description("React project health check CLI")
  .version("0.0.1")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("-c, --checks <checks>", "comma-separated list of checks to run")
  .option("--json", "output raw JSON report")
  .option("--web", "open web dashboard after scan")
  .option("--no-ai", "disable AI features")
  .option("--verbose", "show verbose output")
  .action(async (options) => {
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

    const checks = options.checks
      ? options.checks.split(",").map((s: string) => s.trim())
      : undefined;

    if (options.json) {
      const { runVitals } = await import("@vitals/core");
      const report = await runVitals({
        projectPath: options.path,
        checks,
        verbose: options.verbose,
      });

      // Auto-save to trend history
      try {
        const { saveEntry } = await import("./lib/history.js");
        saveEntry(report);
      } catch {
        // Non-critical
      }

      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      process.exit(0);
    }

    render(
      React.createElement(App, {
        projectPath: options.path,
        checks,
        openWeb: options.web,
        enableAI: options.ai !== false,
        verbose: options.verbose,
      }),
    );
  });

// --- vitals init ---
program
  .command("init")
  .description("Initialize .vitals/ folder and run an initial baseline scan")
  .option("-p, --path <path>", "project path to initialize", process.cwd())
  .action(async (options) => {
    const { initVitals } = await import("./commands/init.js");
    await initVitals(options.path);
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
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

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
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

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
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

    const { StatsApp } = await import("./components/StatsApp.js");
    render(
      React.createElement(StatsApp, {
        projectPath: options.path,
        jsonOutput: options.json ?? false,
      }),
    );
  });

// --- vitals tui ---
program
  .command("tui")
  .description("Launch the persistent developer dashboard")
  .option("-p, --path <path>", "project path to monitor", process.cwd())
  .option("--no-watch", "disable file-watching auto-refresh")
  .option("--refresh <seconds>", "auto-refresh interval in seconds", "300")
  .option("-c, --checks <checks>", "comma-separated list of checks to run")
  .action(async (options) => {
    const { TuiApp } = await import("./components/tui/TuiApp.js");
    const checks = options.checks
      ? options.checks.split(",").map((s: string) => s.trim())
      : undefined;
    render(
      React.createElement(TuiApp, {
        projectPath: options.path,
        checks,
        watchEnabled: options.watch !== false,
        refreshInterval: parseInt(options.refresh, 10),
      }),
      { exitOnCtrlC: true },
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
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

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
