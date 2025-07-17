/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  escapeRegExp,
  longestCommonSubstring,
  normalizeWhiteSpace,
} from "@isomorphic/stringUtils";

import {
  box,
  getElementComputedStyle,
  getGlobalOptions,
  isElementVisible,
} from "./domUtils";
import * as roleUtils from "./roleUtils";
import { yamlEscapeKeyIfNeeded, yamlEscapeValueIfNeeded } from "./yaml";
import { BROWSER_ACTIONS } from "../utils/isomorphic/browserActions";

import type {
  AriaProps,
  AriaRegex,
  AriaRole,
  AriaTemplateNode,
  AriaTemplateRoleNode,
  AriaTemplateTextNode,
} from "@isomorphic/ariaSnapshot";
import type { Box } from "./domUtils";

export type AriaNode = AriaProps & {
  role: AriaRole | "fragment" | "iframe";
  name: string;
  ref?: string;
  children: (AriaNode | string)[];
  element: Element;
  box: Box;
  receivesPointerEvents: boolean;
  props: Record<string, string>;
};

export type AriaSnapshot = {
  root: AriaNode;
  elements: Map<string, Element>;
};

type AriaRef = {
  role: string;
  name: string;
  ref: string;
};

let lastRef = 0;

export function generateAriaTree(
  rootElement: Element,
  options?: { forAI?: boolean; refPrefix?: string }
): AriaSnapshot {
  const visited = new Set<Node>();

  const snapshot: AriaSnapshot = {
    root: {
      role: "fragment",
      name: "",
      children: [],
      element: rootElement,
      props: {},
      box: box(rootElement),
      receivesPointerEvents: true,
    },
    elements: new Map<string, Element>(),
  };

  const visit = (ariaNode: AriaNode, node: Node) => {
    if (visited.has(node)) return;
    visited.add(node);

    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      const text = node.nodeValue;
      // <textarea>AAA</textarea> should not report AAA as a child of the textarea.
      if (ariaNode.role !== "textbox" && text)
        ariaNode.children.push(node.nodeValue || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    let isVisible = !roleUtils.isElementHiddenForAria(element);
    if (options?.forAI) isVisible = isVisible || isElementVisible(element);
    if (!isVisible) return;

    const ariaChildren: Element[] = [];
    if (element.hasAttribute("aria-owns")) {
      const ids = element.getAttribute("aria-owns")!.split(/\s+/);
      for (const id of ids) {
        const ownedElement = rootElement.ownerDocument.getElementById(id);
        if (ownedElement) ariaChildren.push(ownedElement);
      }
    }

    const childAriaNode = toAriaNode(element, options);
    if (childAriaNode) {
      if (childAriaNode.ref) {
        snapshot.elements.set(childAriaNode.ref, element);
      }
      ariaNode.children.push(childAriaNode);
    }
    processElement(childAriaNode || ariaNode, element, ariaChildren);
  };

  function processElement(
    ariaNode: AriaNode,
    element: Element,
    ariaChildren: Element[] = []
  ) {
    // Surround every element with spaces for the sake of concatenated text nodes.
    const display = getElementComputedStyle(element)?.display || "inline";
    const treatAsBlock =
      display !== "inline" || element.nodeName === "BR" ? " " : "";
    if (treatAsBlock) ariaNode.children.push(treatAsBlock);

    ariaNode.children.push(roleUtils.getCSSContent(element, "::before") || "");
    const assignedNodes =
      element.nodeName === "SLOT"
        ? (element as HTMLSlotElement).assignedNodes()
        : [];
    if (assignedNodes.length) {
      for (const child of assignedNodes) visit(ariaNode, child);
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (!(child as Element | Text).assignedSlot) visit(ariaNode, child);
      }
      if (element.shadowRoot) {
        for (
          let child = element.shadowRoot.firstChild;
          child;
          child = child.nextSibling
        )
          visit(ariaNode, child);
      }
    }

    for (const child of ariaChildren) visit(ariaNode, child);

    ariaNode.children.push(roleUtils.getCSSContent(element, "::after") || "");

    if (treatAsBlock) ariaNode.children.push(treatAsBlock);

    if (
      ariaNode.children.length === 1 &&
      ariaNode.name === ariaNode.children[0]
    )
      ariaNode.children = [];

    if (ariaNode.role === "link" && element.hasAttribute("href")) {
      const href = element.getAttribute("href")!;
      ariaNode.props["url"] = href;
    }
  }

  roleUtils.beginAriaCaches();
  try {
    visit(snapshot.root, rootElement);
  } finally {
    roleUtils.endAriaCaches();
  }

  normalizeStringChildren(snapshot.root);
  normalizeGenericRoles(snapshot.root);
  return snapshot;
}

