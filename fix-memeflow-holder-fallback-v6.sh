#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-holder-fallback-v6-$STAMP"
mkdir -p "$BACKUP"
cp "$APP" "$BACKUP/app-server.mjs"
cp "$UI" "$BACKUP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path

# =========================
# app-server.mjs
# =========================
p = Path("memeflow-app/app-server.mjs")
c = p.read_text()

old = """ const canonicalToken=canonicalManual?.token||{};
 const decimals=mf49Num(canonicalToken.decimals)??mf49Num(known.decimals);
 const total=mf49Num(canonicalToken.totalSupply)??mf49Num(known.totalSupply);
 const top10=mf49Num(canonicalToken.top10Pct)??mf49Num(known.top10Pct);
 const holderFresh=canonicalToken.holderFresh===true;
 const holderCount=mf49Num(canonicalToken.holderCount);
 const holderCountDisplay=holderCount!=null?String(Math.round(holderCount)):null;
"""

new = """ const canonicalToken=canonicalManual?.token||{};
 const decimals=mf49Num(canonicalToken.decimals)??mf49Num(known.decimals);
 const total=mf49Num(canonicalToken.totalSupply)??mf49Num(known.totalSupply);

 // MEMEFLOW_MANUAL_HOLDER_LIVE_FALLBACK_V6
 // Exact getProgramAccounts remains authoritative. If it misses the bounded
 // manual-analysis deadline, reuse MEMEFLOW's already-running WS holder ledger
 // as an explicitly labelled lower-bound instead of rendering false zeroes.
 let holderLedger=null;
 try{holderLedger=eventHolderLedger?.inspect?.(mint)||null}catch{}

 const knownHolderTruth=__mfPipelineHolderTruthV26(
  known,
  mint,
  Date.now()
 );

 const canonicalExactHolder=
  canonicalToken?.holderCountAuthoritative===true &&
  canonicalToken?.holderFresh===true
   ? mf49Num(canonicalToken.holderCount)
   : null;

 const storedExactHolder=
  knownHolderTruth?.authoritative===true
   ? mf49Num(knownHolderTruth.count)
   : null;

 const holderCount=
  canonicalExactHolder ??
  storedExactHolder;

 const observedCandidates=[
  mf49Num(canonicalToken.observedHolderCount),
  mf49Num(knownHolderTruth?.observed),
  mf49Num(holderLedger?.observedHolderCount),
  mf49Num(holderLedger?.holderCount)
 ].filter(v=>v!=null&&v>=0);

 const observedHolderCount=
  observedCandidates.length
   ? Math.max(...observedCandidates)
   : null;

 const holderCountIsLowerBound=
  holderCount==null &&
  observedHolderCount!=null;

 const holderCountDisplay=
  holderCount!=null
   ? String(Math.round(holderCount))
   : observedHolderCount!=null
     ? String(Math.round(observedHolderCount))+'+'
     : null;

 const exactHolderEvidence=holderCount!=null;

 const top10=
  exactHolderEvidence
   ? (
      mf49Num(canonicalToken.top10Pct) ??
      mf49Num(known.top10Pct)
     )
   : null;

 const top10PctApprox=
  !exactHolderEvidence
   ? mf49Num(holderLedger?.top10Pct)
   : null;

 const developerPctApprox=
  !exactHolderEvidence
   ? mf49Num(holderLedger?.developerPct)
   : null;

 const top10PctDisplay=
  top10!=null
   ? null
   : top10PctApprox!=null
     ? '~'+String(Math.round(top10PctApprox*10)/10)+'%'
     : null;

 const developerPctDisplayFallback=
  developerPctApprox!=null
   ? '~'+String(Math.round(developerPctApprox*10)/10)+'%'
   : null;

 const holderFresh=
  canonicalToken.holderFresh===true ||
  knownHolderTruth?.fresh===true ||
  Boolean(holderLedger?.holderFresh);

 if(holderCountIsLowerBound){
  sources.add('MEMEFLOW live holder ledger');
 }
"""

if old not in c:
    raise SystemExit("ERROR: V6 holder anchor not found in app-server.mjs")
c = c.replace(old, new, 1)

old = """  if(canonicalManual?.evidence?.holderScanError){
   warnings.push(`Holders: ${canonicalManual.evidence.holderScanError}`);
  }"""
new = """  if(canonicalManual?.evidence?.holderScanError){
   const holderMessage=String(canonicalManual.evidence.holderScanError||'');
   if(/MANUAL_ANALYSIS_RPC_TIMEOUT:getProgramAccounts/i.test(holderMessage)){
    warnings.push('Exact holder RPC timed out; MEMEFLOW live holder fallback will be used when available.');
   }else{
    warnings.push(`Holders: ${holderMessage}`);
   }
  }"""
