#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW Copy Trading runtime V2.1"
COMMIT_MESSAGE="fix(copy-trading): complete runtime mirroring and shared visibility"

APP="memeflow-app"
APP_SERVER="$APP/app-server.mjs"
FEED="$APP/src/pump-live-trade-feed.mjs"
COPY="$APP/src/copy-trading.mjs"
PAPER="$APP/src/paper-engine.mjs"
TRADING_JS="$APP/trading.js"
TRADING_CSS="$APP/trading.css"
TRADING_HTML="$APP/trading.html"
WS_TEST="$APP/tests/ws-only-preopen-rpc-v1.mjs"
PACKAGE="$APP/package.json"
NEW_TEST="$APP/tests/copy-trading-runtime-v2.mjs"

FILES=(
  "$APP_SERVER"
  "$FEED"
  "$COPY"
  "$PAPER"
  "$TRADING_JS"
  "$TRADING_CSS"
  "$TRADING_HTML"
  "$WS_TEST"
  "$PACKAGE"
)

die(){ echo "ERROR: $*" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this from inside the MEMEFLOW git repository."
cd "$ROOT"

START_HEAD="$(git rev-parse HEAD)"
BACKUP="$(mktemp -d)"
NEW_TEST_EXISTED=0
[[ -e "$NEW_TEST" ]] && NEW_TEST_EXISTED=1

echo "==> $PATCH_NAME"
echo "==> Repository: $ROOT"
echo "==> Starting HEAD: ${START_HEAD:0:12}"

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || die "Required file not found: $f"
done

# Protect unrelated local work in files this patch owns.
if ! git diff --quiet -- "${FILES[@]}" "$NEW_TEST" 2>/dev/null; then
  die "Patch target files contain uncommitted changes. Commit/revert those files first."
fi
if ! git diff --cached --quiet -- "${FILES[@]}" "$NEW_TEST" 2>/dev/null; then
  die "Patch target files contain staged changes. Commit/revert those files first."
fi

for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done
if [[ -e "$NEW_TEST" ]]; then
  mkdir -p "$BACKUP/$(dirname "$NEW_TEST")"
  cp -p "$NEW_TEST" "$BACKUP/$NEW_TEST"
fi

rollback(){
  code=$?
  if [[ $code -eq 0 ]]; then
    rm -rf "$BACKUP"
    return 0
  fi

  echo
  echo "[$PATCH_NAME] Failure detected. Rolling back this patch..." >&2

  CURRENT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"
  if [[ -n "$CURRENT_HEAD" && "$CURRENT_HEAD" != "$START_HEAD" ]]; then
    git reset --mixed "$START_HEAD" >/dev/null 2>&1 || true
  fi

  for f in "${FILES[@]}"; do
    if [[ -f "$BACKUP/$f" ]]; then
      mkdir -p "$(dirname "$f")"
      cp -p "$BACKUP/$f" "$f"
    fi
  done

  if [[ $NEW_TEST_EXISTED -eq 1 && -f "$BACKUP/$NEW_TEST" ]]; then
    mkdir -p "$(dirname "$NEW_TEST")"
    cp -p "$BACKUP/$NEW_TEST" "$NEW_TEST"
  else
    rm -f "$NEW_TEST"
  fi

  git reset --quiet -- "${FILES[@]}" "$NEW_TEST" 2>/dev/null || true
  rm -rf "$BACKUP"

  echo "[$PATCH_NAME] Restored to starting state." >&2
  echo "[$PATCH_NAME] No local patch commit remains." >&2
  exit "$code"
}
trap rollback EXIT

echo "==> 1/10 Preflight: verifying the CURRENT project before writing anything..."
python3 - <<'PY'
from pathlib import Path

files = {
    "app": Path("memeflow-app/app-server.mjs").read_text(encoding="utf-8"),
    "feed": Path("memeflow-app/src/pump-live-trade-feed.mjs").read_text(encoding="utf-8"),
    "copy": Path("memeflow-app/src/copy-trading.mjs").read_text(encoding="utf-8"),
    "paper": Path("memeflow-app/src/paper-engine.mjs").read_text(encoding="utf-8"),
    "trading": Path("memeflow-app/trading.js").read_text(encoding="utf-8"),
    "html": Path("memeflow-app/trading.html").read_text(encoding="utf-8"),
    "test": Path("memeflow-app/tests/ws-only-preopen-rpc-v1.mjs").read_text(encoding="utf-8"),
    "pkg": Path("memeflow-app/package.json").read_text(encoding="utf-8"),
}

def need(key, needle, label):
    if needle not in files[key]:
        raise SystemExit(f"ERROR: preflight missing {label}")

# Anchors are only required when V2 is not already installed.
if "MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2" not in files["app"]:
    need("app", "const copyTrading=new CopyTradingManager({store,paper,rpc:null});",
         "current CopyTradingManager constructor")
if "MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2" not in files["app"]:
    need("app", "function publishTrade(mint,event,tokenOverride=null){",
         "publishTrade anchor")
    need("app", "publishTrade: typeof publishTrade==='function'?publishTrade:null,",
         "live feed publishTrade wiring")

if "MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2" not in files["feed"]:
    need("feed",
         "eventHolderLedger,store,publish,publishTrade,evaluateAI,",
         "feed option list")
    need("feed",
         "const known=tokenFromStore(store,e.mint);",
         "feed unknown-mint gate")

if "entryReason:'COPY TRADING BUY'" not in files["copy"]:
    need("copy",
         "primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`",
         "copy first-BUY decision")
if "strategySource: decision?.strategySource || null" not in files["paper"]:
    need("paper",
         "primaryReason: decision?.primaryReason || null,",
         "paper position metadata")
if "decision?.entryReason || 'AUTOMATIC PAPER ENTRY'" not in files["paper"]:
    need("paper",
         "this.recordTrade(position, 'BUY', quantity, price, 0, 'AUTOMATIC PAPER ENTRY');",
         "paper first BUY trade")
if "strategySource: position.strategySource || null" not in files["paper"]:
    need("paper",
         "simulated: true,",
         "paper trade metadata")

# This is the exact literal currently present in main. Raw-string handling avoids
# the escaping bug that caused V2 to report 0 matches.
legacy_test = r"assert.match(app,/new CopyTradingManager\(\{store,paper,rpc:null\}\)/);"
if "MEMEFLOW_COPY_TRADING_RPC_TEST_V2" not in files["test"] and legacy_test not in files["test"]:
    raise SystemExit("ERROR: current ws-only CopyTradingManager assertion was not found")

need("pkg", 'node tests/copy-trading.mjs', "existing copy-trading test")
need("html", '/trading.js?v=chart-match-panel-v3', "trading.js cache prefix")
need("html", '/trading.css?v=buy-ready-yellow-v1', "trading.css cache prefix")

print("Preflight OK.")
PY

echo "==> 2/10 Applying runtime fixes..."
python3 - <<'PY'
from pathlib import Path
import re

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

def once(text, old, new, label):
    n=text.count(old)
    if n != 1:
        raise SystemExit(f"ERROR: {label}: expected 1 exact match, found {n}")
    return text.replace(old,new,1)

# ================================================================
# app-server.mjs
# ================================================================
path="memeflow-app/app-server.mjs"
s=read(path)

if "MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2" not in s:
    s=once(
        s,
        "const copyTrading=new CopyTradingManager({store,paper,rpc:null});",
        """/* MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2
 * Keep exactly ONE RpcPool in the runtime. The scanner remains WebSocket-only.
 * Copy Trading may reuse this already-configured pool asynchronously ONLY to
 * reconcile the tracked wallet's SELL fraction. No RPC is added to discovery,
 * holder scanning, pricing, or ordinary TradeEvent ingestion.
 */
const __mfCopyTradingRpc={
  async call(method,args=[]){
    if(method!=='getTransaction'&&method!=='getTokenAccountsByOwner'){
      const e=new Error('COPY_TRADING_RPC_METHOD_BLOCKED');
      e.code='COPY_TRADING_RPC_METHOD_BLOCKED';
      throw e;
    }
    return __mfPreOpenRpc.call(method,args);
  }
};
const copyTrading=new CopyTradingManager({store,paper,rpc:__mfCopyTradingRpc});""",
        "CopyTradingManager RPC wiring"
    )

if "MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2" not in s:
    anchor="function publishTrade(mint,event,tokenOverride=null){"
    block="""/* MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2
 * Normal scanner unknown-mint behavior stays unchanged.
 * The ONLY exception is a Pump TradeEvent belonging to a wallet explicitly
 * configured for Copy Trading:
 *   - BUY: materialize the mint so the same event can open our copy position.
 *   - SELL: materialize only when we already have an open copied position.
 */
function __mfCopyTradingMarketFromEvent(event){
  let priceSol=null,liquiditySol=null;

  try{
    const vs=BigInt(event?.virtualSolReserves??0);
    const vt=BigInt(event?.virtualTokenReserves??0);
    if(vs>0n&&vt>0n){
      priceSol=(Number(vs)/1e9)/(Number(vt)/1e6);
    }
  }catch{}

  try{
    const rs=BigInt(event?.realSolReserves??0);
    if(rs>=0n)liquiditySol=Number(rs)/1e9;
  }catch{}

  // Last-resort trade execution price for a tracked copy BUY.
  if(!(Number.isFinite(priceSol)&&priceSol>0)){
    try{
      const sol=BigInt(event?.solAmount??0);
      const tok=BigInt(event?.tokenAmount??0);
      if(sol>0n&&tok>0n){
        priceSol=(Number(sol)/1e9)/(Number(tok)/1e6);
      }
    }catch{}
  }

  return {priceSol,liquiditySol};
}

function __mfPrepareTrackedCopyTrade(event){
  const wallet=String(event?.user||'').trim();
  const mint=String(event?.mint||'').trim();
  if(!wallet||!mint)return null;

  const matches=copyTrading.enabledUsers(wallet);
  if(!matches.length)return null;

  const existing=store.getToken?.(mint)||store.state.tokens?.[mint]||null;
  if(existing)return existing;

  const hasOpenCopyPosition=matches.some(({user})=>
    Boolean(paper.openForMint?.(user?.id,mint))
  );

  if(event?.isBuy!==true&&!hasOpenCopyPosition)return null;

  const market=__mfCopyTradingMarketFromEvent(event);
  if(!(Number.isFinite(market.priceSol)&&market.priceSol>0))return null;

  const now=Date.now();
  return store.addToken({
    mint,
    name:`COPY ${mint.slice(0,6)}`,
    symbol:'TOKEN',
    source:'copy-trading-tracked-wallet',
    launchPlatform:'pump',
    protocol:'pump',
    wsFirst:true,
    copyTradingDiscovered:true,
    copyTradingTrackedWallet:wallet,
    discoveredAt:now,
    createdAt:now,
    lastPriceAt:now,
    lastMarketActivityAt:now,
    priceSol:market.priceSol,
    liquiditySol:Number.isFinite(market.liquiditySol)?market.liquiditySol:null,
    eventSignature:event?.signature||null,
    eventSlot:event?.slot??null
  });
}

"""
    if anchor not in s:
        raise SystemExit("ERROR: publishTrade anchor disappeared after preflight")
    s=s.replace(anchor,block+anchor,1)

feed_prop="  publishTrade: typeof publishTrade==='function'?publishTrade:null,"
pre_prop="  preprocessTrade: typeof __mfPrepareTrackedCopyTrade==='function'?__mfPrepareTrackedCopyTrade:null,"
if pre_prop not in s:
    s=once(s,feed_prop,feed_prop+"\n"+pre_prop,"feed preprocessTrade wiring")

write(path,s)

# ================================================================
# pump-live-trade-feed.mjs
# ================================================================
path="memeflow-app/src/pump-live-trade-feed.mjs"
s=read(path)

if "MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2" not in s:
    s=once(
        s,
        """  const {
    eventHolderLedger,store,publish,publishTrade,evaluateAI,
    opportunityEngine,getSolUsd,onDead
  }=opts;""",
        """  const {
    eventHolderLedger,store,publish,publishTrade,preprocessTrade,evaluateAI,
    opportunityEngine,getSolUsd,onDead
  }=opts;""",
        "feed options"
    )

    s=once(
        s,
        """        // MEMEFLOW_FRESH_SESSION_SCANNER_V1
        const known=tokenFromStore(store,e.mint);
        if(!known){metrics.unknownMintEventsIgnored++;continue}

        const key=tradeEventKey(e,signature,i);
        if(!acceptTradeEventKey(key)){metrics.duplicateTradeEventsSkipped++;continue}

        metrics.lastTradeEventAt=Date.now();
        metrics.lastTradeEventSource=source;
        applyEvent({...e,signature:signature||null,slot});
        accepted++;""",
        """        /* MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2
         * Let an explicitly tracked wallet materialize its own previously
         * unknown Pump mint before the normal unknown-mint gate. The callback
         * is synchronous and never executes a trade itself, so this SAME
         * canonical TradeEvent still flows through applyEvent/publishTrade once.
         */
        const event={...e,signature:signature||null,slot};
        let known=tokenFromStore(store,e.mint);

        if(!known){
          try{preprocessTrade?.(event)}catch(err){
            metrics.lastError='copy-preprocess:'+String(err?.message||err);
          }
          known=tokenFromStore(store,e.mint);
        }

        if(!known){metrics.unknownMintEventsIgnored++;continue}

        const key=tradeEventKey(e,signature,i);
        if(!acceptTradeEventKey(key)){metrics.duplicateTradeEventsSkipped++;continue}

        metrics.lastTradeEventAt=Date.now();
        metrics.lastTradeEventSource=source;
        applyEvent(event);
        accepted++;""",
        "unknown-mint gate"
    )

write(path,s)

# ================================================================
# copy-trading.mjs
# ================================================================
path="memeflow-app/src/copy-trading.mjs"
s=read(path)

# Do not spend RPC on a tracked wallet SELL when none of the matching users
# actually has a position to mirror.
old="""    if(event.isBuy!==true){
      const wantsSell=matches.some(x=>x.settings.copyTradingMirrorSells!==false);
      if(wantsSell)sellInfo=await this.resolveSellInfo(wallet,mint,event);
    }"""
new="""    if(event.isBuy!==true){
      const wantsSell=matches.some(({user,settings})=>
        settings.copyTradingMirrorSells!==false &&
        Boolean(this.paper.openForMint?.(user?.id,mint))
      );
      if(wantsSell)sellInfo=await this.resolveSellInfo(wallet,mint,event);
    }"""
if "Boolean(this.paper.openForMint?.(user?.id,mint))" not in s:
    s=once(s,old,new,"SELL RPC demand gate")

if "entryReason:'COPY TRADING BUY'" not in s:
    s=once(
        s,
        """      primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`
    };""",
        """      primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`,
      entryReason:'COPY TRADING BUY',
      strategySource:'copy-trading',
      copyTradingWallet:settings.copyTradingWallet,
      copyTradingSource:'pump-trade-event'
    };""",
        "first BUY metadata"
    )

if "existing.copyTradingSource='pump-trade-event';" not in s:
    anchor="""      existing.strategySource='copy-trading';
      existing.copyTradingWallet=settings.copyTradingWallet;"""
    replacement=anchor+"\n      existing.copyTradingSource='pump-trade-event';"
    s=once(s,anchor,replacement,"scale-in source metadata")

write(path,s)

# ================================================================
# paper-engine.mjs
# ================================================================
path="memeflow-app/src/paper-engine.mjs"
s=read(path)

if "strategySource: decision?.strategySource || null" not in s:
    s=once(
        s,
        """      primaryReason: decision?.primaryReason || null,
      tp1Executed: false,""",
        """      primaryReason: decision?.primaryReason || null,
      strategySource: decision?.strategySource || null,
      copyTradingWallet: decision?.copyTradingWallet || null,
      copyTradingSource: decision?.copyTradingSource || null,
      tp1Executed: false,""",
        "position source metadata"
    )

if "decision?.entryReason || 'AUTOMATIC PAPER ENTRY'" not in s:
    s=once(
        s,
        "    this.recordTrade(position, 'BUY', quantity, price, 0, 'AUTOMATIC PAPER ENTRY');",
        "    this.recordTrade(position, 'BUY', quantity, price, 0, decision?.entryReason || 'AUTOMATIC PAPER ENTRY');",
        "first BUY reason"
    )

if "strategySource: position.strategySource || null" not in s:
    s=once(
        s,
        """      mode: 'paper',
      simulated: true,
      side,""",
        """      mode: 'paper',
      simulated: true,
      strategySource: position.strategySource || null,
      copyTradingWallet: position.copyTradingWallet || null,
      copyTradingSource: position.copyTradingSource || null,
      side,""",
        "trade source metadata"
    )

write(path,s)

# ================================================================
# trading.js
# ================================================================
path="memeflow-app/trading.js"
s=read(path)

# Preserve copy metadata when a position has to become a synthetic pinned candidate.
if "strategySource: position.strategySource || null" not in s.split("function positionAsCandidate(position)",1)[1].split("function mergedCandidates()",1)[0]:
    s=once(
        s,
        """    confidence: position.decisionConfidence ?? null,
    state: 'OPEN POSITION',
    __openPosition: position""",
        """    confidence: position.decisionConfidence ?? null,
    strategySource: position.strategySource || null,
    copyTradingWallet: position.copyTradingWallet || null,
    state: 'OPEN POSITION',
    __openPosition: position""",
        "positionAsCandidate metadata"
    )

# If scanner candidate already exists, merge the open position metadata into it.
old="""    const existing = byMint.get(position.mint);
    if (existing) {
      pinned.push(existing);
      byMint.delete(position.mint);
    } else {"""
new="""    const existing = byMint.get(position.mint);
    if (existing) {
      pinned.push({
        ...existing,
        strategySource: position.strategySource || existing.strategySource || null,
        copyTradingWallet: position.copyTradingWallet || existing.copyTradingWallet || null,
        __openPosition: position
      });
      byMint.delete(position.mint);
    } else {"""
if "strategySource: position.strategySource || existing.strategySource || null" not in s:
    s=once(s,old,new,"merged pinned candidate metadata")

# Candidate list badge.
old="""            <strong>${esc(item.symbol || item.name || short(item.mint))}</strong>"""
new="""            <strong>${esc(item.symbol || item.name || short(item.mint))}${String(item.strategySource || '').toLowerCase() === 'copy-trading' ? ' <em class="copy-trade-badge">COPY TRADE</em>' : ''}</strong>"""
if "item.strategySource || '').toLowerCase() === 'copy-trading'" not in s:
    s=once(s,old,new,"candidate COPY TRADE badge")

# Open positions badge.
if "const copyTrade = String(position.strategySource || '').toLowerCase() === 'copy-trading';" not in s:
    s=once(
        s,
        """  list.innerHTML = rows.map(position => {
    const pnl = num(position.unrealizedPnlPct, 0);
    const settings = position.settingsSnapshot || {};
    return `""",
        """  list.innerHTML = rows.map(position => {
    const pnl = num(position.unrealizedPnlPct, 0);
    const settings = position.settingsSnapshot || {};
    const copyTrade = String(position.strategySource || '').toLowerCase() === 'copy-trading';
    return `""",
        "position copy flag"
    )

if "${copyTrade ? ' <em class=\"copy-trade-badge\">COPY TRADE</em>' : ''}" not in s:
    s=once(
        s,
        """        <div><span>TOKEN</span><strong class="position-symbol">${esc(position.symbol || short(position.mint))}</strong></div>""",
        """        <div><span>TOKEN</span><strong class="position-symbol">${esc(position.symbol || short(position.mint))}${copyTrade ? ' <em class="copy-trade-badge">COPY TRADE</em>' : ''}</strong></div>""",
        "position badge"
    )

# Recent trades badge + real executedAt timestamp.
if "const copyTrade = String(trade.strategySource || '').toLowerCase() === 'copy-trading';" not in s:
    s=once(
        s,
        """    const side = String(trade.side || '').toUpperCase();
    const time = trade.at || trade.createdAt || trade.timestamp;
    const reason = trade.reason || trade.exitReason || 'ENGINE';
    return `""",
        """    const side = String(trade.side || '').toUpperCase();
    const time = trade.at || trade.createdAt || trade.timestamp || trade.executedAt;
    const reason = trade.reason || trade.exitReason || 'ENGINE';
    const copyTrade = String(trade.strategySource || '').toLowerCase() === 'copy-trading';
    return `""",
        "trade copy flag"
    )

old="""        <span>${esc(reason)}${time ? ` · ${new Date(time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</span>"""
new="""        <span>${copyTrade ? '<em class="copy-trade-badge">COPY TRADE</em> · ' : ''}${esc(reason)}${time ? ` · ${new Date(time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</span>"""
if """${copyTrade ? '<em class="copy-trade-badge">COPY TRADE</em> · ' : ''}${esc(reason)}""" not in s:
    s=once(s,old,new,"trade badge")

write(path,s)

# ================================================================
# trading.css
# ================================================================
path="memeflow-app/trading.css"
s=read(path)

if "MEMEFLOW_COPY_TRADE_BADGE_V2" not in s:
    s += """

/* ===== MEMEFLOW_COPY_TRADE_BADGE_V2 ===== */
.copy-trade-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 5px;
  padding: 2px 4px;
  border: 1px solid rgba(85, 217, 255, .18);
  border-radius: 5px;
  background: rgba(85, 217, 255, .045);
  color: #7fdff7;
  font-size: 5.5px;
  font-style: normal;
  font-weight: 800;
  letter-spacing: .06em;
  line-height: 1;
  vertical-align: middle;
}
.trade-row .copy-trade-badge {
  margin-left: 0;
  margin-right: 2px;
}
/* ===== /MEMEFLOW_COPY_TRADE_BADGE_V2 ===== */
"""

write(path,s)

# ================================================================
# trading.html cache bust while preserving prefixes expected elsewhere
# ================================================================
path="memeflow-app/trading.html"
s=read(path)

s,n=re.subn(
    r'href="/trading\.css\?v=buy-ready-yellow-v1[^"]*"',
    'href="/trading.css?v=buy-ready-yellow-v1-copy-trading-v2-1-20260826"',
    s,
    count=1
)
if n!=1:
    raise SystemExit(f"ERROR: trading.css cache tag match count = {n}")

s,n=re.subn(
    r'src="/trading\.js\?v=chart-match-panel-v3[^"]*"',
    'src="/trading.js?v=chart-match-panel-v3-copy-trading-v2-1-20260826"',
    s,
    count=1
)
if n!=1:
    raise SystemExit(f"ERROR: trading.js cache tag match count = {n}")

write(path,s)

# ================================================================
# ws-only test: update the exact CURRENT assertion.
# This is the V2 bug fix: use raw strings so \(...\) matches the source.
# ================================================================
path="memeflow-app/tests/ws-only-preopen-rpc-v1.mjs"
s=read(path)

if "MEMEFLOW_COPY_TRADING_RPC_TEST_V2" not in s:
    old = r"""// Generic legacy callers are deliberately wired to a fail-fast NO-NETWORK shim.
assert.match(app,/SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN/);
assert.match(app,/new CopyTradingManager\(\{store,paper,rpc:null\}\)/);"""

    new = r"""// Generic legacy callers remain fail-fast. Copy Trading is the only additional
// consumer of the existing protected pool, and its wrapper permits only exact
// tracked-wallet SELL reconciliation methods. Scanner transport stays WS-only.
// MEMEFLOW_COPY_TRADING_RPC_TEST_V2
assert.match(app,/SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN/);
assert.match(app,/new CopyTradingManager\(\{store,paper,rpc:__mfCopyTradingRpc\}\)/);
assert.match(app,/MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2/);
assert.match(app,/method!=='getTransaction'&&method!=='getTokenAccountsByOwner'/);"""

    s=once(s,old,new,"ws-only Copy Trading assertion")

write(path,s)

# ================================================================
# package.json
# ================================================================
path="memeflow-app/package.json"
s=read(path)

if "copy-trading-runtime-v2.mjs" not in s:
    s=once(
        s,
        '&& node tests/copy-trading.mjs"',
        '&& node tests/copy-trading.mjs && node tests/copy-trading-runtime-v2.mjs"',
        "npm test chain"
    )

write(path,s)
PY

echo "==> 3/10 Writing dedicated runtime regression test..."
cat > "$NEW_TEST" <<'EOF'
// MEMEFLOW_COPY_TRADING_RUNTIME_V2 regression test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PaperEngine} from '../src/paper-engine.mjs';
import {CopyTradingManager} from '../src/copy-trading.mjs';
import {defaultSettings} from '../src/settings.mjs';

const WALLET='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const MINT='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

let tick=Date.now();
const clock=()=>++tick;

const settings={
  ...defaultSettings(),
  operatingMode:'automate',
  tradingEnvironment:'paper',
  copyTradingEnabled:true,
  copyTradingWallet:WALLET,
  copyTradingBuyAmountSol:0.2,
  copyTradingMirrorSells:true,
  maxPositionSize:2,
  maxOpenPositions:10,
  maxDailyEntries:20,
  dailySpendLimit:10,
  tradingCapital:10
};

const store={
  state:{
    users:{u1:{id:'u1',killSwitch:false,settings}},
    paperPositions:{},
    paperTrades:{},
    paperProposals:{},
    paperProcessed:{},
    paperMetrics:{entries:0,exits:0,errors:0},
    copyTradingEvents:{},
    copyTradingMetrics:{
      matched:0,buys:0,sells:0,rejected:0,errors:0,lastEventAt:null
    }
  },
  save(){}
};

const paper=new PaperEngine(store,{clock});
let rpcCalls=0;

const rpc={
  async call(method){
    rpcCalls++;
    if(method==='getTransaction'){
      return {
        meta:{
          preTokenBalances:[
            {mint:MINT,owner:WALLET,uiTokenAmount:{amount:'1000000'}}
          ],
          postTokenBalances:[
            {mint:MINT,owner:WALLET,uiTokenAmount:{amount:'500000'}}
          ]
        }
      };
    }
    if(method==='getTokenAccountsByOwner')return {value:[]};
    throw new Error(`unexpected RPC method: ${method}`);
  }
};

const manager=new CopyTradingManager({
  store,paper,rpc,clock,logger:{warn(){}}
});

// BUY must enter the SAME shared PaperEngine used by ordinary paper trading.
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:true,
    solAmount:200000000n,
    tokenAmount:1000000n,
    signature:'copy-buy-1'
  },
  {
    mint:MINT,
    symbol:'TEST',
    name:'Test Token',
    priceSol:0.01,
    holderFresh:true,
    updatedAt:clock()
  }
);

