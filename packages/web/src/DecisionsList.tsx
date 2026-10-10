import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AdrGraph, AdrRecord } from "@adrv/core/browser";
import { cursorEnrichPercent } from "./enrichProgress";
import { EnrichHourglass } from "./EnrichHourglass";
import { formatEnrichDuration } from "./enrichTimers";
import { linkCountFor } from "./LinksOutline";
import { statusBadgeClass } from "./status";

/** Virtualized list sized for large corpora (scroll, do not mount 10k DOM nodes). */
export const DECISIONS_NAV_MAX = 10_000;

/** Default list size before the user searches. */
export const DECISIONS_NAV_PREVIEW = 5;

/** Below this count, render a plain list (avoids measure glitches on small sets). */
const VIRTUALIZE_THRESHOLD = 120;

const ROW_ESTIMATE_PX = 118;

export type DecisionsListMode = "preview" | "search" | "all" | "picked";

type Props = {
  graph: AdrGraph;
  nodes: AdrRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAnalyze?: (id: string) => void;
  /** Total ADRs matching filters (may be greater than `nodes` in preview mode). */
  totalInFilter: number;
  listMode: DecisionsListMode;
  enrichCurrentAdrId?: string | null;
  enrichItemElapsedSec?: number;
};

function DecisionRow({
  graph,
  n,
  selected,
  onSelect,
  onAnalyze,
  enrichItemElapsedSec,
}: {
  graph: AdrGraph;
  n: AdrRecord;
  selected: boolean;
  onSelect: (id: string) => void;
  onAnalyze?: (id: string) => void;
  enrichItemElapsedSec?: number;
}) {
  const links = linkCountFor(n.id, graph.edges);
  const enrichingNow =
    graph.cursorEnriching && graph.cursorEnrichCurrent === n.id;
  const queued = (graph.cursorEnrichQueued ?? []).includes(n.id);
  const batchPct = enrichingNow ? cursorEnrichPercent(graph) : null;
  const showEnrichTrack = !!n.cursorEnriched || enrichingNow || queued;
  const canAnalyze =
    !!onAnalyze && !n.cursorEnriched && !enrichingNow && !queued;

  return (
    <button
      type="button"
      onClick={() => onSelect(n.id)}
      className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
        selected
          ? "bg-blue-500/15 ring-1 ring-blue-500/30"
          : "hover:bg-zinc-800/80"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
          {n.cursorEnriched && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/60"
              title="Ready — enriched by Cursor"
              aria-label="Ready"
            >
              ✓
            </span>
          )}
          {enrichingNow && (
            <EnrichHourglass size={12} className="text-amber-400" />
          )}
          {enrichingNow && (
            <span className="font-mono text-[9px] font-semibold text-amber-400">
              {enrichItemElapsedSec != null
                ? formatEnrichDuration(enrichItemElapsedSec)
                : "0:00"}
              {batchPct != null ? ` · ${batchPct}%` : ""}
            </span>
          )}
          {n.id}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {canAnalyze && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze(n.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onAnalyze(n.id);
                }
              }}
              className="rounded-md border border-blue-500/40 bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-200 hover:bg-blue-500/25"
            >
              Analyze
            </span>
          )}
          {queued && !enrichingNow && !n.cursorEnriched && (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-400/80">
              Queued
            </span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] capitalize ${statusBadgeClass(n.status)}`}
          >
            {n.status}
          </span>
        </span>
      </div>
      <span className="mt-1 line-clamp-2 block text-sm leading-snug text-zinc-200">
        {n.title}
      </span>
      {links > 0 && (
        <span className="mt-1 inline-block text-[10px] text-zinc-500">
          {links} link{links === 1 ? "" : "s"}
        </span>
      )}
      {showEnrichTrack && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuenow={
            n.cursorEnriched ? 100 : enrichingNow ? (batchPct ?? 0) : 0
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            n.cursorEnriched
              ? "Cursor enrichment complete"
              : enrichingNow
                ? "Cursor enriching"
                : "Waiting for Cursor"
          }
        >
          {n.cursorEnriched ? (
            <div className="h-full w-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
          ) : enrichingNow ? (
            <div
              className="h-full rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)] transition-[width] duration-500"
              style={{ width: `${batchPct ?? 8}%` }}
            />
          ) : null}
        </div>
      )}
    </button>
  );
}

function listCaption(
  listMode: DecisionsListMode,
  shown: number,
  totalInFilter: number,
  truncated: boolean,
): string {
  if (listMode === "preview") {
    return `Showing ${shown} of ${totalInFilter.toLocaleString()} — search or choose ADRs`;
  }
  if (listMode === "search") {
    return `${shown.toLocaleString()} match${shown === 1 ? "" : "es"}`;
  }
  if (listMode === "picked") {
    return `${shown.toLocaleString()} selected ADR${shown === 1 ? "" : "s"}`;
  }
  return `${shown.toLocaleString()} shown`;
}

export function DecisionsList({
  graph,
  nodes: inputNodes,
  selectedId,
  onSelect,
  onAnalyze,
  totalInFilter,
  listMode,
  enrichCurrentAdrId,
  enrichItemElapsedSec = 0,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const truncated = inputNodes.length > DECISIONS_NAV_MAX;
  const nodes = useMemo(() => {
    const sorted = [...inputNodes].sort((a, b) => a.id.localeCompare(b.id));
    return truncated ? sorted.slice(0, DECISIONS_NAV_MAX) : sorted;
  }, [inputNodes, truncated]);

  const useVirtual = nodes.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 10,
    enabled: useVirtual,
  });

  const selectedIndex = selectedId
    ? nodes.findIndex((n) => n.id === selectedId)
    : -1;

  useEffect(() => {
    if (!useVirtual || selectedIndex < 0) return;
    virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
  }, [selectedIndex, virtualizer, useVirtual]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-3 py-2 text-[10px] leading-snug text-zinc-600">
        {listCaption(listMode, nodes.length, totalInFilter, truncated)}
        {truncated && (
          <span className="text-amber-500/90">
            {" "}
            (cap {DECISIONS_NAV_MAX.toLocaleString()} — refine search)
          </span>
        )}
      </div>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {useVirtual ? (
          <ul
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const n = nodes[row.index];
              return (
                <li
                  key={n.id}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full px-0"
                  style={{
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <DecisionRow
                    graph={graph}
                    n={n}
                    selected={selectedId === n.id}
                    onSelect={onSelect}
                    onAnalyze={onAnalyze}
                    enrichItemElapsedSec={
                      enrichCurrentAdrId === n.id
                        ? enrichItemElapsedSec
                        : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="w-full">
            {nodes.map((n) => (
              <li key={n.id}>
                <DecisionRow
                  graph={graph}
                  n={n}
                  selected={selectedId === n.id}
                  onSelect={onSelect}
                  onAnalyze={onAnalyze}
                  enrichItemElapsedSec={
                    enrichCurrentAdrId === n.id
                      ? enrichItemElapsedSec
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
