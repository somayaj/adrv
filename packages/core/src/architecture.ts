import YAML from "yaml";
import { inferArchitectureFromDocument } from "./inferArchitecture.js";

export type ArchNodeKind =
  | "client"
  | "gateway"
  | "service"
  | "database"
  | "queue"
  | "worker"
  | "external";

export type ArchitectureSpec = {
  direction?: "TB" | "LR";
  nodes: Array<{
    id: string;
    label: string;
    kind: ArchNodeKind;
    description?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    async?: boolean;
  }>;
};

const FENCE = /```architecture\s*\n([\s\S]*?)```/i;

const KINDS = new Set<ArchNodeKind>([
  "client",
  "gateway",
  "service",
  "database",
  "queue",
  "worker",
  "external",
]);

function normalizeKind(raw: unknown): ArchNodeKind {
  if (typeof raw !== "string") return "service";
  const k = raw.toLowerCase().trim() as ArchNodeKind;
  return KINDS.has(k) ? k : "service";
}

export function parseArchitectureFromBody(
  body: string,
): ArchitectureSpec | null {
  const m = FENCE.exec(body);
  if (!m?.[1]) return null;
  return parseArchitectureYaml(m[1]);
}

export function architectureFromDocument(
  body: string,
  title: string,
  tags: string[],
  linked: Array<{ id: string; title: string; tags: string[] }>,
): ArchitectureSpec | null {
  const explicit = parseArchitectureFromBody(body);
  if (explicit) return explicit;
  return inferArchitectureFromDocument(body, title, tags, linked);
}

function parseArchitectureYaml(yamlBlock: string): ArchitectureSpec | null {
  try {
    const doc = YAML.parse(yamlBlock) as Record<string, unknown>;
    if (!doc || !Array.isArray(doc.nodes) || doc.nodes.length === 0) {
      return null;
    }
    const nodes = doc.nodes
      .map((n) => {
        if (!n || typeof n !== "object") return null;
        const o = n as Record<string, unknown>;
        const id = String(o.id ?? "").trim();
        const label = String(o.label ?? id).trim();
        if (!id) return null;
        return {
          id,
          label,
          kind: normalizeKind(o.kind),
          description:
            typeof o.description === "string" ? o.description : undefined,
        };
      })
      .filter(Boolean) as ArchitectureSpec["nodes"];

    const edges = (Array.isArray(doc.edges) ? doc.edges : [])
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const o = e as Record<string, unknown>;
        const from = String(o.from ?? "").trim();
        const to = String(o.to ?? "").trim();
        if (!from || !to) return null;
        return {
          from,
          to,
          label: typeof o.label === "string" ? o.label : undefined,
          async: o.async === true,
        };
      })
      .filter(Boolean) as ArchitectureSpec["edges"];

    const direction =
      doc.direction === "LR" || doc.direction === "lr" ? "LR" : "TB";

    return { direction, nodes, edges };
  } catch {
    return null;
  }
}

export function hasArchitecture(
  body: string,
  architecture?: ArchitectureSpec | null,
): boolean {
  if (architecture != null && architecture.nodes.length > 0) return true;
  if (FENCE.test(body)) return true;
  return body.trim().length > 0;
}

export function architectureSource(body: string): string | null {
  const m = FENCE.exec(body);
  return m?.[1]?.trim() ?? null;
}
