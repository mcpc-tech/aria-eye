// Auto-apply patches on first import
try {
  const { applyPatch } = require('./utils/patcher.js');
  applyPatch();
} catch (e) {
  // Silently ignore if patch fails
}

// Core
export { createEye } from "./eye";
export type { EyeProps, EyeEvalProps, EvaluateFunction } from "./eye";

// Utilities
export { getBrowserWSUrl } from "./utils/browserWsUrl";
export { logger, setLogLevel } from "./utils/logger";
export type { LogLevel, Logger } from "./utils/logger";

// Services
export * from "./services/action";
export * from "./services/a11y";
