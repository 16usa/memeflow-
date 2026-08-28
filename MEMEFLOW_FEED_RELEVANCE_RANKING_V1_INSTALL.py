#!/usr/bin/env python3
from pathlib import Path
import subprocess

MARK = "MEMEFLOW_FEED_RELEVANCE_RANKING_V1"

root = Path.cwd()
if (root / "memeflow-app").is_dir():
    app = root / "memeflow-app"
elif (root / "app-server.mjs").is_file() and (root / "src").is_dir():
    app = root
else:
    raise SystemExit("ERROR: memeflow-app not found. Run from the Replit project root.")

app_server = app / "app-server.mjs"
package_json = app / "package.json"
ranking_module = app / "src" / "feed-ranking.mjs"
ranking_test = app / "tests" / "feed-ranking.mjs"

for p in (app_server, package_json):
    if not p.exists():
        raise SystemExit(f"ERROR: missing {p}")

def run(cmd, cwd=None):
    print("+", " ".join(map(str, cmd)))
    subprocess.run(cmd, cwd=cwd, check=True)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"PATCH ERROR [{label}]: expected exactly 1 anchor, found {count}"
        )
    return text.replace(old, new, 1)

rel_targets = [
    str(app_server.relative_to(root)),
    str(package_json.relative_to(root)),
]
for p in (ranking_module, ranking_test):
    if p.exists():
        rel_targets.append(str(p.relative_to(root)))

status = subprocess.run(
    ["git", "status", "--porcelain", "--", *rel_targets],
    cwd=root,
    text=True,
    capture_output=True,
    check=True,
).stdout.strip()

if status:
    print("ERROR: target files already have local changes:")
    print(status)
    print("Nothing was changed.")
    raise SystemExit(1)

originals = {
    app_server: app_server.read_text(encoding="utf-8"),
    package_json: package_json.read_text(encoding="utf-8"),
}
module_existed = ranking_module.exists()
module_original = ranking_module.read_text(encoding="utf-8") if module_existed else None
test_existed = ranking_test.exists()
test_original = ranking_test.read_text(encoding="utf-8") if test_existed else None

