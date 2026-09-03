#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"
ORACLE="memeflow-app/src/sol-usd-oracle.mjs"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-data-plane-v7-$STAMP"
mkdir -p "$BACKUP"
cp "$APP" "$BACKUP/app-server.mjs"
cp "$UI" "$BACKUP/system-tokens.js"
cp "$ORACLE" "$BACKUP/sol-usd-oracle.mjs"

python3 - <<'PY'
from pathlib import Path

# ============================================================
# 1) SOL/USD oracle: remove the remaining DexScreener dependency.
# ============================================================
p=Path("memeflow-app/src/sol-usd-oracle.mjs")
c=p.read_text()

old="""function fromDexScreener(data){
  const pairs=Array.isArray(data?.pairs)?data.pairs:[];
  const rows=pairs.filter(p=>p?.chainId==='solana'&&finite(p?.priceUsd));
  rows.sort((a,b)=>Number(b?.liquidity?.usd||0)-Number(a?.liquidity?.usd||0));
  const p=rows[0];
  return p&&finite(p.priceUsd)?Number(p.priceUsd):null;
}
"""
if old not in c:
    raise SystemExit("ERROR: V7 oracle DexScreener parser anchor not found")
c=c.replace(old,"",1)

old="""      const attempts=[
        async()=>['dexscreener',fromDexScreener(await fetchJson('https://api.dexscreener.com/latest/dex/search?q=SOL%20USDC'))],
        async()=>['coingecko',fromCoinGecko(await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'))]
      ];"""
new="""      const attempts=[
        async()=>['coingecko',fromCoinGecko(await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'))]
      ];"""
if old not in c:
    raise SystemExit("ERROR: V7 oracle attempts anchor not found")
c=c.replace(old,new,1)
p.write_text(c)

# ============================================================
# 2) app-server: internal indexed snapshot first, deep RPC second.
# ============================================================
p=Path("memeflow-app/app-server.mjs")
c=p.read_text()

old="""async function mf49StandaloneScan(raw,u){
 const resolved=await mf49ResolveInput(raw),mint=resolved.mint;
 const known=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();
"""
new="""async function mf49StandaloneScan(raw,u){
 const resolved=await mf49ResolveInput(raw),mint=resolved.mint;
 const stored=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 // MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7
 // GMGN-style behavior: the click path reads MEMEFLOW's already-indexed facts
 // first. Deep RPC is verification/enrichment only and must never be the sole
 // source of the visible result.
 let marketLedger=null;
 let holderLedger=null;
 try{marketLedger=eventMarketLedger?.inspect?.(mint)||null}catch{}
 try{holderLedger=eventHolderLedger?.inspect?.(mint)||null}catch{}

 const inferredPump=
  String(stored?.launchPlatform||stored?.protocol||'').toLowerCase().includes('pump') ||
  mint.toLowerCase().endsWith('pump') ||
  resolved.inputKind==='pump-fun';

 const observedSeed=[
  mf49Num(stored?.observedHolderCount),
  mf49Num(holderLedger?.observedHolderCount),
  mf49Num(holderLedger?.holderCount)
 ].filter(v=>v!=null&&v>0);

 const known={
  ...stored,
  launchPlatform:
   stored?.launchPlatform ||
   (inferredPump?'pump':null),
  protocol:
   stored?.protocol ||
   (inferredPump?'pump':null),
  priceSol:
   mf49Num(marketLedger?.priceSol) ??
   mf49Num(stored?.priceSol),
  liquiditySol:
   mf49Num(marketLedger?.liquiditySol) ??
   mf49Num(stored?.liquiditySol),
  buyPressure:
   mf49Num(marketLedger?.buyPressure) ??
   mf49Num(stored?.buyPressure),
  observedHolderCount:
   observedSeed.length
    ? Math.max(...observedSeed)
    : null
 };

 if(marketLedger)sources.add('MEMEFLOW live market ledger');
 if(holderLedger?.observedHolderCount>0)sources.add('MEMEFLOW live holder ledger');
"""
if old not in c:
    raise SystemExit("ERROR: V7 standalone opening anchor not found")
c=c.replace(old,new,1)

# holderLedger is now created at the beginning.
old=""" let holderLedger=null;
 try{holderLedger=eventHolderLedger?.inspect?.(mint)||null}catch{}

 const knownHolderTruth="""
new=""" const knownHolderTruth="""
if old not in c:
    raise SystemExit("ERROR: V7 duplicate holderLedger anchor not found")
c=c.replace(old,new,1)

# 0 observed users means "no observation", not "0+ holders".
old=""" ].filter(v=>v!=null&&v>=0);"""
new=""" ].filter(v=>v!=null&&v>0);"""
if old not in c:
    raise SystemExit("ERROR: V7 observed-holder filter anchor not found")
