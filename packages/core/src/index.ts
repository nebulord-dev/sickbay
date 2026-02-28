export { runVitals } from './runner.js';
export { calculateOverallScore, buildSummary, getScoreColor, getScoreEmoji } from './scoring.js';
export { detectProject, detectPackageManager, detectContext } from './utils/detect-project.js';
export type {
  VitalsReport,
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
} from './types.js';
