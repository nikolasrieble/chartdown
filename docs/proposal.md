# Chartdown: Vega-Lite as the Mermaid of Data Charts

**Status:** Proposal
**Author:** Nikolas Rieble
**Date:** 2026-03-25

---

## Problem Statement

Chart data is destroyed when exported as images. Agents can't read PNGs.

Today, the workflow for putting a chart in a document is: create chart in a tool (Grafana, Excel, matplotlib, Google Sheets) → export as PNG → paste into document. The structured data — values, types, axis semantics, series relationships — is discarded at the export step. What remains is pixels.

This matters because **agents are now the primary consumers of documentation.** An agent reviewing a PR, triaging an incident report, or executing a runbook cannot interact with an image. It needs structured data.

**Mermaid proved this pattern works for diagrams.** Mermaid replaced opaque diagram images with structured text that is agent-readable and renders visually for humans. It became the standard: GitHub renders it, VS Code renders it, Obsidian renders it, every documentation platform supports it.

**There is no Mermaid equivalent for data charts.** No standard structured format for bar charts, line charts, scatter plots, or time series in Markdown documents. The format exists — [Vega](https://vega.github.io/vega/) / [Vega-Lite](https://vega.github.io/vega-lite/) — but adoption has not happened. Charts remain images.

### Why Vega-Lite hasn't had its Mermaid moment

Mermaid succeeded because of a virtuous cycle: authors write text → platforms render it → more authors adopt it. Vega-Lite is stuck because:

1. **No export path from existing tools.** Nobody authors charts in Vega-Lite JSON. They author in Grafana, Excel, matplotlib, Sheets. These tools export PNG, not Vega-Lite.
2. **Limited rendering in Markdown contexts.** VS Code has extensions (markdown-vega-preview, Markdown Preview Enhanced). But GitHub, the most important Markdown platform, does not render ` ```vega-lite ` blocks. Mermaid got GitHub support — Vega-Lite has not.
3. **No adoption push.** Mermaid had champions who lobbied platforms, wrote plugins, and evangelized. Vega-Lite has academic adoption but no Mermaid-style grassroots push into developer documentation.

### The two-sided gap

```
Authoring tools                    Rendering platforms
(Grafana, matplotlib,    ──PNG──►  (GitHub, VS Code,
 Excel, Sheets)                     Obsidian, SSGs)

         │                                  │
         │  No Vega-Lite export     No Vega-Lite render
         │  (data dies here)        (on most platforms)
         │                                  │
         ▼                                  ▼
    Export plugins               Renderer plugins / lobbying
    (the supply side)            (the demand side)
```

Both sides need to be addressed. Export plugins create supply (structured chart data). Renderer support creates demand (reason to use structured charts). Either alone is insufficient.

---

## Proposal

**Make Vega-Lite the Mermaid of data charts** by closing both sides of the adoption gap.

No new format. No new schema. Vega / Vega-Lite already defines the format. The work is adoption infrastructure: export plugins for tools where charts originate, and push for rendering support where charts are consumed.

### Supply side: export plugins

Build plugins / wrappers that export Vega-Lite JSON from the tools people already use to create charts:

| Tool | Integration | Effort | Impact |
|---|---|---|---|
| **Grafana** | Panel plugin: "Copy as Vega-Lite" / "Share as Vega-Lite" | Medium | High — Grafana screenshots dominate incident reports and postmortems |
| **matplotlib / seaborn** | Wrapper that captures `plt.plot()` data and emits Vega-Lite alongside PNG | Low | High — ubiquitous in data science, Jupyter notebooks |
| **Python (Altair)** | Already exists — [Altair](https://altair-viz.github.io/) IS a Python API for Vega-Lite | Zero | High — promote Altair as the default Python charting library for docs |
| **Excel / Google Sheets** | Add-on that exports selected chart as Vega-Lite JSON | Medium | Medium — common in business docs |
| **Datadog / Kibana** | API export or browser extension | Medium | Medium — operational dashboards |
| **Observable** | Already Vega-based | Zero | Low — niche audience |

**Key insight:** Altair (Python) already generates Vega-Lite. The matplotlib wrapper may just be "use Altair instead" with a migration guide. The biggest bang-for-buck new work is a **Grafana export plugin**.

### Demand side: rendering support

| Platform | Current state | Action |
|---|---|---|
| **VS Code** | Works today via markdown-vega-preview, Markdown Preview Enhanced | Promote existing extensions; optionally build a best-in-class renderer |
| **GitHub** | Does not render ` ```vega-lite ` | Lobby / feature request (GitHub added Mermaid in 2022 — precedent exists) |
| **Obsidian** | Community plugins exist | Promote existing plugins |
| **Kroki** | Already renders Vega-Lite server-side | Works for GitLab, MkDocs, Docusaurus via Kroki integration |
| **Docusaurus / MkDocs** | Via Kroki or custom plugin | Document the integration path |

### The workflow

```
Human creates chart in Grafana / matplotlib / Altair
         │
         ▼
Export plugin emits Vega-Lite JSON (instead of / alongside PNG)
         │
         ▼
JSON pasted into incident report / PR / design doc as ```vega-lite block
         │
         ├──► Agent reads JSON natively (zero tooling)
         │    - Answers "what was peak latency?"
         │    - Verifies chart matches claims in prose
         │    - Updates chart with new data
         │
         └──► Human sees rendered chart
              - VS Code / Obsidian preview
              - Kroki on GitLab / MkDocs
              - Raw JSON as fallback (still useful)
```

### What "Chartdown" is

Chartdown is not a format. It is the **adoption campaign** to make Vega-Lite the standard for data charts in Markdown, the way Mermaid is the standard for diagrams.

Concretely, Chartdown is:
1. **Export plugins** for Grafana, matplotlib, etc.
2. **A conventions guide** — the 80% subset of Vega-Lite that covers bar, line, scatter, pie, area, and histogram with minimal boilerplate
3. **Agent integration examples** — prompt templates and patterns for agents to read, write, and modify chart blocks
4. **Renderer promotion / development** — making the human-side experience good enough that authors prefer ` ```vega-lite ` over PNG

### Examples

A bar chart (Vega-Lite):

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "mark": "bar",
  "title": "Q1 Revenue by Region",
  "data": {
    "values": [
      {"region": "EMEA", "revenue": 4.2},
      {"region": "NA", "revenue": 7.1},
      {"region": "APAC", "revenue": 3.8}
    ]
  },
  "encoding": {
    "x": {"field": "region", "type": "nominal", "title": "Region"},
    "y": {"field": "revenue", "type": "quantitative", "title": "Revenue (M USD)"}
  }
}
```

A multi-series line chart (e.g., exported from Grafana):

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "mark": "line",
  "title": "Latency P99 Over Time",
  "data": {
    "values": [
      {"date": "2026-01", "service": "API Gateway", "latency": 120},
      {"date": "2026-02", "service": "API Gateway", "latency": 95},
      {"date": "2026-03", "service": "API Gateway", "latency": 110},
      {"date": "2026-01", "service": "Database", "latency": 45},
      {"date": "2026-02", "service": "Database", "latency": 42},
      {"date": "2026-03", "service": "Database", "latency": 48}
    ]
  },
  "encoding": {
    "x": {"field": "date", "type": "temporal", "title": "Date"},
    "y": {"field": "latency", "type": "quantitative", "title": "Latency (ms)"},
    "color": {"field": "service", "type": "nominal"}
  }
}
```