if old not in c:
    raise SystemExit("ERROR: V6 holder warning anchor not found")
c = c.replace(old, new, 1)

old = """ const creator=canonicalToken.creator||known.creator||null;
 let developerPct=mf49Num(canonicalToken.developerPct)??mf49Num(known.developerPct);"""
new = """ const creator=canonicalToken.creator||known.creator||holderLedger?.eventLedgerCreator||null;
 let developerPct=
  exactHolderEvidence
   ? (
      mf49Num(canonicalToken.developerPct) ??
      mf49Num(known.developerPct)
     )
   : null;"""
if old not in c:
    raise SystemExit("ERROR: V6 developer anchor not found")
c = c.replace(old, new, 1)

old = """ if(holderCount==null)warnings.push('Exact holder count is unavailable because the canonical holder scan did not complete.');"""
new = """ if(holderCount==null&&observedHolderCount!=null){
  warnings.push(`Exact holder total is unavailable; ${Math.round(observedHolderCount)}+ is the live MEMEFLOW lower bound.`);
 }else if(holderCount==null){
  warnings.push('Exact holder count is unavailable because the canonical holder scan did not complete.');
 }"""
if old not in c:
    raise SystemExit("ERROR: V6 unavailable-holder warning anchor not found")
c = c.replace(old, new, 1)

old = """  onchain:{
   decimals,totalSupply:total,holderCount,holderCountDisplay,top10Pct:top10,
   developerPct,creator,mintAuthority,freezeAuthority,holderFresh
  },"""
new = """  onchain:{
   decimals,
   totalSupply:total,
   holderCount,
   holderCountDisplay,
   observedHolderCount,
   holderCountIsLowerBound,
   top10Pct:top10,
   top10PctApprox,
   top10PctDisplay,
   developerPct,
   developerPctApprox,
   developerPctDisplay:
    developerPct!=null
     ? null
     : developerPctDisplayFallback,
   creator,
   mintAuthority,
   freezeAuthority,
   holderFresh
  },"""
if old not in c:
    raise SystemExit("ERROR: V6 onchain response anchor not found")
c = c.replace(old, new, 1)

p.write_text(c)

# =========================
# system-tokens.js
# =========================
p = Path("memeflow-app/system-tokens.js")
c = p.read_text()

old = """        <div class="mf-scan-metric"><span>Holders</span><strong>${escapeHtml(chain?.holderCountDisplay??chain?.holderCount??holderCount(liveRow||{}))}</strong></div>
        <div class="mf-scan-metric"><span>Top 10</span><strong>${finite(chain?.top10Pct)?escapeHtml(__mfScanNumberV27(chain.top10Pct,1)+'%'):'—'}</strong></div>
        <div class="mf-scan-metric"><span>Dev</span><strong>${finite(chain?.developerPct)?escapeHtml(__mfScanNumberV27(chain.developerPct,1)+'%'):'—'}</strong></div>"""

new = """        <div class="mf-scan-metric"><span>Holders</span><strong>${escapeHtml(chain?.holderCountDisplay??chain?.holderCount??holderCount(liveRow||{}))}</strong></div>
        <div class="mf-scan-metric"><span>Top 10</span><strong>${chain?.top10PctDisplay?escapeHtml(chain.top10PctDisplay):(finite(chain?.top10Pct)?escapeHtml(__mfScanNumberV27(chain.top10Pct,1)+'%'):'—')}</strong></div>
        <div class="mf-scan-metric"><span>Dev</span><strong>${chain?.developerPctDisplay?escapeHtml(chain.developerPctDisplay):(finite(chain?.developerPct)?escapeHtml(__mfScanNumberV27(chain.developerPct,1)+'%'):'—')}</strong></div>"""

if old not in c:
    raise SystemExit("ERROR: V6 UI metric anchor not found")
c = c.replace(old, new, 1)

p.write_text(c)
PY

node --check "$APP"
node --check "$UI"

echo
echo "=== V6 verification ==="
grep -n "MEMEFLOW_MANUAL_HOLDER_LIVE_FALLBACK_V6" "$APP"
grep -n "MEMEFLOW live holder ledger" "$APP"

echo
echo "=== Diff summary ==="
git diff --stat -- "$APP" "$UI"

git add "$APP" "$UI"
git commit -m "fix: use live holder fallback when manual RPC times out"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
