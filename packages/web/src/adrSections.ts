export type AdrSection = {
  title: string;
  body: string;
};

/** Split ADR markdown on `##` headings (fenced blocks kept in section body). */
export function adrSectionsFromBody(body: string): AdrSection[] {
  const sections: AdrSection[] = [];
  let current: AdrSection | null = null;

  for (const line of body.split("\n")) {
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      if (current) sections.push(current);
      current = { title: h2[1].trim(), body: "" };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  return sections.map((s) => ({
    title: s.title,
    body: s.body.trim(),
  }));
}

/** Tyree–Akerman order for the timeline reader (legacy Context/Consequences still sort sensibly). */
export function adrSectionsForReading(body: string): AdrSection[] {
  const all = adrSectionsFromBody(body);
  if (all.length === 0) return [];

  const priority = [
    "issue",
    "decision",
    "argument",
    "implications",
    "positions",
    "assumptions",
    "constraints",
    "related",
    "architecture",
    "context",
    "consequences",
  ];
  const ranked = [...all].sort((a, b) => {
    const ai = priority.findIndex((p) => a.title.toLowerCase().includes(p));
    const bi = priority.findIndex((p) => b.title.toLowerCase().includes(p));
    const ap = ai === -1 ? 99 : ai;
    const bp = bi === -1 ? 99 : bi;
    if (ap !== bp) return ap - bp;
    return 0;
  });
  return ranked;
}
