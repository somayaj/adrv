import { useCallback, useState } from "react";
import { LINK_META } from "./linkCopy";

const ORDER: (keyof typeof LINK_META)[] = [
  "depends-on",
  "relates-to",
  "supersedes",
  "amends",
];

const STORAGE_KEY = "adrv-link-legend-open";

function readOpen(defaultOpen: boolean): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

export function LinkLegend() {
  const [open, setOpen] = useState(() => readOpen(false));

  const toggle = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div
      className={`pointer-events-auto absolute left-10 top-[4.75rem] z-[5] rounded-lg border border-border bg-panel/95 shadow-sm backdrop-blur-sm ${
        open ? "max-w-xs" : ""
      }`}
      aria-label="Link types legend"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={
          open
            ? "Hide link types legend"
            : "Show link types legend (depends on, supersedes, …)"
        }
        className={`text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 ${
          open
            ? "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left"
            : "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
        }`}
      >
        {open ? (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Link types
            </span>
            <span className="font-mono text-sm leading-none" aria-hidden>
              −
            </span>
          </>
        ) : (
          <>
            <span className="font-mono text-sm leading-none" aria-hidden>
              +
            </span>
            <span>Legend</span>
          </>
        )}
      </button>
      {open && (
        <div className="max-h-[min(38vh,14rem)] overflow-y-auto border-t border-border px-3 pb-3 pt-1">
          <ul className="space-y-2">
            {ORDER.map((key) => {
              const m = LINK_META[key];
              return (
                <li key={key} className="flex gap-2">
                  <span
                    className="mt-1.5 h-0.5 w-5 shrink-0 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  <div>
                    <p className="text-xs font-medium text-zinc-200">
                      {m.label}
                    </p>
                    <p className="text-[11px] leading-snug text-zinc-500">
                      {m.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-[10px] text-zinc-600">
            Dashed edges = inferred from markdown text
          </p>
        </div>
      )}
    </div>
  );
}
