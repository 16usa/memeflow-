#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW_DATA_INTEGRITY_V1_3_1_ADAPTIVE"
EXPECTED_HEAD="b4d3d18842191afc3cb87c6737dc86723af4aab0"
NEW_TEST="src/data-integrity-v1_3.test.mjs"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

if [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then
  ROOT="."
elif [[ -f "memeflow-app/app-server.mjs" && -f "memeflow-app/src/evaluate.mjs" ]]; then
  ROOT="memeflow-app"
else
  die "MEMEFLOW app root not found."
fi

cd "$ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside the MEMEFLOW git worktree."
HEAD_NOW="$(git rev-parse HEAD)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Built for $EXPECTED_HEAD; current HEAD is $HEAD_NOW. Nothing changed."

TARGETS=(
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/store.mjs"
  "src/event-holder-ledger.mjs"
)
for f in "${TARGETS[@]}"; do [[ -f "$f" ]] || die "Missing target file: $f"; done
[[ -f "src/single-instance-lock.mjs" ]] || die "Missing src/single-instance-lock.mjs"
[[ -f "src/filter-upgrade.test.mjs" ]] || die "Missing src/filter-upgrade.test.mjs"

# V1.2 intentionally leaves a dirty working tree. Do not require git-clean here;
# instead require the exact V1.2 semantic markers before touching anything.
grep -q "MEMEFLOW_UNIFIED_DECISION_V1_1" src/evaluate.mjs || die "V1.2 evaluator marker missing. Run the successful V1.2 patch first."
grep -q "fresh holder snapshot data pending" src/evaluate.mjs || die "V1.2 holder WAITING rule missing."
grep -q "process.env.DATA_DIR" src/single-instance-lock.mjs || die "V1.2 DATA_DIR lock isolation missing."
grep -q "metadataResolved:metadata.metadataResolved===true" src/enrich.mjs || die "V1.2 metadata resolution block missing."
# Later scanner/chart patches may rename holderSource while keeping the same ledger contract.
# Validate structure instead of one historical string literal.
grep -Eq "class[[:space:]]+EventHolderLedger|export[[:space:]]+class[[:space:]]+EventHolderLedger" src/event-holder-ledger.mjs || die "EventHolderLedger class missing."
grep -q "snapshot(m)" src/event-holder-ledger.mjs || die "EventHolderLedger snapshot(m) method missing."
grep -q "applyToStore(store,m)" src/event-holder-ledger.mjs || die "EventHolderLedger applyToStore(store,m) method missing."

if grep -q "MEMEFLOW_DATA_INTEGRITY_V1_3" src/evaluate.mjs; then
  die "V1.3 is already applied. Nothing changed."
fi
[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists. Nothing changed."

BACKUP=".memeflow-data-integrity-v1.3-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed. Restoring exact pre-V1.3 files..."
  for f in "${TARGETS[@]}"; do cp "$BACKUP/$f" "$f" || true; done
  rm -f "$NEW_TEST"
  log "ROLLBACK COMPLETE. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying $PATCH_NAME on top of successful V1.2..."

python3 - <<'PY'
from pathlib import Path
import re

MARK='MEMEFLOW_DATA_INTEGRITY_V1_3'

def read(path): return Path(path).read_text(encoding='utf-8')
def write(path,text): Path(path).write_text(text,encoding='utf-8')
def once(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'{label}: expected exactly 1 anchor, found {n}')
    return text.replace(old,new,1)

# ---------------------------------------------------------------------------
# 1) EVENT HOLDER LEDGER: observational telemetry only.
#    TradeEvent.user is useful fast telemetry, but it is NOT a complete current
#    holder census. Never let it write canonical holderCount/top10/dev/freshness.
# ---------------------------------------------------------------------------
hp=Path('src/event-holder-ledger.mjs')
h=hp.read_text(encoding='utf-8')
if MARK in h: raise SystemExit('event-holder ledger already contains V1.3 marker')

start_marker="  snapshot(m){"
start=h.find(start_marker)
if start<0 or h.find(start_marker,start+1)>=0:
    raise SystemExit('event-holder snapshot anchor is missing or ambiguous')

# Prefer the historic inspect() marker. If a later patch removed/renamed inspect(),
# stop at the next known class method after applyToStore instead of refusing on wording.
inspect_marker="  inspect(m){return this.snapshot(m)}"
inspect_at=h.find(inspect_marker,start)
if inspect_at>=0:
    end=inspect_at+len(inspect_marker)
else:
    apply_at=h.find("  applyToStore(store,m){",start)
    if apply_at<0:
        raise SystemExit('event-holder applyToStore anchor missing')
    candidates=[]
    for marker in ["  load(){","  metricsSnapshot(){","  status(){","  diagnostics(){"]:
        pos=h.find(marker,apply_at+1)
        if pos>=0:candidates.append(pos)
    if not candidates:
        raise SystemExit('cannot determine safe end of event-holder snapshot/apply block')
    end=min(candidates)

replacement=r'''  // MEMEFLOW_DATA_INTEGRITY_V1_3
  // This ledger observes Pump TradeEvent.user wallets. It is NOT a complete
  // SPL/Token-2022 holder census and therefore may never claim holderFresh or
  // overwrite canonical holderCount/top10Pct/developerPct.
  snapshot(m){
    const r=this.byMint.get(m);
    if(!r)return null;

    const holders=[...r.balances]
      .filter(([,a])=>a>0n)
      .sort((a,b)=>a[1]===b[1]?0:(a[1]>b[1]?-1:1));

    const totalSupply=supplyRaw(r.decimals??6);
    const top10=holders.slice(0,10).reduce((s,[,a])=>s+a,0n);
    const dev=r.creator?(r.balances.get(r.creator)||0n):0n;
    const tracked=holders.reduce((s,[,a])=>s+a,0n);

    return {
      mint:m,
      eventHolderSource:'event-ledger-v12-27-observational',
      eventHolderEvidenceKind:'observational-not-census',
      eventTrackedWallets:holders.length,
      eventTop10Pct:pct(top10,totalSupply),
      eventDeveloperPct:r.creator?pct(dev,totalSupply):null,
      eventHolderObservedAt:r.lastSeenAt||Date.now(),
      eventLedgerVersion:VERSION,
      eventLedgerLastUser:r.lastUser||null,
      eventLedgerTxCount:r.txCount,
      eventLedgerCreator:r.creator,
      eventLedgerTrackedSupplyRaw:tracked.toString(),
      eventLedgerTotalSupplyRaw:totalSupply.toString(),
      eventLedgerDecimals:r.decimals??6,
      eventLedgerCoveragePct:pct(tracked,totalSupply)
    };
  }

  applyToStore(store,m){
    const r=this.byMint.get(m);
    const token=store?.state?.tokens?.[m]||null;
    const creator=token?.creator||token?.creatorWallet||token?.developerWallet||token?.devWallet||null;
    if(r && !r.creator && creator){
      r.creator=creator;
      this.metrics.creatorLinksRecoveredFromStore++;
      this.metrics.creatorLinksSet++;
      this.schedule();
    }
    const s=this.snapshot(m);
    if(!s||!store?.setToken)return null;
    try{
      const patch={...s};
      // A process that has not restarted yet may still carry the legacy false
      // authoritative source. Neutralize it immediately on the next event.
      if(String(token?.holderSource||'').toLowerCase().includes('event-ledger')){
        patch.eventTrackedWallets=patch.eventTrackedWallets ?? token?.holderCount ?? null;
        patch.eventTop10Pct=patch.eventTop10Pct ?? token?.top10Pct ?? null;
        patch.eventDeveloperPct=patch.eventDeveloperPct ?? token?.developerPct ?? null;
        patch.holderCount=null;
        patch.top10Pct=null;
        patch.developerPct=null;
        patch.developerSharePct=null;
        patch.holderFresh=false;
        patch.holderSource=null;
        patch.holderIntegrityInvalidatedAt=Date.now();
      }
      return store.setToken(m,patch)||patch;
    }catch(e){
      this.metrics.lastError=String(e?.message||e);
      return null;
    }
  }

  inspect(m){return this.snapshot(m)}'''
h=h[:start]+replacement+h[end:]
hp.write_text(h,encoding='utf-8')

# ---------------------------------------------------------------------------
# 2) STORE LOAD: scrub already-persisted event-derived fake canonical holders.
#    Preserve the old values only under event* diagnostics for audit.
# ---------------------------------------------------------------------------
sp=Path('src/store.mjs')
s=sp.read_text(encoding='utf-8')
anchor="""      this.state={...this.state,...d};
      // Decisions are deliberately ephemeral and are reconstructed by recovery.
      // Old tracked state files used to persist them, which wastes memory at boot.
      this.state.decisions={};"""
repl="""      this.state={...this.state,...d};

      // MEMEFLOW_DATA_INTEGRITY_V1_3
      // Older V12.27 builds persisted TradeEvent-observed wallets as if they
      // were a complete live holder census. Preserve them for diagnostics, but
      // invalidate them as canonical trading evidence on startup.
      for(const token of Object.values(this.state.tokens||{})){
        if(!String(token?.holderSource||'').toLowerCase().includes('event-ledger'))continue;
        if(token.eventTrackedWallets==null&&token.holderCount!=null)token.eventTrackedWallets=token.holderCount;
        if(token.eventTop10Pct==null&&token.top10Pct!=null)token.eventTop10Pct=token.top10Pct;
        if(token.eventDeveloperPct==null&&token.developerPct!=null)token.eventDeveloperPct=token.developerPct;
        token.eventHolderSource='event-ledger-v12-27-observational';
        token.eventHolderEvidenceKind='observational-not-census';
        token.holderCount=null;
        token.top10Pct=null;
        token.developerPct=null;
        token.developerSharePct=null;
        token.holderFresh=false;
        token.holderSource=null;
        token.holderIntegrityInvalidatedAt=Date.now();
      }

      // Decisions are deliberately ephemeral and are reconstructed by recovery.
      // Old tracked state files used to persist them, which wastes memory at boot.
      this.state.decisions={};"""
s=once(s,anchor,repl,'store legacy holder scrub')
sp.write_text(s,encoding='utf-8')

# ---------------------------------------------------------------------------
# 3) EVALUATOR DEFENSE-IN-DEPTH + COLLAPSE GATE.
#    Even before restart, legacy event-holder evidence cannot produce BUY READY.
#    A >=90% observed peak drawdown is a hard risk failure and crushes score.
# ---------------------------------------------------------------------------
ep=Path('src/evaluate.mjs')
e=ep.read_text(encoding='utf-8')
if MARK in e: raise SystemExit('evaluate already contains V1.3 marker')

sig=re.compile(r"export\s+function\s+evaluate\s*\(\s*token\s*=\s*\{\}\s*,\s*s\s*=\s*\{\}\s*\)\s*\{")
ms=list(sig.finditer(e))
if len(ms)!=1: raise SystemExit(f'evaluate signature: expected 1, found {len(ms)}')
helper=r'''// MEMEFLOW_DATA_INTEGRITY_V1_3
function __mfV13SanitizeEvidence(token={}){
  if(!String(token?.holderSource||'').toLowerCase().includes('event-ledger'))return token;
  return {
    ...token,
    eventTrackedWallets:token.eventTrackedWallets??token.holderCount??null,
    eventTop10Pct:token.eventTop10Pct??token.top10Pct??null,
    eventDeveloperPct:token.eventDeveloperPct??token.developerPct??null,
    eventHolderSource:'event-ledger-v12-27-observational',
    holderCount:null,
    holders:null,
    top10Pct:null,
    top10:null,
    developerPct:null,
    developerSharePct:null,
    creatorPct:null,
    holderFresh:false
  };
}

'''
e=e[:ms[0].start()]+helper+e[ms[0].start():]
# Re-find after insertion and add sanitizer as first evaluator statement.
m=sig.search(e)
if not m: raise SystemExit('evaluate signature disappeared after helper insertion')
e=e[:m.end()]+"\n  token=__mfV13SanitizeEvidence(token);"+e[m.end():]

# Score must be mutable so catastrophic drawdown cannot still display 90/100.
e,n=re.subn(r"\bconst\s+score\s*=\s*ai\.score\s*;","let score=ai.score;",e,count=1)
if n!=1: raise SystemExit(f'evaluate score declaration anchor: expected 1, found {n}')

score_anchor="""  const minScore=finite(s.minScore)?Number(s.minScore):null;"""
if e.count(score_anchor)!=1: raise SystemExit('evaluate minScore anchor mismatch')
collapse=r'''  // Independent hard market-integrity gate. A token that has already lost
  // >=90% from MEMEFLOW's observed peak cannot remain BUY READY simply because
  // historic holder/momentum fields still look good.
  const __mfCurrentPrice=finite(token?.priceSol)?Number(token.priceSol):null;
  const __mfPeakPrice=finite(token?.peakPriceSol)?Number(token.peakPriceSol):null;
  const __mfEnvLimit=(typeof process!=='undefined'&&process?.env)
    ? Number(process.env.MEMEFLOW_COLLAPSE_DRAWDOWN_PCT)
    : NaN;
  const __mfCollapseLimit=Number.isFinite(__mfEnvLimit)
    ? Math.max(50,Math.min(99,__mfEnvLimit))
    : 90;
  const __mfDrawdownPct=(__mfCurrentPrice!==null&&__mfCurrentPrice>0&&__mfPeakPrice!==null&&__mfPeakPrice>0&&__mfPeakPrice>=__mfCurrentPrice)
    ? (1-__mfCurrentPrice/__mfPeakPrice)*100
    : null;
  if(__mfDrawdownPct!==null){
    const __mfCollapsed=__mfDrawdownPct>=__mfCollapseLimit;
    addGate(
      'Peak drawdown safety',
      !__mfCollapsed,
      `token collapsed ${__mfDrawdownPct.toFixed(1)}% from observed peak (limit ${__mfCollapseLimit}%)`,
      {value:Number(__mfDrawdownPct.toFixed(3)),threshold:__mfCollapseLimit,operator:'<'}
    );
    if(__mfCollapsed)score=Math.min(score,20);
  }

'''
e=e.replace(score_anchor,collapse+score_anchor,1)
ep.write_text(e,encoding='utf-8')

# ---------------------------------------------------------------------------
# 4) METADATA IMAGE RECOVERY.
#    Social metadata may be resolved while image gateway delivery was temporary.
#    Retry image-less resolved metadata up to four times, every >=5 minutes.
# ---------------------------------------------------------------------------
enp=Path('src/enrich.mjs')
en=enp.read_text(encoding='utf-8')
old="""    const shouldFetchMetadata =
      Boolean(existingToken.uri) &&
      existingToken.metadataResolved!==true &&
      metadataRetryReady;"""
new="""    // MEMEFLOW_DATA_INTEGRITY_V1_3
    const imageMissing=!existingToken.imageUrl&&!existingToken.image&&!existingToken.logoUrl;
    const imageRetryCount=Math.max(0,Number(existingToken.metadataImageRetryCount||0));
    const imageRetryAt=Number(existingToken.metadataImageRetryAt||0);
    const imageRetryDue=
      existingToken.metadataResolved===true &&
      imageMissing &&
      imageRetryCount<4 &&
      (!imageRetryAt||Date.now()-imageRetryAt>=5*60_000);
    const shouldFetchMetadata =
      Boolean(existingToken.uri) &&
      (existingToken.metadataResolved!==true||imageRetryDue) &&
      metadataRetryReady;"""
en=once(en,old,new,'enrich image retry condition')

en=once(
    en,
    """          metadataResolved:metadata.metadataResolved===true,
          metadataError:null,
          metadataUrl:metadata.metadataUrl,""",
    """          metadataResolved:metadata.metadataResolved===true,
          metadataError:null,
          metadataImageRetryAt:imageRetryDue?Date.now():(existingToken.metadataImageRetryAt||null),
          metadataImageRetryCount:imageRetryDue?imageRetryCount+1:imageRetryCount,
          metadataUrl:metadata.metadataUrl,""",
    'enrich successful image retry accounting'
)
en=once(
    en,
    """          metadataFetchedAt:Date.now(),
          metadataResolved:false,
          metadataError:sanitize(error?.message || String(error))""",
    """          metadataFetchedAt:Date.now(),
          metadataResolved:false,
          metadataImageRetryAt:imageRetryDue?Date.now():(existingToken.metadataImageRetryAt||null),
          metadataImageRetryCount:imageRetryDue?imageRetryCount+1:imageRetryCount,
          metadataError:sanitize(error?.message || String(error))""",
    'enrich failed image retry accounting'
)
enp.write_text(en,encoding='utf-8')

# ---------------------------------------------------------------------------
# 5) FOCUSED REGRESSION TESTS.
# ---------------------------------------------------------------------------
Path('src/data-integrity-v1_3.test.mjs').write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate} from './evaluate.mjs';
import {defaultSettings} from './settings.mjs';

const good=(patch={})=>({
  mint:'Good111',name:'Good',symbol:'GOOD',
  launchPlatform:'pump',source:'Pump create',
  discoveredAt:Date.now()-5*60_000,
  holderCount:120,holderFresh:true,
  top10Pct:10,developerPct:2,buyPressure:3,
  priceSol:1,peakPriceSol:1,dataQuality:1,
  metadataResolved:true,
  ...patch
});

test('legacy event-ledger wallet count cannot manufacture BUY READY',()=>{
  const d=evaluate(good({
    holderSource:'event-ledger-v12-27-user-only',
    holderCount:928,holderFresh:true,top10Pct:8,developerPct:1
  }),defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.ok(d.settingsEvaluation.gates.some(g=>g.name==='Fresh holder snapshot'&&g.status==='WAITING'));
});

test('95 percent peak collapse is hard BLOCKED even with otherwise perfect evidence',()=>{
  const d=evaluate(good({priceSol:0.045,peakPriceSol:1}),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  assert.match(d.reasons.join(' '),/collapsed .* observed peak/i);
  const gate=d.settingsEvaluation.gates.find(g=>g.name==='Peak drawdown safety');
  assert.equal(gate?.status,'FAIL');
});

test('ordinary 70 percent pullback is not classified as catastrophic collapse',()=>{
  const d=evaluate(good({priceSol:0.30,peakPriceSol:1}),defaultSettings());
  const gate=d.settingsEvaluation.gates.find(g=>g.name==='Peak drawdown safety');
  assert.equal(gate?.status,'PASS');
  assert.doesNotMatch(d.reasons.join(' '),/token collapsed/i);
});

test('event holder ledger exposes observational diagnostics, not canonical holder census',()=>{
  const src=fs.readFileSync(new URL('./event-holder-ledger.mjs',import.meta.url),'utf8');
  assert.match(src,/eventTrackedWallets/);
  assert.match(src,/observational-not-census/);
  const snapshot=src.slice(src.indexOf('snapshot(m){'),src.indexOf('applyToStore(store,m){'));
  assert.doesNotMatch(snapshot,/\bholderCount\s*:/);
  assert.doesNotMatch(snapshot,/\bholderFresh\s*:\s*true/);
});

test('metadata has bounded retry path for missing token image',()=>{
  const src=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  assert.match(src,/metadataImageRetryCount/);
  assert.match(src,/imageRetryCount<4/);
  assert.match(src,/imageRetryDue/);
});
""",encoding='utf-8')
PY

log "Syntax validation..."
for f in "${TARGETS[@]}" "$NEW_TEST"; do node --check "$f"; done

log "V1.3 data-integrity tests..."
node --test "$NEW_TEST"

log "V1.2 canonical regression suite..."
node --test \
  src/filter-upgrade.test.mjs \
  src/unified-decision.test.mjs \
  src/candidate-visibility-lifecycle.test.mjs \
  src/paper-fee-reserve.test.mjs \
  src/openai-policy.test.mjs \
  "$NEW_TEST"

log "Existing integration suite..."
npm test

log "Diff sanity..."
git diff --check

# Structural guarantees: the fast event ledger must no longer manufacture a
# canonical fresh holder snapshot, and live evaluator remains free of new I/O.
if grep -A45 "snapshot(m){" src/event-holder-ledger.mjs | grep -Eq "holderFresh:true|holderCount:"; then
  die "Event holder snapshot still exposes canonical holder evidence."
fi
if grep -Eq "fetch\(|await |writeFile|rename\(" src/evaluate.mjs; then
  die "Evaluator hot path gained I/O/await."
fi

trap - ERR INT TERM

log "SUCCESS: $PATCH_NAME applied and tests passed."
log "Backup: $BACKUP"
log "Key behavior:"
log "  - Pump TradeEvent wallet ledger is observational only; it cannot claim current holderCount/freshness"
log "  - legacy event-derived 928-style holder counts are invalidated on restart and kept only as event diagnostics"
log "  - legacy event evidence is fail-closed to WAITING even before restart"
log "  - >=90% drawdown from MEMEFLOW observed peak is hard BLOCKED and score is capped at 20"
log "  - resolved metadata with a missing logo gets up to 4 bounded image retries (>=5m apart)"
log "  - no fake exact holder census is invented from getTokenLargestAccounts/event history"
log ""
log "RESTART the Replit workflow/app now so persisted legacy holder evidence is scrubbed on load."
