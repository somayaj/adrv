import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureSpec, ArchNodeKind } from "@adrv/core/browser";

export type ArchNodeData = {
  label: string;
  kind: ArchNodeKind;
  description?: string;
};

const KINDS = new Set<ArchNodeKind>([
  "client",
  "gateway",
  "service",
  "database",
  "queue",
  "worker",
  "external",
]);

function normalizeKind(raw: string): ArchNodeKind {
  const k = raw.toLowerCase().trim() as ArchNodeKind;
  return KINDS.has(k) ? k : "service";
}

const SIZE: Record<ArchNodeKind, { w: number; h: number }> = {
  client: { w: 132, h: 44 },
  gateway: { w: 148, h: 48 },
  service: { w: 156, h: 52 },
  database: { w: 128, h: 58 },
  queue: { w: 152, h: 46 },
  worker: { w: 140, h: 48 },
  external: { w: 136, h: 44 },
};

export function specToFlow(spec: ArchitectureSpec): {
  nodes: Node<ArchNodeData>[];
  edges: Edge[];
} {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: spec.direction ?? "TB",
    nodesep: 56,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
  });

  for (const n of spec.nodes) {
    const kind = normalizeKind(n.kind);
    const { w, h } = SIZE[kind];
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of spec.edges) {
    g.setEdge(e.from, e.to);
  }

  Dagre.layout(g);

  const nodes: Node<ArchNodeData>[] = spec.nodes.map((n) => {
    const kind = normalizeKind(n.kind);
    const pos = g.node(n.id);
    const { w, h } = SIZE[kind];
    return {
      id: n.id,
      type: kind,
      position: {
        x: (pos?.x ?? 0) - w / 2,
        y: (pos?.y ?? 0) - h / 2,
      },
      data: {
        label: n.label,
        kind,
        description: n.description,
      },
    };
  });

  const edges: Edge[] = spec.edges.map((e, i) => ({
    id: `arch-e-${i}`,
    source: e.from,
    target: e.to,
    label: e.label,
    type: "smoothstep",
    animated: e.async === true,
    style: {
      stroke: e.async ? "#a78bfa" : "#52525b",
      strokeWidth: 1.5,
    },
    labelStyle: { fill: "#f4f4f5", fontSize: 12, fontWeight: 500 },
    labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  }));

  return { nodes, edges };
}
