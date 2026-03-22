export { runSickbay, runSickbayMonorepo } from './runner.js';
export { calculateOverallScore, buildSummary, getScoreColor, getScoreEmoji } from './scoring.js';
export { detectProject, detectPackageManager, detectContext } from './utils/detect-project.js';
export { detectMonorepo } from './utils/detect-monorepo.js';
export type {
  SickbayReport,
  ProjectInfo,
  CheckResult,
  Issue,
  FixSuggestion,
  ToolRunner,
  ToolResult,
  RunOptions,
  ProjectContext,
  Framework,
  Runtime,
  BuildTool,
  TestFramework,
  MonorepoInfo,
  PackageReport,
  MonorepoReport,
} from './types.js';
