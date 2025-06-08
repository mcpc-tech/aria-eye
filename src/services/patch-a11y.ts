/**
 * Patch-a11y: Try to fix unaccessible elements using AI.
 *
 * 1. Run a11y checks in the browser(axe-core), get bad cases;
 * 2. Fix bad cases by AI, apply to DOM tree;
 * 3. Generate the patched a11y tree.
 */

import axe, { AxeResults } from "axe-core";
import puppeteer, { Page, SerializedAXNode } from "puppeteer";

import { openrouter, venus } from "./embed";
import { generateObject } from "ai";

import { z } from "zod";

import * as esbuild from "esbuild";
import html2canvas from "html2canvas";
import { writeFileSync } from "fs";
import { cropAndConcatElements } from "../utils/puzzle";

export type EvaluateFunc = <TReturn, TParams extends any[] = any[]>(
  func: (...params: TParams) => Promise<TReturn>,
  ...params: TParams
) => TReturn;

export type A11yChecksRunner<ResultType> = (
  evaluate: EvaluateFunc
) => Promise<ResultType>;

export type A11yPatcher<ResultType, ResultTypePatched = any> = (
  evaluate: EvaluateFunc,
  results: ResultType,
  shot?: (selector: string) => Promise<string>
) => Promise<ResultTypePatched>;

export type A11yTreeGenerator = (
  evaluate: EvaluateFunc,
  serializedAXNode: SerializedAXNode
) => Promise<ElementDescriptionFromDOM>;

export type ScreenshotFunc<Base64String extends string> = (
  evaluate: EvaluateFunc,
  selector: string,
  ...args: Array<any>
) => Promise<Base64String>;

export interface ElementDescriptionFromDOM {
  /**
   * DOM props
   */
  props: axe.VirtualNode["props"];
  /**
   * Extend puppeteer's accessibility tree node with additional axe properties
   */
  a11y: SerializedAXNode & { isFocusable: boolean };
  /**
   * String representation of a DOM element
   */
  content: {
    html: string;
    text: string;
  };
  /**
   * DOM element position and identifiers
   */
  domMetadata: {
    id: string;
    selector: axe.NodeResult["target"]["0"];
    boundingBox: { top: number; left: number; width: number; height: number };
    boundingBoxCenter: {
      x: number;
      y: number;
    };
  };

  children?: Array<ElementDescriptionFromDOM>;
}

const SUPPORTED_RULES = ["html-has-lang", "image-alt", "label", "link-name"];

const takeScreenshot: ScreenshotFunc<string> = async (
  evaluate,
  selector: string
) => {
  const html2canvasPath = require.resolve("html2canvas-pro");

  const result = await esbuild.build({
    entryPoints: [html2canvasPath],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "html2canvas",
  });

  const html2canvasBundle = result.outputFiles[0].text;

  return evaluate(
    async (bundle, selector) => {
      const script = document.createElement("script");
      script.textContent = bundle;
      document.head.appendChild(script);
      script.remove();

      const win = window as Window & { html2canvas?: typeof html2canvas };
      if (!win.html2canvas) {
        throw new Error("html2canvas failed to load.");
      }

      return win
        .html2canvas(document.querySelector(selector))
        .then((canvas) => canvas.toDataURL("image/png").split(",")[1]);
    },
    html2canvasBundle,
    selector
  );
};

const a11yChecksRunner: A11yChecksRunner<AxeResults> = async (evaluate) => {
  const axeCorePath = require.resolve("axe-core");

  const result = await esbuild.build({
    entryPoints: [axeCorePath],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "axe",
  });

  const axeBundle = result.outputFiles[0].text;

  return evaluate((bundle) => {
    const script = document.createElement("script");
    script.textContent = bundle;
    document.head.appendChild(script);
    script.remove(); 

    const win = window as Window & { axe?: typeof axe };
    if (!win.axe) {
      throw new Error("axe-core failed to load.");
    }

    return win.axe.run(document, {
      selectors: true,
      xpath: true,
    });
  }, axeBundle);
};

