import { useEffect, useState } from "react";
import type { AdrGraph, AdrRecord } from "@adrv/core/browser";
import { LinksOutline, linkCountFor } from "./LinksOutline";
import { statusBadgeClass } from "./status";
import ReactMarkdown from "react-markdown";

type Tab = "links" | "document";

type Props = {
  graph: AdrGraph;
  selected: AdrRecord;
  onSelect: (id: string) => void;
};

export function DetailPanel({ graph, selected, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>("document");
  const links = linkCountFor(selected.id, graph.edges);

  useEffect(() => {
    setTab("document");
  }, [selected.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">{selected.id}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs capitalize ${statusBadgeClass(selected.status)}`}
          >
            {selected.status}
          </span>
          {links > 0 && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              {links} link{links === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-base font-semibold leading-snug text-zinc-100">
          {selected.title}
        </h2>
        <div className="mt-3 flex gap-1 rounded-lg border border-border p-0.5">
          <TabButton
            active={tab === "document"}
            onClick={() => setTab("document")}
          >
            Decision
          </TabButton>
          <TabButton active={tab === "links"} onClick={() => setTab("links")}>
            Links
          </TabButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "links" ? (
          <LinksOutline
            graph={graph}
            selectedId={selected.id}
            onSelect={onSelect}
            scope="selected"
          />
        ) : (
          <div className="h-full overflow-y-auto p-4 text-sm leading-relaxed text-zinc-300 [&_a]:text-blue-400 [&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-100 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-zinc-200 [&_p]:mb-2">
            <ReactMarkdown>{selected.body}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}
