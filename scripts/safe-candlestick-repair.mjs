#!/usr/bin/env node
/**
 * MEMEFLOW Safe Candlestick Repair
 *
 * 1) Removes/restores the broken premium chart patch when its backup exists.
 * 2) Installs a safer candlestick renderer with no global DOM observer.
 * 3) Preserves existing market-data requests, intervals, token switching and IDs.
 *
 * Target: memeflow-app/index.html
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || "memeflow-app/index.html";
const file = path.resolve(target);
const brokenBackup = `${file}.before-premium-candlestick-chart`;
const safeBackup = `${file}.before-safe-candlestick-chart`;
const marker = "MEMEFLOW_SAFE_CANDLESTICK_CHART_V2";

if (!fs.existsSync(file)) {
  console.error(`ERROR: File not found: ${file}`);
  process.exit(1);
}

/* Repair the broken premium patch first. */
if (fs.existsSync(brokenBackup)) {
  const current = fs.readFileSync(file, "utf8");
  if (current.includes("MEMEFLOW_PREMIUM_CANDLESTICK_CHART_V1")) {
    fs.copyFileSync(brokenBackup, file);
    console.log("REPAIRED: Restored index.html from the pre-premium backup.");
  }
}

let html = fs.readFileSync(file, "utf8");

if (!html.includes('id="market-chart-module"')) {
  console.error("ERROR: Separate Market Chart module not found.");
  console.error("Apply the separate Market Chart patch first.");
  process.exit(1);
}

if (html.includes(marker)) {
  console.log("Safe candlestick chart is already installed. Nothing changed.");
  process.exit(0);
}

if (!fs.existsSync(safeBackup)) {
  fs.copyFileSync(file, safeBackup);
}

const css = `
/* ${marker} */
.market-chart-module{
  --mf-up:#50df84;
  --mf-down:#ff5063;
  --mf-grid:rgba(145,162,181,.11);
}
.market-chart-module .panel-head{padding:15px 17px}
.market-chart-module-body{padding:0!important}

.mf-token-summary{
  display:grid;
  grid-template-columns:66px minmax(0,1fr) auto;
  gap:14px;
  align-items:center;
  padding:16px 17px;
  border-bottom:1px solid var(--line-soft,var(--line));
  background:
    radial-gradient(circle at 86% 8%,rgba(84,221,255,.075),transparent 34%),
    linear-gradient(180deg,rgba(255,255,255,.018),transparent);
}
.mf-token-image{
  width:66px;height:66px;border-radius:19px;object-fit:cover;
  border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(135deg,rgba(84,221,255,.16),rgba(81,231,168,.07));
  box-shadow:0 12px 30px rgba(0,0,0,.28);
}
.mf-token-copy{min-width:0}
.mf-token-title{
  margin:0;font-size:clamp(19px,3vw,29px);line-height:1.05;
  letter-spacing:-.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.mf-token-sub{
  margin-top:7px;color:var(--muted);font-size:11px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.mf-token-price{text-align:right;min-width:130px}
.mf-token-price b{
  display:block;font-size:clamp(23px,4vw,37px);line-height:1;
  font-weight:900;letter-spacing:-.04em;font-variant-numeric:tabular-nums
}
.mf-token-price span{
  display:block;margin-top:8px;color:var(--green);font-size:12px;font-weight:800
}

.market-chart-module .chart-symbol small{display:none!important}
.market-chart-module .chart-symbol{width:100%;align-items:center}
.market-chart-module .chart-symbol b{font-size:14px}
.market-chart-module .chart-symbol span{margin-left:auto;max-width:45%}

.market-chart-module .chart-toolbar{
  display:block;padding:14px 16px 11px;background:rgba(255,255,255,.012)
}
.market-chart-module .chart-intervals{
  width:100%;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));
  gap:4px;margin-top:11px
}
.market-chart-module .chart-intervals button{
  min-height:43px;padding:7px 2px;border-radius:12px;font-size:10px
}
.market-chart-module .chart-shell{margin:0;border:0;border-radius:0;background:transparent}
.market-chart-module .chart{
  position:relative;
  height:clamp(320px,56vw,520px)!important;
  background:
    repeating-linear-gradient(90deg,transparent 0 calc(16.666% - 1px),var(--mf-grid) calc(16.666% - 1px) 16.666%),
    repeating-linear-gradient(0deg,transparent 0 calc(20% - 1px),var(--mf-grid) calc(20% - 1px) 20%),
    rgba(6,10,15,.86)!important
}
.market-chart-module #chartArea,
.market-chart-module #chartLine,
.market-chart-module #chartDot{opacity:0!important}

.market-chart-module .mf-candle-layer .mf-wick{
  stroke-width:1.35;vector-effect:non-scaling-stroke
}
.market-chart-module .mf-candle-layer .mf-body{
  rx:1.4;vector-effect:non-scaling-stroke
}
.market-chart-module .mf-candle-layer .up{fill:var(--mf-up);stroke:var(--mf-up)}
.market-chart-module .mf-candle-layer .down{fill:var(--mf-down);stroke:var(--mf-down)}

.mf-axis{
  position:absolute;right:7px;top:13px;bottom:23px;width:62px;z-index:4;
  pointer-events:none
}
.mf-axis span{
  position:absolute;right:0;transform:translateY(-50%);
  color:#97a4b5;font-size:9px;font-variant-numeric:tabular-nums;
  padding-left:7px;background:linear-gradient(90deg,transparent,rgba(6,10,15,.8) 30%)
}
.mf-last-line{
  position:absolute;left:0;right:62px;border-top:1px dashed rgba(81,231,168,.72);
  z-index:3;pointer-events:none
}
.mf-last-line:after{
  content:"";position:absolute;right:-3px;top:-4px;width:7px;height:7px;
  border-radius:50%;background:var(--green);box-shadow:0 0 12px rgba(81,231,168,.55)
}
.market-chart-module .chart-empty{
  inset:0 62px 0 0!important;display:flex;align-items:center;justify-content:center;
  text-align:center;padding:22px!important;font-size:12px!important;line-height:1.45!important
}
.market-chart-module .chart-empty b{font-size:13px!important}
.market-chart-module .chart-footer{padding:11px 16px;min-height:44px}

@media(max-width:560px){
  .mf-token-summary{
    grid-template-columns:56px minmax(0,1fr);gap:11px;padding:13px
  }
  .mf-token-image{width:56px;height:56px;border-radius:16px}
  .mf-token-title{font-size:19px}
  .mf-token-sub{font-size:9px;margin-top:5px}
  .mf-token-price{
    grid-column:1/-1;display:flex;align-items:baseline;justify-content:space-between;
    text-align:left;min-width:0;padding-top:2px
  }
  .mf-token-price b{font-size:26px}
  .mf-token-price span{margin-top:0;font-size:11px}
  .market-chart-module .chart-toolbar{padding:12px 11px 9px}
  .market-chart-module .chart-symbol b{
    max-width:58%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
  }
  .market-chart-module .chart-symbol span{
    max-width:38%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right
  }
  .market-chart-module .chart-intervals{gap:3px;margin-top:9px}
  .market-chart-module .chart-intervals button{min-height:45px;font-size:10px}
  .market-chart-module .chart{height:380px!important}
  .market-chart-module .chart-footer{padding:10px 11px;font-size:8px}
}
`;

