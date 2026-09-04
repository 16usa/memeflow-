#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP = fs.existsSync(path.join(ROOT, 'memeflow-app'))
  ? path.join(ROOT, 'memeflow-app')
  : ROOT;

const jsPath = path.join(APP, 'system-tokens.js');
const htmlPath = path.join(APP, 'system-tokens.html');

const MARK = 'MEMEFLOW_CANONICAL_RANKING_V26';
const ASSET_VERSION = 'canonical-ranking-v26-20260903';

function fail(msg) {
  console.error('\n[RANK-V26] ERROR:', msg);
  process.exit(1);
}
function read(p) {
  if (!fs.existsSync(p)) fail('Missing file: ' + p);
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}
function functionRange(src, name) {
  const re = new RegExp('function\\s+' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\([^)]*\\)\\s*\\{', 'g');
  const m = re.exec(src);
  if (!m) fail('Function not found: ' + name);

  const start = m.index;
  const braceStart = src.indexOf('{', start);

  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }

  fail('Closing brace not found: ' + name);
}
function replaceFunction(src, name, replacement) {
  const r = functionRange(src, name);
  return src.slice(0, r.start) + replacement + src.slice(r.end);
}

let js = read(jsPath);
let html = read(htmlPath);

if (js.includes(MARK)) {
  console.log('[RANK-V26] Already installed.');
  process.exit(0);
}

const required = [
  ['priority', js.includes('function priority(row)')],
  ['sortRows', js.includes('function sortRows(rows)')],
  ['smart sort', js.includes('function __mfSmartSortRowsV25(rows)')],
  ['sort UI', js.includes('function __mfEnsureSortUiV25()')],
  ['open P&L', js.includes('function openPositionPnlPct(position)')],
  ['score', js.includes('function tokenScore(row)')]
];

