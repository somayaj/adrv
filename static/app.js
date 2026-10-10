/** Minimal UI bundled with `adrv serve` — uses GET /api/graph */

let graph = null;
let selectedId = null;
let view = "deps";

const KIND_COLOR = {
  client: "#a1a1aa",
  gateway: "#fbbf24",
  service: "#60a5fa",
  database: "#34d399",
  queue: "#a78bfa",
  worker: "#71717a",
  external: "#52525b",
};

const LINK_META = {
  "depends-on": {
    label: "Depends on",
    color: "#3b82f6",
    description:
      "Assumes another decision is already in place.",
  },
  "relates-to": {
    label: "Related to",
    color: "#71717a",
    description: "Same topic — read together.",
  },
  supersedes: {
    label: "Supersedes",
    color: "#f59e0b",
    description: "Replaces an older decision.",
  },
  "superseded-by": {
    label: "Superseded by",
    color: "#f59e0b",
    description: "Replaced by a newer decision.",
  },
  amends: {
    label: "Amends",
    color: "#a78bfa",
    description: "Narrows or extends without replacing.",
  },
};

const LINK_LEGEND_ORDER = [
  "depends-on",
  "relates-to",
  "supersedes",
  "amends",
];

function linkMeta(type) {
  return LINK_META[type] || { label: type, color: "#71717a", description: "" };
}

function renderLinkLegend(container) {
  let el = container.querySelector(".link-legend");
  if (!el) {
    el = document.createElement("div");
    el.className = "link-legend";
    el.setAttribute("aria-label", "Link types legend");
    container.appendChild(el);
  }
  const items = LINK_LEGEND_ORDER.map((key) => {
    const m = LINK_META[key];
    return `<li><span class="swatch" style="background:${m.color}"></span><div><div class="name">${escapeHtml(m.label)}</div><div class="desc">${escapeHtml(m.description)}</div></div></li>`;
  }).join("");
  el.innerHTML = `<h3>Link types</h3><ul>${items}</ul><p class="foot">Dashed edges = inferred from markdown text</p>`;
}

function removeLinkLegend(container) {
  container.querySelector(".link-legend")?.remove();
}

async function load() {
  const res = await fetch("/api/graph");
  if (!res.ok) throw new Error(await res.text());
  graph = await res.json();
  if (!graph.nodes?.length) throw new Error("No ADRs in graph");
  selectedId = graph.nodes[0].id;
  document.getElementById("summary").textContent =
    `${graph.nodes.length} decisions · ${graph.edges.length} links · embedded UI`;
  render();
}

function node(id) {
  return graph.nodes.find((n) => n.id === id);
}

function render() {
  const app = document.getElementById("app");
  const n = node(selectedId);
  if (!n) return;

  const viewLabel =
    view === "arch"
      ? "Architecture"
      : view === "steps"
        ? "Steps"
        : view === "links"
          ? "Links"
          : "Dependencies";
  app.innerHTML = `
    <aside id="list"></aside>
    <div class="stage">
      <div class="detail">
        <span class="id">${n.id}</span><span class="badge">${n.status}</span>
        <h2>${escapeHtml(n.title)}</h2>
        <pre class="body">${escapeHtml(n.body.slice(0, 800))}${n.body.length > 800 ? "…" : ""}</pre>
      </div>
      <p class="view-hint" id="viewHint">${viewLabel} for ADR ${escapeHtml(n.id)}</p>
      <div class="canvas-wrap" id="canvas"><svg id="svg"></svg></div>
    </div>`;

  const list = document.getElementById("list");
  for (const item of graph.nodes) {
    const b = document.createElement("button");
    b.className = item.id === selectedId ? "active" : "";
    b.innerHTML = `<span class="id">${item.id}</span><br>${escapeHtml(item.title)}`;
    b.onclick = () => {
      selectedId = item.id;
      render();
    };
    list.appendChild(b);
  }

  if (view === "arch" && n.architecture?.nodes?.length) {
    drawArch(n.architecture);
  } else if (view === "arch") {
    drawArchEmpty();
  } else if (view === "steps") drawSteps(n);
  else if (view === "links") drawLinks();
  else drawDeps();
}

function stripFenced(body) {
  return body.replace(/```[\s\S]*?```/g, "");
}

function decisionSection(body) {
  const lines = stripFenced(body).split("\n");
  let inDecision = false;
  let buf = "";
  for (const line of lines) {
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      const title = hm[2].trim().toLowerCase();
      if (title === "decision") {
        inDecision = true;
        buf = "";
        continue;
      }
      if (inDecision) break;
    } else if (inDecision) {
      buf += line + "\n";
    }
  }
  return buf;
}