c=c.replace(old,new,1)

# Replace market derivation with internal ledger + SOL/USD conversion.
old=""" const name=canonicalToken.name||known.name||known.symbol||null;
 const symbol=canonicalToken.symbol||known.symbol||null;
 const priceUsd=mf49Num(canonicalToken.priceUsd)??mf49Num(known.priceUsd);
 const liquidityUsd=mf49Num(canonicalToken.liquidityUsd)??mf49Num(known.liquidityUsd);
 const marketCapUsd=mf49Num(canonicalToken.marketCapUsd)??mf49Num(known.marketCapUsd);
 const volume5mUsd=mf49Num(known?.market?.volume5mUsd)??mf49Num(known.volume5mUsd);
 const buys5m=mf49Num(known?.market?.buys5m)??mf49Num(known.buys5m);
 const sells5m=mf49Num(known?.market?.sells5m)??mf49Num(known.sells5m);

 let priceSol=mf49Num(canonicalToken.priceSol)??mf49Num(known.priceSol),liquiditySol=mf49Num(canonicalToken.liquiditySol)??mf49Num(known.liquiditySol);
 if(priceSol!=null||liquiditySol!=null)sources.add('Pump curve');

 let buyPressure=mf49Num(canonicalToken.buyPressure)??mf49Num(known.buyPressure);
 const tw=tradeWindows.get(mint);
 if(tw&&(tw.buy||tw.sell)){
  buyPressure=tw.sell?tw.buy/tw.sell:(tw.buy||null);
  sources.add('Live flow')
 }"""
new=""" const name=canonicalToken.name||known.name||known.symbol||null;
 const symbol=canonicalToken.symbol||known.symbol||null;

 const solUsd=mf49Num(solUsdOracle?.get?.());

 let priceSol=
  mf49Num(canonicalToken.priceSol) ??
  mf49Num(marketLedger?.priceSol) ??
  mf49Num(known.priceSol);

 let liquiditySol=
  mf49Num(canonicalToken.liquiditySol) ??
  mf49Num(marketLedger?.liquiditySol) ??
  mf49Num(known.liquiditySol);

 const priceUsd=
  mf49Num(canonicalToken.priceUsd) ??
  mf49Num(known.priceUsd) ??
  (
   priceSol!=null && solUsd!=null
    ? priceSol*solUsd
    : null
  );

 const marketCapUsd=
  mf49Num(canonicalToken.marketCapUsd) ??
  mf49Num(known.marketCapUsd) ??
  (
   priceSol!=null && total!=null && solUsd!=null
    ? priceSol*total*solUsd
    : null
  );

 const liquidityUsd=
  mf49Num(canonicalToken.liquidityUsd) ??
  mf49Num(known.liquidityUsd) ??
  (
   liquiditySol!=null && solUsd!=null
    ? liquiditySol*solUsd
    : null
  );

 const volume5mSol=
  mf49Num(known?.market?.volume5mSol) ??
  mf49Num(known.volume5mSol);

 const volume5mUsd=
  mf49Num(known?.market?.volume5mUsd) ??
  mf49Num(known.volume5mUsd) ??
  (
   volume5mSol!=null && solUsd!=null
    ? volume5mSol*solUsd
    : null
  );

 let buyPressure=
  mf49Num(canonicalToken.buyPressure) ??
  mf49Num(marketLedger?.buyPressure) ??
  mf49Num(known.buyPressure);

 const tw=tradeWindows.get(mint);
 const buys5m=
  mf49Num(known?.market?.buys5m) ??
  mf49Num(known.buys5m) ??
  mf49Num(tw?.buy);

 const sells5m=
  mf49Num(known?.market?.sells5m) ??
  mf49Num(known.sells5m) ??
  mf49Num(tw?.sell);

 if(tw&&(tw.buy||tw.sell)){
  buyPressure=tw.sell?tw.buy/tw.sell:(tw.buy||null);
  sources.add('MEMEFLOW live flow');
 }

 if(priceSol!=null||liquiditySol!=null)sources.add('Pump curve / live reserves');
 if(solUsd!=null)sources.add('SOL/USD oracle');"""
if old not in c:
    raise SystemExit("ERROR: V7 market derivation anchor not found")
c=c.replace(old,new,1)

# Authority must distinguish UNKNOWN from NONE.
old=""" const mintParsed=mintInfo?.value?.data?.parsed?.info||{};
 const mintAuthority=mintParsed.mintAuthority??null,freezeAuthority=mintParsed.freezeAuthority??null;

 const priceAvailable=priceSol!=null||priceUsd!=null;"""
