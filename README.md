# adrv

**ADR dependency graphs** and **interactive architecture diagrams** from markdown in your repo.

Install with Cargo — **no Node.js or npm required**. The `adrv` binary includes a built-in web UI for `adrv serve`.

Contributors: commit messages use [Conventional Commits](CONTRIBUTING.md) (`feat:`, `fix:`, `docs:`, … — not `CN-*` prefixes).

## Install

```bash
cargo install adrv
```

Run the UI and API (default command):

```bash
adrv serve --root ./docs/adr --port 8080
```

Open **http://127.0.0.1:8080/**.

Build from source (still no npm unless you are hacking on the UI in this repo):

```bash
cargo build --release --target-dir ./target
./target/release/adrv --help
```

## CLI

```bash
# Web UI + /api/graph (default command)
adrv
adrv serve --root ./docs/adr --port 8080

# JSON graph (nodes, link edges, architecture models per ADR)
adrv graph --root ./docs/adr

# List ADRs that define ```architecture blocks
adrv architecture --root ./docs/adr
```

`serve` ships an **embedded** UI in the crate. Optional: point at a custom build with `--web /path/to/dist` or `ADRV_WEB_DIR` (only needed when developing the web app in this repository).

Optional **Cursor** enrichment: `adrv cursor login`, then use **Analyze** in the UI (per ADR).

## UI

Four views over the same ADR corpus (select a decision in the list on the left):

| View | What you see |
|------|----------------|
| **Dependencies** | React Flow graph of `depends-on`, `relates-to`, supersedes, and other link types |
| **Links** | Outline of how the selected ADR connects to others |
| **Timeline** | Ordered decision steps for the selected ADR (markdown list or Cursor analysis) |
| **Architecture** | Component diagram from a fenced `architecture` block or **Analyze** (Cursor reads the ADR) |

**Analyze** (per ADR) enriches links, steps, and architecture in memory via the Cursor API — nothing is written back to your markdown unless you choose to.

**Dependencies**

![Dependencies — React Flow graph of ADR links](https://raw.githubusercontent.com/somayaj/adrv/HEAD/docs/screenshots/dependencies.png)

**Links**

![Links — connections for the selected ADR](https://raw.githubusercontent.com/somayaj/adrv/HEAD/docs/screenshots/links.png)

**Timeline**

![Timeline — decision steps for one ADR](https://raw.githubusercontent.com/somayaj/adrv/HEAD/docs/screenshots/timeline.png)

**Architecture**

![Architecture — component diagram from the ADR or Cursor Analyze](https://raw.githubusercontent.com/somayaj/adrv/HEAD/docs/screenshots/architecture.png)

## Documents

`adrv` loads **any text document** under your root (UTF-8), not only classic ADRs:

| Extensions | Examples |
|------------|----------|
| Markdown | `.md`, `.markdown`, `.mdx` |
| Plain text | `.txt`, `.text` |
| Other | `.rst`, `.adoc`, `.asciidoc` |

Skipped: `README`, `CHANGELOG`, `LICENSE`, and paths under `node_modules`, `target`, `dist`, etc.

Each file becomes one **decision node**. ID from frontmatter or filename (`0004-foo.md` → `0004`, `policy.txt` → `policy`). Title from frontmatter, `# heading`, or the first line of plain text.

**Links** (optional): YAML frontmatter (`depends-on`, `relates-to`, …) or markdown links to other `NNNN-slug.md` files in the corpus.

### Writing ADRs: context, decision, and diagrams

Use normal markdown sections. Table-style metadata (Status, Date, Audience) in the doc is fine; YAML frontmatter is optional.

| Section | Role in the UI |
|---------|----------------|
| **Context** | Shown in the detail panel and sent to Cursor on **Analyze** |
| **Decision** | Numbered lists under `## Decision` power the **Timeline** tab |
| **Consequences** | Full text in the detail panel |

**Sequential decisions** — under `## Decision`, use a numbered list:

```markdown
## Decision

1. Merge to trunk **automatically deploys** to the launch environment.
2. Deploy triggers **Octane automation**.
3. Octane runs tests on launch before promotion.
```

**Architecture diagrams** come from an explicit fenced block in the ADR, or from **Analyze** (`adrv cursor login` then **Analyze** in the UI). Example fence:

```architecture
direction: TB
nodes:
  - id: api
    label: API service
    kind: service
edges: []
```

Node kinds: `client`, `gateway`, `service`, `database`, `queue`, `worker`, `external`

## Library

```rust
use adrv::load_adr_graph;

let graph = load_adr_graph("docs/adr").expect("load ADRs");
println!("{} decisions", graph.nodes.len());
```
