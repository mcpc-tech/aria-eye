import { SEE_MODE } from "./constants";
import { ALL_BROWSER_ACTIONS } from "./utils/isomorphic/browserActions";
import { injectA11y } from "./services/a11y";
import {
  browser_click,
  browser_type,
  browser_press_key,
  browser_hover,
  browser_select_option,
  browser_drag,
  browser_file_upload,
} from "./services/action";
import { flattenTreeDFS } from "utils/tree";
import { memory } from "services/mem";
import {
  a11yRefSelect,
  genArgsByPlatform as getEvaluationAdapter,
  parsePrompt,
} from "@isomorphic/dom";
import { ElementHandle } from "puppeteer";
import { formatElementContent, createMemoryEntry, ElementContent, extractElementsFromA11yNode } from "@isomorphic/contentFormatter";

const MEM_USER_ID = `${"eye-client"}_${Math.random()
  .toString(36)
  .substring(2, 15)}`;

export type EvaluateFunction = <T extends any, Arg>(
  pageFunction: (arg?: Arg) => T | Promise<T>,
  arg?: Arg
) => Promise<T>;

export interface EyeEvalProps {
  evaluate: EvaluateFunction;
  evaluateHandle?: EvaluateFunction;
}

export interface EyeProps {
  platform: { name: "playwright" | "puppeteer" | "native"; page: any };
  /**
   * If true, the eye will use LLM to infer elements.
   */
  infer?: boolean;
}

interface ActionInfo {
  actionType: string;
  elementDescription: string;
  elementData: any;
  text?: string;
  key?: string;
  values?: string[];
  filePaths?: string[];
  targetElementDescription?: string;
  slowly?: boolean;
  submit?: boolean;
}

/**
 * Find the best matching element and determine action from supportedActions
 */
async function findElementAndAction(
  description: string,
  similarityThreshold: number = 0.7
): Promise<ActionInfo & { score: number }> {
  // Search memory for actionable elements that match the description
  const { results } = await memory.search(description, {
    userId: MEM_USER_ID,
    limit: 10,
  });

  // Filter results to only include actionable elements (those with refs and supportedActions)
  const actionableResults = results.filter((result) => {
    if (!result.memory) return false;
    const props = parsePrompt(result.memory);
    return props.ref;
  });

  // Use the best matching actionable element
  const bestMatch = actionableResults[0];

  // Check similarity threshold like in look method
  if (bestMatch.score! < similarityThreshold) {
    throw new Error(
      `Element matching "${description}" not found, score: ${
        bestMatch.score
      }, threshold: ${similarityThreshold}, actionable results: ${JSON.stringify(
        actionableResults.slice(0, 5)
      )}`
    );
  }

  const props = parsePrompt(bestMatch.memory);

  console.log(`Acting on element: ${description}, found:`, bestMatch, props);
  const elementDescription = bestMatch.memory || description;

  return {
    actionType: props.action?.toString() || "click",
    elementDescription,
    elementData: props,
    score: bestMatch.score!,
  };
}

/**
 * AI with eyes - interact with web pages using text/image embeddings.
 */