const position=paper.openForMint('u1',MINT);
assert.ok(position,'copy BUY must create a shared PaperEngine position');
assert.equal(position.strategySource,'copy-trading');
assert.equal(position.copyTradingWallet,WALLET);
assert.equal(position.copyTradingSource,'pump-trade-event');

let trades=paper.userTrades('u1');
assert.equal(trades.length,1);
assert.equal(trades[0].side,'BUY');
assert.equal(trades[0].reason,'COPY TRADING BUY');
assert.equal(trades[0].strategySource,'copy-trading');
assert.equal(trades[0].copyTradingWallet,WALLET);

// A second BUY is a shared-position scale-in and keeps COPY metadata.
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:true,
    solAmount:200000000n,
    tokenAmount:500000n,
    signature:'copy-buy-2'
  },
  {
    mint:MINT,
    symbol:'TEST',
    name:'Test Token',
    priceSol:0.02,
    holderFresh:true,
    updatedAt:clock()
  }
);

assert.equal(position.initialSizeSol,0.4);
assert.equal(position.strategySource,'copy-trading');
assert.equal(position.copyTradingSource,'pump-trade-event');

const before=position.remainingTokenQuantity;

// Source transaction says pre=1,000,000, post=500,000 => source sold 50%.
// Our remaining copy position must also reduce by exactly 50%.
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:false,
    solAmount:100000000n,
    tokenAmount:500000n,
    signature:'copy-sell-1'
  },
  {
    mint:MINT,
    priceSol:0.03,
    holderFresh:true,
    updatedAt:clock()
  }
);

