// Auto-apply patches on first import
try {
  const { applyPatch } = require('./utils/patcher.js');
  applyPatch();
} catch (e) {
  // Silently ignore if patch fails
}

export * from "./eye";
export * from "./utils/browserWsUrl";
export * from "./services/action";
export * from "./services/a11y";
