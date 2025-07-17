/**
 * Unified content formatter for accessibility element descriptions
 * This module provides a centralized way to format element content for memory storage
 */

import { BrowserAction } from "./browserActions";

export interface ElementContent {
  action: BrowserAction;
  name: string;
  role: string;
  ref: string;
  additionalAttributes?: Record<string, any>;
}

/**
 * Formats element content in a consistent way across the application
 * @param element The element data to format
 * @returns Formatted content string
 */
export function formatElementContent(element: ElementContent): string {
  const { action, name, role, ref, additionalAttributes = {} } = element;
  
  // Base attributes that are always included
  const baseAttributes = { ref, action };
  
  // Merge with any additional attributes
  const allAttributes = { ...baseAttributes, ...additionalAttributes };
  
  // Generate the consistent content format
  return `${action} ${name} ${role}, with Attributes: ${JSON.stringify(allAttributes)}`;
}

/**
 * Creates a memory entry object with consistent formatting
 * @param element The element data to create entry for
 * @returns Memory entry object
 */
export function createMemoryEntry(element: ElementContent) {
  return {
    role: "user" as const,
    content: formatElementContent(element),
  };
}

/**
 * Batch create memory entries for multiple elements
 * @param elements Array of element data
 * @returns Array of memory entry objects
 */
export function createMemoryEntries(elements: ElementContent[]) {
  return elements.map(createMemoryEntry);
}

/**
 * Extracts elements with supported actions from an a11y tree node and creates memory entries
 * This is a type-safe replacement for the extractElementsWithActions function
 * @param node The a11y tree node to process
 * @returns Array of memory entry objects
 */
export function extractElementsFromA11yNode(node: any): Array<{ role: "user"; content: string }> {
  const elements: Array<{ role: "user"; content: string }> = [];

  if (
    node.ref &&
    node.supportedActions &&
    Array.isArray(node.supportedActions) &&
    node.supportedActions.length > 0
  ) {
    // Create a separate element for each supported action
    for (const action of node.supportedActions) {
      const elementContent: ElementContent = {
        action: action,
        name: node.name || "",
        role: node.role || "",
        ref: node.ref,
        // Include any additional properties from the node as attributes
        additionalAttributes: {
          ...(node.descriptivePrompt && { descriptivePrompt: node.descriptivePrompt }),
          ...(node.clickable !== undefined && { clickable: node.clickable }),
          ...(node.disabled !== undefined && { disabled: node.disabled }),
        }
      };

      elements.push(createMemoryEntry(elementContent));
    }
  }

  // Recursively process children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === "object" && child !== null && child.role) {
        elements.push(...extractElementsFromA11yNode(child));
      }
    }
  }

  return elements;
}