function numberedSteps(body) {
  const re = /^\s*\d+\.\s+(.+)$/;
  const steps = [];
  for (const line of decisionSection(body).split("\n")) {
    const m = re.exec(line);
    if (m) {
      let s = m[1]
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/`/g, "")
        .trim();
      if (s.length >= 3) steps.push(s);
    }
  }
  return steps;
}

function archStepLabels(spec) {
  if (!spec?.nodes?.length) return [];
  const labels = new Map(spec.nodes.map((n) => [n.id, n.label]));
  const incoming = new Map(spec.nodes.map((n) => [n.id, 0]));
  for (const e of spec.edges || []) {
    incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
  }
  const out = new Map();
  for (const e of spec.edges || []) {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e.to);
  }
  const start =
    spec.nodes.find((n) => (incoming.get(n.id) || 0) === 0)?.id ||
    spec.nodes[0].id;
  const ordered = [];
  const seen = new Set();
  let cur = start;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    ordered.push(labels.get(cur) || cur);
    const nexts = out.get(cur) || [];
    cur = nexts.find((t) => !seen.has(t));
  }
  for (const n of spec.nodes) {
    if (!seen.has(n.id)) ordered.push(n.label);
  }
  return ordered;
}

function stepsForNode(n) {
  const numbered = numberedSteps(n.body);
  if (numbered.length) return numbered;
  return archStepLabels(n.architecture);
}

function drawSteps(n) {
  const wrap = canvasEl();
  if (!wrap) return;
  removeLinkLegend(wrap);
  const steps = stepsForNode(n);
  if (!steps.length) {
    wrap.innerHTML = `<p style="padding:1.5rem;color:#8b8b9a;font-size:0.875rem;line-height:1.5">ADR <strong>${escapeHtml(n.id)}</strong> has no numbered steps under <code>## Decision</code> and no architecture diagram to outline.</p>`;
    return;
  }
  const ol = document.createElement("ol");
  ol.style.cssText =
    "margin:0;padding:1.25rem 1.5rem 1.25rem 2.5rem;overflow:auto;height:100%;line-height:1.6;font-size:0.9rem";
  for (const s of steps) {
    const li = document.createElement("li");
    li.style.marginBottom = "1rem";
    li.textContent = s;
    ol.appendChild(li);
  }
  wrap.innerHTML = "";
  wrap.appendChild(ol);
}

function drawLinks() {
  const wrap = document.querySelector(".canvas-wrap");
  const related = graph.edges.filter(
    (e) => e.from === selectedId || e.to === selectedId,
  );
  if (!related.length) {
    wrap.innerHTML = `<p style="padding:1.5rem;color:#8b8b9a;font-size:0.875rem;line-height:1.5">ADR <strong>${escapeHtml(selectedId)}</strong> has no graph links to other ADRs (add <code>depends-on</code> / <code>relates-to</code> in frontmatter or link to <code>NNNN-slug.md</code> in the body).</p>`;
    return;
  }
  const ul = document.createElement("ul");
  ul.style.cssText =
    "list-style:none;margin:0;padding:1rem 1.25rem;overflow:auto;height:100%";
  for (const e of related) {
    const other = e.from === selectedId ? e.to : e.from;
    const otherNode = node(other);
    const li = document.createElement("li");
    li.style.cssText =
      "margin-bottom:0.75rem;padding:0.75rem;border:1px solid #2a2a32;border-radius:8px;background:#141418";
    const meta = linkMeta(e.type);
    li.innerHTML = `<span class="link-pill" style="background:${meta.color}22;color:${meta.color}">${escapeHtml(meta.label)}</span>${e.inferred ? '<span class="badge">inferred</span>' : ""}
      <span style="font-size:0.75rem;color:#8b8b9a;margin-left:0.5rem">${e.from} → ${e.to}</span>
      <div style="margin-top:0.5rem;font-size:0.85rem">${escapeHtml(otherNode?.title ?? other)}</div>`;
    li.onclick = () => {
      selectedId = other;
      render();
    };
    ul.appendChild(li);
  }
  wrap.innerHTML = "";
  wrap.appendChild(ul);
  renderLinkLegend(wrap);
}

function canvasEl() {
  return document.getElementById("canvas");
}

function ensureSvg() {
  const wrap = canvasEl();
  if (!wrap) return null;
  let svg = document.getElementById("svg");
  if (!svg) {
    wrap.innerHTML = '<svg id="svg"></svg>';
    svg = document.getElementById("svg");
  }
  return svg;
}

function drawArchEmpty() {
  const wrap = canvasEl();
  if (!wrap) return;
  wrap.innerHTML = `<p style="padding:1.5rem;color:#8b8b9a;font-size:0.875rem;line-height:1.5">ADR <strong>${escapeHtml(selectedId)}</strong> has no fenced <code>architecture</code> YAML block.</p>`;
  removeLinkLegend(wrap);
}

function drawDeps() {
  const edges = graph.edges.filter(
    (e) =>
      !e.inferred ||
      graph.edges.filter((x) => x.from === e.from && x.to === e.to).length === 1,
  );
  const ids = new Set(graph.nodes.map((n) => n.id));
  const relevant = new Set([selectedId]);
  for (const e of edges) {
    if (e.from === selectedId || e.to === selectedId) {
      relevant.add(e.from);
      relevant.add(e.to);
    }
  }
  const nodes = graph.nodes.filter((n) => relevant.has(n.id));
  const wrap = canvasEl();
  layoutAndDraw(
    nodes.map((n) => ({ id: n.id, label: n.title, kind: "service" })),
    edges
      .filter((e) => relevant.has(e.from) && relevant.has(e.to))
      .map((e) => {
        const meta = linkMeta(e.type);
        return {
          from: e.from,
          to: e.to,
          label: meta.label,
          dashed: !!e.inferred,
          stroke: meta.color,
        };
      }),
    {
      onNodeDblClick: true,
    },
  );
  if (wrap) renderLinkLegend(wrap);
}

function drawArch(spec) {
  const wrap = canvasEl();
  layoutAndDraw(
    spec.nodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind })),
    spec.edges.map((e) => ({
      from: e.from,
      to: e.to,
      label: e.label || "",
      dashed: e.async,
      stroke: e.async ? "#a78bfa" : "#52525b",
    })),
  );
  if (wrap) removeLinkLegend(wrap);
}

