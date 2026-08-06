#!/usr/bin/env node
/**
 * MEMEFLOW Native OHLC Chart v1
 *
 * Replaces the visual content of the existing standalone Market Chart module
 * with a self-contained Canvas candlestick chart.
 *
 * Data source:
 * - samples the already-rendered live price (#chartCurrentPrice)
 * - stores per-token samples in localStorage
 * - aggregates samples into OHLC candles for 1s / 1m / 5m / 15m / 1h / All
 *
 * It does NOT add another backend request.
 * It removes prior experimental chart-patch blocks before installing.
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || "memeflow-app/index.html";
const file = path.resolve(target);
const backup = `${file}.before-native-ohlc-chart`;
const marker = "MEMEFLOW_NATIVE_OHLC_CHART_V1";

if (!fs.existsSync(file)) {
  console.error(`ERROR: File not found: ${file}`);
  process.exit(1);
}

let html = fs.readFileSync(file, "utf8");

if (!html.includes('id="market-chart-module"')) {
  console.error("ERROR: Separate Market Chart module not found.");
  process.exit(1);
}

if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

/* Remove prior experimental patch blocks by marker. */
const oldMarkers = [
  "MEMEFLOW_PREMIUM_CANDLESTICK_CHART_V1",
  "MEMEFLOW_SAFE_CANDLESTICK_CHART_V2",
  "MEMEFLOW_CANDLESTICK_FINAL_FIX_V3",
  "separate-market-chart-mobile-hotfix"
];

for (const oldMarker of oldMarkers) {
  const scriptRe = new RegExp(
    `<script[^>]*id=["']${oldMarker}["'][\\s\\S]*?<\\/script>\\s*`,
    "g"
  );
  html = html.replace(scriptRe, "");

  const cssComment = `/* ${oldMarker} */`;
  const cssStart = html.indexOf(cssComment);
  if (cssStart >= 0) {
    const nextMarker = html.indexOf("/* =====", cssStart + cssComment.length);
    const styleEnd = html.indexOf("</style>", cssStart);
    const end = nextMarker >= 0 && nextMarker < styleEnd ? nextMarker : styleEnd;
    if (end > cssStart) html = html.slice(0, cssStart) + html.slice(end);
  }
}

/* Remove previous native version if script is re-run after manual edits. */
html = html.replace(
  new RegExp(`<script[^>]*id=["']${marker}["'][\\s\\S]*?<\\/script>\\s*`, "g"),
  ""
);

