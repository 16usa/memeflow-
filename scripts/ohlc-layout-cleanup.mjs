#!/usr/bin/env node
/**
 * MEMEFLOW Native OHLC — Final Layout Cleanup
 *
 * Fixes:
 * - hides every legacy chart element inside the standalone Market Chart module
 * - keeps exactly one .mf-native-chart
 * - constrains mobile chart height
 * - restores proper token header / toolbar / footer layout
 * - makes candle bodies thinner
 * - prevents the fixed bottom navigation from covering chart content
 *
 * Target: memeflow-app/index.html
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || "memeflow-app/index.html";
const file = path.resolve(target);
const backup = `${file}.before-ohlc-layout-cleanup`;
const marker = "MEMEFLOW_OHLC_LAYOUT_CLEANUP_V1";

if (!fs.existsSync(file)) {
  console.error(`ERROR: File not found: ${file}`);
  process.exit(1);
}

let html = fs.readFileSync(file, "utf8");

if (!html.includes("MEMEFLOW_NATIVE_OHLC_CHART_V1")) {
  console.error("ERROR: Native OHLC chart patch is not installed.");
  process.exit(1);
}

if (html.includes(marker)) {
  console.log("OHLC layout cleanup is already installed. Nothing changed.");
  process.exit(0);
}

if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

/* Make candle bodies slimmer in the installed native renderer. */
html = html.replace(
  /Math\.max\(3,\s*Math\.min\(14,\s*xStep\s*\*\s*0\.58\)\)/g,
  "Math.max(2, Math.min(8, xStep * 0.34))"
);

