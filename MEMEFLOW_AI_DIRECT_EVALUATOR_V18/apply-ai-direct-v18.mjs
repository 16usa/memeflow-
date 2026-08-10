#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();

const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];
const target = candidates.find(p => fs.existsSync(p));
if (!target) {
  console.error('MEMEFLOW v18: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-direct-v18.bak';
fs.copyFileSync(target, backup);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    if (['node_modules','.git','dist','build'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(?:js|mjs|cjs|ts|html)$/i.test(entry.name)) {
      try { if (fs.statSync(p).size <= 3_000_000) out.push(p); } catch {}
    }
  }
  return out;
}

function routeCandidates() {
  const files = [...new Set([...walk(appDir), ...walk(root).filter(p => !p.includes('MEMEFLOW_AI_DIRECT_EVALUATOR_V18'))])];
  const found = [];

  for (const file of files) {
    let src = '';
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!src || /ai-direct-evaluator-v18|ai-final-native-v1[4-8]/i.test(file)) continue;

    const routeRe = /["'`]((?:\/api\/)[A-Za-z0-9_\-./?=&:{}]+)["'`]/g;
    for (const match of src.matchAll(routeRe)) {
      const route = match[1];
      const pos = match.index || 0;
      const context = src.slice(Math.max(0, pos - 2600), Math.min(src.length, pos + 2600));
      const c = context.toLowerCase();
      const r = route.toLowerCase();
      let score = 0;

      if (c.includes('manual ai scan')) score += 16;
      if (c.includes('analyze any solana token')) score += 15;
      if (/manual.{0,40}scan|scan.{0,40}manual/s.test(c)) score += 11;
      if (c.includes('analyze token')) score += 10;
      if (/manualscan|manual_scan|manual-scan/.test(c)) score += 8;
      if (/evaluat|analysis/.test(c)) score += 5;
      if (/mint/.test(c)) score += 4;
      if (/settings/.test(c)) score += 3;
      if (/market cap|liquidity|holders|buy pressure|developer/.test(c)) score += 5;

      if (/openai|chat|assistant|ai-live|trade|execute|wallet|chart|demo/.test(r)) score -= 30;
      if (/candidate feed|automatic candidate|paper engine/.test(c)) score -= 8;

      let method = 'GET';
      const nearby = src.slice(Math.max(0, pos - 900), Math.min(src.length, pos + 1400));
      const mm = nearby.match(/method\s*:\s*["'`](POST|PUT|PATCH|GET)["'`]/i);
      if (mm) method = mm[1].toUpperCase();
      else if (/JSON\.stringify\s*\(/.test(nearby)) method = 'POST';

      let bodyKey = 'mint';
      const bodyMatch = nearby.match(/JSON\.stringify\s*\(\s*\{([\s\S]{0,700}?)\}\s*\)/i);
      if (bodyMatch) {
        const body = bodyMatch[1];
        for (const key of ['mint','tokenAddress','address','token','input']) {
          if (new RegExp(`(?:^|[,\\s])${key}\\s*[:},]`).test(body)) { bodyKey = key; break; }
        }
      }

      let queryKey = 'mint';
      const q = route.match(/[?&]([A-Za-z0-9_-]+)=$/);
      if (q) queryKey = q[1];
      else {
        const qp = nearby.match(/URLSearchParams\s*\(\s*\{[\s\S]{0,300}?(mint|tokenAddress|address|token)\s*:/i);
        if (qp) queryKey = qp[1];
      }

      found.push({ route, score, method, bodyKey, queryKey, file:path.relative(root,file) });
    }
  }

  const dedup = new Map();
  for (const item of found) {
    const key = `${item.method} ${item.route}`;
    if (!dedup.has(key) || dedup.get(key).score < item.score) dedup.set(key, item);
  }
  return [...dedup.values()].sort((a,b) => b.score - a.score);
}

const ranked = routeCandidates();
const best = ranked.find(x => x.score >= 16) || null;

const config = best ? {
  endpoint: best.route,
  method: best.method,
  bodyKey: best.bodyKey,
  queryKey: best.queryKey,
  detectedFrom: best.file,
  confidenceScore: best.score
} : {
  endpoint: null,
  method: null,
  detectedFrom: null,
  confidenceScore: ranked[0]?.score || 0,
  diagnosticTopCandidates: ranked.slice(0,5)
};

fs.writeFileSync(
  path.join(appDir, 'ai-direct-evaluator-v18-config.js'),
  `window.__MEMEFLOW_AI_DIRECT_V18_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
  'utf8'
);
fs.copyFileSync(path.join(__dirname, 'ai-direct-evaluator-v18.js'), path.join(appDir, 'ai-direct-evaluator-v18.js'));

let html = fs.readFileSync(target, 'utf8');
html = html.replace(/\s*<script\s+src=["']\.\/(?:ai-final-native-v17|ai-direct-evaluator-v18|ai-direct-evaluator-v18-config)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig, '\n');

const tags = [
  '<script src="./ai-direct-evaluator-v18-config.js?v=18.0.0" defer></script>',
  '<script src="./ai-direct-evaluator-v18.js?v=18.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) {
  fs.copyFileSync(backup, target);
  console.error('MEMEFLOW v18: </body> not found. Backup restored.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tags}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

console.log(`MEMEFLOW AI Direct Evaluator v18 installed in: ${path.relative(root,target)}`);
console.log(`Backup created: ${path.relative(root,backup)}`);
if (best) {
  console.log(`Direct evaluator detected: ${best.method} ${best.route}`);
  console.log(`Detected from: ${best.file} (score ${best.score})`);
  console.log('IMPORTANT: Analyze token will NOT click, fill, scroll to, or modify MANUAL AI SCAN.');
} else {
  console.log('WARNING: No high-confidence direct evaluator endpoint was detected.');
  console.log('The patch was installed fail-closed: Analyze token will show an error and MANUAL AI SCAN will remain untouched.');
  if (ranked.length) {
    console.log('Top route candidates:');
    ranked.slice(0,5).forEach(x => console.log(`  score=${x.score} ${x.method} ${x.route} @ ${x.file}`));
  }
}
console.log('Script tags: ai-direct-evaluator-v18-config.js + ai-direct-evaluator-v18.js');