function ariaRef(
  element: Element,
  role: string,
  name: string,
  options?: { forAI?: boolean; refPrefix?: string }
): string | undefined {
  if (!options?.forAI) return undefined;

  let ariaRef: AriaRef | undefined;
  ariaRef = (element as any)._ariaRef;
  if (!ariaRef || ariaRef.role !== role || ariaRef.name !== name) {
    ariaRef = { role, name, ref: (options?.refPrefix ?? "") + "e" + ++lastRef };
    (element as any)._ariaRef = ariaRef;
  }
  return ariaRef.ref;
}

function toAriaNode(
  element: Element,
  options?: { forAI?: boolean; refPrefix?: string }
): AriaNode | null {
  if (element.nodeName === "IFRAME") {
    return {
      role: "iframe",
      name: "",
      ref: ariaRef(element, "iframe", "", options),
      children: [],
      props: {},
      element,
      box: box(element),
      receivesPointerEvents: true,
    };
  }

  const defaultRole = options?.forAI ? "generic" : null;
  const role = roleUtils.getAriaRole(element) ?? defaultRole;
  if (!role || role === "presentation" || role === "none") return null;

  const name = normalizeWhiteSpace(
    roleUtils.getElementAccessibleName(element, false) || ""
  );
  const receivesPointerEvents = roleUtils.receivesPointerEvents(element);

  const result: AriaNode = {
    role,
    name,
    ref: ariaRef(element, role, name, options),
    children: [],
    props: {},
    element,
    box: box(element),
    receivesPointerEvents,
  };

  if (roleUtils.kAriaCheckedRoles.includes(role))
    result.checked = roleUtils.getAriaChecked(element);

  if (roleUtils.kAriaDisabledRoles.includes(role))
    result.disabled = roleUtils.getAriaDisabled(element);

  if (roleUtils.kAriaExpandedRoles.includes(role))
    result.expanded = roleUtils.getAriaExpanded(element);

  if (roleUtils.kAriaLevelRoles.includes(role))
    result.level = roleUtils.getAriaLevel(element);

  if (roleUtils.kAriaPressedRoles.includes(role))
    result.pressed = roleUtils.getAriaPressed(element);

  if (roleUtils.kAriaSelectedRoles.includes(role))
    result.selected = roleUtils.getAriaSelected(element);

  // Set clickable property based on element's ability to receive pointer events and role
  result.clickable =
    receivesPointerEvents &&
    ([
      "button",
      "link",
      "menuitem",
      "tab",
      "option",
      "checkbox",
      "radio",
      "switch",
    ].includes(role) ||
      element.hasAttribute("onclick") ||
      (element.hasAttribute("role") &&
        ["button", "link"].includes(element.getAttribute("role") || "")));

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    if (
      element.type !== "checkbox" &&
      element.type !== "radio" &&
      (element.type !== "file" || getGlobalOptions().inputFileRoleTextbox)
    )
      result.children = [element.value];
  }

  return result;
}

function normalizeGenericRoles(node: AriaNode) {
  const normalizeChildren = (node: AriaNode) => {
    const result: (AriaNode | string)[] = [];
    for (const child of node.children || []) {
      if (typeof child === "string") {
        result.push(child);
        continue;
      }
      const normalized = normalizeChildren(child);
      result.push(...normalized);
    }

    // Only remove generic that encloses one element, logical grouping still makes sense, even if it is not ref-able.
    const removeSelf =
      node.role === "generic" &&
      result.length <= 1 &&
      result.every((c) => typeof c !== "string" && receivesPointerEvents(c));
    if (removeSelf) return result;
    node.children = result;
    return [node];
  };

  normalizeChildren(node);
}

