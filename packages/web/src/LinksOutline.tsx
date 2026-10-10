import type { AdrEdge, AdrGraph, AdrRecord } from "@adrv/core/browser";
import {
  LINK_META,
  dedupeEdges,
  decisionSnippet,
  linkSentence,
} from "./linkCopy";
type Props = {
  graph: AdrGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  scope: "all" | "selected";
};

function recordById(graph: AdrGraph, id: string): AdrRecord | undefined {
  return graph.nodes.find((n) => n.id === id);
}

function LinkCard({
  edge,
  graph,
  onSelect,
  focusId,
}: {
  edge: AdrEdge;
  graph: AdrGraph;
  onSelect: (id: string) => void;
  focusId: string | null;
}) {
  const from = recordById(graph, edge.from);
  const to = recordById(graph, edge.to);
  if (!from || !to) return null;

  const meta = LINK_META[edge.type];
  const outbound = focusId === from.id;
  const sentence = linkSentence(
    edge,
    from,
    to,
    outbound || !focusId ? "outbound" : "inbound",
  );
  const other = focusId === from.id ? to : focusId === to.id ? from : to;

  return (
    <article
      className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-zinc-600"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-zinc-100"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </span>
        {edge.inferred && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
            Inferred
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{sentence}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(from.id)}
          className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
            focusId === from.id
              ? "border-blue-500/50 bg-blue-500/10 text-blue-100"
              : "border-border text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span className="font-mono text-zinc-500">{from.id}</span>
          <span className="mt-0.5 block font-medium text-zinc-200">
            {from.title}
          </span>
        </button>
        <span className="self-center text-zinc-600">→</span>
        <button
          type="button"
          onClick={() => onSelect(to.id)}
          className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
            focusId === to.id
              ? "border-blue-500/50 bg-blue-500/10 text-blue-100"
              : "border-border text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span className="font-mono text-zinc-500">{to.id}</span>
          <span className="mt-0.5 block font-medium text-zinc-200">
            {to.title}
          </span>
        </button>
      </div>
      {decisionSnippet(other.body) && (
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-zinc-500">
          <span className="text-zinc-600">Decision — </span>
          {decisionSnippet(other.body)}
        </p>
      )}
    </article>
  );
}

export function LinksOutline({ graph, selectedId, onSelect, scope }: Props) {
  const edges = dedupeEdges(graph.edges);
  const filtered =
    scope === "selected" && selectedId
      ? edges.filter((e) => e.from === selectedId || e.to === selectedId)
      : edges;

  const grouped = new Map<string, AdrEdge[]>();
  for (const e of filtered) {
    const list = grouped.get(e.type) ?? [];
    list.push(e);
    grouped.set(e.type, list);
  }

  const typeOrder = [
    "depends-on",
    "relates-to",
    "supersedes",
    "superseded-by",
    "amends",
  ] as const;

  if (scope === "selected" && !selectedId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-zinc-300">No ADR selected</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          Pick a decision in the left list, then open Links to see how it
          connects to others.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-zinc-300">No links yet</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          {scope === "selected" && selectedId
            ? `ADR ${selectedId} has no depends-on, relates-to, or supersedes links in frontmatter or body.`
            : "Add frontmatter (depends-on, relates-to) or link to other ADRs in markdown."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-5 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-lg font-semibold text-zinc-100">
          {scope === "selected" && selectedId
            ? `Links for ADR ${selectedId}`
            : "Decision links"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {scope === "selected"
            ? "How this record connects to the rest of the architecture."
            : "Plain-language outline of every relationship in the corpus."}
        </p>

        <div className="mt-6 space-y-8">
          {typeOrder.map((type) => {
            const list = grouped.get(type);
            if (!list?.length) return null;
            const meta = LINK_META[type];
            return (
              <section key={type}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </h3>
                  <span className="text-xs text-zinc-600">
                    {list.length} link{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mb-3 text-xs text-zinc-500">{meta.description}</p>
                <div className="space-y-3">
                  {list.map((edge) => (
                    <LinkCard
                      key={`${edge.from}-${edge.to}-${edge.type}`}
                      edge={edge}
                      graph={graph}
                      onSelect={onSelect}
                      focusId={selectedId}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function linkCountFor(id: string, edges: AdrEdge[]): number {
  return dedupeEdges(edges).filter(
    (e) => e.from === id || e.to === id,
  ).length;
}