assert.ok(
  Math.abs(position.remainingTokenQuantity-(before*0.5))<1e-9,
  '50% tracked-wallet SELL must mirror 50% of our position'
);
assert.ok(rpcCalls>=1,'an owned mirrored SELL must reconcile source fraction');

trades=paper.userTrades('u1');
assert.equal(trades[0].side,'SELL');
assert.equal(trades[0].reason,'COPY TRADING SELL');
assert.equal(trades[0].strategySource,'copy-trading');

// SELL for another mint with NO copy position must NOT waste RPC.
const beforeNoPositionRpc=rpcCalls;
await manager.onTradeEvent(
  {
    user:WALLET,
    mint:'11111111111111111111111111111111',
    isBuy:false,
    solAmount:1n,
    tokenAmount:1n,
    signature:'irrelevant-sell'
  },
  {
    mint:'11111111111111111111111111111111',
    priceSol:0.01
  }
);
assert.equal(
  rpcCalls,
  beforeNoPositionRpc,
  'tracked SELL without our open position must not call RPC'
);

// Static integration guards for server/feed/UI wiring.
const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const feed=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const trading=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');

assert.equal(
  [...app.matchAll(/new RpcPool\s*\(/g)].length,
  1,
  'Copy Trading must not create a second RpcPool'
);
assert.match(app,/MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2/);
assert.match(app,/rpc:__mfCopyTradingRpc/);
assert.match(app,/MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2/);
assert.match(app,/copyTrading\.enabledUsers\(wallet\)/);
assert.match(app,/hasOpenCopyPosition/);
assert.match(app,/preprocessTrade: typeof __mfPrepareTrackedCopyTrade/);

assert.match(feed,/MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2/);
assert.match(feed,/preprocessTrade\?\.\(event\)/);
assert.match(feed,/known=tokenFromStore\(store,e\.mint\)/);

assert.match(trading,/COPY TRADE/);
assert.match(trading,/strategySource/);

console.log('copy trading runtime v2 regression passed');
EOF

echo "==> 4/10 Verifying final source invariants..."
python3 - <<'PY'
from pathlib import Path

app=Path("memeflow-app/app-server.mjs").read_text(encoding="utf-8")
feed=Path("memeflow-app/src/pump-live-trade-feed.mjs").read_text(encoding="utf-8")
copy=Path("memeflow-app/src/copy-trading.mjs").read_text(encoding="utf-8")
paper=Path("memeflow-app/src/paper-engine.mjs").read_text(encoding="utf-8")
trading=Path("memeflow-app/trading.js").read_text(encoding="utf-8")
html=Path("memeflow-app/trading.html").read_text(encoding="utf-8")
test=Path("memeflow-app/tests/ws-only-preopen-rpc-v1.mjs").read_text(encoding="utf-8")
pkg=Path("memeflow-app/package.json").read_text(encoding="utf-8")

checks=[
 ("one RpcPool only", app.count("new RpcPool(")==1),
 ("restricted SELL RPC wrapper", "MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2" in app),
 ("manager uses restricted RPC", "new CopyTradingManager({store,paper,rpc:__mfCopyTradingRpc})" in app),
 ("unknown tracked mint activation", "MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2" in app),
 ("unknown SELL requires open position", "hasOpenCopyPosition" in app),
 ("feed preprocess callback", "MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2" in feed),
 ("SELL only reconciles with open copy position", "Boolean(this.paper.openForMint?.(user?.id,mint))" in copy),
 ("first BUY labeled", "entryReason:'COPY TRADING BUY'" in copy),
 ("scale-in tagged", "existing.copyTradingSource='pump-trade-event';" in copy),
 ("position source metadata", "strategySource: decision?.strategySource || null" in paper),
 ("trade source metadata", "strategySource: position.strategySource || null" in paper),
 ("candidate COPY badge", "item.strategySource || '').toLowerCase() === 'copy-trading'" in trading),
 ("position/trade COPY badge", trading.count("COPY TRADE")>=3),
 ("ws-only test updated", "MEMEFLOW_COPY_TRADING_RPC_TEST_V2" in test),
 ("runtime regression in npm test", "copy-trading-runtime-v2.mjs" in pkg),
 ("JS cache bumped", "chart-match-panel-v3-copy-trading-v2-1-20260826" in html),
 ("CSS cache bumped", "buy-ready-yellow-v1-copy-trading-v2-1-20260826" in html),
]

bad=[name for name,ok in checks if not ok]
if bad:
    raise SystemExit("ERROR: invariant failure: "+", ".join(bad))

print("Invariant checks OK:")
for name,_ in checks:
    print(" -",name)
PY

echo "==> 5/10 Syntax checks..."
node --check "$APP_SERVER"
node --check "$FEED"
node --check "$COPY"
node --check "$PAPER"
node --check "$TRADING_JS"
node --check "$WS_TEST"
node --check "$NEW_TEST"

echo "==> 6/10 Focused architecture + Copy Trading tests..."
(
  cd "$APP"
  node tests/ws-only-preopen-rpc-v1.mjs
  node tests/copy-trading.mjs
  node tests/copy-trading-runtime-v2.mjs
)

echo "==> 7/10 COMPLETE npm test suite..."
(
  cd "$APP"
  npm test
)

echo "==> 8/10 Git validation..."
git diff --check -- "${FILES[@]}" "$NEW_TEST"

echo
echo "----- COPY TRADING V2.1 DIFF -----"
git diff -- \
  "$APP_SERVER" \
  "$FEED" \
  "$COPY" \
  "$PAPER" \
  "$TRADING_JS" \
  "$TRADING_CSS" \
  "$TRADING_HTML" \
  "$WS_TEST" \
  "$PACKAGE" \
  "$NEW_TEST"
echo "----- END DIFF -----"
echo

echo "==> 9/10 Commit..."
git add \
  "$APP_SERVER" \
  "$FEED" \
  "$COPY" \
  "$PAPER" \
  "$TRADING_JS" \
  "$TRADING_CSS" \
  "$TRADING_HTML" \
  "$WS_TEST" \
  "$PACKAGE" \
  "$NEW_TEST"

if git diff --cached --quiet; then
  echo "No new changes to commit; runtime V2.1 already appears installed."
else
  git commit -m "$COMMIT_MESSAGE"
fi

echo "==> 10/10 Push..."
git push origin HEAD

trap - EXIT
rm -rf "$BACKUP"

echo
echo "DONE."
echo "MEMEFLOW Copy Trading runtime V2.1 installed successfully."
echo "Full npm test suite passed."
echo "Commit/push completed."
echo
echo "Runtime behavior:"
echo "  BUY   -> shared PaperEngine / normal Open positions / normal Recent trades"
echo "  BUY+  -> scale-in same position"
echo "  SELL  -> exact proportional mirror via tracked-wallet transaction/balance"
echo "  UI    -> COPY TRADE marker in candidate, open-position and trade-history rows"
echo "  MINT  -> tracked unknown Pump BUY can enter the same canonical feed"
echo "  RPC   -> still exactly one RpcPool; scanner remains WebSocket-only"
echo
echo "LIVE signing/execution remains fail-closed until a verified signer adapter exists."
echo "Deploy/restart Replit and reload the Trading Terminal."
