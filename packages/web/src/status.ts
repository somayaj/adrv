import type { AdrStatus } from "@adrv/core/browser";

const STYLES: Record<AdrStatus, string> = {
  accepted:
    "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  proposed: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
  superseded: "bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30",
  deprecated: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  rejected: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  unknown: "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-600/40",
};

export function statusBadgeClass(status: AdrStatus): string {
  return STYLES[status] ?? STYLES.unknown;
}
