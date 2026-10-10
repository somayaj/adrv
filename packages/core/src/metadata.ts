export function parseMetadataTable(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    const key = cells[0].replace(/\*/g, "").trim().toLowerCase();
    const val = cells[1].trim();
    if (key && val) map.set(key, val);
  }
  return map;
}

export function titleFromLeadingIdLine(body: string): string | null {
  const re = /^(\d{1,8})\s*[—–-]\s*(.+)$/;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) return null;
    const m = re.exec(trimmed);
    if (m?.[2]) return m[2].trim();
    break;
  }
  return null;
}

function stripFenced(body: string): string {
  return body.replace(/```[\s\S]*?```/g, "");
}

/** Nygard `**Status:**`, line `Status:`, supersession headers (outside fences). */
export function statusFromProse(body: string): string | null {
  const scan = stripFenced(body);
  let inHeader = true;
  for (const line of scan.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) inHeader = false;

    const bold = /^\*\*status:\*\*\s+(.+)$/i.exec(trimmed);
    if (bold?.[1]) return bold[1].trim();

    if (inHeader) {
      const plain = /^status:\s*(.+)$/i.exec(trimmed);
      if (plain?.[1]) {
        const val = plain[1].trim();
        if (val.length <= 120 && !val.startsWith("<")) return val;
      }
      if (/^\*\*supersedes\*\*:?\s*.+$/i.test(trimmed)) return "superseded";
      if (/superseded\s+by\s+adr/i.test(trimmed)) return "superseded";
    }
  }
  return null;
}

function sectionBody(body: string, names: string[]): string {
  const heading = /^(#{1,3})\s+(.+)$/;
  let current: string | null = null;
  let buf = "";
  let out = "";
  for (const line of body.split("\n")) {
    const hm = heading.exec(line);
    if (hm) {
      if (current && names.some((n) => current!.toLowerCase() === n.toLowerCase())) {
        out = buf;
      }
      current = hm[2].trim();
      buf = "";
    } else if (current) {
      buf += line + "\n";
    }
  }
  if (current && names.some((n) => current!.toLowerCase() === n.toLowerCase())) {
    out = buf;
  }
  return out;
}

/** Plain markdown ADR (Nygard / Tyree): Issue or Context plus Decision body. */
export function classicDecisionRecord(body: string): boolean {
  const stripped = stripFenced(body);
  const lower = stripped.toLowerCase();
  const hasContext =
    lower.includes("## context") ||
    lower.includes("## issue") ||
    lower.includes("context and problem");
  if (!hasContext) return false;
  const decision = sectionBody(stripped, ["Decision"]).trim();
  return decision.length >= 8;
}

export function dateFromProse(body: string): string | null {
  const scan = stripFenced(body);
  let inHeader = true;
  for (const line of scan.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      inHeader = false;
      break;
    }
    const bold = /^\*\*date\*\*:?\s*(\S.+?)\s*$/i.exec(trimmed);
    if (bold?.[1]) return bold[1].trim();
    const plain = /^date:\s*(\S.+?)\s*$/i.exec(trimmed);
    if (plain?.[1]) return plain[1].trim();
  }
  return null;
}

/** MADR `Decision Outcome` / `Chosen option:` */
export function madrDecisionMade(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("chosen option:") ||
    (lower.includes("decision outcome") && lower.includes("chosen option"))
  );
}

export function tagsFromMetadata(table: Map<string, string>): string[] {
  const audience = table.get("audience");
  if (!audience) return [];
  return audience
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