function normalizeStringChildren(rootA11yNode: AriaNode) {
  const flushChildren = (
    buffer: string[],
    normalizedChildren: (AriaNode | string)[]
  ) => {
    if (!buffer.length) return;
    const text = normalizeWhiteSpace(buffer.join(""));
    if (text) normalizedChildren.push(text);
    buffer.length = 0;
  };

  const visit = (ariaNode: AriaNode) => {
    const normalizedChildren: (AriaNode | string)[] = [];
    const buffer: string[] = [];
    for (const child of ariaNode.children || []) {
      if (typeof child === "string") {
        buffer.push(child);
      } else {
        flushChildren(buffer, normalizedChildren);
        visit(child);
        normalizedChildren.push(child);
      }
    }
    flushChildren(buffer, normalizedChildren);
    ariaNode.children = normalizedChildren.length ? normalizedChildren : [];
    if (
      ariaNode.children.length === 1 &&
      ariaNode.children[0] === ariaNode.name
    )
      ariaNode.children = [];
  };
  visit(rootA11yNode);
}

function matchesText(
  text: string,
  template: AriaRegex | string | undefined
): boolean {
  if (!template) return true;
  if (!text) return false;
  if (typeof template === "string") return text === template;
  return !!text.match(new RegExp(template.pattern));
}

function matchesTextNode(text: string, template: AriaTemplateTextNode) {
  return matchesText(text, template.text);
}

function matchesName(text: string, template: AriaTemplateRoleNode) {
  return matchesText(text, template.name);
}

export type MatcherReceived = {
  raw: string;
  regex: string;
};

export function matchesAriaTree(
  rootElement: Element,
  template: AriaTemplateNode
): { matches: AriaNode[]; received: MatcherReceived } {
  const snapshot = generateAriaTree(rootElement);
  const matches = matchesNodeDeep(snapshot.root, template, false, false);
  return {
    matches,
    received: {
      raw: renderAriaTree(snapshot, { mode: "raw" }),
      regex: renderAriaTree(snapshot, { mode: "regex" }),
    },
  };
}

export function getAllByAria(
  rootElement: Element,
  template: AriaTemplateNode
): Element[] {
  const root = generateAriaTree(rootElement).root;
  const matches = matchesNodeDeep(root, template, true, false);
  return matches.map((n) => n.element);
}

function matchesNode(
  node: AriaNode | string,
  template: AriaTemplateNode,
  isDeepEqual: boolean
): boolean {
  if (typeof node === "string" && template.kind === "text")
    return matchesTextNode(node, template);

  if (node === null || typeof node !== "object" || template.kind !== "role")
    return false;

  if (template.role !== "fragment" && template.role !== node.role) return false;
  if (template.checked !== undefined && template.checked !== node.checked)
    return false;
  if (template.disabled !== undefined && template.disabled !== node.disabled)
    return false;
  if (template.expanded !== undefined && template.expanded !== node.expanded)
    return false;
  if (template.level !== undefined && template.level !== node.level)
    return false;
  if (template.pressed !== undefined && template.pressed !== node.pressed)
    return false;
  if (template.selected !== undefined && template.selected !== node.selected)
    return false;
  if (!matchesName(node.name, template)) return false;
  if (!matchesText(node.props.url, template.props?.url)) return false;

  // Proceed based on the container mode.
  if (template.containerMode === "contain")
    return containsList(node.children || [], template.children || []);
  if (template.containerMode === "equal")
    return listEqual(node.children || [], template.children || [], false);
  if (template.containerMode === "deep-equal" || isDeepEqual)
    return listEqual(node.children || [], template.children || [], true);
  return containsList(node.children || [], template.children || []);
}

function listEqual(
  children: (AriaNode | string)[],
  template: AriaTemplateNode[],
  isDeepEqual: boolean
): boolean {
  if (template.length !== children.length) return false;
  for (let i = 0; i < template.length; ++i) {
    if (!matchesNode(children[i], template[i], isDeepEqual)) return false;
  }
  return true;
}

function containsList(
  children: (AriaNode | string)[],
  template: AriaTemplateNode[]
): boolean {
  if (template.length > children.length) return false;
  const cc = children.slice();
  const tt = template.slice();
  for (const t of tt) {
    let c = cc.shift();
    while (c) {
      if (matchesNode(c, t, false)) break;
      c = cc.shift();
    }
    if (!c) return false;
  }
  return true;
}