new=""" const mintParsed=mintInfo?.value?.data?.parsed?.info||null;
 const authorityKnown=Boolean(mintParsed);
 const mintAuthority=authorityKnown?(mintParsed.mintAuthority??null):null;
 const freezeAuthority=authorityKnown?(mintParsed.freezeAuthority??null):null;
 const mintAuthorityStatus=
  !authorityKnown
   ? 'UNKNOWN'
   : mintAuthority
     ? 'ACTIVE'
     : 'NONE';
 const freezeAuthorityStatus=
  !authorityKnown
   ? 'UNKNOWN'
   : freezeAuthority
     ? 'ACTIVE'
     : 'NONE';

 const priceAvailable=priceSol!=null||priceUsd!=null;"""
if old not in c:
    raise SystemExit("ERROR: V7 authority anchor not found")
c=c.replace(old,new,1)

# Add semantic analysis readiness after evaluation.
old=""" const evaluation=mf49Evaluate(evalToken,u.settings);

 if(holderCount==null&&observedHolderCount!=null){"""
new=""" const evaluation=mf49Evaluate(evalToken,u.settings);

 // MEMEFLOW_MANUAL_ANALYSIS_STATE_SEMANTICS_V7
 // WAITING is a trading decision, not an error code for absent evidence.
 // A standalone scan receives a trading state only after the minimum evidence
 // needed to make that state meaningful is present.
 const evidenceFlags={
  price:priceAvailable,
  marketCap:marketCapUsd!=null,
  holders:holderCount!=null||observedHolderCount!=null,
  activity:
   buyPressure!=null ||
   volume5mUsd!=null ||
   buys5m!=null ||
   sells5m!=null,
  tokenAccount:authorityKnown
 };
 const evidenceCount=Object.values(evidenceFlags).filter(Boolean).length;
 const decisionEvidenceReady=
  evidenceFlags.price &&
  evidenceFlags.marketCap &&
  evidenceFlags.holders &&
  evidenceFlags.activity;
 const analysisStatus=
  decisionEvidenceReady
   ? 'READY'
   : evidenceCount>=2
     ? 'PARTIAL'
     : 'INSUFFICIENT_DATA';
 const analysisMessage=
  analysisStatus==='READY'
   ? 'MEMEFLOW has enough current evidence for a trading-state evaluation.'
   : analysisStatus==='PARTIAL'
     ? 'Partial token data is available; no trading state is assigned until core market and holder evidence is complete.'
     : 'Insufficient token data; MEMEFLOW will not label this token WAITING or score it as a trading candidate.';

 if(holderCount==null&&observedHolderCount!=null){"""
if old not in c:
    raise SystemExit("ERROR: V7 analysis-status anchor not found")
c=c.replace(old,new,1)

# Make full-analysis deadline warning human-readable.
old=""" }else{
  warnings.push(`Full on-chain analysis: ${manualSettled.reason?.message||'unavailable'}`);
 }"""
new=""" }else{
  if(manualSettled.reason?.code==='MANUAL_ANALYSIS_DEADLINE'){
   warnings.push('Deep on-chain verification did not finish within the bounded scan window; indexed MEMEFLOW data is shown instead.');
  }else{
   warnings.push(`Full on-chain analysis: ${manualSettled.reason?.message||'unavailable'}`);
  }
 }"""
if old not in c:
    raise SystemExit("ERROR: V7 deadline warning anchor not found")
c=c.replace(old,new,1)

# Include volume5mSol, statuses, analysis status in response.
old="""  market:{
   priceUsd,priceSol,
   marketCapUsd,
   marketCapSol:priceSol!=null&&total!=null?priceSol*total:null,
   liquidityUsd,liquiditySol,
   buyPressure,volume5mUsd,buys5m,sells5m,"""
new="""  market:{
   priceUsd,priceSol,
   marketCapUsd,
   marketCapSol:priceSol!=null&&total!=null?priceSol*total:null,
   liquidityUsd,liquiditySol,
   buyPressure,volume5mSol,volume5mUsd,buys5m,sells5m,"""
if old not in c:
    raise SystemExit("ERROR: V7 market response anchor not found")
c=c.replace(old,new,1)

old="""   creator,
   mintAuthority,
   freezeAuthority,
   holderFresh
  },
  settingsApplied:"""
new="""   creator,
   mintAuthority,
   freezeAuthority,
   mintAuthorityStatus,
   freezeAuthorityStatus,
   holderFresh
  },
  analysisStatus,
  analysisMessage,
  evidenceFlags,
  evidenceCount,
  settingsApplied:"""
