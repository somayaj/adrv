import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AdrGraph, AdrRecord } from "@adrv/core/browser";
import { AdrNode } from "./AdrNode";
import { DetailPanel } from "./DetailPanel";
import { LinkLegend } from "./LinkLegend";
import {
  MainNavEdgeToggles,
  PanelCollapseHeader,
  PanelRail,
} from "./CollapsiblePanels";
import { AdrNavToolbar } from "./AdrNavToolbar";
import {
  DECISIONS_NAV_PREVIEW,
  DecisionsList,
  type DecisionsListMode,
} from "./DecisionsList";
import {
  cursorEnrichEtaSeconds,
  cursorEnrichPercent,
  cursorEnrichProgressLabel,
} from "./enrichProgress";
import { EnrichHourglass } from "./EnrichHourglass";
import { formatEnrichDuration, useEnrichTimers } from "./enrichTimers";
import { LinksOutline, linkCountFor } from "./LinksOutline";
import {
  filterGraph,
  graphToFlow,
  type AdrNodeData,
} from "./buildFlow";
import { ArchitectureView } from "./ArchitectureView";
import { TimelineView } from "./TimelineView";
import { dedupeEdges } from "./linkCopy";
type ViewMode =
  | "graph"
  | "links"
  | "timeline"
  | "architecture";

const nodeTypes: NodeTypes = { adr: AdrNode };

const LEFT_NAV_KEY = "adrv-left-nav";
const RIGHT_NAV_KEY = "adrv-right-nav";

function readPanelOpen(key: string, defaultOpen: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* private mode */
  }
  return defaultOpen;
}