function matchesNodeDeep(
  root: AriaNode,
  template: AriaTemplateNode,
  collectAll: boolean,
  isDeepEqual: boolean
): AriaNode[] {
  const results: AriaNode[] = [];
  const visit = (node: AriaNode | string, parent: AriaNode | null): boolean => {
    if (matchesNode(node, template, isDeepEqual)) {
      const result = typeof node === "string" ? parent : node;
      if (result) results.push(result);
      return !collectAll;
    }
    if (typeof node === "string") return false;
    for (const child of node.children || []) {
      if (visit(child, node)) return true;
    }
    return false;
  };
  visit(root, null);
  return results;
}

export function renderAriaTree(
  ariaSnapshot: AriaSnapshot,
  options?: { mode?: "raw" | "regex"; forAI?: boolean }
): string {
  const lines: string[] = [];
  const includeText =
    options?.mode === "regex" ? textContributesInfo : () => true;
  const renderString =
    options?.mode === "regex" ? convertToBestGuessRegex : (str: string) => str;
  const visit = (
    ariaNode: AriaNode | string,
    parentAriaNode: AriaNode | null,
    indent: string
  ) => {
    if (typeof ariaNode === "string") {
      if (parentAriaNode && !includeText(parentAriaNode, ariaNode)) return;
      const text = yamlEscapeValueIfNeeded(renderString(ariaNode));
      if (text) lines.push(indent + "- text: " + text);
      return;
    }

    let key = ariaNode.role;
    // Yaml has a limit of 1024 characters per key, and we leave some space for role and attributes.
    if (ariaNode.name && ariaNode.name.length <= 900) {
      const name = renderString(ariaNode.name);
      if (name) {
        const stringifiedName =
          name.startsWith("/") && name.endsWith("/")
            ? name
            : JSON.stringify(name);
        key += " " + stringifiedName;
      }
    }
    if (ariaNode.checked === "mixed") key += ` [checked=mixed]`;
    if (ariaNode.checked === true) key += ` [checked]`;
    if (ariaNode.clickable) key += ` [clickable]`;
    if (ariaNode.disabled) key += ` [disabled]`;
    if (ariaNode.expanded) key += ` [expanded]`;
    if (ariaNode.level) key += ` [level=${ariaNode.level}]`;
    if (ariaNode.pressed === "mixed") key += ` [pressed=mixed]`;
    if (ariaNode.pressed === true) key += ` [pressed]`;
    if (ariaNode.selected === true) key += ` [selected]`;
    if (options?.forAI && receivesPointerEvents(ariaNode)) {
      const ref = ariaNode.ref;
      const cursor = hasPointerCursor(ariaNode) ? " [cursor=pointer]" : "";
      if (ref) key += ` [ref=${ref}]${cursor}`;
    }

    const escapedKey = indent + "- " + yamlEscapeKeyIfNeeded(key);
    const hasProps = !!Object.keys(ariaNode.props).length;
    if (!ariaNode.children.length && !hasProps) {
      lines.push(escapedKey);
    } else if (
      ariaNode.children.length === 1 &&
      typeof ariaNode.children[0] === "string" &&
      !hasProps
    ) {
      const text = includeText(ariaNode, ariaNode.children[0])
        ? renderString(ariaNode.children[0] as string)
        : null;
      if (text) lines.push(escapedKey + ": " + yamlEscapeValueIfNeeded(text));
      else lines.push(escapedKey);
    } else {
      lines.push(escapedKey + ":");
      for (const [name, value] of Object.entries(ariaNode.props))
        lines.push(
          indent + "  - /" + name + ": " + yamlEscapeValueIfNeeded(value)
        );
      for (const child of ariaNode.children || [])
        visit(child, ariaNode, indent + "  ");
    }
  };

  const ariaNode = ariaSnapshot.root;
  if (ariaNode.role === "fragment") {
    // Render fragment.
    for (const child of ariaNode.children || []) visit(child, ariaNode, "");
  } else {
    visit(ariaNode, null, "");
  }
  return lines.join("\n");
}

/**
 * Renders an Aria snapshot into a JSON string that includes semantic descriptions.
 * All logic is encapsulated within this function; it is the single entry point
 * from an external perspective.
 *
 * @param ariaSnapshot The Aria snapshot to render.
 * @param options Rendering options (mode, forAI).
 * @returns A string containing the JSON representation of the Aria tree.
 */
