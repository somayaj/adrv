import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { AdrGraph, AdrRecord } from "./types.js";
import { parseArchitectureFromBody } from "./architecture.js";
import { DOC_GLOBS, shouldSkipDocument } from "./docFiles.js";
import { resolveRecordStatus } from "./adrStatus.js";
import {
  dateFromProse,
  parseMetadataTable,
  tagsFromMetadata,
  titleFromLeadingIdLine,
} from "./metadata.js";
import { normalizeAdrId, titleFromFilename } from "./normalize.js";
import { edgesFromBody, edgesFromFrontmatter } from "./relationships.js";

function idFromPath(filePath: string, data: Record<string, unknown>): string {
  const fromFm =
    data.adr ?? data.id ?? data.number ?? data["adr-id"];
  if (typeof fromFm === "number") return String(fromFm).padStart(4, "0");
  if (typeof fromFm === "string") {
    const n = normalizeAdrId(fromFm);
    if (n) return n;
  }
  const base = path.basename(filePath);
  const fromName = normalizeAdrId(base);
  if (fromName) return fromName;
  return path.parse(base).name || "document";
}

function titleFromRecord(
  data: Record<string, unknown>,
  filePath: string,
): string {
  const t = data.title ?? data.name;
  if (typeof t === "string" && t.trim()) return t.trim();
  return titleFromFilename(path.basename(filePath));
}

function titleFromPlainFirstLine(body: string): string | null {
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) break;
    if (t.length <= 120) return t;
    break;
  }
  return null;
}

export async function loadAdrGraph(adrRoot: string): Promise<AdrGraph> {
  const root = path.resolve(adrRoot);
  const warnings: string[] = [];

  const entries = (
    await fg(DOC_GLOBS, {
      cwd: root,
      absolute: true,
      ignore: ["**/node_modules/**"],
    })
  ).filter((p) => !shouldSkipDocument(p));

  if (entries.length === 0) {
    warnings.push(`No documents found under ${root}`);
    return { root, nodes: [], edges: [], warnings };
  }

  const nodes: AdrRecord[] = [];

  for (const filePath of entries.sort()) {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
      if (raw.includes("\0")) {
        warnings.push(`Skip ${filePath}: binary file`);
        continue;
      }
    } catch {
      warnings.push(`Skip ${filePath}: unreadable`);
      continue;
    }

    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const id = idFromPath(filePath, data);

    const body = parsed.content.trim();
    const table = parseMetadataTable(body);

    let title = titleFromRecord(data, filePath);
    const leading = titleFromLeadingIdLine(body);
    if (leading) title = leading;
    const heading = body.match(/^#{1,6}\s+(.+)$/m);
    if (heading?.[1]) {
      const h = heading[1]
        .replace(/^(?:ADR[-\s]*)?\d+\s*[:.\-–—]\s*/i, "")
        .trim();
      if (h) title = h;
    } else {
      const plain = titleFromPlainFirstLine(body);
      if (plain) title = plain;
    }

    const tagsRaw = data.tags ?? data.labels;
    const tags: string[] = Array.isArray(tagsRaw)
      ? tagsRaw.map(String)
      : typeof tagsRaw === "string"
        ? tagsRaw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
        : [];
    for (const t of tagsFromMetadata(table)) {
      if (!tags.includes(t)) tags.push(t);
    }

    const statusFm =
      typeof data.status === "string"
        ? data.status
        : typeof data.state === "string"
          ? data.state
          : undefined;
    const date =
      typeof data.date === "string"
        ? data.date
        : table.get("date") ?? dateFromProse(body) ?? undefined;

    nodes.push({
      id,
      title,
      status: resolveRecordStatus(
        statusFm,
        table.get("status"),
        body,
      ),
      date,
      tags,
      path: filePath,
      relativePath: path.relative(root, filePath),
      body,
      architecture: undefined,
    });
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [];

  for (const node of nodes) {
    const raw = await fs.readFile(node.path, "utf8");
    const { data, content } = matter(raw);
    edges.push(
      ...edgesFromFrontmatter(node.id, data as Record<string, unknown>),
    );
    edges.push(...edgesFromBody(node.id, content));
  }

  for (const edge of edges) {
    if (!byId.has(edge.from)) {
      warnings.push(`Edge references missing source ADR: ${edge.from}`);
    }
    if (!byId.has(edge.to)) {
      warnings.push(
        `Edge ${edge.from} → ${edge.to} (${edge.type}): target ADR not found`,
      );
    }
  }

  const known = edges.filter((e) => byId.has(e.from) && byId.has(e.to));

  for (const node of nodes) {
    const linked = known
      .filter((e) => e.from === node.id || e.to === node.id)
      .map((e) => {
        const otherId = e.from === node.id ? e.to : e.from;
        const other = byId.get(otherId)!;
        return { id: other.id, title: other.title, tags: other.tags };
      });
    node.architecture =
      parseArchitectureFromBody(node.body) ??
      undefined;
  }

  return { root, nodes, edges: known, warnings };
}
