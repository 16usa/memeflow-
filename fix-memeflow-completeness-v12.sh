#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

APP="memeflow-app/app-server.mjs"
UI="memeflow-app/system-tokens.js"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-completeness-v12-$STAMP"
mkdir -p "$BACKUP"

echo "=== MEMEFLOW V12 preflight ==="
git diff --quiet -- "$APP" "$UI" || {
  echo "ERROR: target source files already have uncommitted changes."
  echo "Nothing changed."
  exit 1
}

cp "$APP" "$BACKUP/app-server.mjs"
cp "$UI" "$BACKUP/system-tokens.js"

python3 - <<'PY'
from pathlib import Path

def replace1(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ERROR: {label} anchor not found")
    return text.replace(old, new, 1)

# ============================================================
# app-server.mjs
# ============================================================
p=Path("memeflow-app/app-server.mjs")
c=p.read_text()

# A completed Pump bonding curve has zero curve reserves because trading has
# migrated. That zero is NOT token liquidity and must not become "$0 liquidity".
old="""  return {
   mint,
   name:coin.name||null,
"""
new="""  const complete=coin.complete===true;

  return {
   mint,
   name:coin.name||null,
"""
c=replace1(c,old,new,"Pump complete insertion")

old="""   marketCapUsd:mf49Num(coin.usd_market_cap??coin.marketCapUsd),
   priceSol:reservePriceSol??capPriceSol,
   liquiditySol:realSolRaw!=null?realSolRaw/1e9:null,
   previewHolderCount:holderRef!=null&&holderRef>0?holderRef:null,
"""
new="""   marketCapUsd:mf49Num(coin.usd_market_cap??coin.marketCapUsd),
   priceSol:reservePriceSol??capPriceSol,
   // Once complete/migrated, bonding-curve real SOL reserves are no longer
   // market liquidity. Keep it UNKNOWN until a migrated-pool source exists.
   liquiditySol:
    !complete&&realSolRaw!=null&&realSolRaw>0
     ? realSolRaw/1e9
     : null,
   complete,
   migrated:complete,
   previewHolderCount:holderRef!=null&&holderRef>0?holderRef:null,
"""
c=replace1(c,old,new,"Pump migrated liquidity semantics")

# Fast Pump trade reference: optional. It can fill 5m activity without making
# the manual click path depend on a heavy Solana transaction-history crawl.
insert_after="""async function mf49PumpReference(mint){
"""
# We insert helper after the entire mf49PumpReference function by locating
# the next resolve-input function.
needle="""async function mf49ResolveInput(raw){
"""
helper=r"""async function mf49PumpTradesReference(mint){
 const base=String(
  process.env.PUMPFUN_TRADES_URL||
  'https://frontend-api-v3.pump.fun/trades/all'
 ).trim().replace(/\/+$/,'');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),1800);
 timer.unref?.();
 try{
  const headers={
   accept:'application/json',
   origin:'https://pump.fun',
   'user-agent':'MEMEFLOW/1.0 token-trades-reference'
  };
  const jwt=String(process.env.PUMPFUN_HISTORY_JWT||'').trim();
  if(jwt)headers.authorization=`Bearer ${jwt}`;

  const url=
   base+'/'+encodeURIComponent(mint)+
   '?limit=200&offset=0&minimumSize=0';

  const response=await fetch(url,{headers,signal:controller.signal});
  if(!response.ok)return null;

  const body=await response.json().catch(()=>null);
  const rows=
   Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.trades)
        ? body.trades
        : [];

  if(!rows.length)return null;

  const now=Date.now();
  const cutoff=now-5*60_000;
  let buys=0,sells=0,volumeSol=0,seen=0;

  for(const row of rows){
   const rawTs=
    mf49Num(
     row?.timestamp??
     row?.created_timestamp??
     row?.createdTimestamp??
     row?.created_at??
     row?.createdAt
    );
   if(rawTs==null)continue;
   const at=rawTs<1e12?rawTs*1000:rawTs;
   if(at<cutoff||at>now+60_000)continue;

   const isBuy=
    row?.is_buy===true||
    row?.isBuy===true||
    String(row?.type||row?.side||'').toLowerCase()==='buy';

   const isSell=
    row?.is_buy===false||
    row?.isBuy===false||
    String(row?.type||row?.side||'').toLowerCase()==='sell';

   if(!isBuy&&!isSell)continue;

   const rawSol=mf49Num(
    row?.sol_amount??
    row?.solAmount??
    row?.sol_amount_lamports??
    row?.amountSol
   );

   let sol=null;
   if(rawSol!=null){
    // Pump trade APIs commonly expose lamports; normalized adapters may expose SOL.
    sol=rawSol>1_000_000?rawSol/1e9:rawSol;
   }

   if(isBuy)buys++;
   if(isSell)sells++;
   if(sol!=null&&sol>=0)volumeSol+=sol;
   seen++;
  }

  if(!seen)return null;

  return {
   buys5m:buys,
   sells5m:sells,
   volume5mSol:volumeSol,
   buyPressure:
    sells>0
     ? buys/sells
     : buys>0
       ? buys
       : 0,
   trades5m:seen,
   at:now
  };
 }catch{
  return null;
 }finally{
  clearTimeout(timer)
 }
}

"""
if needle not in c:
    raise SystemExit("ERROR: resolve input insertion anchor not found")
c=c.replace(needle,helper+needle,1)

# Fetch Pump coin facts and recent trade facts in parallel.
old=""" let pumpReference=null;
 try{
  pumpReference=await mf49PumpReference(mint);
  if(pumpReference)sources.add('Pump token reference');
 }catch{}
"""
new=""" let pumpReference=null,pumpTrades=null;
 try{
  [pumpReference,pumpTrades]=await Promise.all([
   mf49PumpReference(mint),
   mf49PumpTradesReference(mint)
  ]);
  if(pumpReference)sources.add('Pump token reference');
  if(pumpTrades)sources.add('Pump recent trades');
 }catch{}
"""
c=replace1(c,old,new,"parallel Pump references")

# Preserve migrated truth in the canonical known snapshot.
old="""  marketCapSol:
   mf49Num(stored?.marketCapSol) ??
   mf49Num(pumpReference?.marketCapSol),
  priceSol:
"""
new="""  marketCapSol:
   mf49Num(stored?.marketCapSol) ??
   mf49Num(pumpReference?.marketCapSol),
  complete:
   stored?.complete===true||
   pumpReference?.complete===true,
  migrated:
   stored?.migrated===true||
   pumpReference?.migrated===true,
  priceSol:
"""
c=replace1(c,old,new,"known migrated truth")

# Recent Pump trade reference is a fallback behind MEMEFLOW live facts.
old=""" const volume5mSol=
  mf49Num(known?.market?.volume5mSol) ??
  mf49Num(known.volume5mSol);
"""
new=""" const volume5mSol=
  mf49Num(known?.market?.volume5mSol) ??
  mf49Num(known.volume5mSol) ??
  mf49Num(pumpTrades?.volume5mSol);
"""
c=replace1(c,old,new,"volume5m fallback")

old=""" let buyPressure=
  mf49Num(canonicalToken.buyPressure) ??
  mf49Num(marketLedger?.buyPressure) ??
  mf49Num(known.buyPressure);
"""
new=""" let buyPressure=
  mf49Num(canonicalToken.buyPressure) ??
  mf49Num(marketLedger?.buyPressure) ??
  mf49Num(known.buyPressure) ??
  mf49Num(pumpTrades?.buyPressure);
"""
c=replace1(c,old,new,"buy pressure fallback")

old=""" const buys5m=
  mf49Num(known?.market?.buys5m) ??
  mf49Num(known.buys5m) ??
  mf49Num(tw?.buy);

 const sells5m=
  mf49Num(known?.market?.sells5m) ??
  mf49Num(known.sells5m) ??
  mf49Num(tw?.sell);
"""
new=""" const buys5m=
  mf49Num(known?.market?.buys5m) ??
  mf49Num(known.buys5m) ??
  mf49Num(tw?.buy) ??
  mf49Num(pumpTrades?.buys5m);

 const sells5m=
  mf49Num(known?.market?.sells5m) ??
  mf49Num(known.sells5m) ??
  mf49Num(tw?.sell) ??
  mf49Num(pumpTrades?.sells5m);
"""
c=replace1(c,old,new,"5m count fallback")

# The core architecture rule: policy/evaluator output is diagnostic until the
# canonical fact set is sufficiently complete. Known threshold failures remain
# visible in diagnostics, but they cannot become the scan's trading verdict.
old=""" const analysisStatus=
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
"""
new=""" const analysisStatus=
  decisionEvidenceReady
   ? 'READY'
   : evidenceCount>=2
     ? 'PARTIAL'
     : 'INSUFFICIENT_DATA';

 const decisionEligible=analysisStatus==='READY';

 const analysisMessage=
  decisionEligible
   ? 'MEMEFLOW has enough current evidence for a trading-state evaluation.'
   : analysisStatus==='PARTIAL'
     ? 'Partial token data is available. Known facts are shown, but no trading verdict or AI score is assigned until core market, activity and holder evidence is complete.'
     : 'Insufficient token data. MEMEFLOW will not assign WAITING, WATCH, BUY READY, BLOCKED or an AI score from incomplete evidence.';

 const knownPolicyFailures=
  Array.isArray(evaluation?.settingsEvaluation?.failedGates)
   ? evaluation.settingsEvaluation.failedGates
      .filter(g=>g?.status==='FAIL')
      .map(g=>({
       key:g.key||null,
       name:g.name||null,
       reason:g.reason||null,
       value:g.value??null,
       threshold:g.threshold??null,
       retryable:g.retryable===true
      }))
   : [];

 const displayEvaluation=
  decisionEligible
   ? evaluation
   : {
      state:'DATA INCOMPLETE',
      score:null,
      confidence:null,
      primaryReason:analysisMessage,
      reasons:[],
      diagnosticState:evaluation?.state||null,
      diagnosticScore:evaluation?.score??null,
      diagnosticConfidence:evaluation?.confidence??null
     };
"""
c=replace1(c,old,new,"decision eligibility")

# Put decision eligibility into response, and provide displayEvaluation as the
# only verdict the UI should use.
old="""  analysisStatus,
  analysisMessage,
  evidenceFlags,
  evidenceCount,
  settingsApplied:
"""
new="""  analysisStatus,
  analysisMessage,
  decisionEligible,
  displayEvaluation,
  knownPolicyFailures,
  evidenceFlags,
  evidenceCount,
  settingsApplied:
"""
c=replace1(c,old,new,"response decision semantics")

p.write_text(c)

# ============================================================
# system-tokens.js
# ============================================================
p=Path("memeflow-app/system-tokens.js")
c=p.read_text()

# Manual scan always consumes server-authoritative displayEvaluation. A stale
# registry decision may be shown only when the server says facts are complete.
old="""function __mfScanDecisionV27(scan,liveRow){
  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }
  return scan?.evaluation||{};
}
"""
new="""function __mfScanDecisionV27(scan,liveRow){
  if(scan?.decisionEligible===false){
    return scan?.displayEvaluation||{
      state:'DATA INCOMPLETE',
      score:null,
      confidence:null,
      reasons:[]
    };
  }

  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }

  return scan?.displayEvaluation||scan?.evaluation||{};
}
"""
c=replace1(c,old,new,"UI display evaluation")

old="""  const manualDataIncomplete=
    scan?.analysisStatus &&
    scan.analysisStatus!=='READY' &&
    !__mfScanLiveEvidenceReadyV11(liveRow);
"""
new="""  const manualDataIncomplete=
    scan?.decisionEligible===false ||
    (
      scan?.analysisStatus &&
      scan.analysisStatus!=='READY' &&
      !__mfScanLiveEvidenceReadyV11(liveRow)
    );
"""
c=replace1(c,old,new,"UI completeness guard")

# Don't show curve-reserve liquidity as $0 for migrated tokens. Null already
# formats as dash; this extra guard protects stale zeroes from old registry rows.
old="""          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.liquidityUsd))}</strong></div>
"""
new="""          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(
            scan?.migrated===true&&Number(market?.liquidityUsd)===0
              ? '—'
              : __mfScanCompactUsdV27(market?.liquidityUsd)
          )}</strong></div>
"""
c=replace1(c,old,new,"UI migrated liquidity")

# Known threshold failures are useful diagnostics, but label them explicitly
# instead of presenting them as the verdict while data is incomplete.
old="""        ${reasons.length>1
          ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
          : ''}
        ${warnings.length
"""
new="""        ${manualDataIncomplete&&Array.isArray(scan?.knownPolicyFailures)&&scan.knownPolicyFailures.length
          ? `<div class="mf-scan-note-label">Known settings checks</div><ul class="mf-scan-notes">${scan.knownPolicyFailures.slice(0,6).map(g=>`<li>${escapeHtml(g?.reason||g?.name||'Known settings failure')}</li>`).join('')}</ul>`
          : reasons.length>1
            ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
            : ''}
        ${warnings.length
"""
c=replace1(c,old,new,"UI known policy diagnostics")

p.write_text(c)

# Post-write guard
for file, needles in {
    "memeflow-app/app-server.mjs":[
        "decisionEligible",
        "displayEvaluation",
        "mf49PumpTradesReference",
        "Known facts are shown"
    ],
    "memeflow-app/system-tokens.js":[
        "scan?.decisionEligible===false",
        "Known settings checks"
    ]
}.items():
    txt=Path(file).read_text()
    for needle in needles:
        if needle not in txt:
            raise SystemExit(f"ERROR: missing {needle} in {file}")

print("POST_WRITE_VERIFY_OK")
PY

echo
echo "=== Syntax ==="
node --check "$APP"
node --check "$UI"
echo "SYNTAX_OK"

echo
echo "=== Existing core regressions ==="
(
  cd memeflow-app
  node tests/settings-gate.mjs
  node tests/opportunity-engine.mjs
)
echo "CORE_REGRESSION_OK"

echo
echo "=== V12 static architecture regressions ==="
node --input-type=module <<'NODE'
import fs from 'node:fs';

const app=fs.readFileSync('./memeflow-app/app-server.mjs','utf8');
const ui=fs.readFileSync('./memeflow-app/system-tokens.js','utf8');

if(!app.includes("decisionEligible=analysisStatus==='READY'")){
  throw new Error('decision completeness gate missing');
}
if(!app.includes("state:'DATA INCOMPLETE'")){
  throw new Error('incomplete display state missing');
}
if(!app.includes("score:null")){
  throw new Error('incomplete score nulling missing');
}
if(!ui.includes("scan?.decisionEligible===false")){
  throw new Error('UI does not honor server completeness gate');
}
if(!app.includes("!complete&&realSolRaw!=null&&realSolRaw>0")){
  throw new Error('migrated curve liquidity guard missing');
}

console.log('V12_COMPLETENESS_ARCHITECTURE_OK');
NODE

echo
echo "=== Stage only intended files ==="
git reset
git add "$APP" "$UI"

ALLOWED='^(memeflow-app/app-server\.mjs|memeflow-app/system-tokens\.js)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED" || true)"
if [ -n "$BAD" ]; then
  echo "ERROR: unrelated files staged:"
  echo "$BAD"
  git reset
  exit 1
fi

COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [ "$COUNT" -ne 2 ]; then
  echo "ERROR: expected exactly 2 staged files, got $COUNT"
  git diff --cached --name-status
  git reset
  exit 1
fi

echo "STAGED_SCOPE_OK"
git diff --cached --stat

git commit -m "fix: gate manual verdicts on complete token evidence"
git push origin HEAD

echo
echo "DONE"
echo "Backup: $BACKUP"
git log -1 --oneline