const a11yPatcher: A11yPatcher<AxeResults> = async (
  evaluate,
  results,
  shot
) => {
  const violations = [];

  for (const pass of [...results.passes, ...results.incomplete]) {
    for (const node of pass.nodes) {
      const selector = node.target[0].toString();
      if (!selector) continue;

      await evaluate(
        (selector, node) => {
          const el = window.document.querySelector(selector);

          (el as { __AXE_NODE?: axe.NodeResult }).__AXE_NODE = node;
          (el as { __AXE_V_NODE?: axe.VirtualNode }).__AXE_V_NODE = (
            window as any
          ).axe.utils.getNodeFromTree(
            (window as any).axe.utils.getFlattenedTree(),
            el.tagName === "img" ? el.parentElement : el
          );

          return null;
        },
        selector,
        node
      );
    }
  }

  const allViolations = results.violations.filter((v) =>
    SUPPORTED_RULES.includes(v.id as any)
  );

  const allNodes = allViolations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      node,
      violation,
    }))
  );
  console.log("To be fixed", { allNodes });

  const nodeBatchSize = 10;
  const processedNodes = [];
  for (let i = 0; i < allNodes.length; i += nodeBatchSize) {
    const nodeBatch = allNodes.slice(i, i + nodeBatchSize);
    const batchResults = await Promise.all(
      nodeBatch.map(async ({ node, violation }) => {
        const selector = node.target?.[0].toString();
        if (!selector) {
          return null;
        }

        const screenshot = shot
          ? await shot(selector)
          : await takeScreenshot(evaluate, selector);

        if (!screenshot) return null;

        // asle save this to file
        writeFileSync(`./.eye/${selector}.png`, screenshot, {
          encoding: "base64",
        });

        const prompt =
          "Analyze this HTML element image and provide an accessibility fix for the following issue:\n" +
          `${node.failureSummary}\n` +
          "Specify the exact HTML attribute and value needed to fix this accessibility violation. " +
          "Keep the fix minimal and standards-compliant. " +
          "Describe the specific content, function or purpose of this element in a brief, clear way. " +
          "Do not describe general HTML or accessibility concepts or changes.";

        try {
          const { object } = await generateObject({
            mode: "json",
            model: openrouter("google/gemini-2.0-flash-lite-001"),
            // model: ollama("PetrosStav/gemma3-tools:12b"),
            schema: z.object({
              attributeName: z
                .string()
                .describe(
                  "Required HTML accessibility attribute name to fix the violation"
                ),
              attributeValue: z
                .string()
                .describe(
                  "Standards-compliant value for the accessibility attribute"
                ),
              description: z
                .string()
                .describe(
                  "Brief description of the element's purpose and role"
                ),
            }),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image",
                    image: screenshot,
                  },
                ],
              },
            ],
          });

          await evaluate(
            (
              { attributeName, attributeValue, description },
              selector,
              node
            ) => {
              const el = window.document.querySelector(selector);
              el.setAttribute(attributeName, attributeValue);
              const existingDescription =
                el.getAttribute("aria-description") || "";
              el.setAttribute(
                "aria-description",
                existingDescription
                  ? `${existingDescription} ${description}`
                  : description
              );
              (el as any).__AXE_NODE = node;
              (el as { __AXE_V_NODE?: axe.VirtualNode }).__AXE_V_NODE = (
                window as any
              ).axe.utils.getNodeFromTree(
                (window as any).axe.utils.getFlattenedTree(),
                el.tagName === "img" ? el.parentElement : el
              );

              return null;
            },
            object,
            selector,
            node
          );

          return { fix: object, selector, description: object.description };
        } catch (error) {
          console.error("Error generating accessibility fixes:", error);
          return null;
        }
      })
    );
    processedNodes.push(...batchResults.filter(Boolean));
  }
  violations.push(...processedNodes);
  console.log("Fixed", { violations });
  return violations;
};

