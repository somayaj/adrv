import type { ArchitectureSpec } from "./architecture.js";
import {
  architectureSpecFromSteps,
  decisionStepsFromBody,
} from "./decisionSteps.js";

type Linked = { id: string; title: string; tags: string[] };

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function classify(label: string, tags: string[]): string {
  const hay = `${label} ${tags.join(" ")}`.toLowerCase();
  if (
    /postgres|mysql|mongodb|database/.test(hay) ||
    (hay.includes("redis") && hay.includes("cache"))
  ) {
    return "database";
  }
  if (/nats|jetstream|kafka|rabbit|queue|event bus|messaging/.test(hay)) {
    return "queue";
  }
  if (/gateway/.test(hay) || (hay.includes("edge") && hay.includes("api"))) {
    return "gateway";
  }
  if (/worker|fulfillment|projector/.test(hay)) return "worker";
  if (/mobile|web app|client|browser/.test(hay)) return "client";
  if (/external|third-party/.test(hay)) return "external";
  return "service";
}

function extractPhrases(body: string): string[] {
  const out: string[] = [];
  const bold = /\*\*([^*]{2,80})\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = bold.exec(body)) !== null) out.push(m[1].trim());
  const code = /`([^`]{2,60})`/g;
  while ((m = code.exec(body)) !== null) out.push(m[1].trim());
  return out;
}

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
      if (current && names.some((n) => current!.toLowerCase() === n.toLowerCase())) {
        parts.push(buf);
      }
      current = hm[2].trim();
      buf = "";
    } else if (current) {
      buf += line + "\n";
    }
  }
  if (current && names.some((n) => current!.toLowerCase() === n.toLowerCase())) {
    parts.push(buf);
  }
  return parts.join("\n");
}

export function inferArchitectureFromDocument(
  body: string,
  title: string,
  tags: string[],
  linked: Linked[],
): ArchitectureSpec | null {
  const stripped = stripFenced(body);
  const steps = decisionStepsFromBody(stripped);
  const fromSteps = architectureSpecFromSteps(steps);
  if (fromSteps) return fromSteps;

  const focus = sectionText(stripped, [
    "Issue",
    "Context",
    "Decision",
    "Argument",
    "Positions",
    "Implications",
    "Consequences",
    "Architecture",
  ]);
  const scan = focus.trim() ? focus : stripped;

  const components = new Map<
    string,
    { id: string; label: string; kind: string }
  >();

  const add = (label: string, kind: string) => {
    const id = slugify(label);
    if (!id || id.length < 2) return;
    if (!components.has(id)) {
      components.set(id, { id, label, kind });
    }
  };

  add(title, classify(title, tags));
  for (const phrase of extractPhrases(scan)) {
    add(phrase, classify(phrase, tags));
  }
  const lower = scan.toLowerCase();
  if (lower.includes("connection pooling") || lower.includes("at the edge")) {
    add("Edge / connection pool", "gateway");
  }
  if (lower.includes("services") && !components.has("services")) {
    add("Services", "service");
  }
  for (const peer of linked) {
    add(peer.title, classify(peer.title, peer.tags));
  }

  if (components.size === 0) return null;

  const nodes = [...components.values()].map((c) => ({
    id: c.id,
    label: c.label,
    kind: c.kind as ArchitectureSpec["nodes"][0]["kind"],
  }));

  const edges: ArchitectureSpec["edges"] = [];
  const byKind = (k: string) => nodes.filter((n) => n.kind === k).map((n) => n.id);
  const push = (from: string, to: string, label?: string, async?: boolean) => {
    if (from !== to) edges.push({ from, to, label, async });
  };

  for (const c of byKind("client")) {
    for (const g of byKind("gateway")) push(c, g);
  }
  for (const g of byKind("gateway")) {
    for (const s of byKind("service")) push(g, s);
  }
  for (const s of byKind("service")) {
    for (const d of byKind("database")) push(s, d, "data");
    for (const q of byKind("queue")) push(s, q, "events", true);
  }
  for (const q of byKind("queue")) {
    for (const w of byKind("worker")) push(q, w, undefined, true);
  }
  const services = byKind("service");
  const databases = byKind("database");
  if (services.length === 1 && databases.length === 1 && edges.length === 0) {
    push(services[0], databases[0]);
  }

  return { direction: "TB", nodes, edges };
}
