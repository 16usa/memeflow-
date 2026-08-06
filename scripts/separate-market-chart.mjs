#!/usr/bin/env node
/**
 * MEMEFLOW patch: move Market Chart out of AI Decision Studio
 * Target: memeflow-app/index.html
 * Idempotent: safe to run more than once.
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

if (html.includes('id="market-chart-module"')) {
  console.log("Market Chart is already in a separate module. Nothing changed.");
  process.exit(0);
}

const chartStartToken = '<div class="chart-shell"';
const chartIdToken = 'id="marketChart"';
const actionsToken = '<div class="mission-actions">';
const workspaceEndToken = '</section>';
const noScriptToken = '<noscript>';

const chartStart = html.indexOf(chartStartToken);
if (chartStart < 0 || html.indexOf(chartIdToken, chartStart) < 0) {
  console.error("ERROR: Could not find #marketChart.");
  process.exit(1);
}

const chartEnd = html.indexOf(actionsToken, chartStart);
if (chartEnd < 0) {
  console.error("ERROR: Could not find the end of Market Chart before .mission-actions.");
  process.exit(1);
}

const chartMarkup = html.slice(chartStart, chartEnd).trim();
html = html.slice(0, chartStart) + html.slice(chartEnd);

const noscriptIndex = html.indexOf(noScriptToken);
if (noscriptIndex < 0) {
  console.error("ERROR: Could not find <noscript> insertion anchor.");
  process.exit(1);
}

const sectionEnd = html.lastIndexOf(workspaceEndToken, noscriptIndex);
if (sectionEnd < 0) {
  console.error("ERROR: Could not find workspace closing </section>.");
  process.exit(1);
}

const insertAt = sectionEnd + workspaceEndToken.length;
const moduleMarkup = `
<section aria-labelledby="market-chart-title" class="panel market-chart-module" id="market-chart-module">
  <div class="panel-head market-chart-module-head">
    <div>
      <div class="eyebrow">LIVE MARKET DATA</div>
      <h2 id="market-chart-title">Market Chart</h2>
    </div>
    <span class="state wait" id="marketChartModuleState">LIVE</span>
  </div>
  <div class="panel-body market-chart-module-body">
${chartMarkup}
  </div>
</section>`;

html = html.slice(0, insertAt) + "\n" + moduleMarkup + "\n" + html.slice(insertAt);

const cssMarker = "/* ===== separate-market-chart-module ===== */";
const css = `
${cssMarker}
.market-chart-module{
  margin-top:12px;
  overflow:hidden;
  scroll-margin-top:84px;
}
.market-chart-module-head{
  align-items:center;
}
.market-chart-module-head h2{
  margin:3px 0 0;
}
.market-chart-module-body{
  padding:0;
}
.market-chart-module #marketChart{
  margin:0;
  border:0;
  border-radius:0;
  background:transparent;
}
.market-chart-module .chart-toolbar{
  padding:14px 16px 12px;
}
.market-chart-module .chart-footer{
  padding:11px 16px;
}
.market-chart-module .chart-shell .chart{
  height:clamp(230px,38vw,440px);
}
@media(max-width:820px){
  .market-chart-module{
    margin-top:10px;
  }
  .market-chart-module .chart-shell .chart{
    height:300px;
  }
}
@media(max-width:560px){
  .market-chart-module .chart-shell .chart{
    height:260px;
  }
  .market-chart-module .chart-toolbar{
    padding:12px;
  }
  .market-chart-module .chart-footer{
    padding:10px 12px;
  }
}
`;

if (!html.includes(cssMarker)) {
  const styleEnd = html.lastIndexOf("</style>");
  if (styleEnd < 0) {
    console.error("ERROR: Could not find </style>.");
    process.exit(1);
  }
  html = html.slice(0, styleEnd) + css + "\n" + html.slice(styleEnd);
}

const backup = `${file}.before-market-chart-module`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

fs.writeFileSync(file, html, "utf8");

const chartCount = (html.match(/id="marketChart"/g) || []).length;
const moduleCount = (html.match(/id="market-chart-module"/g) || []).length;

if (chartCount !== 1 || moduleCount !== 1) {
  console.error(`ERROR: Validation failed. marketChart=${chartCount}, module=${moduleCount}`);
  fs.copyFileSync(backup, file);
  process.exit(1);
}

console.log("SUCCESS: Market Chart moved into a separate standalone module.");
console.log(`Updated: ${file}`);
console.log(`Backup:  ${backup}`);