if old not in c:
    raise SystemExit("ERROR: V7 response status anchor not found")
c=c.replace(old,new,1)

p.write_text(c)

# ============================================================
# 3) UI: DATA INCOMPLETE is not WAITING; unknown authority is not NONE.
# ============================================================
p=Path("memeflow-app/system-tokens.js")
c=p.read_text()

old="""  const market=scan?.market||{};
  const chain=scan?.onchain||{};
  const stateText=stateLabel(decision?.state||'WAITING');
  const stateClass=__mfScanStateClassV27(decision?.state);

  const reasons=["""
new="""  const market=scan?.market||{};
  const chain=scan?.onchain||{};
  const manualDataIncomplete=
    !tracked &&
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY';
  const stateText=
    manualDataIncomplete
      ? 'DATA INCOMPLETE'
      : stateLabel(decision?.state||'WAITING');
  const stateClass=
    manualDataIncomplete
      ? 'waiting'
      : __mfScanStateClassV27(decision?.state);
  const scoreText=
    manualDataIncomplete
      ? '—'
      : __mfScanNumberV27(decision?.score,0);

  const reasons=["""
if old not in c:
    raise SystemExit("ERROR: V7 UI state anchor not found")
c=c.replace(old,new,1)

old="""        <div class="mf-scan-metric"><span>Score</span><strong>${escapeHtml(__mfScanNumberV27(decision?.score,0))}</strong></div>"""
new="""        <div class="mf-scan-metric"><span>Score</span><strong>${escapeHtml(scoreText)}</strong></div>"""
if old not in c:
    raise SystemExit("ERROR: V7 UI score anchor not found")
c=c.replace(old,new,1)

old="""      <p class="mf-scan-reason">
        ${escapeHtml(reasons[0]||(
          tracked
            ? 'Current canonical MEMEFLOW live state.'
            : 'Independent scan completed with the current MEMEFLOW evaluator.'
        ))}
      </p>"""
new="""      <p class="mf-scan-reason">
        ${escapeHtml(
          manualDataIncomplete
            ? (scan?.analysisMessage||'Token data is incomplete.')
            : reasons[0]||(
                tracked
                  ? 'Current canonical MEMEFLOW live state.'
                  : 'Independent scan completed with the current MEMEFLOW evaluator.'
              )
        )}
      </p>"""
if old not in c:
    raise SystemExit("ERROR: V7 UI reason anchor not found")
c=c.replace(old,new,1)

old="""          <div class="mf-scan-detail"><span>Mint authority</span><strong>${escapeHtml(chain?.mintAuthority?'ACTIVE':'NONE')}</strong></div>
          <div class="mf-scan-detail"><span>Freeze authority</span><strong>${escapeHtml(chain?.freezeAuthority?'ACTIVE':'NONE')}</strong></div>"""
new="""          <div class="mf-scan-detail"><span>Mint authority</span><strong>${escapeHtml(chain?.mintAuthorityStatus??(chain?.mintAuthority?'ACTIVE':'UNKNOWN'))}</strong></div>
          <div class="mf-scan-detail"><span>Freeze authority</span><strong>${escapeHtml(chain?.freezeAuthorityStatus??(chain?.freezeAuthority?'ACTIVE':'UNKNOWN'))}</strong></div>"""
if old not in c:
    raise SystemExit("ERROR: V7 UI authority anchor not found")
c=c.replace(old,new,1)

p.write_text(c)
PY

node --check "$APP"
node --check "$UI"
node --check "$ORACLE"

echo
echo "=== V7 architecture verification ==="
grep -n "MEMEFLOW_MANUAL_INDEXED_DATA_PLANE_V7" "$APP"
grep -n "MEMEFLOW_MANUAL_ANALYSIS_STATE_SEMANTICS_V7" "$APP"

echo
echo "=== DexScreener active-source verification ==="
if grep -RniI \
  --exclude-dir=node_modules \
  --exclude-dir=data \
  --exclude='*.map' \
  --exclude-dir='.token-flow-toolbar-fixed-lock-v2-backup-'* \
  --exclude-dir='.token-flow-toolbar-pin-v3-backup-'* \
  --exclude-dir='.token-flow-toolbar-cleanup-backup-'* \
  -i "dexscreener" \
  memeflow-app/src \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/index.html
then
  echo "ERROR: DexScreener still exists in active source. Nothing committed."
  exit 1
else
  echo "OK: no DexScreener dependency remains in active source files."
fi

echo
echo "=== Diff summary ==="
git diff --stat -- "$APP" "$UI" "$ORACLE"

git add "$APP" "$UI" "$ORACLE"
git commit -m "fix: indexed manual analysis data plane and state semantics"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
