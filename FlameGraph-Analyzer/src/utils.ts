import { FlameNode, ParsedFlamegraph } from "./types";

/**
 * Parses collapsed stack format:
 * func1;func2;func3 10
 */
export function parseCollapsed(text: string): ParsedFlamegraph {
  const root: FlameNode = { name: "root", value: 0, children: [] };
  const lines = text.trim().split("\n");

  for (const line of lines) {
    const match = line.match(/(.+)\s+(\d+)$/);
    if (!match) continue;

    const path = match[1].split(";");
    const value = parseInt(match[2], 10);

    let currentNode = root;
    root.value += value;

    for (const segment of path) {
      if (!currentNode.children) currentNode.children = [];
      let child = currentNode.children.find((c) => c.name === segment);
      if (!child) {
        child = { name: segment, value: 0, children: [] };
        currentNode.children.push(child);
      }
      child.value += value;
      currentNode = child;
    }
  }

  return { root, totalValue: root.value };
}

/**
 * Parses JSON format (hierarchical)
 */
export function parseJSON(json: any): ParsedFlamegraph {
  // Basic validation/normalization
  const normalize = (node: any): FlameNode => {
    return {
      name: node.name || node.label || "unknown",
      value: node.value || node.samples || 0,
      children: (node.children || []).map(normalize),
    };
  };

  const root = normalize(json);
  
  // Recalculate values if they are just leaf values
  const calculateTotal = (node: FlameNode): number => {
    if (!node.children || node.children.length === 0) return node.value;
    const childrenTotal = node.children.reduce((acc, child) => acc + calculateTotal(child), 0);
    node.value = Math.max(node.value, childrenTotal);
    return node.value;
  };

  calculateTotal(root);

  return { root, totalValue: root.value };
}

/**
 * Parses SVG flamegraph format (e.g. from inferno/Brendan Gregg)
 */
export function parseSVG(svgText: string): ParsedFlamegraph {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const frames = doc.getElementById("frames");
  if (!frames) throw new Error("Could not find 'frames' element in SVG");

  const groups = Array.from(frames.querySelectorAll("g"));
  const nodes: { name: string; value: number; x: number; w: number; y: number }[] = [];

  groups.forEach((g) => {
    const title = g.querySelector("title")?.textContent || "";
    const rect = g.querySelector("rect");
    if (!rect) return;

    // Title format: "name (samples, percentage)"
    const nameMatch = title.match(/(.+) \((\d+) samples/);
    const name = nameMatch ? nameMatch[1] : title;
    
    // Use fg:w or samples from title
    const samplesMatch = title.match(/\((\d+) samples/);
    const value = rect.getAttribute("fg:w") 
      ? parseInt(rect.getAttribute("fg:w")!, 10) 
      : (samplesMatch ? parseInt(samplesMatch[1], 10) : 0);

    const x = rect.getAttribute("fg:x") ? parseInt(rect.getAttribute("fg:x")!, 10) : 0;
    const w = value;
    const y = parseFloat(rect.getAttribute("y") || "0");

    nodes.push({ name, value, x, w, y });
  });

  if (nodes.length === 0) throw new Error("No flamegraph nodes found in SVG");

  // Group by Y level (depth)
  const yLevels = Array.from(new Set(nodes.map(n => n.y))).sort((a, b) => b - a);
  
  // Reconstruct tree
  // The bottom-most level (largest Y) is the root level
  const rootNodes = nodes.filter(n => n.y === yLevels[0]);
  
  // If multiple root nodes, create a virtual root
  let root: FlameNode;
  if (rootNodes.length === 1) {
    root = { name: rootNodes[0].name, value: rootNodes[0].value, children: [] };
    buildTree(root, rootNodes[0], nodes, yLevels, 0);
  } else {
    root = { name: "root", value: rootNodes.reduce((acc, n) => acc + n.value, 0), children: [] };
    rootNodes.forEach(rn => {
      const child = { name: rn.name, value: rn.value, children: [] };
      root.children!.push(child);
      buildTree(child, rn, nodes, yLevels, 0);
    });
  }

  return { root, totalValue: root.value };
}

function buildTree(current: FlameNode, currentMeta: any, allNodes: any[], yLevels: number[], levelIdx: number) {
  if (levelIdx >= yLevels.length - 1) return;
  
  const nextY = yLevels[levelIdx + 1];
  const childrenMeta = allNodes.filter(n => n.y === nextY && n.x >= currentMeta.x && (n.x + n.w) <= (currentMeta.x + currentMeta.w));
  
  childrenMeta.forEach(cm => {
    const child = { name: cm.name, value: cm.value, children: [] };
    if (!current.children) current.children = [];
    current.children.push(child);
    buildTree(child, cm, allNodes, yLevels, levelIdx + 1);
  });
}

export function formatForAI(node: FlameNode, totalValue: number, maxDepth: number, minPercent: number, currentDepth = 0): string {
  const percent = (node.value / totalValue) * 100;
  if (percent < minPercent) return "";
  if (currentDepth > maxDepth) return "";

  const indent = "  ".repeat(currentDepth);
  let result = `${indent}- [${percent.toFixed(2)}%] ${node.name}\n`;

  if (node.children && currentDepth < maxDepth) {
    for (const child of node.children) {
      result += formatForAI(child, totalValue, maxDepth, minPercent, currentDepth + 1);
    }
  }

  return result;
}