const a11yPatcherPuzzle: A11yPatcher<AxeResults> = async (
  evaluate,
  results,
  shot
) => {
  const violations = [];

  for (const pass of [...results.passes, ...results.incomplete]) {
    for (const node of pass.nodes) {
      const selector = node.target[0].toString();
      if (!selector) continue;

      await evaluate(
        (selector, node) => {
          const el = window.document.querySelector(selector);

          (el as { __AXE_NODE?: axe.NodeResult }).__AXE_NODE = node;
          (el as { __AXE_V_NODE?: axe.VirtualNode }).__AXE_V_NODE = (
            window as any
          ).axe.utils.getNodeFromTree(
            (window as any).axe.utils.getFlattenedTree(),
            el.tagName === "img" ? el.parentElement : el
          );

          return null;
        },
        selector,
        node
      );
    }
  }

  const allViolations = results.violations.filter((v) =>
    SUPPORTED_RULES.includes(v.id as any)
  );

  const allNodes = allViolations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      node,
      violation,
    }))
  );

  const processedNodes = [];

  const [fullPage, puzzed] = await cropAndConcatElements(shot, evaluate, {
    elementSelectors: allNodes.map((e) => e.node.target[0].toString()),
    outputDir: "./.eye",
    border: {
      width: 20,
      color: "#FF0000", 
    },
    normalizeHeight: true,
  });

  const { object: objects } = await generateObject({
    mode: "json",
    model: venus("qwen2.5-vl-32b-instruct"),
    output: "array",
    schema: z.object({
      attributeName: z
        .string()
        .describe(
          "Required HTML accessibility attribute name to fix the violation"
        ),
      attributeValue: z
        .string()
        .describe("Standards-compliant value for the accessibility attribute"),
      description: z
        .string()

        .describe("Brief description of the element's purpose and role"),
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",

            text: `I need help fixing accessibility violations on this webpage. Please analyze the highlighted elements and provide the necessary ARIA attributes to make them accessible. OUTPUT JSON Content ONLY, NEVER output \`\`\`json`,
          },
          {
            type: "image",
            image: fullPage,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `The elements marked with red borders have accessibility issues that need to be addressed. Here are the specific violations:\n\n${allNodes
                .map(
                  (node) =>
                    `selector: ${node.node.target?.[0].toString()}, failureSummary: ${
                      node.node.failureSummary
                    }`
                )
                .join("\n")}` +
              `\n\nFor each **red border highlighted** element, provide:\n` +
              `1. The specific ARIA attribute name needed to fix the violation\n` +
              `2. The technically correct attribute value that meets WCAG standards\n` +
              `3. A clear, concise description of the element's semantic purpose and role`,
          },
          // ...(puzzed
          //   ? [
          //       {
          //         type: "image",
          //         image: puzzed,
          //       },
          //     ]
          //   : []),
        ],
      },
    ],
  });
  for (let i = 0; i < allNodes.length; i += 1) {
    const object = objects[i];
    const node = allNodes[i].node;
    const selector = node.target?.[0].toString();
    if (!selector || !object) {
      console.log("Skipping node", { selector, object });
      continue;
    }

    try {
      await evaluate(
        ({ attributeName, attributeValue, description }, selector, node) => {
          const el = window.document.querySelector(selector);
          el.setAttribute(attributeName, attributeValue);
          const existingDescription = el.getAttribute("aria-description") || "";
          el.setAttribute(
            "aria-description",
            existingDescription
              ? `${existingDescription} ${description}`
              : description
          );
          (el as any).__AXE_NODE = node;
          (el as { __AXE_V_NODE?: axe.VirtualNode }).__AXE_V_NODE = (
            window as any
          ).axe.utils.getNodeFromTree(
            (window as any).axe.utils.getFlattenedTree(),
            el.tagName === "img" ? el.parentElement : el
          );

          return null;
        },
        object,
        selector,
        node
      );

      processedNodes.push({
        selector,
        description: object.description,
      });
    } catch (error) {
      console.error("Error generating accessibility fixes:", error);
      return null;
    }
  }

  violations.push(...processedNodes);
  console.log("Fixed", { violations });
  return violations;
};