for (const [label, ok] of required) {
  console.log(`[RANK-V26] Preflight ${label}: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) fail('Preflight failed: ' + label);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '.patch-backups', 'canonical-ranking-v26-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(jsPath, path.join(backupDir, 'system-tokens.js'));
fs.copyFileSync(htmlPath, path.join(backupDir, 'system-tokens.html'));

console.log('[RANK-V26] Backup:', path.relative(ROOT, backupDir));

js = replaceFunction(js, 'priority', `function priority(row) {
  const key = stateKey(row?.decision?.state);

  // ${MARK}
  // One canonical lane order across ALL views:
  // OPEN POSITION -> BUY READY -> WATCH -> WAITING -> BLOCKED.
  return {
    open: 0,
    ready: 1,
    watch: 2,
    waiting: 3,
    blocked: 4
  }[key] ?? 5;
}`);

const canonicalEngine = `function __mfCanonicalRankV26(rows) {
  const source = Array.isArray(rows) ? rows.slice() : [];

  const scoreValue = row =>
    finite(tokenScore(row))
      ? Number(tokenScore(row))
      : Number.NEGATIVE_INFINITY;

  const ageValue = row =>
    finite(tokenAge(row))
      ? Number(tokenAge(row))
      : Number.POSITIVE_INFINITY;

  const mintValue = row =>
    String(row?.mint || '');

  return source.sort((a, b) => {
    const laneA = priority(a);
    const laneB = priority(b);

    // 1) Canonical state hierarchy is absolute.
    if (laneA !== laneB) return laneA - laneB;

    const aOpen = laneA === 0;
    const bOpen = laneB === 0;

    // 2) OPEN POSITION is ranked ONLY by total P&L %, highest first.
    if (aOpen && bOpen) {
      const pnlA = openPositionPnlPct(a?.__openPosition);
      const pnlB = openPositionPnlPct(b?.__openPosition);

      const rankA = finite(pnlA)
        ? Number(pnlA)
        : Number.NEGATIVE_INFINITY;

      const rankB = finite(pnlB)
        ? Number(pnlB)
        : Number.NEGATIVE_INFINITY;

      if (rankA !== rankB) return rankB - rankA;

      // Stable deterministic tie-breakers only.
      const openedA = Number(a?.__openPosition?.openedAtMs ?? 0);
      const openedB = Number(b?.__openPosition?.openedAtMs ?? 0);
      if (openedA !== openedB) return openedB - openedA;

      return mintValue(a).localeCompare(mintValue(b));
    }

    // 3) BUY READY / WATCH / WAITING / BLOCKED are ranked ONLY by Score,
    // highest first. Market metrics never outrank Score.
    const scoreA = scoreValue(a);
    const scoreB = scoreValue(b);

    if (scoreA !== scoreB) return scoreB - scoreA;

    // Tie only: newer token first, then mint for deterministic order.
    const ageA = ageValue(a);
    const ageB = ageValue(b);
    if (ageA !== ageB) return ageA - ageB;

    return mintValue(a).localeCompare(mintValue(b));
  });
}
// ${MARK}

`;

const sortRange = functionRange(js, 'sortRows');
js = js.slice(0, sortRange.start) + canonicalEngine + `function sortRows(rows) {
  return __mfCanonicalRankV26(rows);
}` + js.slice(sortRange.end);

js = replaceFunction(js, '__mfSmartSortRowsV25', `function __mfSmartSortRowsV25(rows) {
  // Legacy entry point retained only for compatibility.
  // All ranking now delegates to the single V26 canonical engine.
  return __mfCanonicalRankV26(rows);
}`);

js = replaceFunction(js, '__mfEnsureSortUiV25', `function __mfEnsureSortUiV25() {
  // ${MARK}
  // Remove the legacy manual MC/Holders/TX/Volume sort control.
  // It could override Score and was the source of conflicting ordering.
  document.getElementById('mfSortOverlayV25')?.remove();
  document.getElementById('mfSortTriggerV25')?.closest('.mf-sort-toolbar-v25')?.remove();
  document.body.classList.remove('mf-sort-sheet-open-v25');

  // Discard old persisted manual sorting so it cannot reappear after refresh.
  try {
    localStorage.removeItem(__MF_SORT_STORAGE_KEY_V25);
  } catch {}

  __mfSortConfigV25 = {
    key: 'smart',
    direction: 'desc',
    ageMaxMinutes: null
  };
}`);

const scriptRe = /src="\/system-tokens\.js\?v=[^"]+"/;
if (!scriptRe.test(html)) fail('Versioned system-tokens.js tag not found.');

html = html.replace(
  scriptRe,
  `src="/system-tokens.js?v=${ASSET_VERSION}"`
);

write(jsPath, js);
write(htmlPath, html);

const finalJs = read(jsPath);
const finalHtml = read(htmlPath);

const checks = [
  [finalJs.includes(MARK), 'V26 marker'],
  [finalJs.includes('waiting: 3'), 'WAITING lane after WATCH'],
  [finalJs.includes('return rankB - rankA;'), 'OPEN P&L descending'],
  [finalJs.includes('return scoreB - scoreA;'), 'Score descending'],
  [finalJs.includes("localStorage.removeItem(__MF_SORT_STORAGE_KEY_V25)"), 'legacy sort state cleared'],
  [finalHtml.includes(`system-tokens.js?v=${ASSET_VERSION}`), 'cache-busted asset']
];

for (const [ok, label] of checks) {
  console.log(`[RANK-V26] Verify ${label}: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) fail('Verification failed: ' + label);
}

try {
  execFileSync('node', ['--check', jsPath], {
    cwd: ROOT,
    stdio: 'inherit'
  });
} catch {
  fail('system-tokens.js syntax check failed.');
}

const rollbackPath = path.join(ROOT, 'rollback-canonical-ranking-v26.mjs');
const rollback = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=${JSON.stringify(path.relative(ROOT, backupDir))};

for(const name of ['system-tokens.js','system-tokens.html']){
  const src=path.join(root,backup,name);
  const dst=path.join(app,name);
  if(!fs.existsSync(src))throw new Error('Missing backup: '+src);
  fs.copyFileSync(src,dst);
}
console.log('Rolled back ${MARK}');
`;
write(rollbackPath, rollback);

console.log('\n[RANK-V26] Verification: PASS');
console.log('[RANK-V26] system-tokens.js syntax: PASS');
console.log('[RANK-V26] Canonical order: OPEN P&L -> READY Score -> WATCH Score -> WAITING Score -> BLOCKED Score');
console.log('[RANK-V26] Legacy manual sort control removed.');
console.log('[RANK-V26] New asset:', `/system-tokens.js?v=${ASSET_VERSION}`);
console.log('[RANK-V26] Installed successfully.');
console.log('[RANK-V26] Rollback: node rollback-canonical-ranking-v26.mjs');