/* Ensure the native chart is appended after legacy elements, then hide siblings. */
const css = `
/* ${marker} */
#market-chart-module{
  overflow:hidden!important;
  margin-bottom:110px!important;
}
#market-chart-module .market-chart-module-body{
  display:block!important;
  padding:0!important;
  overflow:hidden!important;
}
#market-chart-module .market-chart-module-body > *:not(.mf-native-chart){
  display:none!important;
}
#market-chart-module .mf-native-chart{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  overflow:hidden!important;
  border-radius:0 0 18px 18px!important;
  background:linear-gradient(180deg,rgba(14,20,28,.97),rgba(7,11,16,.995))!important;
}
#market-chart-module .mf-native-tokenbar{
  display:grid!important;
  grid-template-columns:64px minmax(0,1fr) auto!important;
  gap:14px!important;
  align-items:center!important;
  padding:16px!important;
  min-height:96px!important;
}
#market-chart-module .mf-native-avatar{
  width:64px!important;
  height:64px!important;
  border-radius:18px!important;
  overflow:hidden!important;
}
#market-chart-module .mf-native-avatar img{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  display:block!important;
}
#market-chart-module .mf-native-copy{
  min-width:0!important;
}
#market-chart-module .mf-native-name{
  margin:0!important;
  font-size:24px!important;
  line-height:1.05!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
#market-chart-module .mf-native-meta{
  display:flex!important;
  gap:8px!important;
  margin-top:7px!important;
  font-size:10px!important;
  color:var(--muted)!important;
  min-width:0!important;
}
#market-chart-module .mf-native-quote{
  min-width:130px!important;
  text-align:right!important;
}
#market-chart-module .mf-native-price{
  font-size:30px!important;
  line-height:1!important;
  white-space:nowrap!important;
}
#market-chart-module .mf-native-change{
  margin-top:7px!important;
  font-size:12px!important;
}
#market-chart-module .mf-native-toolbar{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  gap:10px!important;
  align-items:center!important;
  padding:13px 15px 10px!important;
  border-top:1px solid var(--line-soft,var(--line))!important;
}
#market-chart-module .mf-native-label{
  min-width:0!important;
}
#market-chart-module .mf-native-label b{
  font-size:14px!important;
}
#market-chart-module .mf-native-source{
  max-width:220px!important;
  overflow:hidden!important;
  white-space:nowrap!important;
  text-overflow:ellipsis!important;
}
#market-chart-module .mf-native-intervals{
  grid-column:1/-1!important;
  display:grid!important;
  grid-template-columns:repeat(6,minmax(0,1fr))!important;
  gap:4px!important;
}
#market-chart-module .mf-native-intervals button{
  min-height:42px!important;
  padding:7px 2px!important;
  font-size:10px!important;
  border-radius:11px!important;
}
#market-chart-module .mf-native-stage{
  position:relative!important;
  width:100%!important;
  height:420px!important;
  min-height:0!important;
  max-height:420px!important;
  overflow:hidden!important;
}
#market-chart-module .mf-native-canvas{
  position:absolute!important;
  inset:0!important;
  display:block!important;
  width:100%!important;
  height:100%!important;
  max-width:100%!important;
  max-height:100%!important;
}
#market-chart-module .mf-native-overlay{
  position:absolute!important;
  inset:0!important;
  overflow:hidden!important;
}
#market-chart-module .mf-native-footer{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px!important;
  padding:11px 15px!important;
  min-height:44px!important;
  border-top:1px solid var(--line-soft,var(--line))!important;
}
@media(max-width:560px){
  #market-chart-module{
    margin-bottom:118px!important;
  }
  #market-chart-module .mf-native-tokenbar{
    grid-template-columns:54px minmax(0,1fr)!important;
    gap:11px!important;
    padding:13px!important;
    min-height:0!important;
  }
  #market-chart-module .mf-native-avatar{
    width:54px!important;
    height:54px!important;
    border-radius:16px!important;
  }
  #market-chart-module .mf-native-name{
    font-size:20px!important;
  }
  #market-chart-module .mf-native-meta{
    margin-top:5px!important;
    font-size:9px!important;
  }
  #market-chart-module .mf-native-quote{
    grid-column:1/-1!important;
    display:flex!important;
    align-items:baseline!important;
    justify-content:space-between!important;
    min-width:0!important;
    padding-top:2px!important;
    text-align:left!important;
  }
  #market-chart-module .mf-native-price{
    font-size:26px!important;
  }
  #market-chart-module .mf-native-change{
    margin-top:0!important;
    font-size:11px!important;
  }
  #market-chart-module .mf-native-toolbar{
    padding:11px 10px 9px!important;
  }
  #market-chart-module .mf-native-source{
    max-width:42%!important;
    font-size:9px!important;
  }
  #market-chart-module .mf-native-intervals{
    gap:3px!important;
  }
  #market-chart-module .mf-native-intervals button{
    min-height:44px!important;
    padding:6px 1px!important;
    font-size:10px!important;
  }
  #market-chart-module .mf-native-stage{
    height:360px!important;
    max-height:360px!important;
  }
  #market-chart-module .mf-native-footer{
    padding:10px!important;
    font-size:8px!important;
  }
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

  const nativeCharts = [...body.querySelectorAll(".mf-native-chart")];
  if (nativeCharts.length > 1) {
    nativeCharts.slice(1).forEach(node => node.remove());
  }

  const nativeChart = body.querySelector(".mf-native-chart");
  if (!nativeChart) return;

  body.querySelectorAll(":scope > *").forEach(node => {
    if (node !== nativeChart) {
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      node.style.setProperty("display", "none", "important");
    }
  });

  nativeChart.hidden = false;
  nativeChart.removeAttribute("aria-hidden");
  nativeChart.style.setProperty("display", "block", "important");

  const resize = () => {
    const stage = nativeChart.querySelector(".mf-native-stage");
    const canvas = nativeChart.querySelector(".mf-native-canvas");
    if (!stage || !canvas) return;

    const mobile = window.matchMedia("(max-width: 560px)").matches;
    const height = mobile ? 360 : 420;
    stage.style.setProperty("height", height + "px", "important");
    stage.style.setProperty("max-height", height + "px", "important");
    canvas.style.setProperty("width", "100%", "important");
    canvas.style.setProperty("height", "100%", "important");
  };

  resize();
  window.addEventListener("resize", resize, { passive:true });
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

console.log("SUCCESS: OHLC chart layout cleaned up.");
console.log(`Updated: ${file}`);
console.log(`Backup:  ${backup}`);