const js = `
<script id="${marker}">
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const module = document.getElementById("market-chart-module");
  if (!module) return;

  const chart = module.querySelector(".chart");
  const svg = module.querySelector("#liveChartSvg");
  const line = module.querySelector("#chartLine");
  if (!chart || !svg || !line) return;

  function readText(selectors, fallback = "—") {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      if (value && value !== "—") return value;
    }
    return fallback;
  }

  function readImage() {
    const selectors = [
      "#decision-studio img",
      ".primary-card img",
      ".candidate.active img",
      ".candidate img",
      ".token-logo img",
      ".token-avatar img",
      "[data-token-image] img"
    ];
    for (const selector of selectors) {
      const img = document.querySelector(selector);
      if (img?.src) return img.src;
    }
    return "";
  }

  function ensureSummary() {
    let summary = module.querySelector(".mf-token-summary");
    if (summary) return summary;
    summary = document.createElement("div");
    summary.className = "mf-token-summary";
    summary.innerHTML = \`
      <img class="mf-token-image" alt="">
      <div class="mf-token-copy">
        <h3 class="mf-token-title">No token selected</h3>
        <div class="mf-token-sub">Waiting for token data</div>
      </div>
      <div class="mf-token-price">
        <b>—</b>
        <span>LIVE</span>
      </div>\`;
    module.querySelector(".market-chart-module-body")?.prepend(summary);
    return summary;
  }

  function updateSummary() {
    const summary = ensureSummary();
    const name = readText(["#decisionName", "#chartSymbol", ".token-name"], "No token selected");
    const meta = readText(["#decisionMeta", "#chartPairMeta", ".token-address"], "Solana token");
    const price = readText(["#chartCurrentPrice", "#marketCapValue"], "—");
    const image = readImage();

    summary.querySelector(".mf-token-title").textContent = name;
    summary.querySelector(".mf-token-sub").textContent = meta;
    summary.querySelector(".mf-token-price b").textContent = price;

    const img = summary.querySelector(".mf-token-image");
    if (image) {
      img.src = image;
      img.alt = name;
    } else {
      img.removeAttribute("src");
      img.alt = name;
    }
  }

  function pointsFromLine() {
    const raw = line.getAttribute("points")?.trim();
    if (!raw) return [];
    return raw.split(/\\s+/).map(pair => {
      const parts = pair.split(",");
      return { x:Number(parts[0]), y:Number(parts[1]) };
    }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  function candlesFromPoints(points, count) {
    if (points.length < 2) return [];
    const size = Math.max(1, Math.ceil(points.length / count));
    const result = [];
    for (let i = 0; i < points.length; i += size) {
      const group = points.slice(i, i + size);
      if (!group.length) continue;
      const ys = group.map(p => p.y);
      result.push({
        x: group.reduce((s,p) => s+p.x, 0) / group.length,
        open: group[0].y,
        close: group[group.length-1].y,
        high: Math.min(...ys),
        low: Math.max(...ys)
      });
    }
    return result;
  }

  function ensureOverlay() {
    let layer = svg.querySelector(".mf-candle-layer");
    if (!layer) {
      layer = document.createElementNS(NS, "g");
      layer.setAttribute("class", "mf-candle-layer");
      svg.appendChild(layer);
    }
    let axis = chart.querySelector(".mf-axis");
    if (!axis) {
      axis = document.createElement("div");
      axis.className = "mf-axis";
      chart.appendChild(axis);
    }
    let lastLine = chart.querySelector(".mf-last-line");
    if (!lastLine) {
      lastLine = document.createElement("div");
      lastLine.className = "mf-last-line";
      chart.appendChild(lastLine);
    }
    return { layer, axis, lastLine };
  }

  let raf = 0;
  function scheduleRender() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  }

  function render() {
    updateSummary();
    const points = pointsFromLine();
    const {layer, axis, lastLine} = ensureOverlay();
    layer.replaceChildren();

    if (points.length < 2) {
      axis.replaceChildren();
      lastLine.style.display = "none";
      return;
    }

    const viewWidth = svg.viewBox?.baseVal?.width || 760;
    const desired = window.innerWidth <= 560 ? 28 : 42;
    const candles = candlesFromPoints(points, desired);
    const bodyWidth = Math.max(3, Math.min(13, (viewWidth / candles.length) * .56));

    for (const c of candles) {
      const up = c.close <= c.open;
      const cls = up ? "up" : "down";

      const wick = document.createElementNS(NS, "line");
      wick.setAttribute("x1", c.x);
      wick.setAttribute("x2", c.x);
      wick.setAttribute("y1", c.high);
      wick.setAttribute("y2", c.low);
      wick.setAttribute("class", \`mf-wick \${cls}\`);

      const body = document.createElementNS(NS, "rect");
      body.setAttribute("x", c.x - bodyWidth/2);
      body.setAttribute("y", Math.min(c.open,c.close));
      body.setAttribute("width", bodyWidth);
      body.setAttribute("height", Math.max(2, Math.abs(c.close-c.open)));
      body.setAttribute("class", \`mf-body \${cls}\`);

      layer.append(wick, body);
    }

    const ys = points.map(p => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(1, maxY-minY);
    const lastY = points[points.length-1].y;

    axis.replaceChildren();
    for (let i=0;i<5;i++) {
      const label = document.createElement("span");
      label.style.top = (i*25) + "%";
      label.textContent = ["HIGH","+2%","LIVE","-2%","LOW"][i];
      axis.appendChild(label);
    }
    lastLine.style.top = Math.max(2,Math.min(98,((lastY-minY)/span)*100)) + "%";
    lastLine.style.display = "";
  }

  const lineObserver = new MutationObserver(scheduleRender);
  lineObserver.observe(line,{attributes:true,attributeFilter:["points"]});

  const summarySelectors = [
    "#decisionName","#decisionMeta","#chartSymbol","#chartCurrentPrice","#chartPairMeta"
  ];
  for (const selector of summarySelectors) {
    const el = document.querySelector(selector);
    if (el) {
      new MutationObserver(updateSummary).observe(el,{
        childList:true,characterData:true,subtree:true
      });
    }
  }

  window.addEventListener("resize", scheduleRender, {passive:true});
  updateSummary();
  scheduleRender();
})();
</script>
`;

const styleEnd = html.lastIndexOf("</style>");
const bodyEnd = html.lastIndexOf("</body>");

if (styleEnd < 0 || bodyEnd < 0) {
  console.error("ERROR: Could not locate </style> or </body>.");
  process.exit(1);
}

html = html.slice(0, styleEnd) + css + "\n" + html.slice(styleEnd);
const newBodyEnd = html.lastIndexOf("</body>");
html = html.slice(0, newBodyEnd) + js + "\n" + html.slice(newBodyEnd);

fs.writeFileSync(file, html, "utf8");

console.log("SUCCESS: Broken premium patch repaired and safe candlestick chart installed.");
console.log(`Updated: ${file}`);
console.log(`Backup:  ${safeBackup}`);
