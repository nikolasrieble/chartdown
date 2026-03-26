# Chartdown

**Vega-Lite as the Mermaid of data charts.**

Mermaid replaced opaque diagram images with structured text. Chartdown does the same for data charts: agents read JSON, humans see rendered visuals.

## vcat

Render Vega-Lite charts inline in your terminal.

```
vcat chart.json                    # render a Vega-Lite spec
vcat report.md                     # render all ```vega-lite blocks
cat data.csv | vcat                # auto-infer a chart from CSV
tail -f metrics.csv | vcat -s      # stream: live-updating chart
vcat -w chart.json                 # watch: re-render on file change
vcat -o chart.png spec.json        # save to file
```

### Install

```bash
cd tools/vcat && npm install && npm link
```

### Requirements

- Node.js >= 18
- A terminal with Kitty graphics protocol support (Ghostty, Kitty, WezTerm, iTerm2)

### Features

- **Auto-detects terminal theme** — reads Ghostty/Kitty config for colors, falls back to OS dark/light mode
- **Auto-fits terminal width** — charts scale to your terminal
- **Markdown extraction** — finds and renders all ` ```vega-lite ` blocks in `.md` files
- **CSV/TSV inference** — auto-detects chart type from tabular data
- **Streaming mode** — live-updating charts from piped data
- **Watch mode** — re-renders when the source file changes

## The thesis

Charts in documentation are images. Images are opaque to agents. Vega-Lite is a JSON format for charts that already exists, already has renderers, and LLMs already understand. The gap is adoption, not invention.

See [docs/proposal.md](docs/proposal.md) for the full proposal, design decisions, and abandoned ideas.

## License

MIT
