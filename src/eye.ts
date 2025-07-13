import { SEE_MODE } from "./constants";
import { injectA11y } from "./services/a11y";
import { flattenTreeDFS } from "utils/tree";
import { memory } from "services/mem";
import {
  a11yRefSelect,
  genArgsByPlatform as getEvaluationAdapter,
  parsePrompt,
} from "@isomorphic/dom";
import { ElementHandle } from "puppeteer";

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
  await memory.reset();
  async function syncA11yMemoryFromTree() {
    const a11yTree = await evaluate(() => {
      return JSON.parse(
        window._a11y.ariaSnapshotJSON(document.documentElement, { forAI: true })
      );
    });
    const rawResults = (
      await memory.getAll({
        userId: MEM_USER_ID,
      })
    ).results;
    const results: Array<{ role: string; content: string; id: string }> =
      rawResults.map((item) => ({
        role: "user",
        content: item.memory ?? "",
        id: item.id,
      }));
    const ariaList = flattenTreeDFS(a11yTree?.[0]);
    const ariaMemories = ariaList
      .filter(({ ref }) => Boolean(ref))
      .map(({ prompt }) => {
        return {
          role: "user",
          content: prompt,
        };
      });

    const needsToBeAddedMemories = ariaMemories.filter(({ content, role }) => {
      return !results.some((m) => content === m.content && role === m.role);
    });

    const needsToBeDeletedMemories = results.filter(({ content, role }) => {
      return !ariaMemories.some(
        (m) => content === m.content && role === m.role
      );
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

  const blink = async (duration: number = 400) =>
    await new Promise((resolve) => setTimeout(resolve, duration));

  const setup = async () => {
    // Inject a11y library to page if not already injected
    await injectA11y(evaluate);
    // Allways blink before any action to ensure the eye is clear and ready
    await blink();
    // Sync a11y memory from the current page tree
    await syncA11yMemoryFromTree();
  };

  return {
    /**
     * Query elements on the page by description
     */
    async look(
      target: string,
      similarityThreshold: number = 0.5
    ): Promise<ElementHandle> {
      await setup();
      const { results } = await memory.search(target, {
        userId: MEM_USER_ID,
        limit: 10,
      });
      const element = results?.[0];
      if (element.score < similarityThreshold) {
        return Promise.reject(
          `Element matching "${target}" not found, score: ${
            element.score
          }, threshold: ${similarityThreshold}, results: ${JSON.stringify(
            results.slice(0, 10)
          )}`
        );
      }

      const ref = parsePrompt(element?.memory).ref as string;
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
      await setup();
      const results = await waitElementByDescription(setup, description, {
        similarityThreshold,
      });
      const element = results?.[0];
      if (element.score < similarityThreshold) {
        return Promise.reject(
          `Element matching "${description}" not found, score: ${
            element.score
          }, threshold: ${similarityThreshold}, results: ${JSON.stringify(
            results.slice(0, 10)
          )}`
        );
      }

      const ref = parsePrompt(element?.memory).ref as string;
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
      await blink(duration);
    },

    /**
     * Take a a11y snapshot of current page
     */
    async snapshot(yaml = false) {
      const raw = await evaluate((yaml) => {
        return window._a11y[yaml ? "ariaSnapshot" : "ariaSnapshotJSON"](
          document.documentElement,
          {
            forAI: true,
          }
        );
      }, yaml);
      return raw;
    },
  };
};

/**
 * Waits for an element matching the given description to appear on the page.
 */
export async function waitElementByDescription(
  setup: () => Promise<void>,
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
  const similarityThreshold = options.similarityThreshold || 0.8;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await setup();
      const { results } = await memory.search(description, {
        userId: MEM_USER_ID,
        limit: 10,
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
