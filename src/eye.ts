import { SEE_MODE } from "./constants";
import { injectA11y } from "./services/a11y";
import { flattenTreeDFS } from "utils/tree";
import { memory } from "services/mem";
import {
  a11yRefSelect,
  genArgsByPlatform as getEvaluationAdapter,
  parseA11yRef,
} from "@isomorphic/dom";
import { ElementHandle } from "puppeteer";
import fs from "node:fs";
import { MemoryItem } from "mem0ai/oss";

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
  await memory.deleteAll({ userId: MEM_USER_ID });
  async function syncA11yMemoryFromTree(a11yTree: any) {
    const rawResults = (
      await memory.getAll({
        userId: MEM_USER_ID,
      })
    ).results;
    const cachedMemo: Array<{ role: string; content: string; id: string }> =
      rawResults.map((item) => ({
        role: "user",
        content: item.memory ?? "",
        id: item.id,
      }));
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

    const needsToBeAddedMemories = memories.filter(({ content, role }) => {
      return !cachedMemo.some((m) => content === m.content && role === m.role);
    });

    const needsToBeDeletedMemories = cachedMemo.filter(({ content, role }) => {
      return !memories.some((m) => content === m.content && role === m.role);
    });

    // Perform add and delete concurrently, but prioritize add (await add first)
    const addPromise =
      needsToBeAddedMemories.length > 0
        ? memory.add(needsToBeAddedMemories, {
            infer: false,
            userId: MEM_USER_ID,
          })
        : Promise.resolve();

    const deletePromise =
      needsToBeDeletedMemories.length > 0
        ? Promise.all(
            needsToBeDeletedMemories.map((mem) => memory.delete(mem.id))
          )
        : Promise.resolve();

    // Await add first, then delete
    await Promise.all([addPromise, deletePromise]);

    if (needsToBeAddedMemories.length > 0) {
      console.log(
        `Added ${needsToBeAddedMemories.length} new memories for user ${MEM_USER_ID}`
      );
    }
    if (needsToBeDeletedMemories.length > 0) {
      console.log(
        `Deleted ${needsToBeDeletedMemories.length} outdated memories for user ${MEM_USER_ID}`
      );
    }
  }

  const { evaluate, evaluateHandle } = getEvaluationAdapter(platform);
  
  const a11yMemo = async () => {
    const a11yTree = await evaluate(() => {
      return JSON.parse(
        window._a11y.ariaSnapshotJSON(document.documentElement, { forAI: true })
      );
    });
    await syncA11yMemoryFromTree(a11yTree);
  };

  return {
    /**
     * Query elements on the page by description
     */
    async look(
      target: string,
      similarityThreshold: number = 0.6
    ): Promise<ElementHandle> {
      await injectA11y(evaluate);
      const { results } = await queryElementsByDescription(a11yMemo, target);
      const element = results?.[0];
      if (element.score < similarityThreshold) {
        return Promise.reject();
      }

      const ref = parseA11yRef(element?.memory);
      console.log(`Looking for element: ${target}, found:`, ref, element);
      const elementHandle = await a11yRefSelect(
        { evaluate, evaluateHandle },
        ref
      );
      return elementHandle;
    },

    /**
     * Wait for an element matching the description to appear
     */
    async wait(description: string, similarityThreshold = 0.8) {
      await injectA11y(evaluate);
      const results = await waitElementByDescription(a11yMemo, description, {
        similarityThreshold,
      });
      const element = results?.[0];
      if (element.score < similarityThreshold) {
        return Promise.reject();
      }

      const ref = parseA11yRef(element?.memory);
      const elementHandle = await a11yRefSelect(
        { evaluate, evaluateHandle },
        ref
      );
      return elementHandle as ElementHandle;
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
      await injectA11y(evaluate);
      const raw = await evaluate((yaml) => {
        return window._a11y[yaml ? "ariaSnapshot" : "ariaSnapshotJSON"](
          document.documentElement,
          {
            forAI: true,
          }
        );
      }, yaml);
      if (!yaml) {
        const a11yTree = JSON.parse(raw);
        await syncA11yMemoryFromTree(a11yTree);
      }
      return raw;
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
  options: {
    timeout?: number;
    pollingInterval?: number;
    mode?: SEE_MODE;
    similarityThreshold?: number;
  } = { similarityThreshold: 0.8 }
) {
  const timeout = options.timeout || 60000;
  const pollingInterval = options.pollingInterval || 1000;
  const mode = options.mode || SEE_MODE.Query;
  const similarityThreshold = options.similarityThreshold || 0.8;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await a11yMemo();
      const { results } = await memory.search(description, {
        userId: MEM_USER_ID,
        limit: 100,
      });

      const filteredResults = results.filter(
        (r) => r.score >= similarityThreshold
      );

      if (filteredResults.length > 0) {
        return filteredResults;
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
