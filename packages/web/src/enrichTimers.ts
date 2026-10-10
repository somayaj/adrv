import { useEffect, useRef, useState } from "react";
import type { AdrGraph } from "@adrv/core/browser";

/** Elapsed wall time as M:SS or H:MM:SS. */
export function formatEnrichDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Ticking elapsed timers while `cursorEnriching` (batch + current ADR).
 * Resets when enrichment stops or when `cursorEnrichCurrent` changes.
 */
export function useEnrichTimers(graph: AdrGraph | null) {
  const [tick, setTick] = useState(() => Date.now());
  const batchStartRef = useRef<number | null>(null);
  const itemStartRef = useRef<number | null>(null);
  const lastCurrentRef = useRef<string | undefined>(undefined);

  const enriching = !!graph?.cursorEnriching;
  const current = graph?.cursorEnrichCurrent;

  useEffect(() => {
    if (!enriching) {
      batchStartRef.current = null;
      itemStartRef.current = null;
      lastCurrentRef.current = undefined;
      return;
    }
    if (batchStartRef.current == null) {
      batchStartRef.current = Date.now();
    }
    if (current !== lastCurrentRef.current) {
      lastCurrentRef.current = current;
      itemStartRef.current = current ? Date.now() : null;
    }
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enriching, current]);

  const batchElapsedSec =
    enriching && batchStartRef.current != null
      ? (tick - batchStartRef.current) / 1000
      : 0;
  const itemElapsedSec =
    enriching && current && itemStartRef.current != null
      ? (tick - itemStartRef.current) / 1000
      : 0;

  return { batchElapsedSec, itemElapsedSec, activeAdrId: current ?? null };
}
