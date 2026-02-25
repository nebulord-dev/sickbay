export { runVitals } from './runner.js';
export { calculateOverallScore, buildSummary, getScoreColor, getScoreEmoji } from './scoring.js';
export { detectProject, detectPackageManager } from './utils/detect-project.js';
export type {
  VitalsReport,
  ProjectInfo,
  CheckResult,
  Issue,
  FixSuggestion,
  ToolRunner,
  ToolResult,
  RunOptions,
} from './types.js';