---

## Abandoned Ideas

### 1. Inventing a new schema ("Chartdown format")

**Considered:** A bespoke JSON schema simpler than Vega-Lite, with ~20 keys and chart-type-specific data shapes.

**Why abandoned:** Inventing a schema means inventing a rendering pipeline. Vega-Lite already has VS Code renderers, Kroki support, Obsidian plugins, LLM training data, and a mature ecosystem (Altair, Vega Embed, academic adoption). A custom schema would require rebuilding all of this for marginal simplicity gains. The right approach is to define a conventions guide (the "80% subset") over the existing Vega-Lite schema, not replace it.

### 2. Custom DSL (Mermaid-style syntax)

**Considered:** A terse, human-writable syntax like `bar "Revenue" | EMEA: 4.2, NA: 7.1`.

**Why abandoned:** Agents are the primary audience. JSON is what agents speak. A custom DSL requires a custom parser (Mermaid's biggest ongoing cost), isn't in LLM training data, and doesn't compose with JSON tooling. Mermaid's DSL works for diagrams because `A --> B` is genuinely clearer than JSON for relationships. For arrays of numbers, JSON is already the natural representation.

### 3. YAML as the format

**Considered:** YAML is less verbose and more human-readable for small payloads.

**Why abandoned:** YAML's ambiguity (the Norway problem: `NO` → `false`), whitespace sensitivity, and multiple valid representations make it unreliable for machine interchange. LLMs handle JSON more consistently. Moot point now that we're using Vega-Lite, which is JSON.

### 4. Building a new rendering stack

**Considered:** Custom VS Code extension, Obsidian plugin, and Kroki backend for a bespoke format.

**Why abandoned (for a custom format):** All of this exists for Vega-Lite already.

**Not abandoned (for a better Vega-Lite renderer):** Existing VS Code extensions work but may not be best-in-class. A faster, smaller, more theme-aware Vega-Lite markdown renderer is an optional but compelling opportunity.

### 5. Supporting diagrams (flowcharts, sequences, etc.)

**Considered:** A unified format for both data charts and diagrams.

**Why abandoned:** Mermaid owns diagrams. Different rendering pipeline. Different audience. Focus on data charts.

### 6. Agent harness extension (OpenCode) as primary integration

**Considered:** Building Chartdown as an OpenCode skill rather than a VS Code extension.

**Why reframed:** The question was where agents interact with charts. The answer: agents interact with JSON in files — no extension needed. The agent harness (OpenCode, Claude Code) reads the raw Vega-Lite JSON directly. An OpenCode skill could provide conventions and prompt templates, but the primary integration is "agents read files." The export plugins (Grafana, matplotlib) and rendering support (VS Code, Kroki) are where the actual work is.

### 7. New fenced block identifier (` ```chartdown `)

**Considered:** A distinct block identifier to brand the convention.

**Why abandoned:** ` ```vega-lite ` already works with existing renderers. A new identifier requires updating every renderer for zero functional benefit. Use the standard identifier.

---

## Context and Decisions

### How this proposal evolved

**Round 1 — "Dual audience" framing.** The initial draft framed the problem as serving humans and LLMs equally, with a custom JSON schema rendered by a new VS Code extension. Review feedback corrected the framing: the primary audience is agents. The competition is not Vega-Lite or Mermaid — it is the image.

**Round 2 — "Agent-first, human-second."** Reframing around agents clarified that the JSON is the product and rendering is progressive enhancement. This resolved the question "does Chartdown beat a Markdown table?" — tables carry data but not visualization intent (chart type, axis semantics, temporal types).

**Round 3 — Custom schema abandoned.** Vega-Lite is already JSON, already declarative, LLMs already know it, and rendering tooling already exists. A custom schema would require building the entire rendering stack from scratch. Decision: use Vega-Lite as the schema.

**Round 4 — Rendering is already solved.** Investigation found multiple VS Code extensions (markdown-vega-preview, Markdown Preview Enhanced) that render ` ```vega-lite ` blocks today. Kroki renders it server-side. No new rendering tooling needed to start.

**Round 5 — "Mermaid for data charts."** The decisive reframing. Mermaid proved the pattern: structured text replaces opaque images, platforms render it, adoption follows. Vega-Lite is the obvious candidate for data charts — it just hasn't had the adoption push. The work is not inventing a format but closing the adoption gap: export plugins on the supply side (Grafana, matplotlib), renderer support on the demand side (GitHub, VS Code).

**Round 6 — Export plugins are the wedge.** The highest-leverage work is not rendering (which exists) but export: making it trivial to get structured chart data OUT of the tools where charts originate. Grafana is the highest-value target (incident reports, postmortems). Altair already exists for Python. The gap is narrower than it first appeared.

**Round 7 — Supply is already solved by LLMs.** Challenge to the Grafana-first approach: LLMs can generate Vega-Lite from any source — CSV, tables, natural language. The supply bottleneck is not "getting data out of Grafana" but "getting charts into human view." The real gap is rendering, not export. This flipped the priority: the terminal renderer (`vcat`) became the highest-value artifact because it closes the agent→human feedback loop in the environment where agents operate (the terminal).

**Round 8 — `vcat`: the terminal renderer.** Built a CLI tool that renders Vega-Lite specs inline in terminals supporting the Kitty graphics protocol (Ghostty, Kitty, WezTerm, iTerm2). Node.js MVP using Vega's existing rendering pipeline + sharp for PNG output. Features: auto-detect terminal theme (reads Ghostty/Kitty config), auto-fit terminal width, extract and render ` ```vega-lite ` blocks from markdown files, infer charts from CSV/TSV piped via stdin, streaming mode with live re-rendering, watch mode, and file save. ~600 lines. Validates the core thesis: an agent emits Vega-Lite JSON, the human sees a rendered chart, feedback loop is immediate — all in the terminal, no context switch.

**Round 9 — Future: native Zig rewrite.** The Node.js MVP works but has ~200ms startup overhead and depends on npm. A Zig rewrite targeting only the 6 core chart types (bar, line, scatter, pie, area, histogram) would produce a single static binary with instant startup and direct pixel-buffer-to-Kitty output. Text rendering (bitmap font) is the only hard piece. Deferred until the MVP proves adoption.

### Key research: Mermaid's path to adoption

Mermaid's adoption followed a specific pattern that Vega-Lite should replicate:

- **Format existed first** (Mermaid DSL, ~2014)
- **VS Code extension** and other editor integrations created early adopters
- **GitHub native rendering** (Feb 2022) was the inflection point — suddenly every `.md` on GitHub could contain rendered diagrams
- **Platform momentum** followed: Obsidian, GitLab, Notion, Docusaurus all added support
- **Tool export** came last: AI agents now generate Mermaid; documentation tools emit it

For Vega-Lite, the format already exists. Editor integrations exist. The missing pieces are GitHub rendering and export plugins. The export plugins are within our control; GitHub rendering requires lobbying but has precedent (Mermaid).

### Key decisions

| Decision | Rationale |
|---|---|
| No new format | Vega / Vega-Lite already defines the schema. Reinventing it is waste. |
| Export plugins as the wedge | The bottleneck is supply: structured chart data doesn't exist in documents because tools export PNG. Fix the export step. |
| Grafana plugin first | Grafana screenshots in incident reports / postmortems are the highest-value opaque charts. Operational context is where agents need data most. |
| ` ```vega-lite ` fenced blocks | Standard identifier, works with existing renderers today. |
| Agent-first, human-second | Agents are the primary consumers. Rendering is progressive enhancement. |
| Mermaid as the adoption model | Proven pattern: structured text → platform rendering → standard. Replicate for data charts. |
| Terminal renderer (`vcat`) as first artifact | Agents operate in terminals. The agent→human feedback loop must close there. VS Code preview is secondary. |
| Node.js MVP, Zig future | Ship fast with Vega's existing pipeline. Rewrite in Zig only if adoption justifies a single-binary distribution. |
| Kitty graphics protocol | Works across Ghostty, Kitty, WezTerm, iTerm2. No terminal-specific contribution needed. |
| Terminal theme reuse | Charts should look native. Read Ghostty/Kitty config for colors; detect OS dark mode as fallback. |

---

## Open Questions

1. **Grafana plugin feasibility**: What's the Grafana plugin API surface for panel export? Can a plugin access the underlying query results and panel configuration? Is a community plugin sufficient or does this need Grafana Labs involvement?
2. **GitHub rendering**: What's the realistic path to ` ```vega-lite ` rendering on GitHub? Feature request? Partnership? Or accept it won't happen and focus on VS Code / Kroki / Obsidian?
3. **Conventions guide scope**: What subset of Vega-Lite should the conventions guide cover? Goal: an agent can generate a correct chart from the guide without consulting the full Vega-Lite docs.
4. **Data size limits**: Inline `values` work for 5-50 points. Grafana time series can have thousands. When should the convention switch to `"url"` references? What does the agent workflow look like for large datasets?
5. **Altair promotion vs. matplotlib wrapper**: Is the right Python strategy "use Altair" or "wrap matplotlib"? Altair is cleaner but has lower adoption. matplotlib is ubiquitous but wasn't designed for Vega-Lite export.
6. **Best-in-class renderer**: Is there value in building a better Vega-Lite markdown renderer, or are existing extensions good enough? What would "best" mean?
7. **Mermaid coexistence**: Documents will have both Mermaid diagrams and Vega-Lite charts. Any conventions needed for how they coexist? Should the conventions guide address this?
