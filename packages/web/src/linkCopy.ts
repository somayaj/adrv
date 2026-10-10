import type { AdrEdge, AdrEdgeType, AdrRecord } from "@adrv/core/browser";

export type LinkMeta = {
  type: AdrEdgeType;
  label: string;
  color: string;
  description: string;
};

export const LINK_META: Record<AdrEdgeType, LinkMeta> = {
  "depends-on": {
    type: "depends-on",
    label: "Depends on",
    color: "#3b82f6",
    description:
      "This decision assumes another is already in place — build or accept the prerequisite first.",
  },
  "relates-to": {
    type: "relates-to",
    label: "Related to",
    color: "#71717a",
    description:
      "Same topic or boundary — read together; neither necessarily blocks the other.",
  },
  supersedes: {
    type: "supersedes",
    label: "Supersedes",
    color: "#f59e0b",
    description:
      "Replaces an older decision; the prior record should move to superseded.",
  },
  "superseded-by": {
    type: "superseded-by",
    label: "Superseded by",
    color: "#f59e0b",
    description: "This record is replaced by a newer decision.",
  },
  amends: {
    type: "amends",
    label: "Amends",
    color: "#a78bfa",
    description: "Narrows or extends an existing decision without replacing it.",
  },
};

export function dedupeEdges(edges: AdrEdge[]): AdrEdge[] {
  const byKey = new Map<string, AdrEdge>();
  for (const e of edges) {
    const key = `${e.from}|${e.to}|${e.type}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, e);
    else if (prev.inferred && !e.inferred) byKey.set(key, e);
  }
  return [...byKey.values()];
}

export function decisionSnippet(body: string, max = 140): string | null {
  const m = body.match(/##\s*Decision\s*\n+([\s\S]*?)(?=\n##|$)/i);
  if (!m?.[1]) return null;
  const text = m[1]
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function linkSentence(
  edge: AdrEdge,
  from: AdrRecord,
  to: AdrRecord,
  direction: "outbound" | "inbound",
): string {
  const meta = LINK_META[edge.type];
  if (direction === "outbound") {
    switch (edge.type) {
      case "depends-on":
        return `${from.id} requires ${to.id} (${to.title}) before this choice holds.`;
      case "relates-to":
        return `${from.id} is discussed alongside ${to.id} (${to.title}).`;
      case "supersedes":
        return `${from.id} replaces ${to.id} (${to.title}).`;
      case "amends":
        return `${from.id} amends ${to.id} (${to.title}).`;
      case "superseded-by":
        return `${from.id} is superseded by ${to.id} (${to.title}).`;
      default:
        return `${from.id} → ${to.id}`;
    }
  }
  switch (edge.type) {
    case "depends-on":
      return `${from.id} (${from.title}) is a prerequisite for ${to.id}.`;
    case "relates-to":
      return `${from.id} (${from.title}) relates to ${to.id}.`;
    case "supersedes":
      return `${from.id} supersedes ${to.id}.`;
    case "amends":
      return `${from.id} amends ${to.id}.`;
    case "superseded-by":
      return `${from.id} marks ${to.id} as superseded.`;
    default:
      return `${from.id} → ${to.id}`;
  }
}
