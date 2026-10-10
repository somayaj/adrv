import { useMemo, useState } from "react";
import type { AdrRecord } from "@adrv/core/browser";

type Props = {
  allNodes: AdrRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pickIds: string[] | null;
  onPickIdsChange: (ids: string[] | null) => void;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  previewSize: number;
};

export function AdrNavToolbar({
  allNodes,
  selectedId,
  onSelect,
  pickIds,
  onPickIdsChange,
  showAll,
  onShowAllChange,
  previewSize,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sorted = useMemo(
    () => [...allNodes].sort((a, b) => a.id.localeCompare(b.id)),
    [allNodes],
  );

  const togglePick = (id: string) => {
    const base = new Set(pickIds ?? []);
    if (base.has(id)) base.delete(id);
    else base.add(id);
    const next = [...base].sort((a, b) => a.localeCompare(b));
    onPickIdsChange(next.length ? next : null);
    onShowAllChange(false);
  };

  const ensureVisible = (id: string) => {
    if (showAll && !pickIds?.length) return;
    if (pickIds?.includes(id)) return;
    const previewIds = sorted.slice(0, previewSize).map((n) => n.id);
    if (previewIds.includes(id)) return;
    const base = pickIds?.length ? pickIds : previewIds;
    onPickIdsChange([...new Set([...base, id])].sort((a, b) => a.localeCompare(b)));
    onShowAllChange(false);
  };

  return (
    <div className="shrink-0 space-y-2 border-b border-border px-2 py-2">
      <label className="block">
        <span className="sr-only">Go to ADR</span>
        <select
          value={selectedId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            ensureVisible(id);
            onSelect(id);
          }}
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Go to ADR…</option>
          {sorted.map((n) => (
            <option key={n.id} value={n.id}>
              {n.id} — {n.title}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-1">
        {!showAll && !pickIds?.length && sorted.length > previewSize && (
          <button
            type="button"
            onClick={() => onShowAllChange(true)}
            className="rounded-md border border-border px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Show all {sorted.length}
          </button>
        )}
        {(showAll || pickIds?.length) && (
          <button
            type="button"
            onClick={() => {
              onShowAllChange(false);
              onPickIdsChange(null);
            }}
            className="rounded-md border border-border px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            First {previewSize} only
          </button>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="rounded-md border border-border px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-expanded={pickerOpen}
        >
          {pickerOpen ? "Hide picker" : "Choose ADRs to view"}
        </button>
      </div>

      {pickerOpen && (
        <div
          className="max-h-40 overflow-y-auto rounded-md border border-border bg-surface p-2"
          role="group"
          aria-label="ADRs to show in list"
        >
          {sorted.map((n) => (
            <label
              key={n.id}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-zinc-800/60"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pickIds?.includes(n.id) ?? false}
                onChange={() => togglePick(n.id)}
              />
              <span className="min-w-0">
                <span className="font-mono text-zinc-500">{n.id}</span>
                <span className="block truncate text-zinc-300">{n.title}</span>
              </span>
            </label>
          ))}
          {pickIds?.length ? (
            <p className="mt-2 border-t border-border pt-2 text-[10px] text-zinc-500">
              Listing {pickIds.length} selected — uncheck all or use “First{" "}
              {previewSize} only” to reset.
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-zinc-600">
              Checked ADRs appear in the list and Dependencies graph.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
