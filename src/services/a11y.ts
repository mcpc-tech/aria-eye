import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";

type EvaluateFunction = <T extends any, Arg>(pageFunction: (arg?: Arg) => T | Promise<T>, arg?: Arg) => Promise<T>;

interface EyeEvalProps {
  evaluate: EvaluateFunction;
  evaluateHandle?: EvaluateFunction;
}

export const injectA11y = (
  evaluate: EyeEvalProps["evaluate"],
  globalName = "_a11y"
) => {
  // Load the pre-built injected script from the package directory
  const currentDir = dirname(__filename);
  const a11yPath = join(currentDir, "injected", "a11y.js");
  const a11yBundle = readFileSync(a11yPath, 'utf-8');

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
