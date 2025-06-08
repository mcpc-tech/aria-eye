import { SEE_MODE } from "./constants";
import { injectA11y } from "./services/a11y";
import { flattenTreeDFS } from "utils/tree";
import { memory } from "services/mem";
import {
  a11yRefSelect,
  genArgsByPlatform as getEvaluationAdapter,
  parseA11yRef,
} from "@isomorphic/dom";

const MEM_USER_ID = "eye-client";

export type EvaluateFunction = <T extends any, Arg>(
  pageFunction: (arg?: Arg) => T | Promise<T>,
  arg?: Arg
) => Promise<T>;

export interface EyeEvalProps {
  evaluate?: EvaluateFunction;
  evaluateHandle?: EvaluateFunction;
}

export interface EyeProps {
  platform: { name: "playwright" | "puppeteer" | "native"; page: any };
}

/**
 * AI with eyes - interact with web pages using text/image embeddings.
 */
export const createEye = async ({ platform }: EyeProps) => {
  const { evaluate, evaluateHandle } = getEvaluationAdapter(platform);
  const a11yMemo = async () => {
    await memory.deleteAll({ userId: MEM_USER_ID });
    injectA11y(evaluate);

    const a11yTree = await evaluate(() => {
      const json = JSON.parse(
        window._a11y.ariaSnapshotJSON(document.documentElement, { forAI: true })
      );
      window._a11y._lastTreeResult = json;
      return json;
    });

    const ariaList = flattenTreeDFS(a11yTree?.[0]);
    const memories = ariaList
      .filter(({ ref }) => Boolean(ref))
      .map(({ role, name, ref, text, level }) => {
        return {
          role: "user",
          content: `${name ?? "N/A"} ${role ?? "N/A"}, with ${
            text ?? "N/A"
          } [heading-level=${level ?? "N/A"}] [selector=${ref ?? "N/A"}]`,
        };
      });
    await memory.add(memories, {
      infer: false,
      userId: MEM_USER_ID,
    });
  };

  return {
    /**
     * Query elements on the page by description
     */
    async look(
      target: string,
      similarityThreshold: number = 0.5
    ): Promise<any> {
      const { results } = await queryElementsByDescription(a11yMemo, target);
      const element = results?.[0];
      if (element.score < similarityThreshold) {
        return null;
      }

      const ref = parseA11yRef(element?.memory);
      const elementHandle = await a11yRefSelect(
        { evaluate, evaluateHandle },
        ref
      );
      return elementHandle;
    },

    /**
     * Wait for an element matching the description to appear
     */
    async wait(description: string, options = {}) {
      return waitElementByDescription(a11yMemo, description, options);
    },

    /**
     * Blink for `duration` milliseconds
     *
     * The default duration is based on the average human eye blink to complete a full blink cycle
     * @default 400
     */
    async blink(duration: number = 400) {
      await new Promise((resolve) => setTimeout(resolve, duration));
    },

    /**
     * Take a a11y snapshot of current page
     */
    async snapshot(yaml = false) {
      injectA11y(evaluate);
      return await evaluate((yaml) => {
        return window._a11y[yaml ? "ariaSnapshot" : "ariaSnapshotJSON"](
          document.documentElement,
          {
            forAI: true,
          }
        );
      }, yaml);
    },
  };
};

export async function queryElementsByDescription(
  a11yMemo: any,
  target: string
) {
  await a11yMemo();
  return await memory.search(target, {
    userId: MEM_USER_ID,
    limit: 100,
  });
}

/**
 * Waits for an element matching the given description to appear on the page.
 */
export async function waitElementByDescription(
  a11yMemo: any,
  description: string,
  options: { timeout?: number; pollingInterval?: number; mode?: SEE_MODE } = {}
) {
  const timeout = options.timeout || 30000;
  const pollingInterval = options.pollingInterval || 1000;
  const mode = options.mode || SEE_MODE.Query;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await a11yMemo();
      const { results } = await memory.search(description, {
        userId: MEM_USER_ID,
        limit: 100,
      });

      if (results.length > 0) {
        return results;
      }

      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    } catch (error) {
      console.error("Error while waiting for element:", error);
    }
  }

  throw new Error(
    `Timeout: Element matching description "${description}" not found within ${timeout}ms`
  );
}