function layoutAndDraw(nodes, edges, opts) {
  const svg = ensureSvg();
  if (!svg) return;
  const w = svg.clientWidth || 800;
  const h = svg.clientHeight || 500;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  const pos = new Map();
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });

  let lines = "";
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    const stroke = e.stroke || "#52525b";
    lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${stroke}" stroke-width="2" ${e.dashed ? 'stroke-dasharray="6 4"' : ""} />`;
    if (e.label) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      lines += `<rect x="${mx - 36}" y="${my - 10}" width="72" height="14" rx="3" fill="#18181b" opacity="0.9" />`;
      lines += `<text x="${mx}" y="${my}" fill="#f4f4f5" font-size="10" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeHtml(e.label)}</text>`;
    }
  }

  let boxes = "";
  for (const n of nodes) {
    const p = pos.get(n.id);
    const color = KIND_COLOR[n.kind] || KIND_COLOR.service;
    const label = truncate(n.label, 28);
    const bw = Math.min(220, Math.max(100, label.length * 7 + 24));
    const bh = 44;
    const adrAttr = opts?.onNodeDblClick
      ? ` data-adr-id="${escapeHtml(n.id)}" class="dep-node" style="cursor:pointer"`
      : "";
    boxes += `<rect x="${p.x - bw / 2}" y="${p.y - bh / 2}" width="${bw}" height="${bh}" rx="8" fill="#18181b" stroke="${color}" stroke-width="2"${adrAttr} />`;
    boxes += `<text x="${p.x}" y="${p.y}" fill="#fafafa" font-size="12" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeHtml(label)}</text>`;
  }

  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = lines + boxes;
  if (opts?.onNodeDblClick) {
    for (const rect of svg.querySelectorAll("rect.dep-node")) {
      const id = rect.getAttribute("data-adr-id");
      if (!id) continue;
      rect.addEventListener("dblclick", () => {
        selectedId = id;
        view = "steps";
        document.querySelectorAll(".tabs button").forEach((b) => {
          b.classList.toggle("active", b.dataset.view === "steps");
        });
        render();
      });
    }
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    view = btn.dataset.view;
    render();
  });
});

load().catch((e) => {
  const el = document.getElementById("err");
  el.hidden = false;
  el.textContent = e.message || String(e);
  document.getElementById("app").innerHTML = "";
});

window.addEventListener("resize", () => {
  if (graph) render();
});
