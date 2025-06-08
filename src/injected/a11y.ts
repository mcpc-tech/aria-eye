import {
  generateAriaTree,
  renderAriaTree,
  renderAriaTreeAsJSON,
} from "./ariaSnapshot";

export function ariaSnapshot(
  node: Node,
  options?: { mode?: "raw" | "regex"; forAI?: boolean; refPrefix?: string }
): string {
  if (node.nodeType !== Node.ELEMENT_NODE)
    throw this.createStacklessError(
      "Can only capture aria snapshot of Element nodes."
    );
  this._lastAriaSnapshot = generateAriaTree(node as Element, options);
  return renderAriaTree(this._lastAriaSnapshot, options);
}

export function ariaSnapshotJSON(
  node: Node,
  options?: { mode?: "raw" | "regex"; forAI?: boolean; refPrefix?: string }
): string {
  if (node.nodeType !== Node.ELEMENT_NODE)
    throw this.createStacklessError(
      "Can only capture aria snapshot of Element nodes."
    );
  this._lastAriaSnapshot = generateAriaTree(node as Element, options);
  return renderAriaTreeAsJSON(this._lastAriaSnapshot, options);
}

export { generateAriaTree };
