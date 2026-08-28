#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW Copy Trading runtime V2"
COMMIT_MESSAGE="fix(copy-trading): complete sell mirroring and shared trade visibility"

APP="memeflow-app"
FILES=(
  "$APP/app-server.mjs"
  "$APP/src/pump-live-trade-feed.mjs"
  "$APP/src/copy-trading.mjs"
  "$APP/src/paper-engine.mjs"
  "$APP/trading.js"
  "$APP/trading.css"
  "$APP/trading.html"
  "$APP/tests/ws-only-preopen-rpc-v1.mjs"
  "$APP/package.json"
)
NEW_TEST="$APP/tests/copy-trading-runtime-v2.mjs"

die(){ echo "ERROR: $*" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this from inside the MEMEFLOW git repository."
cd "$ROOT"

echo "==> $PATCH_NAME"
echo "==> Repository: $ROOT"

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || die "Required file not found: $f"
done

# Never overwrite unrelated local work in the exact files this patch owns.
if ! git diff --quiet -- "${FILES[@]}" "$NEW_TEST" 2>/dev/null; then
  die "One or more patch target files have uncommitted changes. Commit/revert them first."
fi
if ! git diff --cached --quiet -- "${FILES[@]}" "$NEW_TEST" 2>/dev/null; then
  die "One or more patch target files already have staged changes. Commit/revert them first."
fi

BACKUP="$(mktemp -d)"
NEW_TEST_EXISTED=0
[[ -e "$NEW_TEST" ]] && NEW_TEST_EXISTED=1

restore_on_error(){
  code=$?
  if [[ $code -eq 0 ]]; then
    rm -rf "$BACKUP"
    return 0
  fi

  echo
  echo "[$PATCH_NAME] Failure detected; restoring only files touched by this patch..." >&2
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
  echo "[$PATCH_NAME] Restored. No commit/push was made." >&2
  exit "$code"
}
trap restore_on_error EXIT

for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done
if [[ -e "$NEW_TEST" ]]; then
  mkdir -p "$BACKUP/$(dirname "$NEW_TEST")"
  cp -p "$NEW_TEST" "$BACKUP/$NEW_TEST"
fi

echo "==> 1/9 Patching runtime wiring, SELL reconciliation, unknown-mint activation, shared tagging..."
python3 - <<'PY'
from pathlib import Path
import re

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------
# A) app-server.mjs
# ---------------------------------------------------------------------
path = "memeflow-app/app-server.mjs"
s = read(path)

rpc_marker = "/* MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2 */"
if rpc_marker not in s:
    old = "const copyTrading=new CopyTradingManager({store,paper,rpc:null});"
    new = r"""/* MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2
 * Copy Trading does NOT create a second RpcPool and does NOT put HTTP RPC back
 * into the scanner hot path. It reuses the existing protected RPC pool only
 * for exact tracked-wallet SELL reconciliation.
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
const copyTrading=new CopyTradingManager({store,paper,rpc:__mfCopyTradingRpc});"""
    s = replace_once(s, old, new, "app-server CopyTradingManager RPC wiring")

prepare_marker = "/* MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2 */"
if prepare_marker not in s:
    anchor = "function publishTrade(mint,event,tokenOverride=null){"
    if anchor not in s:
        raise SystemExit("ERROR: app-server publishTrade anchor not found")

    block = r"""/* MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2
 * A tracked Pump wallet may buy a mint that the normal scanner has not seen
 * yet. Activate ONLY such tracked mints before the feed's unknown-mint gate.
 * Untracked unknown mints keep the existing scanner behavior.
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
  if(!(Number.isFinite(priceSol)&&priceSol>0)){
    try{
      const sol=BigInt(event?.solAmount??0);
      const tok=BigInt(event?.tokenAmount??0);
      if(sol>0n&&tok>0n)priceSol=(Number(sol)/1e9)/(Number(tok)/1e6);
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
    s = s.replace(anchor, block + anchor, 1)

feed_prop = "  publishTrade: typeof publishTrade==='function'?publishTrade:null,"
if "preprocessTrade: typeof __mfPrepareTrackedCopyTrade" not in s:
    if feed_prop not in s:
        raise SystemExit("ERROR: startPumpLiveTradeFeed publishTrade property not found")
    s = s.replace(
        feed_prop,
        feed_prop + "\n  preprocessTrade: typeof __mfPrepareTrackedCopyTrade==='function'?__mfPrepareTrackedCopyTrade:null,",
        1
    )

write(path, s)

# ---------------------------------------------------------------------
# B) pump-live-trade-feed.mjs
# ---------------------------------------------------------------------
path = "memeflow-app/src/pump-live-trade-feed.mjs"
s = read(path)

if "MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2" not in s:
    old = """  const {
    eventHolderLedger,store,publish,publishTrade,evaluateAI,
    opportunityEngine,getSolUsd,onDead
  }=opts;"""
    new = """  const {
    eventHolderLedger,store,publish,publishTrade,preprocessTrade,evaluateAI,
    opportunityEngine,getSolUsd,onDead
  }=opts;"""
    s = replace_once(s, old, new, "feed option destructuring")

    old_block = """        // MEMEFLOW_FRESH_SESSION_SCANNER_V1
        const known=tokenFromStore(store,e.mint);
        if(!known){metrics.unknownMintEventsIgnored++;continue}

        const key=tradeEventKey(e,signature,i);
        if(!acceptTradeEventKey(key)){metrics.duplicateTradeEventsSkipped++;continue}

        metrics.lastTradeEventAt=Date.now();
        metrics.lastTradeEventSource=source;
        applyEvent({...e,signature:signature||null,slot});
        accepted++;"""

    new_block = """        /* MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2
         * Preserve the normal unknown-mint gate, except that a configured
         * tracked wallet gets one chance to activate its mint synchronously.
         * preprocessTrade never performs execution; it only materializes the
         * canonical token row so this SAME event continues through the normal
         * holder/market/publishTrade pipeline exactly once.
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
        accepted++;"""

    s = replace_once(s, old_block, new_block, "unknown-mint feed gate")

write(path, s)

# ---------------------------------------------------------------------
# C) copy-trading.mjs
# ---------------------------------------------------------------------
path = "memeflow-app/src/copy-trading.mjs"
s = read(path)

if "entryReason:'COPY TRADING BUY'" not in s:
    old = """    const decision={
      id:`copy:${settings.copyTradingWallet}:${event.mint}:${this.clock()}`,
      state:'BUY READY',score:null,confidence:null,
      primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`
    };"""
    new = """    const decision={
      id:`copy:${settings.copyTradingWallet}:${event.mint}:${this.clock()}`,
      state:'BUY READY',score:null,confidence:null,
      primaryReason:`Mirrored BUY from ${settings.copyTradingWallet}`,
      entryReason:'COPY TRADING BUY',
      strategySource:'copy-trading',
      copyTradingWallet:settings.copyTradingWallet,
      copyTradingSource:'pump-trade-event'
    };"""
    s = replace_once(s, old, new, "copy-trading first BUY metadata")

write(path, s)

# ---------------------------------------------------------------------
# D) paper-engine.mjs
# ---------------------------------------------------------------------
path = "memeflow-app/src/paper-engine.mjs"
s = read(path)

if "strategySource: decision?.strategySource || null" not in s:
    old = """      primaryReason: decision?.primaryReason || null,
      tp1Executed: false,"""
    new = """      primaryReason: decision?.primaryReason || null,
      strategySource: decision?.strategySource || null,
      copyTradingWallet: decision?.copyTradingWallet || null,
      copyTradingSource: decision?.copyTradingSource || null,
      tp1Executed: false,"""
    s = replace_once(s, old, new, "paper position source metadata")

if "decision?.entryReason || 'AUTOMATIC PAPER ENTRY'" not in s:
    old = "    this.recordTrade(position, 'BUY', quantity, price, 0, 'AUTOMATIC PAPER ENTRY');"
    new = "    this.recordTrade(position, 'BUY', quantity, price, 0, decision?.entryReason || 'AUTOMATIC PAPER ENTRY');"
    s = replace_once(s, old, new, "paper first BUY reason")

if "strategySource: position.strategySource || null" not in s:
    old = """      mode: 'paper',
      simulated: true,
      side,"""
    new = """      mode: 'paper',
      simulated: true,
      strategySource: position.strategySource || null,
      copyTradingWallet: position.copyTradingWallet || null,
      copyTradingSource: position.copyTradingSource || null,
      side,"""
    s = replace_once(s, old, new, "paper trade source metadata")

write(path, s)

# ---------------------------------------------------------------------
# E) trading.js
# ---------------------------------------------------------------------
path = "memeflow-app/trading.js"
s = read(path)

if "const copyTrade = String(position.strategySource || '').toLowerCase() === 'copy-trading';" not in s:
    old = """  list.innerHTML = rows.map(position => {
    const pnl = num(position.unrealizedPnlPct, 0);
    const settings = position.settingsSnapshot || {};
    return `"""
    new = """  list.innerHTML = rows.map(position => {
    const pnl = num(position.unrealizedPnlPct, 0);
    const settings = position.settingsSnapshot || {};
    const copyTrade = String(position.strategySource || '').toLowerCase() === 'copy-trading';
    return `"""
    s = replace_once(s, old, new, "position copy-trade flag")

if 'copy-trade-badge">COPY TRADE' not in s:
    old = """        <div><span>TOKEN</span><strong class="position-symbol">${esc(position.symbol || short(position.mint))}</strong></div>"""
    new = """        <div><span>TOKEN</span><strong class="position-symbol">${esc(position.symbol || short(position.mint))}${copyTrade ? ' <em class="copy-trade-badge">COPY TRADE</em>' : ''}</strong></div>"""
    s = replace_once(s, old, new, "position COPY TRADE badge")

if "const copyTrade = String(trade.strategySource || '').toLowerCase() === 'copy-trading';" not in s:
    old = """    const side = String(trade.side || '').toUpperCase();
    const time = trade.at || trade.createdAt || trade.timestamp;
    const reason = trade.reason || trade.exitReason || 'ENGINE';
    return `"""
    new = """    const side = String(trade.side || '').toUpperCase();
    const time = trade.at || trade.createdAt || trade.timestamp || trade.executedAt;
    const reason = trade.reason || trade.exitReason || 'ENGINE';
    const copyTrade = String(trade.strategySource || '').toLowerCase() === 'copy-trading';
    return `"""
    s = replace_once(s, old, new, "trade copy-trade flag")

if "copyTrade ? '<em class=\"copy-trade-badge\">COPY TRADE</em> · ' : ''" not in s:
    old = """        <span>${esc(reason)}${time ? ` · ${new Date(time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</span>"""
    new = """        <span>${copyTrade ? '<em class="copy-trade-badge">COPY TRADE</em> · ' : ''}${esc(reason)}${time ? ` · ${new Date(time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</span>"""
    s = replace_once(s, old, new, "trade COPY TRADE badge")

write(path, s)

# ---------------------------------------------------------------------
# F) trading.css
# ---------------------------------------------------------------------
path = "memeflow-app/trading.css"
s = read(path)
if "MEMEFLOW_COPY_TRADE_BADGE_V2" not in s:
    s += r"""

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
write(path, s)

# ---------------------------------------------------------------------
# G) trading.html cache busts, preserving existing prefixes
# ---------------------------------------------------------------------
path = "memeflow-app/trading.html"
s = read(path)

s, n1 = re.subn(
    r'href="/trading\.css\?v=buy-ready-yellow-v1[^"]*"',
    'href="/trading.css?v=buy-ready-yellow-v1-copy-trading-v2-20260826"',
    s,
    count=1
)
if n1 != 1:
    raise SystemExit(f"ERROR: trading.css cache tag expected 1 match, found {n1}")

s, n2 = re.subn(
    r'src="/trading\.js\?v=chart-match-panel-v3[^"]*"',
    'src="/trading.js?v=chart-match-panel-v3-copy-trading-v2-20260826"',
    s,
    count=1
)
if n2 != 1:
    raise SystemExit(f"ERROR: trading.js cache tag expected 1 match, found {n2}")

write(path, s)

# ---------------------------------------------------------------------
# H) ws-only architecture test: retain ONE RpcPool and scanner WS-only.
# ---------------------------------------------------------------------
path = "memeflow-app/tests/ws-only-preopen-rpc-v1.mjs"
s = read(path)

old = "assert.match(app,/new CopyTradingManager\\\\(\\\\{store,paper,rpc:null\\\\}\\\\)/);"
new = """// Copy Trading reuses the SAME protected RpcPool only for tracked-wallet
// SELL reconciliation. No second pool exists and the scanner feed remains WS-only.
assert.match(app,/new CopyTradingManager\\\\(\\\\{store,paper,rpc:__mfCopyTradingRpc\\\\}\\\\)/);
assert.match(app,/COPY_TRADING_RPC_RECONCILIATION_V2/);
assert.match(app,/method!==['"]getTransaction['"]&&method!==['"]getTokenAccountsByOwner['"]/);"""

if "COPY_TRADING_RPC_RECONCILIATION_V2" not in s:
    s = replace_once(s, old, new, "ws-only CopyTradingManager expectation")

write(path, s)

# ---------------------------------------------------------------------
# I) package.json - add runtime regression test
# ---------------------------------------------------------------------
path = "memeflow-app/package.json"
s = read(path)
if "copy-trading-runtime-v2.mjs" not in s:
    old = "&& node tests/copy-trading.mjs\""
    new = "&& node tests/copy-trading.mjs && node tests/copy-trading-runtime-v2.mjs\""
    s = replace_once(s, old, new, "package test chain")
write(path, s)

PY

echo "==> 2/9 Writing behavioral + runtime regression test..."
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
    copyTradingMetrics:{matched:0,buys:0,sells:0,rejected:0,errors:0,lastEventAt:null}
  },
  save(){}
};

const paper=new PaperEngine(store,{clock});

const rpc={
  async call(method){
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

const manager=new CopyTradingManager({store,paper,rpc,clock,logger:{warn(){}}});

await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:true,
    solAmount:200000000n,
    tokenAmount:1000000n,
    signature:'buy-sig'
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
assert.ok(position,'copy BUY must create the normal shared PaperEngine position');
assert.equal(position.strategySource,'copy-trading');
assert.equal(position.copyTradingWallet,WALLET);
assert.equal(position.copyTradingSource,'pump-trade-event');

let trades=paper.userTrades('u1');
assert.equal(trades.length,1);
assert.equal(trades[0].side,'BUY');
assert.equal(trades[0].reason,'COPY TRADING BUY');
assert.equal(trades[0].strategySource,'copy-trading');
assert.equal(trades[0].copyTradingWallet,WALLET);

const before=position.remainingTokenQuantity;

await manager.onTradeEvent(
  {
    user:WALLET,
    mint:MINT,
    isBuy:false,
    solAmount:100000000n,
    tokenAmount:500000n,
    signature:'sell-sig'
  },
  {
    mint:MINT,
    priceSol:0.012,
    holderFresh:true,
    updatedAt:clock()
  }
);

assert.ok(
  Math.abs(position.remainingTokenQuantity-(before*0.5))<1e-9,
  'tracked wallet 50% SELL must mirror 50% of our shared position'
);

trades=paper.userTrades('u1');
assert.equal(trades[0].side,'SELL');
assert.equal(trades[0].reason,'COPY TRADING SELL');
assert.equal(trades[0].strategySource,'copy-trading');

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const feed=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const trading=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2/);
assert.match(app,/rpc:__mfCopyTradingRpc/);
assert.match(app,/MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2/);
assert.match(app,/copyTrading\.enabledUsers\(wallet\)/);
assert.match(app,/store\.addToken\(\{/);
assert.match(app,/preprocessTrade: typeof __mfPrepareTrackedCopyTrade/);

assert.match(feed,/MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2/);
assert.match(feed,/preprocessTrade\?\.\(event\)/);
assert.match(feed,/known=tokenFromStore\(store,e\.mint\)/);

assert.match(trading,/COPY TRADE/);
assert.match(trading,/strategySource/);

console.log('copy trading runtime v2 passed');
EOF

echo "==> 3/9 Verifying source invariants..."
python3 - <<'PY'
from pathlib import Path

app=Path("memeflow-app/app-server.mjs").read_text()
feed=Path("memeflow-app/src/pump-live-trade-feed.mjs").read_text()
copy=Path("memeflow-app/src/copy-trading.mjs").read_text()
paper=Path("memeflow-app/src/paper-engine.mjs").read_text()
ui=Path("memeflow-app/trading.js").read_text()
html=Path("memeflow-app/trading.html").read_text()

checks = [
    ("exactly one RpcPool", app.count("new RpcPool(") == 1),
    ("copy RPC wrapper", "MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2" in app),
    ("copy manager gets restricted RPC", "new CopyTradingManager({store,paper,rpc:__mfCopyTradingRpc})" in app),
    ("unknown tracked mint activation", "MEMEFLOW_COPY_TRADING_UNKNOWN_MINT_ACTIVATION_V2" in app),
    ("feed preprocess callback", "MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2" in feed),
    ("first BUY reason", "entryReason:'COPY TRADING BUY'" in copy),
    ("position source tag", "strategySource: decision?.strategySource || null" in paper),
    ("trade source tag", "strategySource: position.strategySource || null" in paper),
    ("shared UI badge", "COPY TRADE" in ui),
    ("trading JS cache bust", "chart-match-panel-v3-copy-trading-v2-20260826" in html),
    ("trading CSS cache bust", "buy-ready-yellow-v1-copy-trading-v2-20260826" in html),
]

bad=[name for name,ok in checks if not ok]
if bad:
    raise SystemExit("ERROR: invariant check failed: " + ", ".join(bad))

print("OK:")
for name,_ in checks:
    print(" -", name)
PY

echo "==> 4/9 JavaScript / module syntax checks..."
node --check "$APP/app-server.mjs"
node --check "$APP/src/pump-live-trade-feed.mjs"
node --check "$APP/src/copy-trading.mjs"
node --check "$APP/src/paper-engine.mjs"
node --check "$APP/trading.js"
node --check "$NEW_TEST"

echo "==> 5/9 Running focused Copy Trading regression tests..."
(
  cd "$APP"
  node tests/copy-trading.mjs
  node tests/copy-trading-runtime-v2.mjs
)

echo "==> 6/9 Running the COMPLETE project test suite..."
(
  cd "$APP"
  npm test
)

echo "==> 7/9 Git diff validation..."
git diff --check -- "${FILES[@]}" "$NEW_TEST"

echo
echo "----- PATCH DIFF -----"
git diff -- \
  "$APP/app-server.mjs" \
  "$APP/src/pump-live-trade-feed.mjs" \
  "$APP/src/copy-trading.mjs" \
  "$APP/src/paper-engine.mjs" \
  "$APP/trading.js" \
  "$APP/trading.css" \
  "$APP/trading.html" \
  "$APP/tests/ws-only-preopen-rpc-v1.mjs" \
  "$APP/package.json" \
  "$NEW_TEST"
echo "----- END DIFF -----"
echo

echo "==> 8/9 Commit..."
git add \
  "$APP/app-server.mjs" \
  "$APP/src/pump-live-trade-feed.mjs" \
  "$APP/src/copy-trading.mjs" \
  "$APP/src/paper-engine.mjs" \
  "$APP/trading.js" \
  "$APP/trading.css" \
  "$APP/trading.html" \
  "$APP/tests/ws-only-preopen-rpc-v1.mjs" \
  "$APP/package.json" \
  "$NEW_TEST"

if git diff --cached --quiet; then
  echo "No new changes to commit (patch is already installed)."
else
  git commit -m "$COMMIT_MESSAGE"
fi

echo "==> 9/9 Push..."
git push origin HEAD

trap - EXIT
rm -rf "$BACKUP"

echo
echo "DONE."
echo "Copy Trading runtime V2 is installed, fully tested, committed and pushed."
echo
echo "Implemented:"
echo "  - BUY uses the normal shared PaperEngine position/trade stores."
echo "  - First BUY is labeled COPY TRADING BUY."
echo "  - Scale-in BUY remains COPY TRADING BUY."
echo "  - SELL fraction is reconciled from the tracked wallet transaction/balance."
echo "  - No second RpcPool was added; scanner feed remains WS-only."
echo "  - A tracked wallet's previously unknown Pump mint is activated before the unknown-mint gate."
echo "  - Copy positions/trades appear in the normal Trading Terminal with COPY TRADE labels."
echo "  - Full npm test suite passed before commit/push."
echo
echo "Deploy/restart Replit, then reload Trading Terminal once."
