import { describe, it, expect } from "vitest";
import { BaseRunner } from "./base.js";
import type { CheckResult, ProjectContext, ProjectInfo } from "../types.js";

// Concrete implementation for testing
class TestRunner extends BaseRunner {
  name = "test-runner";
  category = "dependencies" as const;

  async run(): Promise<CheckResult> {
    return {
      id: this.name,
      name: this.name,
      category: this.category,
      score: 85,
      status: "pass",
      issues: [],
      toolsUsed: [this.name],
      duration: 100,
    };
  }
}

describe("BaseRunner", () => {
  it("implements default isApplicable that returns true", async () => {
    const runner = new TestRunner();
    const projectInfo: ProjectInfo = {
      name: "test-project",
      version: "1.0.0",
      framework: "react",
      packageManager: "npm",
      totalDependencies: 0,
      devDependencies: {},
      dependencies: {},
      hasESLint: false,
      hasPrettier: false,
      hasTypeScript: false,
    };

    expect(await runner.isApplicable("/test/path", projectInfo)).toBe(true);
  });

  it("creates skipped result with correct structure", () => {
    const runner = new TestRunner();
    const result = runner["skipped"]("Tool not installed");

    expect(result).toEqual({
      id: "test-runner",
      category: "dependencies",
      name: "test-runner",
      score: 100,
      status: "skipped",
      issues: [],
      toolsUsed: ["test-runner"],
      duration: 0,
      metadata: { reason: "Tool not installed" },
    });
  });

  it("skipped result has score of 100", () => {
    const runner = new TestRunner();
    const result = runner["skipped"]("Any reason");

    expect(result.score).toBe(100);
    expect(result.status).toBe("skipped");
  });

  it("includes skip reason in metadata", () => {
    const runner = new TestRunner();
    const reason = "Custom skip reason";
    const result = runner["skipped"](reason);

    expect(result.metadata).toHaveProperty("reason", reason);
  });

  it("can be extended with custom run implementation", async () => {
    const runner = new TestRunner();
    const result = await runner.run();

    expect(result.id).toBe("test-runner");
    expect(result.category).toBe("dependencies");
    expect(result.score).toBe(85);
  });
});

function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    runtime: 'browser',
    frameworks: ['react'],
    buildTool: 'vite',
    testFramework: 'vitest',
    ...overrides,
  };
}

describe('isApplicableToContext', () => {
  it('returns true when no applicableFrameworks or applicableRuntimes are set', () => {
    const runner = new TestRunner();
    expect(runner.isApplicableToContext(makeContext())).toBe(true);
  });

  it('returns true when context frameworks include a match', () => {
    const runner = new TestRunner();
    (runner as any).applicableFrameworks = ['react'];
    expect(runner.isApplicableToContext(makeContext({ frameworks: ['react'] }))).toBe(true);
  });

  it('returns false when context frameworks have no match', () => {
    const runner = new TestRunner();
    (runner as any).applicableFrameworks = ['angular'];
    expect(runner.isApplicableToContext(makeContext({ frameworks: ['react'] }))).toBe(false);
  });

  it('returns true when applicableRuntimes includes the project runtime', () => {
    const runner = new TestRunner();
    (runner as any).applicableRuntimes = ['node'];
    expect(runner.isApplicableToContext(makeContext({ runtime: 'node', frameworks: [] }))).toBe(true);
  });

  it('returns false when runtime does not match applicableRuntimes', () => {
    const runner = new TestRunner();
    (runner as any).applicableRuntimes = ['browser'];
    expect(runner.isApplicableToContext(makeContext({ runtime: 'node', frameworks: [] }))).toBe(false);
  });

  it('returns false when frameworks match but runtime does not', () => {
    const runner = new TestRunner();
    (runner as any).applicableFrameworks = ['react'];
    (runner as any).applicableRuntimes = ['browser'];
    expect(runner.isApplicableToContext(makeContext({ frameworks: ['react'], runtime: 'node' }))).toBe(false);
  });
});