export const createEye = async ({ platform, infer = false }: EyeProps) => {
  const { evaluate, evaluateHandle } = getEvaluationAdapter(platform);
  await memory.reset();
  async function syncA11yMemoryFromTree() {
    const [a11yTree, a11ySnapshot] = await evaluate(() => {
      return [
        JSON.parse(
          window._a11y.ariaSnapshotJSON(document.documentElement, {
            forAI: true,
          })
        ),
        window._a11y.ariaSnapshot(document.documentElement, { forAI: true }),
      ];
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

    // Extract elements with supportedActions from the JSON tree for memory storage
    const extractElementsWithActions = extractElementsFromA11yNode;

    const ariaMemories =
      a11yTree?.flatMap((node: any) => extractElementsWithActions(node)) || [];

    const needsToBeAddedMemories = ariaMemories.filter(({ content, role }) => {
      return !results.some((m) => content === m.content && role === m.role);
    });

    const needsToBeDeletedMemories = results.filter(({ content, role }) => {
      return !ariaMemories.some(
        (m) => content === m.content && role === m.role
      );
    });

    // Perform add and delete concurrently, but prioritize add (await add first)
    const addPromise = infer
      ? memory.add([{ role: "user", content: a11ySnapshot }], {
          infer,
          userId: MEM_USER_ID,
        })
      : needsToBeAddedMemories.length > 0
      ? memory
          .add(needsToBeAddedMemories, {
            infer: false,
            userId: MEM_USER_ID,
          })
          .then(() =>
            console.log(
              `Added ${needsToBeAddedMemories.length} new memories for user ${MEM_USER_ID}`
            )
          )
      : Promise.resolve();

    const deletePromise = infer
      ? Promise.resolve()
      : needsToBeDeletedMemories.length > 0
      ? Promise.all(
          needsToBeDeletedMemories.map((mem) => memory.delete(mem.id))
        ).then(() =>
          console.log(
            `Deleted ${needsToBeDeletedMemories.length} outdated memories for user ${MEM_USER_ID}`
          )
        )
      : Promise.resolve();

    await Promise.all([addPromise, deletePromise]);
  }

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
      similarityThreshold: number = 0
    ): Promise<ElementHandle> {
      await setup();
      const { results } = await memory.search(target, {
        userId: MEM_USER_ID,
        limit: 10,
      });
      const element = results?.[0];
      if (element?.score! < similarityThreshold) {
        return Promise.reject(
          `Element matching "${target}" not found, score: ${
            element?.score
          }, threshold: ${similarityThreshold}, results: ${JSON.stringify(
            results.slice(0, 10)
          )}`
        );
      }
      console.log(`Looking for element: ${target}, found:`, element);
      const ref = parsePrompt(element?.memory).ref as string;
      const elementHandle = await a11yRefSelect(
        { evaluate, evaluateHandle },
        ref
      );
      return elementHandle;
    },

    /**
     * Wait for an element matching the description to appear
     */
    async wait(description: string, similarityThreshold = 0.5) {
      await setup();
      const results = await waitElementByDescription(setup, description, {
        similarityThreshold,
      });
      const element = results?.[0];
      if (element.score! < similarityThreshold) {
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
      await setup();
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

    /**
     * Execute an action based on a natural language description
     * @param actionDescription - Natural language description of the action to perform
     * @param similarityThreshold - Minimum similarity score for element matching
     */
    async act(actionDescription: string, similarityThreshold: number = 0) {
      await setup();

      // Find the best matching element and determine action from supportedActions
      const actionInfo = await findElementAndAction(
        actionDescription,
        similarityThreshold
      );

      // Extract ref from the element data
      let ref: string;
      try {
        ref = actionInfo.elementData.ref;
      } catch {
        // Fallback for old format
        ref = parsePrompt(actionInfo.elementDescription).ref as string;
      }

      if (!ref) {
        throw new Error(
          `Could not get reference for element matching "${actionDescription}"`
        );
      }

      // Verify the element exists and is accessible like in look method
      console.log(
        `Found element for action: ${actionDescription}, score: ${actionInfo.score}, action: ${actionInfo.actionType}, ref: ${ref}`
      );

      // Get element handle to verify accessibility (similar to look method)
      const elementHandle = await a11yRefSelect(
        { evaluate, evaluateHandle },
        ref
      );

      if (!elementHandle) {
        throw new Error(
          `Element with ref "${ref}" is not accessible for action: "${actionDescription}"`
        );
      }

      // Parse action parameters from description
      const lowerDesc = actionDescription.toLowerCase();

      // Execute the appropriate action
      console.log(
        `Executing action: ${actionInfo.actionType} on element with ref: ${ref}`
      );

      switch (actionInfo.actionType) {
        case "click":
          return await browser_click(
            { evaluate, evaluateHandle },
            actionInfo.elementDescription,
            ref
          );

        case "type":
          // Extract text to type from description
          const textMatch =
            actionDescription.match(
              /(?:type|enter|input|fill)\s+["']([^"']+)["']/i
            ) || actionDescription.match(/["']([^"']+)["']/);
          const text = textMatch ? textMatch[1] : "";
          if (!text) {
            throw new Error(
              `Type action requires text, but none provided in: "${actionDescription}"`
            );
          }
          const submit =
            lowerDesc.includes("submit") ||
            lowerDesc.includes("enter to submit");
          const slowly =
            lowerDesc.includes("slowly") ||
            lowerDesc.includes("character by character");

          return await browser_type(
            { evaluate, evaluateHandle },
            actionInfo.elementDescription,
            ref,
            text,
            slowly,
            submit
          );

        case "press_key":
          // Extract key from description
          const keyMatch = actionDescription.match(
            /(?:press\s+key\s+|keyboard\s+)(\w+)/i
          );
          const key = keyMatch ? keyMatch[1] : "Enter";
          return await browser_press_key({ evaluate, evaluateHandle }, key);

        case "hover":
          return await browser_hover(
            { evaluate, evaluateHandle },
            actionInfo.elementDescription,
            ref
          );

        case "select_option":
          // Extract values to select from description
          const valuesMatch = actionDescription.match(
            /select\s+["']([^"']+)["']/i
          );
          const values = valuesMatch ? [valuesMatch[1]] : [];
          if (values.length === 0) {
            throw new Error(
              `Select action requires values, but none provided in: "${actionDescription}"`
            );
          }
          return await browser_select_option(
            { evaluate, evaluateHandle },
            actionInfo.elementDescription,
            ref,
            values
          );

        case "drag":
          // Extract target element from description
          const toMatch = actionDescription.match(
            /(?:to|onto|drop)\s+([^]+?)(?:\s|$)/i
          );
          const targetElementDescription = toMatch ? toMatch[1].trim() : "";
          if (!targetElementDescription) {
            throw new Error(
              `Drag action requires a target element, but none provided in: "${actionDescription}"`
            );
          }

          // Find target element using memory with similarity threshold
          const { results: targetResults } = await memory.search(
            targetElementDescription,
            {
              userId: MEM_USER_ID,
              limit: 10,
            }
          );

          const actionableTargets = targetResults.filter((r) => {
            if (!r.memory) return false;
            try {
              const data = JSON.parse(r.memory);
              return data.ref;
            } catch {
              return r.memory.includes("[ref=");
            }
          });

          if (actionableTargets.length === 0) {
            throw new Error(
              `Could not find target element for drag action: "${targetElementDescription}". Available results: ${JSON.stringify(
                targetResults.slice(0, 5)
              )}`
            );
          }

          const targetElement = actionableTargets[0];

          // Check similarity threshold for target element
          if (targetElement.score! < similarityThreshold) {
            throw new Error(
              `Target element matching "${targetElementDescription}" not found, score: ${
                targetElement.score
              }, threshold: ${similarityThreshold}, results: ${JSON.stringify(
                actionableTargets.slice(0, 5)
              )}`
            );
          }

          console.log(
            `Found target element for drag: ${targetElementDescription}, score: ${targetElement.score}`
          );

          let targetRef: string;
          try {
            const targetData = JSON.parse(targetElement.memory);
            targetRef = targetData.ref;
          } catch {
            targetRef = parsePrompt(targetElement.memory).ref as string;
          }

          if (!targetRef) {
            throw new Error(
              `Could not get reference for target element matching "${targetElementDescription}"`
            );
          }

          // Verify target element is accessible
          const targetElementHandle = await a11yRefSelect(
            { evaluate, evaluateHandle },
            targetRef
          );

          if (!targetElementHandle) {
            throw new Error(
              `Target element with ref "${targetRef}" is not accessible for drag action`
            );
          }

          return await browser_drag(
            { evaluate, evaluateHandle },
            actionInfo.elementDescription,
            ref,
            targetElementDescription,
            targetRef
          );

        case "file_upload":
          // Extract file paths from description
          const pathsMatch = actionDescription.match(
            /(?:upload|attach)\s+(?:file\s+)?["']([^"']+)["']/i
          );
          const filePaths = pathsMatch ? [pathsMatch[1]] : [];
          if (filePaths.length === 0) {
            throw new Error(
              `Upload action requires file paths, but none provided in: "${actionDescription}"`
            );
          }
          return await browser_file_upload(
            { evaluate, evaluateHandle },
            filePaths
          );

        default:
          throw new Error(
            `Unknown action type: ${actionInfo.actionType} in description: "${actionDescription}"`
          );
      }
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
        (r) => r.score! >= similarityThreshold
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
