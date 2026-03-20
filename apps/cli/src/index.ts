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
  .enablePositionalOptions()
  .passThroughOptions()
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("-c, --checks <checks>", "comma-separated list of checks to run")
  .option("--package <name>", "scope to a single named package (monorepo only)")
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

    const { detectMonorepo, runVitals, runVitalsMonorepo } = await import("@vitals/core");
    const monorepoInfo = await detectMonorepo(options.path);

    // --package flag: scope to a single named package within a monorepo
    if (options.package && monorepoInfo.isMonorepo) {
      const { readFileSync } = await import("fs");
      const targetPath = monorepoInfo.packagePaths.find((p) => {
        try {
          const pkg = JSON.parse(readFileSync(join(p, "package.json"), "utf-8"));
          return pkg.name === options.package || pkg.name?.endsWith(`/${options.package}`);
        } catch {
          return false;
        }
      });

      if (!targetPath) {
        process.stderr.write(`Package "${options.package}" not found in monorepo\n`);
        process.exit(1);
      }

      if (options.json) {
        const report = await runVitals({ projectPath: targetPath, checks, verbose: options.verbose });
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
        process.exit(0);
      }

      render(
        React.createElement(App, {
          projectPath: targetPath,
          checks,
          openWeb: options.web,
          enableAI: options.ai !== false,
          verbose: options.verbose,
        }),
      );
      return;
    }

    if (options.json) {
      if (monorepoInfo.isMonorepo) {
        const report = await runVitalsMonorepo({
          projectPath: options.path,
          checks,
          verbose: options.verbose,
        });
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
        process.exit(0);
      }

      const report = await runVitals({
        projectPath: options.path,
        checks,
        verbose: options.verbose,
      });

      // Auto-save to trend history and last-report snapshot
      try {
        const { saveEntry, saveLastReport } = await import("./lib/history.js");
        saveEntry(report);
        saveLastReport(report);
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
        isMonorepo: monorepoInfo.isMonorepo,
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
  .option("--package <name>", "scope to a single package (monorepo only)")
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

    const { resolveProject } = await import("./lib/resolve-package.js");
    const resolution = await resolveProject(options.path, options.package);

    const { FixApp } = await import("./components/FixApp.js");
    const checks = options.checks
      ? options.checks.split(",").map((s: string) => s.trim())
      : undefined;

    const projectPath = resolution.isMonorepo
      ? resolution.targetPath ?? options.path
      : resolution.targetPath;

    render(
      React.createElement(FixApp, {
        projectPath,
        checks,
        applyAll: options.all ?? false,
        dryRun: options.dryRun ?? false,
        verbose: options.verbose ?? false,
        isMonorepo: resolution.isMonorepo && !resolution.targetPath,
        packagePaths: resolution.isMonorepo ? resolution.packagePaths : undefined,
        packageNames: resolution.isMonorepo ? resolution.packageNames : undefined,
      }),
    );
  });

// --- vitals trend ---
program
  .command("trend")
  .description("Show score history and trends over time")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("-n, --last <count>", "number of recent scans to show", "20")
  .option("--package <name>", "scope to a single package (monorepo only)")
  .option("--json", "output trend data as JSON")
  .action(async (options) => {
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

    const { resolveProject } = await import("./lib/resolve-package.js");
    const resolution = await resolveProject(options.path, options.package);

    const projectPath = resolution.isMonorepo
      ? resolution.targetPath ?? options.path
      : resolution.targetPath;

    const { TrendApp } = await import("./components/TrendApp.js");
    render(
      React.createElement(TrendApp, {
        projectPath,
        last: parseInt(options.last, 10),
        jsonOutput: options.json ?? false,
        isMonorepo: resolution.isMonorepo && !resolution.targetPath,
        packagePaths: resolution.isMonorepo ? resolution.packagePaths : undefined,
        packageNames: resolution.isMonorepo ? resolution.packageNames : undefined,
      }),
    );
  });

// --- vitals stats ---
program
  .command("stats")
  .description("Show a quick codebase overview and project summary")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("--package <name>", "scope to a single package (monorepo only)")
  .option("--json", "output stats as JSON")
  .action(async (options) => {
    // Load .env from project path if it differs from cwd
    if (options.path && options.path !== process.cwd()) {
      const projectEnvPath = join(options.path, ".env");
      if (existsSync(projectEnvPath)) {
        config({ path: projectEnvPath, override: true });
      }
    }

    const { resolveProject } = await import("./lib/resolve-package.js");
    const resolution = await resolveProject(options.path, options.package);

    const projectPath = resolution.isMonorepo
      ? resolution.targetPath ?? options.path
      : resolution.targetPath;

    const { StatsApp } = await import("./components/StatsApp.js");
    render(
      React.createElement(StatsApp, {
        projectPath,
        jsonOutput: options.json ?? false,
        isMonorepo: resolution.isMonorepo && !resolution.targetPath,
        packagePaths: resolution.isMonorepo ? resolution.packagePaths : undefined,
        packageNames: resolution.isMonorepo ? resolution.packageNames : undefined,
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
  .option("--package <name>", "scope to a single package (monorepo only)")
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

    const { resolveProject } = await import("./lib/resolve-package.js");
    const resolution = await resolveProject(options.path, options.package);

    const projectPath = resolution.isMonorepo
      ? resolution.targetPath ?? options.path
      : resolution.targetPath;

    const { DoctorApp } = await import("./components/DoctorApp.js");
    render(
      React.createElement(DoctorApp, {
        projectPath,
        autoFix: options.fix ?? false,
        jsonOutput: options.json ?? false,
        isMonorepo: resolution.isMonorepo && !resolution.targetPath,
        packagePaths: resolution.isMonorepo ? resolution.packagePaths : undefined,
        packageNames: resolution.isMonorepo ? resolution.packageNames : undefined,
      }),
    );
  });

program.parse();