function PanelToggle({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={pressed ? `Hide ${label}` : `Show ${label}`}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        pressed
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

async function fetchGraph(): Promise<AdrGraph> {
  const res = await fetch("/api/graph");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<AdrGraph>;
}

async function requestAnalyze(adrId: string): Promise<AdrGraph> {
  const res = await fetch(`/api/enrich/${encodeURIComponent(adrId)}`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : `Analyze failed (${res.status})`,
    );
  }
  return res.json() as Promise<AdrGraph>;
}

export default function App() {
  const [graph, setGraph] = useState<AdrGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("graph");
  const [leftNavOpen, setLeftNavOpen] = useState(() =>
    readPanelOpen(LEFT_NAV_KEY, true),
  );
  const [rightNavOpen, setRightNavOpen] = useState(() =>
    readPanelOpen(RIGHT_NAV_KEY, true),
  );
  const [timelineStep, setTimelineStep] = useState<number | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [navShowAll, setNavShowAll] = useState(false);
  const [navPickIds, setNavPickIds] = useState<string[] | null>(null);

  const toggleLeftNav = useCallback(() => {
    setLeftNavOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(LEFT_NAV_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleRightNav = useCallback(() => {
    setRightNavOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(RIGHT_NAV_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AdrNodeData>>(
    [] as Node<AdrNodeData>[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);

  useEffect(() => {
    let cancelled = false;
    fetchGraph()
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!graph?.cursorEnriching) return;
    const timer = setInterval(() => {
      fetchGraph()
        .then(setGraph)
        .catch(() => {
          /* keep polling until enrich finishes */
        });
    }, 800);
    return () => clearInterval(timer);
  }, [graph?.cursorEnriching]);

  const handleAnalyze = useCallback((adrId: string) => {
    requestAnalyze(adrId)
      .then(setGraph)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Analyze failed");
      });
  }, []);

  const enrichTimers = useEnrichTimers(graph);
  const enrichEtaSec =
    graph?.cursorEnriching != null && graph.cursorEnriching
      ? cursorEnrichEtaSeconds(graph, enrichTimers.batchElapsedSec)
      : null;

  useEffect(() => {
    setTimelineStep(null);
  }, [selectedId]);

  useEffect(() => {
    if (view === "timeline" && selectedId) {
      setRightNavOpen(true);
    }
  }, [view, selectedId]);

  const filtered = useMemo(
    () => (graph ? filterGraph(graph, query, statusFilter) : null),
    [graph, query, statusFilter],
  );

  const navList = useMemo(() => {
    const all = filtered?.nodes ?? [];
    let pool = [...all].sort((a, b) => a.id.localeCompare(b.id));
    const searching = query.trim().length > 0;

    if (navPickIds?.length) {
      const pick = new Set(navPickIds);
      pool = pool.filter((n) => pick.has(n.id));
    }

    if (searching) {
      return {
        nodes: pool,
        total: pool.length,
        mode: "search" as DecisionsListMode,
      };
    }

    if (navPickIds?.length) {
      return {
        nodes: pool,
        total: pool.length,
        mode: "picked" as DecisionsListMode,
      };
    }

    if (navShowAll || pool.length <= DECISIONS_NAV_PREVIEW) {
      return {
        nodes: pool,
        total: pool.length,
        mode: "all" as DecisionsListMode,
      };
    }

    return {
      nodes: pool.slice(0, DECISIONS_NAV_PREVIEW),
      total: pool.length,
      mode: "preview" as DecisionsListMode,
    };
  }, [filtered, query, navShowAll, navPickIds]);

  const graphScopeFull =
    navShowAll && !navPickIds?.length && !query.trim();

  /** ADR ids that drive the Dependencies graph (list / picker / search — not full corpus until Show all). */
  const viewAdrIds = useMemo(() => {
    if (graphScopeFull) return null;
    if (navPickIds?.length) return navPickIds;
    return navList.nodes.map((n) => n.id);
  }, [graphScopeFull, navPickIds, navList.nodes]);

  const relationshipGraph = useMemo(() => {
    if (!filtered) return null;
    if (!viewAdrIds) return filtered;

    const ids = new Set(viewAdrIds);
    const nodes = filtered.nodes.filter((n) => ids.has(n.id));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = filtered.edges.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to),
    );
    return { ...filtered, nodes, edges };
  }, [filtered, viewAdrIds]);

  const dependenciesScopeKey = viewAdrIds?.join(",") ?? "all";

  useEffect(() => {
    if (!relationshipGraph) return;
    const { nodes: n, edges: e } = graphToFlow(relationshipGraph, selectedId);
    setNodes(n);
    setEdges(e);
  }, [relationshipGraph, selectedId, setNodes, setEdges]);

  const selected =
    graph?.nodes.find((n) => n.id === selectedId) ?? null;

  const linkTotal = relationshipGraph
    ? dedupeEdges(relationshipGraph.edges).length
    : 0;

  const onNodeClick = useCallback(
    (_: unknown, node: { id: string }) => {
      setSelectedId(node.id);
    },
    [],
  );

  const onNodeDoubleClick = useCallback(
    (_: unknown, node: { id: string }) => {
      setSelectedId(node.id);
      setView("timeline");
      setRightNavOpen(true);
    },
    [],
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-rose-500/40 bg-rose-500/10 p-6">
          <h1 className="text-lg font-semibold text-rose-200">
            Could not load ADRs
          </h1>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
        </div>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading ADR graph…
      </div>
    );
  }

  if (graph.requiresCursorKey) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-border bg-panel p-6 text-center">
          <h1 className="text-lg font-semibold text-zinc-100">
            Cursor API key required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            adrv does not draw the graph until a Cursor token is saved. In a
            terminal run{" "}
            <code className="text-zinc-200">adrv cursor login</code>, then
            refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border bg-panel px-4 py-3">
        <div
          className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2"
        >
          <div className="min-w-0 justify-self-start">
            <h1 className="text-base font-semibold tracking-tight text-zinc-100">
              adrv
            </h1>
            <p className="text-xs text-zinc-500">
              {graphScopeFull
                ? `${graph.nodes.length} decisions`
                : `${relationshipGraph?.nodes.length ?? 0} in list`}
              {" · "}
              {linkTotal} link{linkTotal === 1 ? "" : "s"}
              {!graphScopeFull && (
                <span className="text-zinc-600"> (scoped)</span>
              )}
            </p>
          </div>

          <nav
            className="col-start-2 row-start-1 flex justify-center rounded-lg border border-border bg-panel p-0.5"
            aria-label="Views"
          >
            {(
              [
                ["graph", "Dependencies"],
                ["links", "Links"],
                ["timeline", "Timeline"],
                ["architecture", "Architecture"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === id
                    ? "bg-blue-500/20 text-blue-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div
            className="col-start-3 row-start-1 flex min-w-0 flex-wrap items-center justify-end gap-2 justify-self-end"
          >
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Panels"
          >
            <PanelToggle
              label="List"
              pressed={leftNavOpen}
              onClick={toggleLeftNav}
            />
            <PanelToggle
              label="Detail"
              pressed={rightNavOpen}
              onClick={toggleRightNav}
            />
          </div>
          <input
            type="search"
            placeholder="Search id, title, tag… (shows all matches)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-52 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="accepted">Accepted</option>
            <option value="proposed">Proposed</option>
            <option value="superseded">Superseded</option>
            <option value="deprecated">Deprecated</option>
          </select>
          </div>
        </div>
      </header>

      {graph.cursorEnriching && cursorEnrichProgressLabel(graph) && (
        <div
          className="flex shrink-0 items-center gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-100"
          role="status"
        >
          <EnrichHourglass size={18} className="opacity-95" />
          <span className="shrink-0 font-medium">
            Cursor analysis
            {graph.cursorEnrichCurrent
              ? ` · ADR ${graph.cursorEnrichCurrent}`
              : ""}
          </span>
          <span
            className="shrink-0 font-mono tabular-nums text-amber-200/90"
            title="Elapsed"
          >
            {formatEnrichDuration(enrichTimers.batchElapsedSec)}
          </span>
          {enrichEtaSec != null && enrichEtaSec >= 3 && (
            <span
              className="hidden shrink-0 font-mono tabular-nums text-amber-200/65 sm:inline"
              title="Estimated time remaining"
            >
              ~{formatEnrichDuration(enrichEtaSec)} left
            </span>
          )}
          <div className="h-1.5 min-w-[6rem] flex-1 max-w-xs overflow-hidden rounded-full bg-amber-950/50">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
              style={{
                width: `${cursorEnrichPercent(graph) ?? 0}%`,
              }}
            />
          </div>
          <span className="shrink-0 font-mono tabular-nums text-amber-200/90">
            {cursorEnrichProgressLabel(graph)}
          </span>
        </div>
      )}

      {graph.warnings.length > 0 && (
        <div className="flex shrink-0 items-start gap-2 border-b border-border bg-zinc-900/50 px-2 py-1">
          <button
            type="button"
            onClick={() => setWarningsOpen((o) => !o)}
            aria-expanded={warningsOpen}
            aria-label={`${graph.warnings.length} graph warning${graph.warnings.length === 1 ? "" : "s"}`}
            title={warningsOpen ? "Hide warnings" : "Show warnings"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-base leading-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            {warningsOpen ? "−" : "−"}
          </button>
          {warningsOpen && (
            <ul className="max-h-24 min-w-0 flex-1 space-y-1 overflow-y-auto py-0.5 text-xs text-zinc-500">
              {graph.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {!leftNavOpen && (
          <PanelRail label="List" side="left" onOpen={toggleLeftNav} />
        )}
        {leftNavOpen && (
          <aside
            id="adrv-nav-list"
            className="flex w-60 shrink-0 flex-col border-r border-border bg-panel"
          >
            <PanelCollapseHeader
              title="Decisions"
              side="left"
              onCollapse={toggleLeftNav}
            />
            <AdrNavToolbar
              allNodes={filtered?.nodes ?? graph.nodes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              pickIds={navPickIds}
              onPickIdsChange={setNavPickIds}
              showAll={navShowAll}
              onShowAllChange={setNavShowAll}
              previewSize={DECISIONS_NAV_PREVIEW}
            />
            <DecisionsList
              graph={graph}
              nodes={navList.nodes}
              totalInFilter={navList.total}
              listMode={navList.mode}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAnalyze={graph.requiresCursorKey ? undefined : handleAnalyze}
              enrichCurrentAdrId={enrichTimers.activeAdrId}
              enrichItemElapsedSec={enrichTimers.itemElapsedSec}
            />
          </aside>
        )}

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          <MainNavEdgeToggles
            leftOpen={leftNavOpen}
            rightOpen={rightNavOpen}
            onToggleLeft={toggleLeftNav}
            onToggleRight={toggleRightNav}
          />
          <div className="relative min-h-0 flex-1">
          {view === "graph" && (
            <>
              {relationshipGraph && relationshipGraph.nodes.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No ADRs match your filters.
                </div>
              ) : (
                <>
                  {!graphScopeFull && relationshipGraph && (
                    <p
                      className="pointer-events-none absolute left-1/2 top-3 z-10 max-w-[min(100%,36rem)] -translate-x-1/2 rounded-full border border-border bg-panel/95 px-3 py-1 text-center text-[10px] text-zinc-400 shadow-sm backdrop-blur-sm"
                    >
                      Dependencies among{" "}
                      <span className="font-mono text-zinc-300">
                        {relationshipGraph.nodes.map((n) => n.id).join(", ")}
                      </span>
                      {" · "}
                      <span className="text-zinc-500">
                        change list, search, or Choose ADRs to view
                      </span>
                    </p>
                  )}
                  <ReactFlow
                    key={dependenciesScopeKey}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onPaneClick={() => setSelectedId(null)}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    className="bg-surface"
                  >
                    <Background gap={20} color="#25252c" />
                    <Controls
                      showInteractive={false}
                      className="!border-border !bg-panel !shadow-none"
                    />
                    <MiniMap
                      className="!border-border !bg-panel"
                      maskColor="rgba(12, 12, 14, 0.72)"
                      nodeColor="#3b82f6"
                    />
                  </ReactFlow>
                  <LinkLegend />
                </>
              )}
            </>
          )}

          {view === "links" && (
            <LinksOutline
              graph={relationshipGraph ?? graph}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setView("links");
              }}
              scope="selected"
            />
          )}

          {view === "timeline" && (
            <TimelineView
              record={selected}
              analyzingThisAdr={
                !!graph.cursorEnriching &&
                graph.cursorEnrichCurrent === selected?.id
              }
              focusedStep={timelineStep}
              onStepSelect={setTimelineStep}
            />
          )}

          {view === "architecture" && (
            <ArchitectureView
              graph={relationshipGraph ?? graph}
              selectedId={selectedId}
              onSelect={setSelectedId}
              analyzingThisAdr={
                !!graph.cursorEnriching &&
                graph.cursorEnrichCurrent === selected?.id
              }
              onAnalyze={
                graph.requiresCursorKey ? undefined : handleAnalyze
              }
              onOpenGraph={(id) => {
                setSelectedId(id);
                setView("graph");
              }}
            />
          )}
          </div>
        </main>

        {!rightNavOpen && (
          <PanelRail label="Detail" side="right" onOpen={toggleRightNav} />
        )}
        {rightNavOpen && (
          <aside
            id="adrv-nav-detail"
            className="flex w-[min(100%,28rem)] shrink-0 flex-col border-l border-border bg-panel"
          >
            <PanelCollapseHeader
              title="Detail"
              side="right"
              onCollapse={toggleRightNav}
            />
            {selected ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {!selected.cursorEnriched &&
                  graph.cursorEnriching &&
                  graph.cursorEnrichCurrent === selected.id && (
                    <div
                      className="flex shrink-0 items-center gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-100"
                      role="status"
                    >
                      <EnrichHourglass size={16} />
                      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-amber-950/50">
                        <span className="adrv-enrich-bar block h-full w-full" />
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatEnrichDuration(enrichTimers.itemElapsedSec)}
                      </span>
                      Cursor analyzing this ADR
                      {cursorEnrichProgressLabel(graph)
                        ? ` · ${cursorEnrichProgressLabel(graph)}`
                        : ""}{" "}
                      — links and diagrams update when done
                    </div>
                  )}
                {!selected.cursorEnriched && !graph.requiresCursorKey && (
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-zinc-900/40 px-4 py-2.5">
                      <p className="text-xs text-zinc-400">
                        Run Cursor analysis for enriched links and diagrams.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAnalyze(selected.id)}
                        disabled={
                          (graph.cursorEnrichQueued ?? []).includes(
                            selected.id,
                          ) ||
                          (graph.cursorEnriching &&
                            graph.cursorEnrichCurrent === selected.id)
                        }
                        className="shrink-0 rounded-md border border-blue-500/40 bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-500/25 disabled:opacity-50"
                      >
                        {graph.cursorEnriching &&
                        graph.cursorEnrichCurrent === selected.id
                          ? "Analyzing…"
                          : (graph.cursorEnrichQueued ?? []).includes(
                                selected.id,
                              )
                            ? "Queued"
                            : "Analyze"}
                      </button>
                    </div>
                  )}
              {selected.cursorEnriched && (
                <div
                  className="flex shrink-0 items-center gap-2 border-b border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-200"
                  role="status"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-[11px] text-emerald-100"
                    aria-hidden
                  >
                    ✓
                  </span>
                  Cursor analysis complete
                </div>
              )}
              <div className="min-h-0 flex-1">
                <DetailPanel
                  graph={relationshipGraph ?? graph}
                  selected={selected}
                  onSelect={setSelectedId}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-zinc-300">
                No decision selected
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
                Click a decision in the list, or double-click a node for Timeline.
                Or open{" "}
                <button
                  type="button"
                  className="text-blue-400 hover:underline"
                  onClick={() => setView("links")}
                >
                  Links
                </button>{" "}
                to read how ADRs connect.
              </p>
            </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