export function renderAriaTreeAsJSON(
  ariaSnapshot: AriaSnapshot,
  options?: { mode?: "raw" | "regex"; forAI?: boolean }
): string {
  const includeText =
    options?.mode === "regex" ? textContributesInfo : () => true;

  const renderString =
    options?.mode === "regex" ? convertToBestGuessRegex : (str: string) => str;

  /**
   * [Internal Helper Function] Generates supported actions for an actionable element
   * Based on actual browser actions from action.ts and element properties
   */
  const generateSupportedActions = (ariaNode: AriaNode): string[] => {
    const actions: string[] = [];
    const {
      role,
      name,
      checked,
      clickable,
      disabled,
      expanded,
      pressed,
      selected,
      ref,
    } = ariaNode;

    // Only generate actions for elements that receive pointer events and have refs
    if (!receivesPointerEvents(ariaNode) || !ref) {
      return actions;
    }

    // Basic actions available for most interactive elements
    if (clickable) {
      actions.push(BROWSER_ACTIONS.CLICK);
    }
    actions.push(BROWSER_ACTIONS.HOVER);

    // Role-specific actions based on element capabilities
    switch (role) {
      case "textbox":
      case "searchbox":
        actions.push(BROWSER_ACTIONS.TYPE);
        break;

      case "combobox":
        // Comboboxes support both typing and option selection
        actions.push(BROWSER_ACTIONS.TYPE, BROWSER_ACTIONS.SELECT_OPTION);
        break;

      case "button":
        // Buttons can be clicked and can receive key presses
        actions.push(BROWSER_ACTIONS.PRESS_KEY);
        break;

      case "checkbox":
      case "radio":
      case "switch":
        // These elements can be toggled via click, state-aware
        if (checked !== undefined) {
          // Element supports checked state
          actions.push(BROWSER_ACTIONS.CLICK);
        }
        break;

      case "link":
        // Links are clickable and may support drag operations
        actions.push(BROWSER_ACTIONS.DRAG);
        break;

      case "listbox":
      case "option":
        actions.push(BROWSER_ACTIONS.SELECT_OPTION);
        break;

      case "slider":
      case "spinbutton":
        // Sliders can be interacted with via type or click
        actions.push(BROWSER_ACTIONS.TYPE);
        break;

      case "menuitem":
      case "tab":
        // Menu items and tabs can be activated via click or key press
        actions.push(BROWSER_ACTIONS.PRESS_KEY);
        break;
    }

    // Conditional actions based on element state/properties
    if (disabled) {
      // Disabled elements cannot be interacted with (except hover)
      return [BROWSER_ACTIONS.HOVER];
    }

    // File input detection (usually has type="file" in the actual DOM)
    if (role === "textbox" && name && name.toLowerCase().includes("file")) {
      actions.push(BROWSER_ACTIONS.FILE_UPLOAD);
    }

    // All interactive elements can potentially be drag sources
    if (actions.length > 0) {
      actions.push(BROWSER_ACTIONS.DRAG);
    }

    // Remove duplicates and return
    return [...new Set(actions)];
  };

  /**
   * [Internal Helper Function] Generates a rich, natural-language
   * description for a single AriaNode.
   */
  const generateDescriptivePrompt = (
    // Signature is unchanged, options is in scope
    ariaNode: AriaNode,
    parentContext: string
  ): string => {
    const {
      role,
      name,
      checked,
      clickable,
      disabled,
      expanded,
      pressed,
      selected,
      ref,
    } = ariaNode;
    const sentences: Array<string> = [];
    const renderedName = name ? renderString(name) : "";

    // 1. Core Identity
    sentences.push(
      `This is a ${role}${renderedName ? ` named \"${renderedName}\"` : ""}.`
    );

    // 2. Function/Purpose
    let purpose = roleUtils.getRolePurpose(role);
    if (purpose) sentences.push(purpose);

    // 3. Location/Context
    if (parentContext) {
      sentences.push(`It is located inside ${parentContext}.`);
    } else {
      sentences.push(`It is a top-level element on the page.`);
    }

    // 4. State
    const states: Array<string> = [];
    if (checked !== undefined) states.push(checked ? "checked" : "unchecked");
    if (clickable !== undefined)
      states.push(clickable ? "clickable" : "not clickable");
    if (expanded !== undefined)
      states.push(expanded ? "expanded" : "collapsed");
    if (disabled) states.push("disabled");
    if (pressed) states.push("pressed");
    if (selected) states.push("selected");

    if (states.length > 0) {
      sentences.push(`Currently, its state is ${states.join(" and ")}.`);
    }

    // 5. Technical Attributes (for AI)
    const technicalAttrs: Record<string, any> = {};
    if (ref) technicalAttrs.ref = ref;
    if (Object.keys(technicalAttrs).length > 0) {
      sentences.push(`Attributes: ${JSON.stringify(technicalAttrs)}`);
    }

    return sentences.join(" ");
  };

  /**
   * [Internal Recursive Function] Recursively builds the JSON object tree.
   */
  const buildJsonObject = (
    ariaNode: AriaNode | string,
    parentContext: string
  ): any => {
    // Handle text nodes
    if (typeof ariaNode === "string") {
      if (!includeText({} as AriaNode, ariaNode)) {
        return null;
      }
      const text = renderString(ariaNode);
      if (text) {
        const prompt = "text: " + yamlEscapeValueIfNeeded(text);
        const descriptivePrompt = `This is the text content "${text}" located inside ${parentContext}.`;
        return {
          text: text,
          prompt: prompt,
          descriptivePrompt: descriptivePrompt,
        };
      }
      return null;
    }

    // Handle AriaNode objects
    const jsonNode: any = {
      role: ariaNode.role,
      descriptivePrompt: generateDescriptivePrompt(ariaNode, parentContext),
      name: ariaNode.name,
      props: { ...ariaNode.props },
    };

    // Add supported actions for interactive elements
    if (receivesPointerEvents(ariaNode)) {
      const supportedActions = generateSupportedActions(ariaNode);
      if (supportedActions.length > 0) {
        jsonNode.supportedActions = supportedActions;
      }
    }

    // Populate other properties (name, checked, disabled, etc.)
    if (ariaNode.name) {
      const name = renderString(ariaNode.name);
      if (name) jsonNode.name = name;
    }
    if (ariaNode.checked !== undefined) jsonNode.checked = ariaNode.checked;
    if (ariaNode.clickable !== undefined)
      jsonNode.clickable = ariaNode.clickable;
    if (ariaNode.disabled) jsonNode.disabled = ariaNode.disabled;
    if (ariaNode.expanded) jsonNode.expanded = ariaNode.expanded;
    if (ariaNode.level) jsonNode.level = ariaNode.level;
    if (ariaNode.pressed !== undefined) jsonNode.pressed = ariaNode.pressed;
    if (ariaNode.selected) jsonNode.selected = ariaNode.selected;

    // AI-related properties
    if (options?.forAI && receivesPointerEvents(ariaNode)) {
      if (ariaNode.ref) jsonNode.ref = ariaNode.ref;
      if (hasPointerCursor(ariaNode)) jsonNode.cursor = "pointer";
    }

    // Generate the YAML-style 'prompt' property
    let key = ariaNode.role;
    if (ariaNode.name && ariaNode.name.length <= 900) {
      const name = renderString(ariaNode.name);
      if (name) {
        const stringifiedName =
          name.startsWith("/") && name.endsWith("/")
            ? name
            : JSON.stringify(name);
        key += " " + stringifiedName;
      }
    }

    // Append states to the key string
    if (ariaNode.checked === "mixed") key += ` [checked=mixed]`;
    else if (ariaNode.checked === true) key += ` [checked]`;
    if (ariaNode.clickable) key += ` [clickable]`;
    if (ariaNode.disabled) key += ` [disabled]`;
    if (ariaNode.expanded) key += ` [expanded]`;
    if (ariaNode.level) key += ` [level=${ariaNode.level}]`;
    if (ariaNode.pressed === "mixed") key += ` [pressed=mixed]`;
    else if (ariaNode.pressed === true) key += ` [pressed]`;
    if (ariaNode.selected === true) key += ` [selected]`;
    if (options?.forAI && receivesPointerEvents(ariaNode)) {
      const ref = ariaNode.ref;
      const cursor = hasPointerCursor(ariaNode) ? " [cursor=pointer]" : "";
      if (ref) key += ` [ref=${ref}]${cursor}`;
    }

    // Prompt assignment logic
    const escapedKey = yamlEscapeKeyIfNeeded(key);
    const hasProps = !!Object.keys(ariaNode.props).length;
    if (!ariaNode.children.length && !hasProps) {
      jsonNode.prompt = escapedKey;
    } else if (
      ariaNode.children.length === 1 &&
      typeof ariaNode.children[0] === "string" &&
      !hasProps
    ) {
      const text = includeText(ariaNode, ariaNode.children[0])
        ? renderString(ariaNode.children[0] as string)
        : null;
      if (text)
        jsonNode.prompt = escapedKey + ": " + yamlEscapeValueIfNeeded(text);
      else jsonNode.prompt = escapedKey;
    } else {
      jsonNode.prompt = escapedKey + ":";
    }

    // Handle props
    if (Object.keys(ariaNode.props).length > 0) {
      jsonNode.props = { ...ariaNode.props };
    }

    // Recursively process child nodes
    if (ariaNode.children && ariaNode.children.length > 0) {
      const childContext = `the ${ariaNode.role}${
        ariaNode.name ? ` named "${renderString(ariaNode.name)}"` : ""
      }`;
      const children = ariaNode.children
        .map((child) => buildJsonObject(child, childContext))
        .filter((child) => child !== null);
      if (children.length > 0) {
        jsonNode.children = children;
      }
    }

    return jsonNode;
  };

  // ------------------- Main Function Logic Entry Point -------------------

  const ariaNode = ariaSnapshot.root;
  let resultObject: any;

  // Start recursion from the root node with an empty parent context
  if (ariaNode.role === "fragment" && ariaNode.children) {
    resultObject = ariaNode.children
      .map((child) => buildJsonObject(child, ""))
      .filter((child) => child !== null);
  } else {
    resultObject = buildJsonObject(ariaNode, "");
  }

  // Return the final JSON string
  return JSON.stringify(resultObject, null, 2);
}