const css = `
/* ${marker} */
#market-chart-module .market-chart-module-body{padding:0!important}
#market-chart-module .chart-shell{display:none!important}
#market-chart-module .mf-token-summary{display:none!important}

.mf-native-chart{
  --mf-up:#51df85;
  --mf-down:#ff5063;
  --mf-grid:rgba(145,162,181,.105);
  --mf-panel:#070c12;
  background:linear-gradient(180deg,rgba(14,20,28,.96),rgba(7,11,16,.985));
}
.mf-native-tokenbar{
  display:grid;
  grid-template-columns:72px minmax(0,1fr) auto;
  gap:15px;
  align-items:center;
  padding:17px 18px;
  border-bottom:1px solid var(--line-soft,var(--line));
  background:
    radial-gradient(circle at 88% 8%,rgba(84,221,255,.08),transparent 34%),
    linear-gradient(180deg,rgba(255,255,255,.018),transparent);
}
.mf-native-avatar{
  width:72px;height:72px;border-radius:20px;overflow:hidden;
  display:grid;place-items:center;
  border:1px solid rgba(255,255,255,.12);
  background:
    radial-gradient(circle at 28% 20%,rgba(84,221,255,.25),transparent 35%),
    linear-gradient(145deg,rgba(84,221,255,.12),rgba(81,231,168,.06));
  color:#f4f8fb;font-size:20px;font-weight:900;letter-spacing:.04em;
  box-shadow:0 13px 32px rgba(0,0,0,.28)
}
.mf-native-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.mf-native-copy{min-width:0}
.mf-native-name{
  margin:0;font-size:clamp(21px,3.4vw,31px);line-height:1.04;
  letter-spacing:-.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.mf-native-meta{
  display:flex;align-items:center;gap:8px;margin-top:8px;
  color:var(--muted);font-size:11px;min-width:0
}
.mf-native-meta span:first-child{
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.mf-native-quote{text-align:right;min-width:145px}
.mf-native-price{
  display:block;font-size:clamp(24px,4.4vw,40px);line-height:1;
  font-weight:900;letter-spacing:-.045em;font-variant-numeric:tabular-nums
}
.mf-native-change{
  display:block;margin-top:8px;color:var(--green);font-size:13px;font-weight:850
}
.mf-native-change.down{color:var(--red)}

.mf-native-toolbar{
  display:grid;grid-template-columns:minmax(0,1fr) auto;
  gap:12px;align-items:center;padding:14px 17px 11px
}
.mf-native-label{
  display:flex;align-items:baseline;gap:9px;min-width:0
}
.mf-native-label small{
  color:var(--muted);font-size:8px;letter-spacing:.13em
}
.mf-native-label b{
  font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.mf-native-source{color:var(--muted);font-size:10px;white-space:nowrap}
.mf-native-intervals{
  grid-column:1/-1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));
  gap:4px
}
.mf-native-intervals button{
  min-height:43px;border:1px solid transparent;border-radius:12px;
  background:transparent;color:var(--muted);font:inherit;font-size:10px;
  font-weight:850;cursor:pointer
}
.mf-native-intervals button.active{
  color:var(--text);border-color:rgba(84,221,255,.27);
  background:rgba(84,221,255,.075);
  box-shadow:inset 0 0 24px rgba(84,221,255,.025)
}

.mf-native-stage{
  position:relative;height:clamp(350px,58vw,560px);
  border-top:1px solid var(--line-soft,var(--line));
  border-bottom:1px solid var(--line-soft,var(--line));
  background:var(--mf-panel);overflow:hidden
}
.mf-native-canvas{display:block;width:100%;height:100%}
.mf-native-overlay{
  position:absolute;inset:0;pointer-events:none
}
.mf-native-badge{
  position:absolute;right:15px;top:14px;padding:5px 8px;border-radius:9px;
  background:rgba(81,231,168,.09);color:var(--green);
  font-size:9px;font-weight:900;letter-spacing:.1em
}
.mf-native-lastprice{
  position:absolute;right:15px;top:47px;color:var(--text);
  font-size:11px;font-weight:850;font-variant-numeric:tabular-nums
}
.mf-native-age{
  position:absolute;right:15px;top:67px;color:var(--muted);font-size:9px
}
.mf-native-empty{
  position:absolute;inset:0;display:grid;place-items:center;text-align:center;
  padding:28px;color:var(--muted);font-size:11px;line-height:1.5
}
.mf-native-empty b{display:block;color:var(--text);font-size:13px;margin-bottom:5px}

.mf-native-footer{
  display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:11px 17px;color:var(--muted);font-size:9px;flex-wrap:wrap
}
.mf-native-live{display:flex;align-items:center;gap:7px}
.mf-native-dot{
  width:8px;height:8px;border-radius:50%;background:var(--green);
  box-shadow:0 0 0 4px rgba(81,231,168,.09)
}

@media(max-width:560px){
  .mf-native-tokenbar{
    grid-template-columns:58px minmax(0,1fr);gap:12px;padding:14px
  }
  .mf-native-avatar{width:58px;height:58px;border-radius:17px;font-size:17px}
  .mf-native-name{font-size:20px}
  .mf-native-meta{font-size:9px;margin-top:6px}
  .mf-native-quote{
    grid-column:1/-1;display:flex;align-items:baseline;justify-content:space-between;
    text-align:left;min-width:0;padding-top:2px
  }
  .mf-native-price{font-size:27px}
  .mf-native-change{margin-top:0;font-size:11px}
  .mf-native-toolbar{padding:12px 11px 9px}
  .mf-native-source{max-width:42%;overflow:hidden;text-overflow:ellipsis}
  .mf-native-intervals{gap:3px}
  .mf-native-intervals button{min-height:45px;font-size:10px;padding:6px 1px}
  .mf-native-stage{height:390px}
  .mf-native-footer{padding:10px 11px;font-size:8px}
}
`;

