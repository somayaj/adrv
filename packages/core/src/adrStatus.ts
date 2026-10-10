import {
  classicDecisionRecord,
  madrDecisionMade,
  statusFromProse,
} from "./metadata.js";
import { normalizeStatus } from "./normalize.js";
import type { AdrStatus } from "./types.js";

/** Resolve status across Nygard, MADR, Tyree–Akerman, tables, and YAML. */
export function resolveRecordStatus(
  frontMatter: unknown,
  tableStatus: string | undefined,
  body: string,
): AdrStatus {
  const candidates: string[] = [];
  if (typeof frontMatter === "string" && frontMatter.trim()) {
    candidates.push(frontMatter.trim());
  }
  if (tableStatus?.trim()) {
    candidates.push(tableStatus.trim());
  }

  for (const raw of candidates) {
    const normalized = normalizeStatus(raw);
    if (normalized !== "unknown") return normalized;
  }

  const fromProse = statusFromProse(body);
  if (fromProse) {
    const normalized = normalizeStatus(fromProse);
    if (normalized !== "unknown") return normalized;
  }

  if (madrDecisionMade(body) || classicDecisionRecord(body)) return "accepted";

  return "unknown";
}
