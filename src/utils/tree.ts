interface TreeNode {
  children?: TreeNode[];
}

export function flattenTreeDFS<T extends TreeNode>(
  node: T,
  array: T[] = []
): T[] {
  array.push(node);

  if (node.children) {
    for (const child of node.children) {
      flattenTreeDFS(child, array);
    }
  }

  Reflect.deleteProperty(node as object, "children");

  return array;
}