try:
    app_text = originals[app_server]
    pkg_text = originals[package_json]

    if MARK in app_text:
        print("Patch is already installed.")
        raise SystemExit(0)

    if "MEMEFLOW_OPPORTUNITY_ENGINE_V1" not in app_text:
        raise RuntimeError(
            "Current main does not contain MEMEFLOW_OPPORTUNITY_ENGINE_V1. "
            "Install the Opportunity Engine patch first."
        )

    ranking_text = r'''// MEMEFLOW_FEED_RELEVANCE_RANKING_V1
// Strict feed order:
// 1) state: BUY READY > WATCH > WAITING > BLOCKED
// 2) combined relevance from live/card metrics inside the same state.

const STATE_PRIORITY = Object.freeze({
  'BUY READY': 400,
  'WATCH': 300,
  'WAITING': 200,
  'BLOCKED': 100,
  'REJECTED': 50,
  'EXPIRED': 25
});

const number = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const clamp100 = value => Math.max(0, Math.min(100, Number(value) || 0));

function logSaturation(value, cap) {
  const n = number(value);
  if (n === null || n <= 0) return 0;
  const safeCap = Math.max(1, Number(cap) || 1);
  return clamp01(Math.log1p(n) / Math.log1p(safeCap));
}

function statePriority(state) {
  const key = String(state || 'WAITING').trim().toUpperCase();
  return STATE_PRIORITY[key] ?? 0;
}

// Reward real upward motion without letting a vertical +500% candle win
// purely because its raw percentage is huge.
function priceMomentumQuality(value) {
  const p = number(value);
  if (p === null) return 0;
  if (p <= -15) return 0;
  if (p < 0) return clamp01((p + 15) / 15) * 0.12;
  if (p < 5) return 0.20 + (p / 5) * 0.25;
  if (p < 40) return 0.45 + ((p - 5) / 35) * 0.35;
  if (p <= 120) return 0.80 + ((p - 40) / 80) * 0.20;
  if (p <= 180) return 1.00 - ((p - 120) / 60) * 0.12;
  if (p <= 300) return 0.88 - ((p - 180) / 120) * 0.33;
  return 0.50;
}

function ageQuality(ageMinutes) {
  const age = number(ageMinutes);
  if (age === null || age < 0) return 0.3;
  if (age <= 0.15) return 0.65;
  if (age <= 5) return 1;
  if (age <= 15) return 0.85;
  if (age <= 30) return 0.65;
  if (age <= 60) return 0.40;
  return 0.20;
}

function activityFreshness(quoteAgeMs) {
  const ms = number(quoteAgeMs);
  if (ms === null || ms < 0) return 0.25;
  if (ms <= 3_000) return 1;
  if (ms <= 10_000) return 0.85;
  if (ms <= 20_000) return 0.60;
  if (ms <= 30_000) return 0.40;
  return 0.15;
}

function volumeQuality(view) {
  const usd = number(view?.volume5mUsd);
  if (usd !== null) return logSaturation(usd, 10_000);
  const sol = number(view?.volume5mSol);
  if (sol !== null) return logSaturation(sol, 20);
  return 0;
}

function marketCapQuality(view) {
  const usd = number(view?.marketCapUsd);
  if (usd !== null) return logSaturation(usd, 50_000);
  const sol = number(view?.marketCapSol ?? view?.marketCap);
  if (sol !== null) return logSaturation(sol, 150);
  return 0;
}

export function candidateRelevanceScore(view = {}) {
  const score = clamp01((number(view.score) ?? 0) / 100);
  const opportunity = clamp01((number(view.opportunityScore) ?? 0) / 100);
  const quality = clamp01((number(view.qualityScore) ?? 0) / 100);
  const holders = logSaturation(view.holderCount ?? view.holders, 120);
  const volume = volumeQuality(view);
  const tx = clamp01((number(view.transactions5m) ?? 0) / 100);
  const momentum = priceMomentumQuality(view.priceChange5mPct);
  const marketCap = marketCapQuality(view);
  const age = ageQuality(view.ageMinutes);
  const activity = activityFreshness(view.quoteAgeMs);

  let relevance =
    score * 24 +
    opportunity * 14 +
    quality * 10 +
    holders * 11 +
    volume * 11 +
    tx * 9 +
    momentum * 9 +
    marketCap * 5 +
    age * 4 +
    activity * 3;

  const drawdown = Math.max(0, number(view.drawdownFromPeakPct) ?? 0);
  const whale = Math.max(0, number(view.whaleDominancePct) ?? 0);

  relevance -= Math.min(8, Math.max(0, drawdown - 12) * 0.10);
  relevance -= Math.min(6, Math.max(0, whale - 35) * 0.08);

  if (view.opportunityTrendHealthy === false) relevance -= 3;
  if (view.dead === true) relevance = 0;

  return Math.round(clamp100(relevance) * 100) / 100;
}

export function compareCandidateViews(a = {}, b = {}) {
  const stateDelta = statePriority(b.state) - statePriority(a.state);
  if (stateDelta) return stateDelta;

  const ar = number(a.relevanceScore) ?? candidateRelevanceScore(a);
  const br = number(b.relevanceScore) ?? candidateRelevanceScore(b);
  if (br !== ar) return br - ar;

  const ao = number(a.opportunityScore) ?? 0;
  const bo = number(b.opportunityScore) ?? 0;
  if (bo !== ao) return bo - ao;

  const as = number(a.score) ?? 0;
  const bs = number(b.score) ?? 0;
  if (bs !== as) return bs - as;

  const at = number(a.transactions5m) ?? 0;
  const bt = number(b.transactions5m) ?? 0;
  if (bt !== at) return bt - at;

  const av = number(a.volume5mUsd) ?? number(a.volume5mSol) ?? 0;
  const bv = number(b.volume5mUsd) ?? number(b.volume5mSol) ?? 0;
  if (bv !== av) return bv - av;

  const ah = number(a.holderCount ?? a.holders) ?? 0;
  const bh = number(b.holderCount ?? b.holders) ?? 0;
  if (bh !== ah) return bh - ah;

  const aq = number(a.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  const bq = number(b.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  if (aq !== bq) return aq - bq;

  return String(a.mint || a.id || '').localeCompare(String(b.mint || b.id || ''));
}

export function rankCandidateViews(views = []) {
  return (Array.isArray(views) ? views : [])
    .filter(Boolean)
    .map(view => ({
      ...view,
      relevanceScore: candidateRelevanceScore(view),
      statePriority: statePriority(view.state)
    }))
    .sort(compareCandidateViews);
}

export { statePriority as candidateStatePriority };
'''
    ranking_module.write_text(ranking_text, encoding="utf-8")

    app_text = replace_once(
        app_text,
        "import {createSolUsdOracle} from './src/sol-usd-oracle.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1\n",
        "import {createSolUsdOracle} from './src/sol-usd-oracle.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1\n"
        "import {rankCandidateViews} from './src/feed-ranking.mjs'; // MEMEFLOW_FEED_RELEVANCE_RANKING_V1\n",
        "app/import-feed-ranking",
    )

    old_live = '''  const _views=[];
  for(const _decision of _selected.slice(0,_lim)){
    try{
      _views.push(candidateView(_decision));
    }catch(_error){
      _viewErrors++;
    }
  }

  return json(res,200,{
    decisions:_views,
    total:_views.length,
'''
    new_live = '''  const _unrankedViews=[];
  for(const _decision of _selected){
    try{
      _unrankedViews.push(candidateView(_decision));
    }catch(_error){
      _viewErrors++;
    }
  }
  // MEMEFLOW_FEED_RELEVANCE_RANKING_V1
  // State priority is strict. Relevance only reorders cards inside a state.
  const _rankedViews=rankCandidateViews(_unrankedViews);
  const _views=_rankedViews.slice(0,_lim);

  return json(res,200,{
    decisions:_views,
    total:_rankedViews.length,
'''
    app_text = replace_once(
        app_text, old_live, new_live, "app/live-token-state-ranking"
    )

    old_ai = '''  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);
  return json(res,200,{
    decisions:_selected.slice(_off,_off+_lim).map(candidateView),
    total:_selected.length,
'''
    new_ai = '''  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);
  // MEMEFLOW_FEED_RELEVANCE_RANKING_V1
  const _rankedViews=rankCandidateViews(_selected.map(candidateView));
  return json(res,200,{
    decisions:_rankedViews.slice(_off,_off+_lim),
    total:_rankedViews.length,
'''
    app_text = replace_once(
        app_text, old_ai, new_ai, "app/ai-decisions-ranking"
    )

    old_chart = " if(url.pathname==='/api/chart/config'){const qualified=candidateFeed(store.decisions(u.id),'candidates');return json(res,200,{chainId:'solana',tokenAddress:qualified[0]?.mint||''});}"
    new_chart = " if(url.pathname==='/api/chart/config'){const qualified=rankCandidateViews(candidateFeed(store.decisions(u.id),'candidates').map(candidateView));return json(res,200,{chainId:'solana',tokenAddress:qualified[0]?.mint||''});}"
    app_text = replace_once(
        app_text, old_chart, new_chart, "app/chart-top-ranked-candidate"
    )

    pkg_text = replace_once(
        pkg_text,
        '"test": "node tests/opportunity-engine.mjs &&',
        '"test": "node tests/feed-ranking.mjs && node tests/opportunity-engine.mjs &&',
        "package/add-feed-ranking-test",
    )

    test_text = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateRelevanceScore,
  rankCandidateViews,
  candidateStatePriority
} from '../src/feed-ranking.mjs';