function convertToBestGuessRegex(text: string): string {
  const dynamicContent = [
    // 2mb
    { regex: /\b[\d,.]+[bkmBKM]+\b/, replacement: "[\\d,.]+[bkmBKM]+" },
    // 2ms, 20s
    { regex: /\b\d+[hmsp]+\b/, replacement: "\\d+[hmsp]+" },
    { regex: /\b[\d,.]+[hmsp]+\b/, replacement: "[\\d,.]+[hmsp]+" },
    // Do not replace single digits with regex by default.
    // 2+ digits: [Issue 22, 22.3, 2.33, 2,333]
    { regex: /\b\d+,\d+\b/, replacement: "\\d+,\\d+" },
    { regex: /\b\d+\.\d{2,}\b/, replacement: "\\d+\\.\\d+" },
    { regex: /\b\d{2,}\.\d+\b/, replacement: "\\d+\\.\\d+" },
    { regex: /\b\d{2,}\b/, replacement: "\\d+" },
  ];

  let pattern = "";
  let lastIndex = 0;

  const combinedRegex = new RegExp(
    dynamicContent.map((r) => "(" + r.regex.source + ")").join("|"),
    "g"
  );
  text.replace(combinedRegex, (match, ...args) => {
    const offset = args[args.length - 2];
    const groups = args.slice(0, -2);
    pattern += escapeRegExp(text.slice(lastIndex, offset));
    for (let i = 0; i < groups.length; i++) {
      if (groups[i]) {
        const { replacement } = dynamicContent[i];
        pattern += replacement;
        break;
      }
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (!pattern) return text;

  pattern += escapeRegExp(text.slice(lastIndex));
  return String(new RegExp(pattern));
}

function textContributesInfo(node: AriaNode, text: string): boolean {
  if (!text.length) return false;

  if (!node.name) return true;

  if (node.name.length > text.length) return false;

  // Figure out if text adds any value. "longestCommonSubstring" is expensive, so limit strings length.
  const substr =
    text.length <= 200 && node.name.length <= 200
      ? longestCommonSubstring(text, node.name)
      : "";
  let filtered = text;
  while (substr && filtered.includes(substr))
    filtered = filtered.replace(substr, "");
  return filtered.trim().length / text.length > 0.1;
}

function receivesPointerEvents(ariaNode: AriaNode): boolean {
  return ariaNode.box.visible && ariaNode.receivesPointerEvents;
}

function hasPointerCursor(ariaNode: AriaNode): boolean {
  return ariaNode.box.style?.cursor === "pointer";
}
