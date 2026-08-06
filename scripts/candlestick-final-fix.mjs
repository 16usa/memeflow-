#!/usr/bin/env node
/**
 * MEMEFLOW Final Candlestick Fix
 *
 * Fixes:
 * - broken token image placeholder
 * - duplicate / oversized token summary
 * - original cyan line remaining visible
 * - candlesticks disappearing when the chart SVG is re-rendered
 *
 * Target: memeflow-app/index.html
 * Idempotent. Creates a rollback backup.
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || "memeflow-app/index.html";
const file = path.resolve(target);
const marker = "MEMEFLOW_CANDLESTICK_FINAL_FIX_V3";
const backup = `${file}.before-candlestick-final-fix`;

if (!fs.existsSync(file)) {
  console.error(`ERROR: File not found: ${file}`);
  process.exit(1);
}

let html = fs.readFileSync(file, "utf8");

if (!html.includes('id="market-chart-module"')) {
  console.error("ERROR: #market-chart-module was not found.");
  process.exit(1);
}

if (html.includes(marker)) {
  console.log("Final candlestick fix is already installed. Nothing changed.");
  process.exit(0);
}

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

const css = `
/* ${marker} */
.market-chart-module #chartLine,
.market-chart-module #chartArea,
.market-chart-module #chartDot{
  display:none!important;
  opacity:0!important;
  visibility:hidden!important;
}
.market-chart-module .mf-candle-layer{
  display:block!important;
  opacity:1!important;
  visibility:visible!important;
  pointer-events:none;
}
.market-chart-module .mf-candle-layer .mf-wick{
  stroke-width:1.4!important;
  vector-effect:non-scaling-stroke;
}
.market-chart-module .mf-candle-layer .mf-body{
  vector-effect:non-scaling-stroke;
}
.market-chart-module .mf-candle-layer .up{
  fill:#50df84!important;
  stroke:#50df84!important;
}
.market-chart-module .mf-candle-layer .down{
  fill:#ff5063!important;
  stroke:#ff5063!important;
}
.mf-token-summary{
  min-height:88px;
}
.mf-token-image{
  display:none!important;
}
.mf-token-fallback{
  width:66px;
  height:66px;
  border-radius:19px;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  border:1px solid rgba(255,255,255,.12);
  background:
    radial-gradient(circle at 30% 25%,rgba(84,221,255,.24),transparent 34%),
    linear-gradient(145deg,rgba(84,221,255,.13),rgba(81,231,168,.06));
  color:#f4f8fb;
  font-size:18px;
  font-weight:900;
  letter-spacing:.04em;
  box-shadow:0 12px 30px rgba(0,0,0,.26);
  overflow:hidden;
}
.mf-token-fallback.has-image{
  background-size:cover;
  background-position:center;
  color:transparent;
}
.mf-token-summary .mf-token-title{
  margin:0!important;
}
.mf-token-summary .mf-token-sub{
  margin-top:6px!important;
}
.market-chart-module .chart{
  overflow:hidden!important;
}
.market-chart-module .chart svg{
  display:block!important;
  width:100%!important;
  height:100%!important;
}
@media(max-width:560px){
  .mf-token-fallback{
    width:56px;
    height:56px;
    border-radius:16px;
    font-size:16px;
  }
  .mf-token-summary{
    min-height:0;
  }
}
`;

const js = `
<script id="${marker}">
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const module = document.getElementById("market-chart-module");
  if (!module) return;

  function getText(selectors, fallback = "—") {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      if (value && value !== "—") return value;
    }
    return fallback;
  }

  function getImage() {
    const selectors = [
      "#decision-studio img[src]",
      ".primary-card img[src]",
      ".candidate.active img[src]",
      ".candidate img[src]",
      ".token-logo img[src]",
      ".token-avatar img[src]",
      "[data-token-image] img[src]",
      "img[data-token-logo][src]"
    ];
    for (const selector of selectors) {
      const img = document.querySelector(selector);
      if (img?.src && !img.src.startsWith("data:image/svg+xml,%3Csvg")) return img.src;
    }
    return "";
  }

  function ensureFallback() {
    const summary = module.querySelector(".mf-token-summary");
    if (!summary) return null;

    let fallback = summary.querySelector(".mf-token-fallback");
    if (!fallback) {
      fallback = document.createElement("div");
      fallback.className = "mf-token-fallback";
      const img = summary.querySelector(".mf-token-image");
      if (img) img.replaceWith(fallback);
      else summary.prepend(fallback);
    }
    return fallback;
  }

  function updateSummary() {
    const fallback = ensureFallback();
    if (!fallback) return;

    const name = getText(["#decisionName", "#chartSymbol", ".token-name"], "Token");
    const image = getImage();
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase();

    fallback.textContent = initials || "MF";
    if (image) {
      fallback.style.backgroundImage = "url(" + JSON.stringify(image) + ")";
      fallback.classList.add("has-image");
    } else {
      fallback.style.backgroundImage = "";
      fallback.classList.remove("has-image");
    }

    const title = module.querySelector(".mf-token-title");
    const sub = module.querySelector(".mf-token-sub");
    const price = module.querySelector(".mf-token-price b");

    if (title) title.textContent = name;
    if (sub) sub.textContent = getText(["#decisionMeta", "#chartPairMeta"], "Solana bonding curve");
    if (price) price.textContent = getText(["#chartCurrentPrice"], "—");
  }

  function parsePoints(line) {
    const raw = line?.getAttribute("points")?.trim();
    if (!raw) return [];
    return raw.split(/\s+/).map(pair => {
      const [x,y] = pair.split(",").map(Number);
      return {x,y};
    }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  function buildCandles(points, target) {
    if (points.length < 2) return [];
    const groupSize = Math.max(1, Math.ceil(points.length / target));
    const candles = [];
    for (let i=0; i<points.length; i+=groupSize) {
      const group = points.slice(i, i+groupSize);
      if (!group.length) continue;
      const ys = group.map(p => p.y);
      candles.push({
        x: group.reduce((sum,p) => sum+p.x,0)/group.length,
        open: group[0].y,
        close: group[group.length-1].y,
        high: Math.min(...ys),
        low: Math.max(...ys)
      });
    }
    return candles;
  }

  function render() {
    updateSummary();

    const svg = module.querySelector("#liveChartSvg");
    const line = module.querySelector("#chartLine");
    if (!svg || !line) return;

    line.style.display = "none";
    line.style.opacity = "0";

    const area = module.querySelector("#chartArea");
    const dot = module.querySelector("#chartDot");
    if (area) area.style.display = "none";
    if (dot) dot.style.display = "none";

    const points = parsePoints(line);

    let layer = svg.querySelector(".mf-candle-layer");
    if (!layer) {
      layer = document.createElementNS(NS, "g");
      layer.setAttribute("class", "mf-candle-layer");
      svg.appendChild(layer);
    }
    layer.replaceChildren();

    if (points.length < 2) return;

    const width = svg.viewBox?.baseVal?.width || 760;
    const target = window.innerWidth <= 560 ? 26 : 42;
    const candles = buildCandles(points, target);
    const bodyWidth = Math.max(4, Math.min(14, (width / Math.max(candles.length,1)) * .56));

    for (const c of candles) {
      const up = c.close <= c.open;
      const cls = up ? "up" : "down";

      const wick = document.createElementNS(NS, "line");
      wick.setAttribute("x1", String(c.x));
      wick.setAttribute("x2", String(c.x));
      wick.setAttribute("y1", String(c.high));
      wick.setAttribute("y2", String(c.low));
      wick.setAttribute("class", "mf-wick " + cls);

      const body = document.createElementNS(NS, "rect");
      body.setAttribute("x", String(c.x - bodyWidth/2));
      body.setAttribute("y", String(Math.min(c.open,c.close)));
      body.setAttribute("width", String(bodyWidth));
      body.setAttribute("height", String(Math.max(3,Math.abs(c.close-c.open))));
      body.setAttribute("rx", "1.5");
      body.setAttribute("class", "mf-body " + cls);

      layer.append(wick,body);
    }
  }

  let lastSignature = "";
  function tick() {
    const line = module.querySelector("#chartLine");
    const signature = line?.getAttribute("points") || "";
    const name = getText(["#decisionName", "#chartSymbol"], "");
    const price = getText(["#chartCurrentPrice"], "");
    const combined = signature + "|" + name + "|" + price;

    const svg = module.querySelector("#liveChartSvg");
    const hasLayer = !!svg?.querySelector(".mf-candle-layer");

    if (combined !== lastSignature || !hasLayer) {
      lastSignature = combined;
      render();
    } else {
      const originalLine = module.querySelector("#chartLine");
      if (originalLine) {
        originalLine.style.display = "none";
        originalLine.style.opacity = "0";
      }
    }
  }

  render();
  const timer = window.setInterval(tick, 700);
  window.addEventListener("pagehide", () => clearInterval(timer), {once:true});
  window.addEventListener("resize", render, {passive:true});
})();
</script>
`;

const styleEnd = html.lastIndexOf("</style>");
const bodyEnd = html.lastIndexOf("</body>");
if (styleEnd < 0 || bodyEnd < 0) {
  console.error("ERROR: Could not find </style> or </body>.");
  process.exit(1);
}

html = html.slice(0, styleEnd) + css + "\n" + html.slice(styleEnd);
const newBodyEnd = html.lastIndexOf("</body>");
html = html.slice(0, newBodyEnd) + js + "\n" + html.slice(newBodyEnd);

fs.writeFileSync(file, html, "utf8");

console.log("SUCCESS: Final candlestick chart fix installed.");
console.log(`Updated: ${file}`);
console.log(`Backup:  ${backup}`);
