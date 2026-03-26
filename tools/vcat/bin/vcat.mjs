#!/usr/bin/env node

process.noDeprecation = true;

import { readFileSync, writeFileSync, existsSync, watchFile } from "node:fs";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join, extname } from "node:path";
import { compile } from "vega-lite";
import { View, parse } from "vega";
import sharp from "sharp";

const SCALE = 2;

// --- Arg parsing ---

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { files: [], save: null, watch: false, stream: false, interval: 1000, help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--save" || args[i] === "-o") opts.save = args[++i];
    else if (args[i] === "--watch" || args[i] === "-w") opts.watch = true;
    else if (args[i] === "--stream" || args[i] === "-s") opts.stream = true;
    else if (args[i] === "--interval" || args[i] === "-i") opts.interval = parseInt(args[++i], 10);
    else if (args[i] === "--help" || args[i] === "-h") opts.help = true;
    else if (args[i] !== "-") opts.files.push(args[i]);
  }
  return opts;
}

const HELP = `vcat — render Vega-Lite charts in your terminal

Usage:
  vcat chart.json              Render a Vega-Lite spec
  vcat report.md               Render all \`\`\`vega-lite blocks in a markdown file
  cat data.csv | vcat          Auto-chart from CSV data
  tail -f log.csv | vcat -s    Stream: live-updating chart from streaming CSV
  vcat -o chart.png spec.json  Save to file instead of displaying
  vcat -w chart.json           Watch file and re-render on change

Options:
  -s, --stream          Stream mode: read stdin line-by-line, re-render live
  -i, --interval <ms>   Stream re-render interval in ms (default: 1000)
  -o, --save <file>     Save PNG to file instead of displaying in terminal
  -w, --watch           Re-render when the input file changes
  -h, --help            Show this help

Environment:
  VCAT_THEME=dark|light   Force dark or light theme
`;

// --- Theme detection ---

