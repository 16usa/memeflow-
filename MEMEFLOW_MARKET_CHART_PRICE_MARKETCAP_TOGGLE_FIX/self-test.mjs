import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'memeflow-app', 'index.html');
const html = fs.readFileSync(target, 'utf8');

const checks = [
  ['hard reset closes SSE', "if(es){es.close();es=null}"],
  ['hard reset clears candles', "points=[];"],
  ['hard reset waiting state', "No active candidate selected"],
  ['clean renderer installed', "__MEMEFLOW_MARKET_CHART_COMPLETE_FIX__"],
  ['robust outlier filter', "mid / 25"],
  ['percentile scale', "0.02"],
  ['mobile chart sizing', "min-height:330px"],
  ['no stale default load', "clear:()=>selectToken({})"],
  ['no scientific notation formatter', "function decimalPrice"],
  ['USDT price suffix', "formatPriceUSDT"],
  ['English locale formatting', "toLocaleString('en-US'"],
  ['headline metric toggle', "memeflow:chartHeadlineMetric"],
  ['market cap formatter', "function compactUsd"],
  ['tap label', "TAP FOR MARKET CAP"],
  ['selected candidate market cap', "marketCapUsd(candidate = selectedCandidate())"]
];

for (const [label, marker] of checks) {
  if (!html.includes(marker)) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}