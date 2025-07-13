import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import * as esbuild from "esbuild";
import { EyeEvalProps, EyeProps } from "eye";

export const injectA11y = (
  evaluate: EyeEvalProps["evaluate"],
  globalName = "_a11y"
) => {
  const injectPath = fileURLToPath(
    // @ts-ignore
    new URL("../injected/a11y.ts", import.meta.url)
  );

  const result = esbuild.buildSync({
    entryPoints: [injectPath],
    bundle: true,
    write: false,
    format: "iife",
    globalName,
  });

  const a11yBundle = result.outputFiles[0].text;

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