const strongWatch={
  mint:'StrongWatch',
  state:'WATCH',
  score:71,
  qualityScore:78,
  opportunityScore:76,
  holderCount:21,
  volume5mUsd:1600,
  transactions5m:35,
  marketCapUsd:5000,
  priceChange5mPct:105.5,
  ageMinutes:1.4,
  quoteAgeMs:1000,
  drawdownFromPeakPct:3,
  whaleDominancePct:22,
  opportunityTrendHealthy:true
};

const weakWatch={
  mint:'WeakWatch',
  state:'WATCH',
  score:70,
  qualityScore:63,
  opportunityScore:42,
  holderCount:5,
  volume5mUsd:198,
  transactions5m:9,
  marketCapUsd:2400,
  priceChange5mPct:1.1,
  ageMinutes:0.7,
  quoteAgeMs:1000,
  drawdownFromPeakPct:4,
  whaleDominancePct:45,
  opportunityTrendHealthy:true
};

assert.ok(
  candidateRelevanceScore(strongWatch) >
  candidateRelevanceScore(weakWatch),
  'stronger card metrics must rank higher inside WATCH'
);

const hugeButWeakPump={
  ...weakWatch,
  mint:'HugeButWeakPump',
  priceChange5mPct:620
};

assert.ok(
  candidateRelevanceScore(strongWatch) >
  candidateRelevanceScore(hugeButWeakPump),
  'raw vertical price change alone must not dominate relevance'
);

