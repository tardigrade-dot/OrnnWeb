export interface FlameNode {
  name: string;
  value: number;
  children?: FlameNode[];
  depth?: number;
  parent?: FlameNode;
}

export interface ParsedFlamegraph {
  root: FlameNode;
  totalValue: number;
}
