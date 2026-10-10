import type { Edge, Node } from "@xyflow/react";
import type { AdrEdge, AdrGraph, AdrRecord } from "@adrv/core/browser";
import { LINK_META, dedupeEdges } from "./linkCopy";

export type AdrNodeData = {
  record: AdrRecord;
};

function layoutNodes(graph: AdrGraph): Map<string, { x: number; y: number }> {
  const col = 300;
  const row = 140;
  const ranks = new Map<string, number>();
  const edges = dedupeEdges(graph.edges).filter((e) => e.type === "depends-on");

  for (const n of graph.nodes) ranks.set(n.id, 0);
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    for (const e of edges) {
      const next = (ranks.get(e.from) ?? 0) + 1;
      if (next > (ranks.get(e.to) ?? 0)) ranks.set(e.to, next);
    }
  }

  const byRank = new Map<number, AdrRecord[]>();
  for (const n of graph.nodes) {
    const r = ranks.get(n.id) ?? 0;
    const list = byRank.get(r) ?? [];
    list.push(n);
    byRank.set(r, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [rank, list] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    const offset = ((4 - list.length) * col) / 2;
    list.forEach((n, i) => {
      positions.set(n.id, { x: offset + i * col, y: rank * row });
    });
  }
  return positions;
}

export function graphToFlow(
  graph: AdrGraph,
  highlightId: string | null = null,
): {
  nodes: Node<AdrNodeData>[];
  edges: Edge[];
} {
  const positions = layoutNodes(graph);
  const nodes: Node<AdrNodeData>[] = graph.nodes.map((record) => ({
    id: record.id,
    type: "adr",
    position: positions.get(record.id) ?? { x: 0, y: 0 },
    data: { record },
  }));

  const edges: Edge[] = dedupeEdges(graph.edges).map((e, i) => {
    const color = LINK_META[e.type]?.color ?? "#6b7280";
    const connected =
      highlightId &&
      (e.from === highlightId || e.to === highlightId);
    const label = LINK_META[e.type]?.label ?? e.type;

    return {
      id: `e-${i}-${e.from}-${e.to}-${e.type}`,
      source: e.from,
      target: e.to,
      label,
      animated: connected ? true : e.type === "depends-on",
      style: {
        stroke: color,
        strokeWidth: connected ? 2.5 : 1.25,
        opacity: highlightId && !connected ? 0.2 : 1,
        strokeDasharray: e.inferred ? "6 4" : undefined,
      },
      labelStyle: {
        fill: connected ? "#e4e4e7" : "#a1a1aa",
        fontSize: 11,
        fontWeight: 500,
      },
      labelBgStyle: { fill: "#141418", fillOpacity: 0.92 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    };
  });

  return { nodes, edges };
}

export function filterGraph(
  graph: AdrGraph,
  query: string,
  status: string | "all",
): AdrGraph {
  const q = query.trim().toLowerCase();
  let nodes = graph.nodes;
  if (status !== "all") {
    nodes = nodes.filter((n) => n.status === status);
  }
  if (q) {
    nodes = nodes.filter(
      (n) =>
        n.id.includes(q) ||
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  return { ...graph, nodes, edges };
}

export function neighbors(
  id: string | null,
  edges: AdrEdge[],
): { inbound: AdrEdge[]; outbound: AdrEdge[] } {
  if (!id) return { inbound: [], outbound: [] };
  return {
    inbound: edges.filter((e) => e.to === id),
    outbound: edges.filter((e) => e.from === id),
  };
}