const js = `
<script id="${marker}">
(() => {
  "use strict";

  const module = document.getElementById("market-chart-module");
  if (!module) return;

  const body = module.querySelector(".market-chart-module-body");
  if (!body) return;

  const STORAGE_PREFIX = "mf_ohlc_samples_v1:";
  const MAX_SAMPLES = 7200;
  const intervals = {
    "1s": 1000,
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "all": 0
  };

  let activeInterval = "1s";
  let samples = [];
  let currentTokenKey = "";
  let lastSampleAt = 0;
  let lastPrice = null;
  let lastRenderedToken = "";

  function firstText(selectors, fallback = "—") {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      if (value && value !== "—") return value;
    }
    return fallback;
  }

  function parsePrice(raw) {
    if (!raw) return null;
    const normalized = String(raw).replace(/,/g, "").replace(/\\$/g, "").trim();
    const match = normalized.match(/-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?/i);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function formatPrice(value) {
    if (!Number.isFinite(value)) return "—";
    if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
    if (value >= 1_000) return "$" + (value / 1_000).toFixed(2) + "K";
    if (value >= 1) return "$" + value.toFixed(4);
    if (value >= 0.001) return "$" + value.toFixed(6);
    return "$" + value.toExponential(5);
  }

  function tokenName() {
    return firstText(["#decisionName", "#chartSymbol", ".token-name"], "Token");
  }

  function tokenMeta() {
    return firstText(["#decisionMeta", "#chartPairMeta"], "Solana");
  }

  function tokenKey() {
    return firstText(
      ["[data-token-address-text]", ".token-address", "#decisionMeta", "#chartSymbol"],
      tokenName()
    ).replace(/\\s+/g, "_").slice(0, 120);
  }

  function tokenImage() {
    const selectors = [
      "#decision-studio img[src]",
      ".primary-card img[src]",
      ".candidate.active img[src]",
      ".candidate img[src]",
      ".token-logo img[src]",
      ".token-avatar img[src]",
      "[data-token-image] img[src]"
    ];
    for (const selector of selectors) {
      const img = document.querySelector(selector);
      if (img?.src) return img.src;
    }
    return "";
  }

  function currentPrice() {
    return parsePrice(firstText(["#chartCurrentPrice"], ""));
  }

  function loadSamples(key) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter(x => Number.isFinite(x?.t) && Number.isFinite(x?.p))
        : [];
    } catch {
      return [];
    }
  }

  function saveSamples() {
    try {
      localStorage.setItem(
        STORAGE_PREFIX + currentTokenKey,
        JSON.stringify(samples.slice(-MAX_SAMPLES))
      );
    } catch {}
  }

  function ensureUI() {
    let root = body.querySelector(".mf-native-chart");
    if (root) return root;

    root = document.createElement("div");
    root.className = "mf-native-chart";
    root.innerHTML = \`
      <div class="mf-native-tokenbar">
        <div class="mf-native-avatar" aria-label="Token image"></div>
        <div class="mf-native-copy">
          <h3 class="mf-native-name">Token</h3>
          <div class="mf-native-meta"><span>Solana</span><span>↗</span></div>
        </div>
        <div class="mf-native-quote">
          <b class="mf-native-price">—</b>
          <span class="mf-native-change">LIVE</span>
        </div>
      </div>
      <div class="mf-native-toolbar">
        <div class="mf-native-label">
          <small>MARKET CHART</small>
          <b>Token</b>
        </div>
        <span class="mf-native-source">Fresh Solana price stream</span>
        <div class="mf-native-intervals" aria-label="Chart interval">
          <button class="active" data-mf-interval="1s" type="button">1s</button>
          <button data-mf-interval="1m" type="button">1m</button>
          <button data-mf-interval="5m" type="button">5m</button>
          <button data-mf-interval="15m" type="button">15m</button>
          <button data-mf-interval="1h" type="button">1h</button>
          <button data-mf-interval="all" type="button">All</button>
        </div>
      </div>
      <div class="mf-native-stage">
        <canvas class="mf-native-canvas"></canvas>
        <div class="mf-native-overlay">
          <span class="mf-native-badge">LIVE</span>
          <span class="mf-native-lastprice">—</span>
          <span class="mf-native-age">—</span>
          <div class="mf-native-empty"><div><b>Waiting for verified price history</b><span>The first candle appears after enough live samples are collected.</span></div></div>
        </div>
      </div>
      <div class="mf-native-footer">
        <span class="mf-native-live"><i class="mf-native-dot"></i><b>LIVE DATA</b></span>
        <span class="mf-native-pair">Token · Solana</span>
        <span class="mf-native-count">0 candles</span>
      </div>\`;

    body.prepend(root);

    root.querySelectorAll("[data-mf-interval]").forEach(button => {
      button.addEventListener("click", () => {
        activeInterval = button.dataset.mfInterval || "1s";
        root.querySelectorAll("[data-mf-interval]").forEach(b =>
          b.classList.toggle("active", b === button)
        );
        draw();
      });
    });

    return root;
  }

  function updateTokenUI() {
    const root = ensureUI();
    const name = tokenName();
    const meta = tokenMeta();
    const image = tokenImage();
    const price = currentPrice();

    root.querySelector(".mf-native-name").textContent = name;
    root.querySelector(".mf-native-label b").textContent = name;
    root.querySelector(".mf-native-meta span").textContent = meta;
    root.querySelector(".mf-native-pair").textContent = name + " · Solana";

    const avatar = root.querySelector(".mf-native-avatar");
    const initials = name.split(/\\s+/).filter(Boolean).slice(0, 2)
      .map(x => x[0]).join("").toUpperCase() || "MF";
    avatar.replaceChildren();
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = name;
      img.onerror = () => {
        avatar.replaceChildren();
        avatar.textContent = initials;
      };
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials;
    }

    root.querySelector(".mf-native-price").textContent = formatPrice(price);
    root.querySelector(".mf-native-lastprice").textContent = formatPrice(price);

    if (samples.length >= 2) {
      const first = samples[0].p;
      const change = ((samples[samples.length - 1].p - first) / first) * 100;
      const changeEl = root.querySelector(".mf-native-change");
      changeEl.textContent = (change >= 0 ? "↑ " : "↓ ") + Math.abs(change).toFixed(2) + "%";
      changeEl.classList.toggle("down", change < 0);
    }
  }

  function switchTokenIfNeeded() {
    const key = tokenKey();
    if (key === currentTokenKey) return;

    currentTokenKey = key;
    samples = loadSamples(key).slice(-MAX_SAMPLES);
    lastSampleAt = samples.at(-1)?.t || 0;
    lastPrice = samples.at(-1)?.p || null;
    lastRenderedToken = tokenName();
    updateTokenUI();
    draw();
  }

  function samplePrice() {
    switchTokenIfNeeded();
    const price = currentPrice();
    if (!price) return;

    const now = Date.now();
    if (now - lastSampleAt < 900 && price === lastPrice) return;

    samples.push({ t: now, p: price });
    if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
    lastSampleAt = now;
    lastPrice = price;
    saveSamples();
    updateTokenUI();
    draw();
  }

  function aggregate(step) {
    if (!samples.length) return [];
    if (!step) {
      const target = Math.min(80, Math.max(1, Math.floor(samples.length / 2)));
      step = Math.max(1000, Math.ceil((samples.at(-1).t - samples[0].t + 1) / target));
    }

    const buckets = new Map();
    for (const sample of samples) {
      const bucket = Math.floor(sample.t / step) * step;
      let candle = buckets.get(bucket);
      if (!candle) {
        candle = {
          t: bucket,
          open: sample.p,
          high: sample.p,
          low: sample.p,
          close: sample.p
        };
        buckets.set(bucket, candle);
      } else {
        candle.high = Math.max(candle.high, sample.p);
        candle.low = Math.min(candle.low, sample.p);
        candle.close = sample.p;
      }
    }

    return [...buckets.values()].sort((a,b) => a.t - b.t).slice(-120);
  }

  function drawGrid(ctx, width, height, left, top, right, bottom) {
    ctx.save();
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--line-soft").trim() || "rgba(145,162,181,.10)";
    ctx.lineWidth = 1;
    const plotW = right - left;
    const plotH = bottom - top;

    for (let i = 0; i <= 5; i++) {
      const y = top + (plotH * i / 5);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = left + (plotW * i / 6);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const root = ensureUI();
    const canvas = root.querySelector(".mf-native-canvas");
    const stage = root.querySelector(".mf-native-stage");
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0,0,width,height);

    const left = 16;
    const top = 18;
    const right = width - 66;
    const bottom = height - 34;
    drawGrid(ctx,width,height,left,top,right,bottom);

    const candles = aggregate(intervals[activeInterval]);
    root.querySelector(".mf-native-count").textContent =
      candles.length + (candles.length === 1 ? " candle" : " candles");
    root.querySelector(".mf-native-empty").style.display =
      candles.length ? "none" : "grid";

    if (!candles.length) return;

    let min = Math.min(...candles.map(c => c.low));
    let max = Math.max(...candles.map(c => c.high));
    if (min === max) {
      const pad = Math.max(min * 0.01, 1e-12);
      min -= pad;
      max += pad;
    } else {
      const pad = (max - min) * 0.08;
      min -= pad;
      max += pad;
    }

    const plotW = right - left;
    const plotH = bottom - top;
    const xStep = plotW / Math.max(candles.length, 1);
    const bodyW = Math.max(3, Math.min(14, xStep * 0.58));
    const yFor = price => top + ((max - price) / (max - min)) * plotH;

    ctx.font = "10px system-ui,-apple-system,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#97a4b5";

    for (let i = 0; i < 5; i++) {
      const ratio = i / 4;
      const price = max - (max - min) * ratio;
      const y = top + plotH * ratio;
      ctx.fillText(formatPrice(price).replace("$",""), right + 8, y);
    }

    candles.forEach((candle, index) => {
      const x = left + xStep * index + xStep / 2;
      const openY = yFor(candle.open);
      const closeY = yFor(candle.close);
      const highY = yFor(candle.high);
      const lowY = yFor(candle.low);
      const up = candle.close >= candle.open;
      const color = up ? "#51df85" : "#ff5063";

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.25;

      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const y = Math.min(openY, closeY);
      const h = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - bodyW/2, y, bodyW, h);
    });

    const last = candles.at(-1);
    const lastY = yFor(last.close);
    ctx.save();
    ctx.strokeStyle = "rgba(81,223,133,.72)";
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(left,lastY);
    ctx.lineTo(right,lastY);
    ctx.stroke();
    ctx.restore();

    const age = samples.length ? Math.max(0,Math.floor((Date.now()-samples.at(-1).t)/1000)) : 0;
    root.querySelector(".mf-native-age").textContent = age + " sec ago";
    root.querySelector(".mf-native-lastprice").textContent = formatPrice(last.close);
  }

  function tick() {
    switchTokenIfNeeded();
    updateTokenUI();
    samplePrice();
  }

  ensureUI();
  switchTokenIfNeeded();
  updateTokenUI();
  draw();

  const timer = setInterval(tick, 1000);
  window.addEventListener("resize", draw, { passive:true });
  window.addEventListener("pagehide", () => clearInterval(timer), { once:true });
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

console.log("SUCCESS: Native OHLC candlestick chart installed.");
console.log(`Updated: ${file}`);
console.log(`Backup:  ${backup}`);
