import type { ArchitectureSpec } from "./architecture.js";

export type AdrStatus =
  | "proposed"
  | "accepted"
  | "deprecated"
  | "superseded"
  | "rejected"
  | "unknown";

export type AdrEdgeType =
  | "supersedes"
  | "superseded-by"
  | "depends-on"
  | "amends"
  | "relates-to";

export interface AdrRecord {
  id: string;
  title: string;
  status: AdrStatus;
  date?: string;
  tags: string[];
  path: string;
  relativePath: string;
  body: string;
  architecture?: ArchitectureSpec;
  /** Ordered steps from markdown or Cursor enrichment. */
  steps?: string[];
  /** Cursor sequential enrich finished for this ADR. */
  cursorEnriched?: boolean;
}

export interface AdrEdge {
  from: string;
  to: string;
  type: AdrEdgeType;
  inferred?: boolean;
}

export interface AdrGraph {
  root: string;
  nodes: AdrRecord[];
  edges: AdrEdge[];
  warnings: string[];
  /** No visualization until Cursor API key is configured (server strict mode). */
  requiresCursorKey?: boolean;
  /** Wait for Cursor enrichment before rendering. */
  cursorEnriching?: boolean;
  cursorEnrichCurrent?: string;
  cursorEnrichDone?: number;
  cursorEnrichTotal?: number;
  /** 0–1 progress for the ADR currently being analyzed. */
  cursorEnrichItemProgress?: number;
  /** ADR ids queued for Cursor (excludes `cursorEnrichCurrent`). */
  cursorEnrichQueued?: string[];
}
