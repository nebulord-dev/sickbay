import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComplexityRunner } from "./complexity.js";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("../utils/file-helpers.js", () => ({
  timer: vi.fn(() => () => 100),
  fileExists: vi.fn(),
  WARN_LINES: WARN_LINES,
}));

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { WARN_LINES } from "../utils/file-helpers.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);

/** Generate a string with N non-empty lines */
function makeLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `const x${i} = ${i};`).join(
    "\n",
  );
}

describe("ComplexityRunner", () => {
  let runner: ComplexityRunner;

  beforeEach(() => {
    runner = new ComplexityRunner();
    vi.clearAllMocks();
  });

  it("returns false for isApplicable when src dir does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await runner.isApplicable("/project");

    expect(result).toBe(false);
  });

  it("returns true for isApplicable when src dir exists", async () => {
    mockExistsSync.mockReturnValue(true);

    const result = await runner.isApplicable("/project");

    expect(result).toBe(true);
  });

  it("returns pass with score 100 when all files are small", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["index.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 50 lines — well under WARN_LINES (400)
    mockReadFileSync.mockReturnValue(makeLines(50) as any);

    const result = await runner.run("/project");

    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.id).toBe("complexity");
  });

  it("returns warning status and info severity for a file with 350 lines (>=WARN_LINES, <CRITICAL_LINES)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["big.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(350) as any);

    const result = await runner.run("/project");

    expect(result.status).toBe("warning");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("info");
    expect(result.issues[0].message).toContain("350 lines");
    expect(result.score).toBe(90); // 100 - 1*10
  });

  it("returns warning status and warning severity for a file with 600 lines (>=CRITICAL_LINES)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["massive.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(600) as any);

    const result = await runner.run("/project");

    expect(result.status).toBe("warning");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("warning");
    expect(result.issues[0].message).toContain("600 lines");
  });

  it("calculates score as 100 - oversized.length * 10", async () => {
    mockExistsSync.mockReturnValue(true);
    // 3 files, each 350 lines
    mockReaddirSync.mockReturnValue(["a.ts", "b.ts", "c.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(350) as any);

    const result = await runner.run("/project");

    expect(result.score).toBe(70); // 100 - 3*10
    expect(result.issues).toHaveLength(3);
  });

  it("does not let score drop below 0", async () => {
    mockExistsSync.mockReturnValue(true);
    // 11 oversized files: 100 - 11*10 = -10 → capped at 0
    const files = Array.from({ length: 11 }, (_, i) => `file${i}.ts`);
    mockReaddirSync.mockReturnValue(files as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(350) as any);

    const result = await runner.run("/project");

    expect(result.score).toBe(0);
  });

  it("skips test files when scanning", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["app.test.ts", "app.spec.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(600) as any);

    const result = await runner.run("/project");

    expect(result.status).toBe("pass");
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("recurses into subdirectories", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync
      .mockReturnValueOnce(["components"] as any)
      .mockReturnValueOnce(["HugeComponent.tsx"] as any);
    mockStatSync
      .mockReturnValueOnce({ isDirectory: () => true } as any)
      .mockReturnValueOnce({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(400) as any);

    const result = await runner.run("/project");

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain("400 lines");
  });

  it("reports correct metadata", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["index.ts", "utils.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // First file: 100 lines, second file: 350 lines
    mockReadFileSync
      .mockReturnValueOnce(makeLines(100) as any)
      .mockReturnValueOnce(makeLines(350) as any);

    const result = await runner.run("/project");

    expect(result.metadata?.totalFiles).toBe(2);
    expect(result.metadata?.oversizedCount).toBe(1);
    expect(result.metadata?.totalLines).toBe(450);
    expect(result.metadata?.avgLines).toBe(225);
  });

  it("returns pass with no issues when src dir is empty", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([] as any);

    const result = await runner.run("/project");

    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("includes fix description in oversized file issues", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["bigfile.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    mockReadFileSync.mockReturnValue(makeLines(350) as any);

    const result = await runner.run("/project");

    expect(result.issues[0].fix?.description).toContain("smaller");
  });

  it("returns id and category correctly", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([] as any);

    const result = await runner.run("/project");

    expect(result.id).toBe("complexity");
    expect(result.category).toBe("code-quality");
  });

  it("counts only non-empty lines", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["sparse.ts"] as any);
    mockStatSync.mockReturnValue({ isDirectory: () => false } as any);
    // 400 real lines plus 200 blank lines — total non-empty should be 400 (>=WARN_LINES)
    const content = Array.from(
      { length: WARN_LINES },
      (_, i) => `const x${i} = ${i};`,
    ).join("\n\n");
    mockReadFileSync.mockReturnValue(content as any);

    const result = await runner.run("/project");

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain("400 lines");
  });
});
