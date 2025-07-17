import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { readFileSync } from "node:fs";
import { EyeEvalProps, EyeProps } from "eye";

export const injectA11y = (
  evaluate: EyeEvalProps["evaluate"],
  globalName = "_a11y"
) => {
  // Load the pre-built injected script
  const distPath = new URL("../../dist/injected/a11y.js", "file://" + __filename);
  const a11yBundle = readFileSync(fileURLToPath(distPath), 'utf-8');

  return evaluate(
    ({ a11yBundle, globalName }) => {
      const win = window as Window & { [globalName]?: any };
      if (win[globalName]) {
        return;
      }
      const script = document.createElement("script");
      script.textContent = a11yBundle;
      document.head.appendChild(script);
      script.remove();

      if (!win[globalName]) {
        throw new Error("_a11y failed to load.");
      }
    },
    { a11yBundle, globalName } as any
  );
};