const a11yTreeGenerator: A11yTreeGenerator = async (
  evaluate,
  serializedAXNode
) => {
  const enrichAccessibilityNode = async (node: SerializedAXNode | null) => {
    if (!node) return null;

    let resNode: ElementDescriptionFromDOM = null;

    const elementHandle = await node.elementHandle();

    if (elementHandle) {
      const info = await elementHandle.evaluate((el, node) => {
        let [axeNode, axeVDOMNode] = [
          (el as { __AXE_NODE?: axe.NodeResult }).__AXE_NODE,
          (el as { __AXE_V_NODE?: axe.VirtualNode }).__AXE_V_NODE,
        ];
        if (!axeNode || !axeVDOMNode) {
          axeVDOMNode = (el.parentElement as any)?.__AXE_V_NODE;
          axeNode = (el.parentElement as any)?.__AXE_NODE;
          el = el.parentElement;
        }

        return {
          props: axeVDOMNode?.props,
          a11y: {
            ...node,
            children: undefined,
            // @ts-ignore
            isFocusable: axeVDOMNode?.isFocusable,
          },
          content: {
            html: axeNode?.html?.replace(/\n/g, "").trim(),
            text: el?.textContent?.replace(/\n/g, "").trim(),
          },
          domMetadata: {
            boundingBox: {
              top: axeVDOMNode?.boundingClientRect?.top,
              left: axeVDOMNode?.boundingClientRect?.left,
              width: axeVDOMNode?.boundingClientRect?.width,
              height: axeVDOMNode?.boundingClientRect?.height,
            },
            boundingBoxCenter: {
              x: Math.round(
                axeVDOMNode?.boundingClientRect?.left +
                  axeVDOMNode?.boundingClientRect?.width / 2
              ),
              y: Math.round(
                axeVDOMNode?.boundingClientRect?.top +
                  axeVDOMNode?.boundingClientRect?.height / 2
              ),
            },
            id: el?.id,
            selector: axeNode?.target[0].toString(),
          },
        } as ElementDescriptionFromDOM;
      }, node);

      resNode = info;
      await elementHandle.dispose();
    }

    if (node.children) {
      const enrichedChildren = [];
      for (const child of node.children) {
        const enrichedChild = await enrichAccessibilityNode(child);
        if (enrichedChild) {
          enrichedChildren.push(enrichedChild);
        }
      }
      resNode.children = enrichedChildren;
    }

    return resNode;
  };

  const enhancedTree = await enrichAccessibilityNode(serializedAXNode);
  return enhancedTree;
};

const getPage = async () => {
  const getBrowserWSUrl = async () => {
    try {
      const response = await fetch("http://localhost:9222/json/version");
      const data = await response.json();
      return data.webSocketDebuggerUrl;
    } catch (e) {
      console.error(`Error getting WebSocket URL: ${e}`);
      console.error(
        "Make sure Chrome/Chromium is running with --remote-debugging-port=9222"
      );
      return null;
    }
  };

  const wsUrl = await getBrowserWSUrl();
  if (!wsUrl) {
    throw new Error("Could not get WebSocket URL");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsUrl,
    defaultViewport: {
      width: 1680,
      height: 1080,
    },
  });
  let page = (await browser.pages())[0];
  await page.close();
  page = await browser.newPage();
  await page.goto("https://google.com", { waitUntil: "networkidle2" });
  return page;
};
const runAnalysis = async () => {
  const page = await getPage();

  // @ts-expect-error
  const evaluate: EvaluateFunc = (func, ...args: any[]) => {
    return page.evaluate(func, ...args);
  };

  const shot = async (selector) => {
    const ele = await page.$(selector);
    return ele.screenshot({ encoding: "base64" });
  };

  // Analyze accessibility
  const results = await a11yChecksRunner(evaluate);
  // Patch accessibility violations
  // const fixes = await a11yPatcher(evaluate, results);
  const fixes = await a11yPatcherPuzzle(evaluate, results, shot);

  // Generate patched accessibility tree
  const snapshot = await page.accessibility.snapshot();
  const a11ySnapshot = await a11yTreeGenerator(evaluate, snapshot);

  await page.evaluate(
    (a11ySnapshot, fixes) => {
      (window as any).a11ySnapshot = { ...a11ySnapshot, fixes };
    },
    a11ySnapshot,
    fixes
  );

  console.log("End");
};

runAnalysis();
