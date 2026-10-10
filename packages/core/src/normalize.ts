/** Normalize "ADR-0007", "0007", "7" → "0007" when numeric. */
export function normalizeAdrId(raw: string): string | null {
  const trimmed = raw.trim().replace(/^adr[-\s]*/i, "");
  const fromPath = trimmed.match(/(\d{1,8})/);
  if (!fromPath) return null;
  const n = parseInt(fromPath[1], 10);
  if (Number.isNaN(n)) return null;
  return String(n).padStart(4, "0");
}

export function titleFromFilename(baseName: string): string {
  const withoutExt = baseName.replace(/\.[^.]+$/i, "");
  const slug = withoutExt.replace(/^\d+[-_.]*/, "");
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function normalizeStatus(raw: unknown): import("./types.js").AdrStatus {
  if (typeof raw !== "string") return "unknown";
  const s = raw.toLowerCase().trim();
  if (!s) return "unknown";
  if (s.includes("superseded") || s.includes("superseeded")) return "superseded";
  if (s.includes("rejected") || s.includes("declined")) return "rejected";
  if (s.includes("deprecated") || s.includes("retired")) return "deprecated";
  if (
    s === "accepted" ||
    s === "approved" ||
    s === "agreed" ||
    s === "decided" ||
    s === "implemented" ||
    s === "done" ||
    s === "active" ||
    s === "final"
  ) {
    return "accepted";
  }
  if (
    s === "proposed" ||
    s === "draft" ||
    s === "pending" ||
    s === "wip" ||
    s.includes("on hold") ||
    s.includes("on-hold")
  ) {
    return "proposed";
  }
  return "unknown";
}
