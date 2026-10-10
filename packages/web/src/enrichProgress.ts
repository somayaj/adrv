import type { AdrGraph } from "@adrv/core/browser";

export function enrichBatchStep(graph: AdrGraph): number | null {
  const total = graph.cursorEnrichTotal ?? 0;
  if (total <= 0) return null;
  if (!graph.cursorEnriching && !graph.cursorEnrichCurrent) return null;

  const done = graph.cursorEnrichDone ?? 0;
  const item = graph.cursorEnrichCurrent
    ? (graph.cursorEnrichItemProgress ?? 0)
    : 0;
  return done + item;
}

/** 0–100 for the current Cursor analyze batch; null when idle. */
export function cursorEnrichPercent(graph: AdrGraph): number | null {
  const total = graph.cursorEnrichTotal ?? 0;
  const step = enrichBatchStep(graph);
  if (step == null || total <= 0) return null;
  return Math.min(100, Math.round((step / total) * 100));
}

export function cursorEnrichProgressLabel(graph: AdrGraph): string | null {
  const total = graph.cursorEnrichTotal ?? 0;
  const step = enrichBatchStep(graph);
  if (step == null || total <= 0) return null;
  const pct = cursorEnrichPercent(graph);
  const done = graph.cursorEnrichDone ?? 0;
  const onItem = graph.cursorEnrichCurrent ? done + 1 : done;
  return `${onItem}/${total} · ${pct ?? 0}%`;
}

/** Rough ETA for the rest of the batch from elapsed time and fractional step. */
export function cursorEnrichEtaSeconds(
  graph: AdrGraph,
  batchElapsedSec: number,
): number | null {
  const total = graph.cursorEnrichTotal ?? 0;
  const step = enrichBatchStep(graph);
  if (step == null || total <= 0 || batchElapsedSec < 2 || step < 0.03) {
    return null;
  }
  const remaining = total - step;
  if (remaining <= 0.01) return 0;
  const rate = step / batchElapsedSec;
  if (rate <= 0) return null;
  return remaining / rate;
}