function isDarkMode() {
  if (process.env.VCAT_THEME === "light") return false;
  if (process.env.VCAT_THEME === "dark") return true;
  try {
    execSync("defaults read -g AppleInterfaceStyle", { stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function readGhosttyColors() {
  const paths = [
    join(homedir(), ".config", "ghostty", "config"),
    join(homedir(), "Library", "Application Support", "com.mitchellh.ghostty", "config"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const conf = readFileSync(p, "utf-8");
      const colors = {};
      for (const line of conf.split("\n")) {
        const m = line.match(/^\s*(background|foreground|palette)\s*=\s*(.+)/);
        if (!m) continue;
        if (m[1] === "background") colors.bg = m[2].trim();
        else if (m[1] === "foreground") colors.fg = m[2].trim();
        else if (m[1] === "palette") {
          const pm = m[2].trim().match(/^(\d+)=(#[0-9a-fA-F]{6})/);
          if (pm) {
            if (!colors.palette) colors.palette = {};
            colors.palette[parseInt(pm[1])] = pm[2];
          }
        }
      }
      if (colors.bg || colors.fg) return colors;
    } catch {}
  }
  return null;
}

function readKittyColors() {
  const p = join(homedir(), ".config", "kitty", "kitty.conf");
  if (!existsSync(p)) return null;
  try {
    const conf = readFileSync(p, "utf-8");
    const colors = {};
    for (const line of conf.split("\n")) {
      const m = line.match(/^\s*(background|foreground|color(\d+))\s+(#[0-9a-fA-F]{6})/);
      if (!m) continue;
      if (m[1] === "background") colors.bg = m[3];
      else if (m[1] === "foreground") colors.fg = m[3];
      else {
        if (!colors.palette) colors.palette = {};
        colors.palette[parseInt(m[2])] = m[3];
      }
    }
    if (colors.bg || colors.fg) return colors;
  } catch {}
  return null;
}

function detectTerminalColors() {
  const term = process.env.TERM_PROGRAM;
  if (term === "ghostty") {
    const colors = readGhosttyColors();
    if (colors) return colors;
  }
  if (term === "kitty" || process.env.KITTY_WINDOW_ID) {
    const colors = readKittyColors();
    if (colors) return colors;
  }
  return null;
}

function mixColor(hex, target, amount) {
  const mix = (a, b) => Math.round(a + (b - a) * amount);
  const r = mix(parseInt(hex.slice(1, 3), 16), parseInt(target.slice(1, 3), 16), amount);
  const g = mix(parseInt(hex.slice(3, 5), 16), parseInt(target.slice(3, 5), 16), amount);
  const b = mix(parseInt(hex.slice(5, 7), 16), parseInt(target.slice(5, 7), 16), amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const FALLBACK_DARK = {
  bg: "#282c34", fg: "#abb2bf",
  category: ["#61afef", "#e06c75", "#98c379", "#e5c07b", "#c678dd", "#56b6c2", "#be5046", "#d19a66", "#7ec8e3", "#b5cea8"],
};
const FALLBACK_LIGHT = {
  bg: "#ffffff", fg: "#383a42",
  category: ["#4078f2", "#e45649", "#50a14f", "#c18401", "#a626a4", "#0184bc", "#986801", "#e06c75", "#0997b3", "#40a14f"],
};

function buildTheme() {
  const dark = isDarkMode();
  const fallback = dark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const termColors = detectTerminalColors();

  const bg = termColors?.bg || fallback.bg;
  const fg = termColors?.fg || fallback.fg;

  let category = fallback.category;
  if (termColors?.palette) {
    const p = termColors.palette;
    const indices = [4, 1, 2, 3, 5, 6, 12, 9, 10, 11, 13, 14];
    const fromTerm = indices.map((i) => p[i]).filter(Boolean);
    if (fromTerm.length >= 6) category = fromTerm;
  }

  const muted = mixColor(fg, bg, 0.4);
  const subtle = mixColor(fg, bg, 0.7);

  return {
    background: bg,
    title: { color: fg },
    axis: {
      domainColor: muted, gridColor: subtle,
      tickColor: muted, labelColor: muted, titleColor: fg,
    },
    legend: { labelColor: muted, titleColor: fg },
    view: { stroke: subtle },
    range: { category },
  };
}

// --- Terminal helpers ---

function termWidth() {
  try {
    return parseInt(execSync("tput cols", { stdio: ["inherit", "pipe", "ignore"] }).toString(), 10);
  } catch {
    return 80;
  }
}

function chartWidth() {
  const cols = termWidth();
  return Math.min(Math.max(cols * 7, 300), 1200);
}

// --- Kitty graphics protocol ---

function kittyWrite(pngBuffer) {
  try {
    execSync("command -v kitten", { stdio: "ignore" });
    execSync("kitten icat --stdin no", { input: pngBuffer, stdio: ["pipe", "inherit", "ignore"] });
    return;
  } catch {}

  const CHUNK_SIZE = 4096;
  const b64 = pngBuffer.toString("base64");
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    const chunk = b64.slice(i, i + CHUNK_SIZE);
    const isLast = i + CHUNK_SIZE >= b64.length;
    if (i === 0) {
      process.stdout.write(`\x1b_Gf=100,a=T,m=${isLast ? 0 : 1};${chunk}\x1b\\`);
    } else {
      process.stdout.write(`\x1b_Gm=${isLast ? 0 : 1};${chunk}\x1b\\`);
    }
  }
  process.stdout.write("\n");
}

// --- CSV/TSV parsing ---

function parseCSV(text) {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;

  const sep = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    if (vals.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const n = Number(vals[j]);
      row[headers[j]] = isNaN(n) || vals[j] === "" ? vals[j] : n;
    }
    rows.push(row);
  }
  return { headers, rows };
}

function inferSpec(headers, rows) {
  // Find numeric and categorical columns
  const numeric = [];
  const categorical = [];
  const temporal = [];

  for (const h of headers) {
    const vals = rows.map((r) => r[h]);
    const allNum = vals.every((v) => typeof v === "number");
    const looksLikeDate = vals.every((v) => typeof v === "string" && /^\d{4}[-/]/.test(v));

    if (looksLikeDate) temporal.push(h);
    else if (allNum) numeric.push(h);
    else categorical.push(h);
  }

  // Time series: temporal x-axis + numeric y-axis
  if (temporal.length >= 1 && numeric.length >= 1) {
    const x = temporal[0];
    const y = numeric[0];
    const color = categorical[0] || (numeric.length > 1 ? null : null);

    if (categorical.length >= 1) {
      // Multi-series line chart
      return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        mark: "line",
        data: { values: rows },
        encoding: {
          x: { field: x, type: "temporal", title: x },
          y: { field: y, type: "quantitative", title: y },
          color: { field: categorical[0], type: "nominal" },
        },
      };
    }
    return {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "line",
      data: { values: rows },
      encoding: {
        x: { field: x, type: "temporal", title: x },
        y: { field: y, type: "quantitative", title: y },
      },
    };
  }

  // Categorical + numeric: bar chart
  if (categorical.length >= 1 && numeric.length >= 1) {
    return {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "bar",
      data: { values: rows },
      encoding: {
        x: { field: categorical[0], type: "nominal", title: categorical[0] },
        y: { field: numeric[0], type: "quantitative", title: numeric[0] },
      },
    };
  }

  // Two numeric columns: scatter plot
  if (numeric.length >= 2) {
    const spec = {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "point",
      data: { values: rows },
      encoding: {
        x: { field: numeric[0], type: "quantitative", title: numeric[0] },
        y: { field: numeric[1], type: "quantitative", title: numeric[1] },
      },
    };
    if (categorical.length >= 1) {
      spec.encoding.color = { field: categorical[0], type: "nominal" };
    }
    return spec;
  }

  // Single numeric column: histogram
  if (numeric.length === 1) {
    return {
      "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
      mark: "bar",
      data: { values: rows },
      encoding: {
        x: { field: numeric[0], bin: true, type: "quantitative", title: numeric[0] },
        y: { aggregate: "count", type: "quantitative" },
      },
    };
  }

  return null;
}

// --- Input parsing ---

function readInput(file) {
  if (file) return readFileSync(file, "utf-8");
  return readFileSync(0, "utf-8");
}

function extractVegaLiteBlocks(text) {
  const blocks = [];
  const regex = /```(?:vega-lite|vegalite|chartdown)\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function parseSpecs(input, filename) {
  // Try as raw JSON (Vega-Lite spec)
  try {
    return [JSON.parse(input)];
  } catch {}

  // Try as markdown with fenced blocks
  const blocks = extractVegaLiteBlocks(input);
  if (blocks.length > 0) {
    return blocks.map((b) => JSON.parse(b));
  }

  // Try as CSV/TSV
  const ext = filename ? extname(filename).toLowerCase() : "";
  const looksTabular = ext === ".csv" || ext === ".tsv" || input.includes(",") || input.includes("\t");
  if (looksTabular) {
    const parsed = parseCSV(input);
    if (parsed && parsed.rows.length > 0) {
      const spec = inferSpec(parsed.headers, parsed.rows);
      if (spec) return [spec];
    }
  }

  process.stderr.write("vcat: could not parse input as Vega-Lite JSON, markdown, or CSV\n");
  process.exit(1);
}

// --- Rendering ---

let _theme;
function getTheme() {
  if (_theme !== undefined) return _theme;
  _theme = buildTheme();
  return _theme;
}

function applyDefaults(spec) {
  if (!spec.width) spec.width = chartWidth();
  if (!spec.background) {
    const theme = getTheme();
    spec.config = { ...theme, ...(spec.config || {}) };
    spec.background = theme.background;
  }
  return spec;
}

async function renderSpec(spec) {
  spec = applyDefaults(spec);
  const vegaSpec = compile(spec).spec;
  const view = new View(parse(vegaSpec), { renderer: "none" });
  await view.runAsync();
  const svg = await view.toSVG();
  return sharp(Buffer.from(svg), { density: 72 * SCALE }).png().toBuffer();
}

function output(pngBuffer, savePath) {
  if (savePath) {
    writeFileSync(savePath, pngBuffer);
    process.stderr.write(`vcat: saved ${savePath}\n`);
  } else {
    kittyWrite(pngBuffer);
  }
}

// --- Streaming ---

function enterAltScreen() {
  process.stdout.write("\x1b[?1049h"); // alternate screen buffer
  process.stdout.write("\x1b[?25l");   // hide cursor
}

function exitAltScreen() {
  process.stdout.write("\x1b[?25h");   // show cursor
  process.stdout.write("\x1b[?1049l"); // restore main screen
}

function kittyDrawAt(pngBuffer) {
  // Clear screen, home cursor, delete all images, draw fresh
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write("\x1b_Ga=d,d=A\x1b\\");

  const CHUNK_SIZE = 4096;
  const b64 = pngBuffer.toString("base64");
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    const chunk = b64.slice(i, i + CHUNK_SIZE);
    const isLast = i + CHUNK_SIZE >= b64.length;
    if (i === 0) {
      process.stdout.write(`\x1b_Gf=100,a=T,m=${isLast ? 0 : 1};${chunk}\x1b\\`);
    } else {
      process.stdout.write(`\x1b_Gm=${isLast ? 0 : 1};${chunk}\x1b\\`);
    }
  }
}

function drawStatus(rows, frameCount, fps) {
  // Status line at bottom of screen
  const cols = termWidth();
  const msg = ` ${rows} rows | frame ${frameCount} | ${fps} fps | ctrl-c to exit `;
  const pad = Math.max(0, cols - msg.length);
  // Move to last row
  process.stdout.write(`\x1b[999;1H`);
  // Dim style
  process.stdout.write(`\x1b[2m${msg}${" ".repeat(pad)}\x1b[0m`);
}

const STREAM_WINDOW = 500; // max rows to display

function lockAxes(spec, domains) {
  // Set explicit scale domains so axes don't jump between frames
  const enc = spec.encoding;
  if (!enc) return spec;
  for (const ch of ["x", "y"]) {
    if (!enc[ch] || !domains[enc[ch].field]) continue;
    const d = domains[enc[ch].field];
    if (enc[ch].type === "quantitative") {
      enc[ch].scale = { domain: [d.min, d.max] };
    }
  }
  return spec;
}

function updateDomains(domains, rows, headers) {
  for (const h of headers) {
    const vals = rows.map((r) => r[h]).filter((v) => typeof v === "number");
    if (vals.length === 0) continue;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (!domains[h]) {
      // Add 10% padding so data doesn't touch edges
      const pad = (max - min) * 0.1 || 1;
      domains[h] = { min: min - pad, max: max + pad };
    } else {
      const pad = (max - min) * 0.1 || 1;
      domains[h].min = Math.min(domains[h].min, min - pad);
      domains[h].max = Math.max(domains[h].max, max + pad);
    }
  }
}

async function streamMode(opts) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  let headers = null;
  let rows = [];
  let dirty = false;
  let rendering = false;
  let frameCount = 0;
  let totalRows = 0;
  let startTime = Date.now();
  const domains = {};

  if (!opts.save) enterAltScreen();

  process.on("SIGINT", () => {
    if (!opts.save) exitAltScreen();
    process.stderr.write(`vcat: ${totalRows} rows, ${frameCount} frames\n`);
    process.exit(0);
  });

  rl.on("line", (line) => {
    line = line.trim();
    if (!line) return;

    if (!headers) {
      const sep = line.includes("\t") ? "\t" : ",";
      headers = line.split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ""));
      return;
    }

    const sep = line.includes("\t") ? "\t" : ",";
    const vals = line.split(sep).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    if (vals.length !== headers.length) return;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const n = Number(vals[j]);
      row[headers[j]] = isNaN(n) || vals[j] === "" ? vals[j] : n;
    }
    rows.push(row);
    totalRows++;
    // Rolling window
    if (rows.length > STREAM_WINDOW) rows = rows.slice(-STREAM_WINDOW);
    dirty = true;
  });

  const renderLoop = setInterval(async () => {
    if (!dirty || rendering || rows.length === 0 || !headers) return;
    dirty = false;
    rendering = true;

    try {
      updateDomains(domains, rows, headers);
      let spec = inferSpec(headers, rows);
      if (!spec) return;
      spec = lockAxes(spec, domains);
      const png = await renderSpec(spec);

      if (opts.save) {
        writeFileSync(opts.save, png);
      } else {
        kittyDrawAt(png);
      }

      frameCount++;
      const elapsed = (Date.now() - startTime) / 1000;
      const fps = (frameCount / elapsed).toFixed(1);

      if (!opts.save) {
        drawStatus(totalRows, frameCount, fps);
      }
    } catch (e) {
      // silently skip render errors in stream mode
    } finally {
      rendering = false;
    }
  }, opts.interval);

  rl.on("close", async () => {
    clearInterval(renderLoop);
    // Final render
    if (rows.length > 0 && headers) {
      const spec = inferSpec(headers, rows);
      if (spec) {
        const png = await renderSpec(spec);
        if (opts.save) {
          writeFileSync(opts.save, png);
        } else {
          kittyDrawAt(png);
          drawStatus(rows.length, frameCount + 1, "done");
          // Wait a moment so the final frame is visible
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    if (!opts.save) exitAltScreen();
    process.stderr.write(`vcat: stream ended — ${rows.length} rows, ${frameCount + 1} frames\n`);
  });
}

// --- Main ---

async function renderFile(file, savePath) {
  const input = readInput(file);
  const specs = parseSpecs(input, file);

  for (let i = 0; i < specs.length; i++) {
    try {
      const png = await renderSpec(specs[i]);
      const dest = specs.length > 1 && savePath
        ? savePath.replace(/\.png$/, `-${i + 1}.png`)
        : savePath;
      output(png, dest);
    } catch (e) {
      process.stderr.write(`vcat: render error: ${e.message}\n`);
    }
  }
}

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }

  const file = opts.files[0] || null;

  if (opts.stream) {
    await streamMode(opts);
    return;
  }

  if (opts.watch && file) {
    process.stderr.write(`vcat: watching ${file}\n`);
    await renderFile(file, opts.save);
    watchFile(file, { interval: 300 }, async () => {
      process.stderr.write(`vcat: re-rendering\n`);
      await renderFile(file, opts.save);
    });
    return;
  }

  await renderFile(file, opts.save);
}

main().catch((e) => {
  process.stderr.write(`vcat: ${e.message}\n`);
  process.exit(1);
});
