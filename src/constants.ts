export const EYE_OUTPUT_DIR = ".eye";

export const INTERACTIVE_ROLES: Set<string> = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "menuitem",
  "tab",
  "heading",
  "img",
  "image",
  "list",
  "table",
  "form",
  "textbox",
  "combobox",
  "menu",
  "menubar",
  "slider",
  "scrollbar",
  "searchbox",
  "switch",
  // Semantic roles
  "article",
  "banner",
  "complementary",
  "contentinfo",
  "figure",
  "main",
  "navigation",
  "region",
  "tooltip",
  "dialog",
  "alert",
]);

export const EXCLUDED_TAGS: Set<string> = new Set([
  // Document metadata
  "META",
  "LINK",
  "TITLE",
  "BASE",
  "HEAD",
  "HTML",

  // Scripting and styling
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",

  // Embedded content
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SOURCE",
  "TRACK",

  // Graphics
  "CANVAS",

  // Structural
  "MAIN",
]);

// Embedding constants
export const OLLAMA_BASE_URL = "http://localhost:11434/v1/";

export const VISION_LM = "hunyuan-vision";

export const EMBEDDING_MODEL = "nomic-embed-text";
// export const EMBEDDING_MODEL = "all-minilm";
// export const EMBEDDING_MODEL = "qwen2.5";

export enum SEE_MODE {
  Query,
  Assert,
}
