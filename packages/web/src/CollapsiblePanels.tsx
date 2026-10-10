import type { ReactNode } from "react";

type RailProps = {
  label: string;
  side: "left" | "right";
  onOpen: () => void;
};

export function PanelRail({ label, side, onOpen }: RailProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Show ${label}`}
      aria-label={`Show ${label} panel`}
      className={`flex w-10 shrink-0 flex-col items-center justify-center gap-2 border-border bg-zinc-900/90 py-6 text-zinc-500 shadow-inner transition-colors hover:bg-zinc-800 hover:text-zinc-100 ${
        side === "left" ? "border-r" : "border-l"
      }`}
    >
      <span
        className="text-lg leading-none text-zinc-400"
        aria-hidden
      >
        {side === "left" ? "›" : "‹"}
      </span>
      <span
        className={`text-[9px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] ${
          side === "left" ? "rotate-180" : ""
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function PanelCollapseHeader({
  title,
  onCollapse,
  side = "left",
}: {
  title: string;
  onCollapse: () => void;
  side?: "left" | "right";
}) {
  const chevron = side === "left" ? "‹" : "›";
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5 pl-3 pr-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </span>
      <button
        type="button"
        onClick={onCollapse}
        className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label={`Collapse ${title}`}
        title={`Collapse ${title}`}
      >
        {chevron}
      </button>
    </div>
  );
}

/** Collapse/expand controls on the center pane seam (always visible). */
export function MainNavEdgeToggles({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  const base =
    "absolute top-1/2 z-30 flex h-10 w-7 -translate-y-1/2 items-center justify-center border border-border bg-panel text-sm text-zinc-400 shadow-lg transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100";

  return (
    <>
      <button
        type="button"
        onClick={onToggleLeft}
        className={`${base} left-0 rounded-r-md border-l-0`}
        aria-expanded={leftOpen}
        aria-controls="adrv-nav-list"
        title={leftOpen ? "Collapse decisions list" : "Expand decisions list"}
      >
        <span aria-hidden>{leftOpen ? "‹" : "›"}</span>
      </button>
      <button
        type="button"
        onClick={onToggleRight}
        className={`${base} right-0 rounded-l-md border-r-0`}
        aria-expanded={rightOpen}
        aria-controls="adrv-nav-detail"
        title={rightOpen ? "Collapse detail panel" : "Expand detail panel"}
      >
        <span aria-hidden>{rightOpen ? "›" : "‹"}</span>
      </button>
    </>
  );
}

export function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
  className = "",
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800/50"
      >
        <span>{title}</span>
        <span className="font-mono text-zinc-500" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}
