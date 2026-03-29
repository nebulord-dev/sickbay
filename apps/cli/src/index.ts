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
 * Entry point for the Sickbay CLI application.
 * This script sets up the command-line interface using Commander, loads environment variables, and renders the appropriate Ink components based on user commands.
 * It supports multiple commands including the default scan, trend analysis, stats overview, and a doctor command for diagnosing project issues.
 * Each command can output results in JSON format or render an interactive UI in the terminal.
 */

// Load .env from global config first (~/.sickbay/.env)
const globalConfigPath = join(homedir(), ".sickbay", ".env");
if (existsSync(globalConfigPath)) {
  config({ path: globalConfigPath, debug: false, quiet: true });
}

// Load .env from current directory (overrides global)
config({ debug: false, quiet: true });

const program = new Command();

program
  .name("sickbay")
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
  .option("--no-quotes", "suppress personality quotes in output")
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

    const { detectMonorepo, runSickbay, runSickbayMonorepo } = await import("@sickbay/core");
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
        const report = await runSickbay({ projectPath: targetPath, checks, verbose: options.verbose, quotes: options.quotes });
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
          quotes: options.quotes,
        }),
      );
      return;
    }

    if (options.json) {
      if (monorepoInfo.isMonorepo) {
        const report = await runSickbayMonorepo({
          projectPath: options.path,
          checks,
          verbose: options.verbose,
          quotes: options.quotes,
        });
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
        process.exit(0);
      }

      const report = await runSickbay({
        projectPath: options.path,
        checks,
        verbose: options.verbose,
        quotes: options.quotes,
      });

      // Auto-save to trend history and last-report snapshot
      try {
        const { saveEntry, saveLastReport } = await import("./lib/history.js");
        saveEntry(report);
        saveLastReport(report);
      } catch {
        // Non-critical
      }

      // Cache dependency tree
      try {
        const { getDependencyTree } = await import("@sickbay/core");
        const { saveDepTree } = await import("./lib/history.js");
        const tree = await getDependencyTree(options.path, report.projectInfo.packageManager);
        saveDepTree(options.path, tree);
      } catch { /* dep tree is optional */ }

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
        quotes: options.quotes,
        isMonorepo: monorepoInfo.isMonorepo,
      }),
    );
  });

// --- sickbay init ---
program
  .command("init")
  .description("Initialize .sickbay/ folder and run an initial baseline scan")
  .option("-p, --path <path>", "project path to initialize", process.cwd())
  .action(async (options) => {
    const { initSickbay } = await import("./commands/init.js");
    await initSickbay(options.path);
  });

// --- sickbay fix ---
program
  .command("fix")
  .description("Interactively fix issues found by sickbay scan")
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

// --- sickbay trend ---
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

// --- sickbay stats ---
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

// --- sickbay tui ---
program
  .command("tui")
  .description("Launch the persistent developer dashboard")
  .option("-p, --path <path>", "project path to monitor", process.cwd())
  .option("--no-watch", "disable file-watching auto-refresh")
  .option("--no-quotes", "suppress personality quotes in output")
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
        quotes: options.quotes,
      }),
      { exitOnCtrlC: true },
    );
  });

// --- sickbay doctor ---
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

// --- sickbay badge ---
program
  .command("badge")
  .description("Generate a health score badge for your README")
  .option("-p, --path <path>", "project path", process.cwd())
  .option("--package <name>", "scope to a single package (monorepo only)")
  .option("--html", "output HTML <img> tag instead of markdown")
  .option("--url", "output bare badge URL only")
  .option("--label <text>", "custom badge label", "sickbay")
  .option("--scan", "run a fresh scan instead of using last report")
  .action(async (options) => {
    const { resolveProject } = await import("./lib/resolve-package.js");
    const resolution = await resolveProject(options.path, options.package);

    const projectPath = resolution.isMonorepo
      ? resolution.targetPath ?? options.path
      : resolution.targetPath;

    const {
      loadScoreFromLastReport,
      badgeUrl,
      badgeMarkdown,
      badgeHtml,
    } = await import("./commands/badge.js");

    let score = options.scan ? null : loadScoreFromLastReport(projectPath);

    if (score === null) {
      const { runSickbay } = await import("@sickbay/core");
      const report = await runSickbay({ projectPath, quotes: false });

      try {
        const { saveEntry, saveLastReport } = await import("./lib/history.js");
        saveEntry(report);
        saveLastReport(report);
      } catch {
        // Non-critical
      }

      score = report.overallScore;
    }

    let output: string;
    if (options.url) {
      output = badgeUrl(score, options.label);
    } else if (options.html) {
      output = badgeHtml(score, options.label);
    } else {
      output = badgeMarkdown(score, options.label);
    }

    process.stdout.write(output + "\n");
    process.exit(0);
  });

// --- sickbay diff ---
program
  .command("diff <branch>")
  .description("Compare health score against another branch")
  .option("-p, --path <path>", "project path to analyze", process.cwd())
  .option("-c, --checks <checks>", "comma-separated list of checks to run")
  .option("--json", "output diff as JSON")
  .option("--verbose", "show verbose output")
  .action(async (branch, options) => {
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

    const { DiffApp } = await import("./components/DiffApp.js");
    render(
      React.createElement(DiffApp, {
        projectPath: options.path,
        branch,
        jsonOutput: options.json ?? false,
        checks,
        verbose: options.verbose,
      }),
    );
  });

program.parse();
