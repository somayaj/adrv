import type { AdrEdge, AdrEdgeType } from "./types.js";
import { normalizeAdrId } from "./normalize.js";

const FM_KEYS: Record<string, AdrEdgeType> = {
  supersedes: "supersedes",
  "superseded-by": "superseded-by",
  supersededby: "superseded-by",
  depends: "depends-on",
  "depends-on": "depends-on",
  dependson: "depends-on",
  amends: "amends",
  "relates-to": "relates-to",
  relatesto: "relates-to",
  related: "relates-to",
};

function coerceTargets(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((v) => coerceTargets(v));
  if (typeof value === "number") return [String(value)];
  if (typeof value === "string") {
    return value
      .split(/[,;|\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function addEdge(
  edges: AdrEdge[],
  fromId: string,
  toRaw: string,
  type: AdrEdgeType,
  inferred = false,
): void {
  const toId = normalizeAdrId(toRaw) ?? normalizeAdrId(toRaw.replace(/\.md$/i, ""));
  if (!toId || fromId === toId) return;
  const key = `${fromId}|${toId}|${type}`;
  if (edges.some((e) => `${e.from}|${e.to}|${e.type}` === key)) return;
  edges.push({ from: fromId, to: toId, type, inferred });
}

export function edgesFromFrontmatter(
  fromId: string,
  data: Record<string, unknown>,
): AdrEdge[] {
  const edges: AdrEdge[] = [];
  for (const [key, edgeType] of Object.entries(FM_KEYS)) {
    const rawKey = Object.keys(data).find(
      (k) => k.toLowerCase().replace(/_/g, "-") === key.replace(/_/g, "-"),
    );
    if (!rawKey) continue;
    for (const target of coerceTargets(data[rawKey])) {
      addEdge(edges, fromId, target, edgeType);
    }
  }
  return edges;
}

/** Markdown links and explicit ADR-NNNN mentions in body. */
export function edgesFromBody(fromId: string, body: string): AdrEdge[] {
  const edges: AdrEdge[] = [];

  const linkRe = /\[[^\]]*\]\([^)]*?(\d{1,8})[-_][^/)]*\.md[^)]*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(body)) !== null) {
    if (m[1]) addEdge(edges, fromId, m[1], "relates-to", true);
  }

  const mentionRe =
    /\b(?:supersedes?|superseded\s+by|depends\s+on|amends?|relates?\s+to)\s*:?\s*(?:ADR[-\s]*)?(\d{1,8})\b/gi;
  while ((m = mentionRe.exec(body)) !== null) {
    const phrase = m[0].toLowerCase();
    const id = m[1];
    let type: AdrEdgeType = "relates-to";
    if (phrase.includes("supersede") && !phrase.includes("superseded by")) {
      type = "supersedes";
    } else if (phrase.includes("superseded by")) {
      type = "superseded-by";
    } else if (phrase.includes("depend")) {
      type = "depends-on";
    } else if (phrase.includes("amend")) {
      type = "amends";
    }
    addEdge(edges, fromId, id, type, true);
  }

  return edges;
}