const lowBuyReady={
  ...weakWatch,
  mint:'LowBuyReady',
  state:'BUY READY',
  score:72
};

const spectacularWatch={
  ...strongWatch,
  mint:'SpectacularWatch',
  score:99,
  opportunityScore:99,
  qualityScore:99,
  holderCount:200,
  volume5mUsd:25000,
  transactions5m:180,
  priceChange5mPct:90
};

const waitingStrong={...strongWatch,mint:'WaitingStrong',state:'WAITING'};
const blockedStrong={...spectacularWatch,mint:'BlockedStrong',state:'BLOCKED'};

const ranked=rankCandidateViews([
  blockedStrong,
  weakWatch,
  waitingStrong,
  spectacularWatch,
  lowBuyReady,
  strongWatch
]);

assert.equal(ranked[0].mint,'LowBuyReady');
assert.equal(ranked[1].mint,'SpectacularWatch');
assert.equal(ranked[2].mint,'StrongWatch');
assert.equal(ranked[3].mint,'WeakWatch');
assert.equal(ranked[4].mint,'WaitingStrong');
assert.equal(ranked[5].mint,'BlockedStrong');

assert.ok(ranked.every(row=>Number.isFinite(row.relevanceScore)));
assert.ok(candidateStatePriority('BUY READY')>candidateStatePriority('WATCH'));
assert.ok(candidateStatePriority('WATCH')>candidateStatePriority('WAITING'));
assert.ok(candidateStatePriority('WAITING')>candidateStatePriority('BLOCKED'));

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
assert.match(app,/MEMEFLOW_FEED_RELEVANCE_RANKING_V1/);

const liveStart=app.indexOf("if(url.pathname==='/api/system/live-token-states'");
const aiStart=app.indexOf("if(url.pathname==='/api/ai/decisions')");
const debugStart=app.indexOf("if(url.pathname==='/api/debug/filter-pipeline')");
const liveSlice=app.slice(liveStart,aiStart);
const aiSlice=app.slice(aiStart,debugStart);

assert.match(liveSlice,/rankCandidateViews\(_unrankedViews\)/);
assert.match(aiSlice,/rankCandidateViews\(_selected\.map\(candidateView\)\)/);

console.log('feed relevance ranking v1 ok');
'''
    ranking_test.write_text(test_text, encoding="utf-8")

    app_server.write_text(app_text, encoding="utf-8")
    package_json.write_text(pkg_text, encoding="utf-8")

    print("=== Syntax checks ===")
    for p in [app_server, ranking_module, ranking_test]:
        run(["node", "--check", str(p)], cwd=root)

    print("=== Feed ranking regression ===")
    run(["node", "tests/feed-ranking.mjs"], cwd=app)

    print("=== Full test suite ===")
    run(["npm", "test"], cwd=app)

    print("=== Diff validation ===")
    run(["git", "diff", "--check"], cwd=root)

except BaseException as e:
    print(f"ERROR: {e}")
    print("Rolling back local patch changes...")

    for p, original in originals.items():
        p.write_text(original, encoding="utf-8")

    if module_existed:
        ranking_module.write_text(module_original, encoding="utf-8")
    else:
        try:
            ranking_module.unlink()
        except FileNotFoundError:
            pass

    if test_existed:
        ranking_test.write_text(test_original, encoding="utf-8")
    else:
        try:
            ranking_test.unlink()
        except FileNotFoundError:
            pass

    print("Rollback complete. No commit/push was made.")
    raise

print("=== Commit + push ===")
changed = [app_server, package_json, ranking_module, ranking_test]
rel = [str(p.relative_to(root)) for p in changed]

run(["git", "add", "--", *rel], cwd=root)
run(
    [
        "git", "commit", "-m",
        "[MEMEFLOW_FEED_RELEVANCE_RANKING_V1] Rank cards by state then combined relevance"
    ],
    cwd=root
)
run(["git", "push", "origin", "HEAD"], cwd=root)

print()
print("============================================================")
print(" MEMEFLOW_FEED_RELEVANCE_RANKING_V1 INSTALLED SUCCESSFULLY")
print("============================================================")
print("Restart the Replit backend/deployment.")
print("Feed order:")
print(" BUY READY > WATCH > WAITING > BLOCKED")
print(" Inside each state: Score + Opportunity + Quality + holders +")
print(" 5m volume + 5m TX + 5m price + MC + age/freshness.")
