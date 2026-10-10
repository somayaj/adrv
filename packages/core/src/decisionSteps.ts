import type { ArchitectureSpec } from "./architecture.js";
import { parseArchitectureFromBody } from "./architecture.js";

function stripFenced(body: string): string {
  return body.replace(/```[\s\S]*?```/g, "");
}

function sectionText(body: string, names: string[]): string {
  const parts: string[] = [];
  const lines = body.split("\n");
  let current: string | null = null;
  let buf = "";
  for (const line of lines) {
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      if (
        current &&
        names.some((n) => current!.toLowerCase() === n.toLowerCase())
      ) {
        parts.push(buf);
      }
      current = hm[2].trim();
      buf = "";
    } else if (current) {
      buf += line + "\n";
    }
  }
  if (
    current &&
    names.some((n) => current!.toLowerCase() === n.toLowerCase())
  ) {
    parts.push(buf);
  }
  return parts.join("\n");
}

function cleanStepLine(raw: string): string {
  return raw
    .trim()
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`/g, "")
    .split(/\s+/)
    .join(" ");
}

/** Numbered lines under `## Decision` (e.g. `1. …`, `2. …`). */
export function decisionStepsFromBody(body: string): string[] {
  const decision = sectionText(stripFenced(body), ["Decision"]);
  const re = /^\s*\d+\.\s+(.+)$/;
  const steps: string[] = [];
  for (const line of decision.split("\n")) {
    const m = re.exec(line);
    if (m) {
      const step = cleanStepLine(m[1]);
      if (step.length >= 3) steps.push(step);
    }
  }
  return steps;
}

function stepsFromArchitecture(spec: ArchitectureSpec): string[] {
  const { nodes, edges } = spec;
  if (!nodes.length) return [];

  const labels = new Map(nodes.map((n) => [n.id, n.label]));
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }

  const outEdges = new Map<string, string[]>();
  for (const e of edges) {
    const list = outEdges.get(e.from) ?? [];
    list.push(e.to);
    outEdges.set(e.from, list);
  }

  const start =
    nodes.find((n) => (incoming.get(n.id) ?? 0) === 0)?.id ?? nodes[0].id;
  const ordered: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = start;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    ordered.push(labels.get(cur) ?? cur);
    const nexts: string[] = outEdges.get(cur) ?? [];
    cur = nexts.find((t: string) => !seen.has(t));
  }
  for (const n of nodes) {
    if (!seen.has(n.id)) ordered.push(n.label);
  }
  return ordered;
}

/** Outline steps for the Steps tab: numbered decision list, else architecture flow labels. */
export function decisionStepsForRecord(
  body: string,
  architecture?: ArchitectureSpec | null,
): string[] {
  const numbered = decisionStepsFromBody(body);
  if (numbered.length > 0) return numbered;

  if (architecture?.nodes?.length) {
    return stepsFromArchitecture(architecture);
  }
  const parsed = parseArchitectureFromBody(body);
  if (parsed?.nodes?.length) return stepsFromArchitecture(parsed);
  return [];
}

export function architectureSpecFromSteps(
  steps: string[],
): ArchitectureSpec | null {
  if (steps.length < 2) return null;
  const nodes = steps.map((label, i) => ({
    id: `step-${i + 1}`,
    label,
    kind: "service" as const,
  }));
  const edges: ArchitectureSpec["edges"] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
  }
  return { direction: "LR", nodes, edges };
}
