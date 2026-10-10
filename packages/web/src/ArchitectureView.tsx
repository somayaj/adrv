import { useMemo, useState } from "react";
import type { AdrEdge, AdrGraph, AdrRecord } from "@adrv/core/browser";
import { ArchitectureCanvas } from "./architecture/ArchitectureCanvas";
import {
  architectureSource,
  parseArchitectureFromBody,
} from "@adrv/core/browser";
import { EnrichHourglass } from "./EnrichHourglass";
import { decisionSnippet, dedupeEdges } from "./linkCopy";

type Props = {
  graph: AdrGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenGraph: (id: string) => void;
  analyzingThisAdr: boolean;
  onAnalyze?: (id: string) => void;
};

function relatedEdges(id: string, edges: AdrEdge[]): AdrEdge[] {
  return dedupeEdges(edges).filter(
    (e) => e.from === id || e.to === id,
  );
}

function specFor(record: AdrRecord) {
  return record.architecture ?? parseArchitectureFromBody(record.body);
}

export function ArchitectureView({
  graph,
  selectedId,
  onSelect,
  onOpenGraph,
  analyzingThisAdr,
  onAnalyze,
}: Props) {
  const withArch = useMemo(
    () =>
      graph.nodes
        .filter((n) => (n.architecture?.nodes.length ?? 0) > 0)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [graph.nodes],
  );

  const active: AdrRecord | null = selectedId
    ? (graph.nodes.find((n) => n.id === selectedId) ?? null)
    : null;

  const spec = active ? specFor(active) : null;
  const yamlSource = active ? architectureSource(active.body) : null;
  const [showSource, setShowSource] = useState(false);

  const idx = active ? withArch.findIndex((n) => n.id === active.id) : -1;

  const selectAdr = (id: string) => {
    setShowSource(false);
    onSelect(id);
  };

  if (!selectedId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-zinc-500">
          Select an ADR in the Decisions list on the left, then open
          Architecture.
        </p>
      </div>
    );
  }

  if (!active) {
    return null;
  }

  if (!spec) {
    const queued = (graph.cursorEnrichQueued ?? []).includes(active.id);
    const canAnalyze =
      !!onAnalyze && !active.cursorEnriched && !analyzingThisAdr && !queued;

    if (analyzingThisAdr) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
          role="status"
        >
          <EnrichHourglass size={28} className="text-amber-400" />
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
            <div className="adrv-enrich-bar" />
          </div>
          <p className="text-sm font-medium text-zinc-200">
            Cursor is reading this ADR
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
            The architecture diagram for{" "}
            <span className="text-zinc-300">{active.title}</span> appears after
            analysis finishes interpreting the decision.
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <p className="font-mono text-xs text-zinc-500">{active.id}</p>
          <p className="mt-2 text-sm font-medium text-zinc-200">
            No architecture diagram yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {active.cursorEnriched
              ? "Cursor analyzed this ADR but did not return a diagram. You can add a fenced "
              : "Run Analyze so Cursor reads this ADR and builds a diagram, or add a fenced "}
            <code className="text-zinc-400">architecture</code> YAML block in
            the markdown.
          </p>
          {canAnalyze && (
            <button
              type="button"
              onClick={() => onAnalyze(active.id)}
              className="mt-4 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/25"
            >
              Analyze
            </button>
          )}
          {queued && (
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-400">
              Queued for analysis
            </p>
          )}
        </div>
      </div>
    );
  }

  const links = relatedEdges(active.id, graph.edges);
  const snippet = decisionSnippet(active.body, 200);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="shrink-0 border-b border-border bg-panel px-4 py-3 md:px-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">
                {active.id}
              </span>
              <span className="text-[10px] text-zinc-600">
                {spec.nodes.length} components · {spec.edges.length} flows
              </span>
              {active.cursorEnriched && !yamlSource && (
                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                  From Cursor
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-zinc-50">
              {active.title}
            </h2>
            {snippet && (
              <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
                {snippet}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {idx > 0 && (
              <button
                type="button"
                onClick={() => selectAdr(withArch[idx - 1].id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-zinc-300"
              >
                Prev diagram
              </button>
            )}
            {idx >= 0 && idx < withArch.length - 1 && (
              <button
                type="button"
                onClick={() => selectAdr(withArch[idx + 1].id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-zinc-300"
              >
                Next diagram
              </button>
            )}
            {yamlSource && (
              <button
                type="button"
                onClick={() => setShowSource((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  showSource
                    ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                    : "border-border text-zinc-400"
                }`}
              >
                {showSource ? "Diagram" : "YAML"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenGraph(active.id)}
              className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-200"
            >
              Dependencies
            </button>
          </div>
        </div>
        {links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((e) => {
              const otherId = e.from === active.id ? e.to : e.from;
              const other = graph.nodes.find((n) => n.id === otherId);
              if (!other) return null;
              return (
                <button
                  key={`${e.from}-${e.to}-${e.type}`}
                  type="button"
                  onClick={() => selectAdr(other.id)}
                  className="rounded-full border border-border px-2.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  {other.id}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        {showSource && yamlSource ? (
          <pre className="h-full overflow-auto p-4 text-xs leading-relaxed text-zinc-400">
            {yamlSource}
          </pre>
        ) : (
          <ArchitectureCanvas spec={spec} />
        )}
      </div>
    </div>
  );
}
