import type { AdrRecord } from "@adrv/core/browser";
import {
  decisionStepsForRecord,
  decisionStepsFromBody,
} from "@adrv/core/browser";
import { statusBadgeClass } from "./status";

type Props = {
  /** Selected ADR only — timeline never spans multiple records. */
  record: AdrRecord | null;
  analyzingThisAdr: boolean;
  focusedStep: number | null;
  onStepSelect: (index: number) => void;
};

function decisionsInAdr(record: AdrRecord): string[] {
  if (record.steps?.length) return record.steps;
  return decisionStepsForRecord(record.body, record.architecture);
}

function timelineReady(
  analyzingThisAdr: boolean,
  record: AdrRecord,
  decisions: string[],
): boolean {
  if (decisions.length > 0) return true;
  if (!analyzingThisAdr) return true;
  return !!record.cursorEnriched;
}

export function TimelineView({
  record,
  analyzingThisAdr,
  focusedStep,
  onStepSelect,
}: Props) {
  if (!record) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-zinc-500">
          Select one ADR on the left. Timeline shows only that record’s
          decisions — not a cross-ADR history.
        </p>
      </div>
    );
  }

  const decisions = decisionsInAdr(record);

  if (!timelineReady(analyzingThisAdr, record, decisions)) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
        role="status"
      >
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
          <div className="adrv-enrich-bar" />
        </div>
        <p className="text-sm text-zinc-400">Waiting for Cursor analysis</p>
        <p className="max-w-sm text-xs text-zinc-600">
          The decision timeline for {record.id} appears after Cursor finishes
          researching this ADR.
        </p>
      </div>
    );
  }

  const fromMarkdown = decisionStepsFromBody(record.body).length > 0;
  const fromCursor = !!(record.steps?.length && record.cursorEnriched);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-6 md:px-8 lg:py-8">
      <header className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">{record.id}</span>
          {record.date && (
            <time className="text-xs text-zinc-600" dateTime={record.date}>
              {record.date}
            </time>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusBadgeClass(record.status)}`}
          >
            {record.status}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-zinc-100">
          {record.title}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          {fromCursor
            ? "Decisions inferred by Cursor from this ADR"
            : fromMarkdown
              ? "From numbered items under ## Decision"
              : "From the decision flow in this record (Cursor or architecture)"}
        </p>
      </header>

      {decisions.length === 0 ? (
        <div className="mx-auto mt-8 max-w-lg rounded-lg border border-border bg-panel p-6">
          <p className="text-sm font-medium text-zinc-200">
            No decision timeline yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            After Cursor analysis, ordered decisions appear here. You can also add
            a numbered list under{" "}
            <code className="text-zinc-400">## Decision</code> in the markdown.
          </p>
        </div>
      ) : (
        <ol className="relative mx-auto mt-8 max-w-2xl space-y-0">
          {decisions.map((label, i) => {
            const active = focusedStep === i;
            return (
              <li key={i} className="relative flex gap-4 pb-10 last:pb-2">
                {i < decisions.length - 1 && (
                  <span
                    className="absolute left-[11px] top-7 bottom-0 w-px bg-[var(--color-border)]"
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => onStepSelect(i)}
                  className={`relative z-10 flex min-w-0 flex-1 gap-4 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/30"
                      : "border-transparent hover:border-border hover:bg-zinc-800/40"
                  }`}
                >
                  <span
                    className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-violet-500/50 bg-violet-500/15 text-[10px] font-bold text-violet-200"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      Decision {i + 1}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-200">
                      {label}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
