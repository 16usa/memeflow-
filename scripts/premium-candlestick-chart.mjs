#!/usr/bin/env node
/**
 * MEMEFLOW Premium Candlestick Market Chart
 * Enhances the already-separated #market-chart-module without changing backend,
 * polling, chart intervals, token switching, or existing IDs.
 *
 * Target: memeflow-app/index.html
 * Idempotent and creates a rollback backup.
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || "memeflow-app/index.html";
const file = path.resolve(target);

if (!fs.existsSync(file)) {
  console.error(`ERROR: File not found: ${file}`);
  process.exit(1);
}

let html = fs.readFileSync(file, "utf8");
const marker = "MEMEFLOW_PREMIUM_CANDLESTICK_CHART_V1";

if (!html.includes('id="market-chart-module"')) {
  console.error("ERROR: #market-chart-module not found. Apply the separate Market Chart patch first.");
  process.exit(1);
}

if (html.includes(marker)) {
  console.log("Premium candlestick chart patch is already installed. Nothing changed.");
  process.exit(0);
}

const css = `
/* ${marker} */
.market-chart-module{
  --mf-chart-up:#4fe083;
  --mf-chart-down:#ff4d61;
  --mf-chart-grid:rgba(142,160,181,.11);
  --mf-chart-panel:rgba(6,10,15,.86);
}
.market-chart-module .panel-head{
  padding:16px 18px;
}
.market-chart-token-hero{
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  gap:14px;
  align-items:center;
  padding:18px;
  border-bottom:1px solid var(--line-soft,var(--line));
  background:
    radial-gradient(circle at 88% 12%,rgba(84,221,255,.08),transparent 32%),
    linear-gradient(180deg,rgba(255,255,255,.018),transparent);
}
.market-chart-token-logo{
  width:72px;
  height:72px;
  border-radius:20px;
  object-fit:cover;
  border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(135deg,rgba(84,221,255,.18),rgba(81,231,168,.08));
  box-shadow:0 14px 34px rgba(0,0,0,.28);
}
.market-chart-token-copy{min-width:0}
.market-chart-token-name{
  margin:0;
  font-size:clamp(19px,3vw,30px);
  line-height:1.05;
  letter-spacing:-.035em;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.market-chart-token-meta{
  display:flex;
  align-items:center;
  gap:9px;
  margin-top:8px;
  color:var(--muted);
  font-size:12px;
  min-width:0;
}
.market-chart-token-address{
  max-width:190px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.market-chart-price-block{
  text-align:right;
  min-width:125px;
}
.market-chart-price{
  display:block;
  font-size:clamp(22px,4vw,38px);
  line-height:1;
  font-weight:900;
  letter-spacing:-.045em;
  font-variant-numeric:tabular-nums;
}
.market-chart-change{
  display:block;
  margin-top:8px;
  color:var(--green);
  font-size:14px;
  font-weight:800;
}
.market-chart-change.negative{color:var(--red)}
.market-chart-module .chart-symbol small{display:none!important}
.market-chart-module .chart-symbol b{
  font-size:14px;
  letter-spacing:.01em;
}
.market-chart-module .chart-symbol span{
  margin-left:auto;
}
.market-chart-module .chart-shell{
  border:0;
  border-radius:0;
  background:transparent;
}
.market-chart-module .chart-toolbar{
  padding:15px 18px 12px;
  background:rgba(255,255,255,.012);
}
.market-chart-module .chart-intervals{
  width:100%;
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
  gap:5px;
  margin-top:12px;
}
.market-chart-module .chart-intervals button{
  min-height:42px;
  border:1px solid transparent;
  border-radius:12px;
  font-size:11px;
}
.market-chart-module .chart-intervals button.active{
  border-color:rgba(84,221,255,.26);
  background:rgba(84,221,255,.075);
  box-shadow:inset 0 0 22px rgba(84,221,255,.025);
}
.market-chart-module .chart{
  position:relative;
  height:clamp(330px,58vw,560px)!important;
  background:
    repeating-linear-gradient(90deg,transparent 0 calc(16.666% - 1px),var(--mf-chart-grid) calc(16.666% - 1px) 16.666%),
    repeating-linear-gradient(0deg,transparent 0 calc(20% - 1px),var(--mf-chart-grid) calc(20% - 1px) 20%),
    var(--mf-chart-panel)!important;
}
.market-chart-module #chartArea,
.market-chart-module #chartLine,
.market-chart-module #chartDot{
  opacity:0!important;
}
.market-chart-module .mf-candle-layer .wick{
  stroke-width:1.35;
  vector-effect:non-scaling-stroke;
}
.market-chart-module .mf-candle-layer .body{
  rx:1.5;
  vector-effect:non-scaling-stroke;
}
.market-chart-module .mf-candle-layer .up{fill:var(--mf-chart-up);stroke:var(--mf-chart-up)}
.market-chart-module .mf-candle-layer .down{fill:var(--mf-chart-down);stroke:var(--mf-chart-down)}
.market-chart-module .mf-price-axis{
  position:absolute;
  right:8px;
  inset-block:14px 24px;
  width:62px;
  pointer-events:none;
  z-index:4;
}
.market-chart-module .mf-price-axis span{
  position:absolute;
  right:0;
  transform:translateY(-50%);
  padding-left:7px;
  color:#9aa6b6;
  font-size:10px;
  font-variant-numeric:tabular-nums;
  background:linear-gradient(90deg,transparent,rgba(6,10,15,.72) 28%);
}
.market-chart-module .mf-current-line{
  position:absolute;
  left:0;
  right:62px;
  border-top:1px dashed rgba(81,231,168,.75);
  pointer-events:none;
  z-index:3;
}
.market-chart-module .mf-current-line:after{
  content:"";
  position:absolute;
  right:-3px;
  top:-4px;
  width:7px;
  height:7px;
  border-radius:50%;
  background:var(--green);
  box-shadow:0 0 12px rgba(81,231,168,.55);
}
.market-chart-module .chart-empty{
  inset:0 62px 0 0!important;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  padding:24px!important;
  font-size:12px!important;
  line-height:1.45!important;
}
.market-chart-module .chart-empty b{font-size:13px!important}
.market-chart-module .chart-footer{
  padding:12px 18px;
  min-height:46px;
}
html[data-theme="light"] .market-chart-module{
  --mf-chart-panel:#f7f9fb;
  --mf-chart-grid:rgba(23,38,54,.08);
}
@media(max-width:560px){
  .market-chart-token-hero{
    grid-template-columns:58px minmax(0,1fr);
    gap:12px;
    padding:14px;
  }
  .market-chart-token-logo{
    width:58px;
    height:58px;
    border-radius:17px;
  }
  .market-chart-token-name{
    font-size:20px;
  }
  .market-chart-token-meta{
    font-size:10px;
    margin-top:6px;
  }
  .market-chart-price-block{
    grid-column:1/-1;
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    text-align:left;
    min-width:0;
    padding-top:3px;
  }
  .market-chart-price{
    font-size:27px;
  }
  .market-chart-change{
    margin-top:0;
    font-size:12px;
  }
  .market-chart-module .chart-toolbar{
    padding:13px 12px 10px;
  }
  .market-chart-module .chart-symbol{
    width:100%;
  }
  .market-chart-module .chart-symbol b{
    max-width:58%;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .market-chart-module .chart-symbol span{
    max-width:38%;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    text-align:right;
  }
  .market-chart-module .chart-intervals{
    gap:3px;
    margin-top:10px;
  }
  .market-chart-module .chart-intervals button{
    min-height:46px;
    padding:7px 1px;
    font-size:10px;
  }
  .market-chart-module .chart{
    height:390px!important;
  }
  .market-chart-module .chart-footer{
    padding:11px 12px;
    font-size:8px;
  }
}
`;

const js = `
<script id="${marker}">
(() => {
  const MODULE_ID = "market-chart-module";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const text = (selectors, fallback = "—") => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      if (value && value !== "—") return value;
    }
    return fallback;
  };

  const firstImage = () => {
    const selectors = [
      "#decision-studio img",
      ".primary-card img",
      ".candidate.active img",
      ".candidate img",
      "[data-token-image] img",
      "img[token-logo]",
      ".token-logo img",
      ".token-avatar img"
    ];
    for (const selector of selectors) {
      const img = document.querySelector(selector);
      if (img?.src) return img.src;
    }
    return "";
  };

  const numberFromText = value => {
    if (!value) return null;
    const compact = value.replace(/,/g, "").match(/-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?/i);
    return compact ? Number(compact[0]) : null;
  };

  const formatPrice = value => {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
    if (value >= 1_000) return "$" + (value / 1_000).toFixed(2) + "K";
    if (value >= 1) return "$" + value.toFixed(4);
    if (value >= .001) return "$" + value.toFixed(6);
    return "$" + value.toExponential(4);
  };

  function ensureHero(module) {
    let hero = module.querySelector(".market-chart-token-hero");
    if (hero) return hero;
    hero = document.createElement("div");
    hero.className = "market-chart-token-hero";
    hero.innerHTML = \`
      <img class="market-chart-token-logo" alt="" />
      <div class="market-chart-token-copy">
        <h3 class="market-chart-token-name">No token selected</h3>
        <div class="market-chart-token-meta">
          <span class="market-chart-token-address">Waiting for token data</span>
          <span aria-hidden="true">↗</span>
        </div>
      </div>
      <div class="market-chart-price-block">
        <b class="market-chart-price">—</b>
        <span class="market-chart-change">LIVE</span>
      </div>\`;
    const body = module.querySelector(".market-chart-module-body");
    body?.prepend(hero);
    return hero;
  }

  function updateHero(module) {
    const hero = ensureHero(module);
    const name = text(["#decisionName", "#chartSymbol", ".token-name", "[data-token-name]"], "No token selected");
    const address = text(["#decisionMeta", "[data-token-address-text]", ".token-address"], "Solana token");
    const sourcePrice = text(["#chartCurrentPrice", "#marketCapValue", "[data-current-price]"], "—");
    const parsed = numberFromText(sourcePrice);
    const image = firstImage();

    hero.querySelector(".market-chart-token-name").textContent = name;
    hero.querySelector(".market-chart-token-address").textContent = address;
    hero.querySelector(".market-chart-price").textContent =
      sourcePrice.includes("$") || parsed === null ? sourcePrice : formatPrice(parsed);

    const img = hero.querySelector(".market-chart-token-logo");
    if (image) {
      img.src = image;
      img.style.visibility = "visible";
    } else {
      img.removeAttribute("src");
      img.style.visibility = "visible";
      img.alt = name.slice(0, 2).toUpperCase();
    }
  }

  function parsePolyline(polyline) {
    const raw = polyline?.getAttribute("points")?.trim();
    if (!raw) return [];
    return raw.split(/\\s+/).map(pair => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  }

  function aggregate(points, targetCount = 36) {
    if (points.length < 2) return [];
    const groupSize = Math.max(1, Math.ceil(points.length / targetCount));
    const candles = [];
    for (let i = 0; i < points.length; i += groupSize) {
      const group = points.slice(i, i + groupSize);
      if (!group.length) continue;
      const ys = group.map(p => p.y);
      candles.push({
        x: group.reduce((sum, p) => sum + p.x, 0) / group.length,
        open: group[0].y,
        close: group[group.length - 1].y,
        high: Math.min(...ys),
        low: Math.max(...ys)
      });
    }
    return candles;
  }

  function renderCandles(module) {
    const svg = module.querySelector("#liveChartSvg");
    const polyline = module.querySelector("#chartLine");
    if (!svg || !polyline) return;

    const points = parsePolyline(polyline);
    let layer = svg.querySelector(".mf-candle-layer");
    if (!layer) {
      layer = document.createElementNS(SVG_NS, "g");
      layer.setAttribute("class", "mf-candle-layer");
      const markerLayer = svg.querySelector("#chartMarkers");
      svg.insertBefore(layer, markerLayer || null);
    }
    layer.replaceChildren();

    if (points.length < 2) {
      updateAxis(module, []);
      return;
    }

    const box = svg.viewBox?.baseVal;
    const width = box?.width || 760;
    const target = width < 500 ? 28 : 42;
    const candles = aggregate(points, target);
    const candleWidth = Math.max(3, Math.min(14, (width / Math.max(candles.length, 1)) * .58));

    for (const candle of candles) {
      const up = candle.close <= candle.open;
      const cls = up ? "up" : "down";
      const wick = document.createElementNS(SVG_NS, "line");
      wick.setAttribute("x1", candle.x);
      wick.setAttribute("x2", candle.x);
      wick.setAttribute("y1", candle.high);
      wick.setAttribute("y2", candle.low);
      wick.setAttribute("class", \`wick \${cls}\`);

      const body = document.createElementNS(SVG_NS, "rect");
      const y = Math.min(candle.open, candle.close);
      const h = Math.max(2, Math.abs(candle.close - candle.open));
      body.setAttribute("x", candle.x - candleWidth / 2);
      body.setAttribute("y", y);
      body.setAttribute("width", candleWidth);
      body.setAttribute("height", h);
      body.setAttribute("class", \`body \${cls}\`);

      layer.append(wick, body);
    }
    updateAxis(module, points);
  }

  function updateAxis(module, points) {
    const chart = module.querySelector(".chart");
    if (!chart) return;
    let axis = chart.querySelector(".mf-price-axis");
    if (!axis) {
      axis = document.createElement("div");
      axis.className = "mf-price-axis";
      chart.append(axis);
    }
    let currentLine = chart.querySelector(".mf-current-line");
    if (!currentLine) {
      currentLine = document.createElement("div");
      currentLine.className = "mf-current-line";
      chart.append(currentLine);
    }

    if (!points.length) {
      axis.replaceChildren();
      currentLine.style.display = "none";
      return;
    }

    const ys = points.map(p => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const currentText = text(["#chartCurrentPrice"], "");
    const current = numberFromText(currentText);
    const span = Math.max(maxY - minY, 1);
    const center = Number.isFinite(current) ? current : 30_000;
    const volatility = .08;
    const maxPrice = center * (1 + volatility / 2);
    const minPrice = center * (1 - volatility / 2);

    axis.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const ratio = i / 4;
      const label = document.createElement("span");
      label.style.top = (ratio * 100) + "%";
      label.textContent = formatPrice(maxPrice - (maxPrice - minPrice) * ratio).replace("$", "");
      axis.append(label);
    }

    const lastY = points[points.length - 1].y;
    const percent = Math.max(2, Math.min(98, ((lastY - minY) / span) * 100));
    currentLine.style.top = percent + "%";
    currentLine.style.display = "";
  }

  function setup(module) {
    updateHero(module);
    renderCandles(module);

    const polyline = module.querySelector("#chartLine");
    if (polyline && !polyline.dataset.mfObserved) {
      polyline.dataset.mfObserved = "1";
      new MutationObserver(() => renderCandles(module))
        .observe(polyline, { attributes: true, attributeFilter: ["points"] });
    }

    const observed = [
      "#decisionName", "#decisionMeta", "#chartSymbol", "#chartCurrentPrice",
      "#chartSource", "#chartConnection"
    ];
    for (const selector of observed) {
      const el = document.querySelector(selector);
      if (el && !el.dataset.mfHeroObserved) {
        el.dataset.mfHeroObserved = "1";
        new MutationObserver(() => updateHero(module))
          .observe(el, { childList: true, characterData: true, subtree: true });
      }
    }
  }

  const boot = () => {
    const module = document.getElementById(MODULE_ID);
    if (module) setup(module);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  new MutationObserver(boot).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>
`;

const styleEnd = html.lastIndexOf("</style>");
if (styleEnd < 0) {
  console.error("ERROR: Could not find </style>.");
  process.exit(1);
}

const bodyEnd = html.lastIndexOf("</body>");
if (bodyEnd < 0) {
  console.error("ERROR: Could not find </body>.");
  process.exit(1);
}

const backup = `${file}.before-premium-candlestick-chart`;
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

html = html.slice(0, styleEnd) + css + "\n" + html.slice(styleEnd);
const newBodyEnd = html.lastIndexOf("</body>");
html = html.slice(0, newBodyEnd) + js + "\n" + html.slice(newBodyEnd);

fs.writeFileSync(file, html, "utf8");

console.log("SUCCESS: Premium candlestick Market Chart installed.");
console.log(`Updated: ${file}`);
console.log(`Backup:  ${backup}`);
