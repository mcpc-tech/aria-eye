// @ts-nocheck
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
    throw new Error("Can only capture aria snapshot of Element nodes.");
  const dfs = (node, ref) => {
    if (!node) return null;
    if (node.ref === ref) return node;
    for (const child of node.children || []) {
      const found = dfs(child, ref);
      if (found) return found;
    }
    return null;
  };
  this._lastAriaSnapshot = generateAriaTree(node as Element, options);

  this._getElementByRefBackup = (ref) => {
    return dfs(this._lastAriaSnapshot.root, ref)?.element;
  };
  this._getElementByRef = (ref) => {
    return dfs(this._lastAriaSnapshot.root, ref)?.element;
  };

  this._lastAriaSnapshotRender = renderAriaTree(
    this._lastAriaSnapshot,
    options
  );
  return this._lastAriaSnapshotRender;
}

export function ariaSnapshotJSON(
  node: Node,
  options?: { mode?: "raw" | "regex"; forAI?: boolean; refPrefix?: string }
): string {
  if (node.nodeType !== Node.ELEMENT_NODE)
    throw this.createStacklessError(
      "Can only capture aria snapshot of Element nodes."
    );
  const dfs = (node, ref) => {
    if (!node) return null;
    if (node.ref === ref) return node;
    for (const child of node.children || []) {
      const found = dfs(child, ref);
      if (found) return found;
    }
    return null;
  };
  this._lastAriaSnapshot = generateAriaTree(node as Element, options);

  this._getElementByRefBackup = (ref) => {
    return dfs(this._lastAriaSnapshot.root, ref)?.element;
  };
  this._getElementByRef = (ref) => {
    const element = this._lastAriaSnapshot?.elements.get(ref);
    return element;
  };

  this._lastAriaSnapshotJSONRender = renderAriaTreeAsJSON(
    this._lastAriaSnapshot,
    options
  );

  return this._lastAriaSnapshotJSONRender;
}

export { generateAriaTree };
