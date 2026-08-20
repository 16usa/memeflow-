#!/usr/bin/env python3
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime

VERSION = "V30.6"
EXPECTED_BRANCH = "debug-trading-v30-4-2026-08-19-1734"
EXPECTED_HEAD = "d23810f6940b5452e2c7fc262acd8925a477a43b"

REPO = Path("/home/runner/workspace")
APP = REPO / "memeflow-app"

FEED = APP / "src" / "pump-live-trade-feed.mjs"
SERVER = APP / "app-server.mjs"
JS = APP / "trading.js"
HTML = APP / "trading.html"
TARGETS = [FEED, SERVER, JS, HTML]

def fail(message):
    print(f"[CHART-{VERSION}] ERROR: {message}")
    sys.exit(1)

def run(cmd, check=True):
    print(f"[CHART-{VERSION}] $", " ".join(map(str, cmd)))
    return subprocess.run(cmd, text=True, check=check)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, body, label):
    a = text.find(start)
    if a < 0:
        fail(f"{label}: start anchor not found")
    b = text.find(end, a + len(start))
    if b < 0:
        fail(f"{label}: end anchor not found")
    return text[:a] + body.rstrip() + "\n\n" + text[b:]

if not APP.is_dir():
    fail(f"project root not found: {APP}")

for path in TARGETS:
    if not path.is_file():
        fail(f"missing file: {path}")

branch = subprocess.check_output(
    ["git", "-C", str(REPO), "branch", "--show-current"],
    text=True,
).strip()
head = subprocess.check_output(
    ["git", "-C", str(REPO), "rev-parse", "HEAD"],
    text=True,
).strip()

print(f"[CHART-{VERSION}] branch: {branch}")
print(f"[CHART-{VERSION}] head: {head}")

if branch != EXPECTED_BRANCH:
    fail(f"wrong branch: expected {EXPECTED_BRANCH}, got {branch}")

if head != EXPECTED_HEAD:
    fail(f"wrong baseline: expected {EXPECTED_HEAD}, got {head}")

target_rel = [str(path.relative_to(REPO)) for path in TARGETS]
dirty = subprocess.check_output(
    ["git", "-C", str(REPO), "status", "--porcelain", "--", *target_rel],
    text=True,
).strip()

if dirty:
    print(dirty)
    fail("target files have uncommitted changes; refusing to stack over them")

feed0 = FEED.read_text()
server0 = SERVER.read_text()
js0 = JS.read_text()
html0 = HTML.read_text()

for label, needle, text in [
    ("feed V30.5", "MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_TICKS", feed0),
    ("server V30.5", "pump-trade-execution", server0),
    ("browser V30.5", "MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC", js0),
    ("html V30.5", "MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC", html0),
    ("Lightweight Charts 5.2.0", "lightweight-charts@5.2.0", html0),
]:
    if needle not in text:
        fail(f"{label}: expected marker not found")

backup = Path("/home/runner/memeflow-patch-backups") / (
    "trading-chart-v30-6-" + datetime.now().strftime("%Y%m%d-%H%M%S")
)
backup.mkdir(parents=True, exist_ok=False)

for path in TARGETS:
    rel = path.relative_to(APP)
    dst = backup / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)

print(f"[CHART-{VERSION}] backup: {backup}")

# ---------------------------------------------------------------------------
# 1) Pump chart price: remove V30.5 execution-average price.
# ---------------------------------------------------------------------------
feed = feed0

execution_helper = """function executionPriceFromEvent(e){
  // Pump base mints use 6 decimals; native SOL uses 9 decimals.
  // TradeEvent exposes the exchanged amounts separately from fees.
  const sol=Number(e?.solAmount)/1e9;
  const tokens=Number(e?.tokenAmount)/1e6;
  if(!(Number.isFinite(sol)&&sol>0&&Number.isFinite(tokens)&&tokens>0))return null;
  const price=sol/tokens;
  return Number.isFinite(price)&&price>0?price:null;
}
"""

feed = replace_once(
    feed,
    execution_helper,
    "",
    "remove execution-average helper",
)

old_chart_tick = """      // Chart is fed directly by the decoded TradeEvent and never by
      // holder/AI/polling publishes. The engine continues using m.priceSol
      // (bonding-curve mark); the chart uses the actual trade execution price.
      const executionPriceSol=executionPriceFromEvent(e);
      const chartPriceSol=
        Number.isFinite(executionPriceSol)&&executionPriceSol>0
          ? executionPriceSol
          : m.priceSol;

      if(Number.isFinite(chartPriceSol)&&chartPriceSol>0){
        try{
          onChartTick?.({
            id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
            mint:e.mint,
            t:eventAt,
            priceSol:chartPriceSol,
            executionPriceSol:Number.isFinite(executionPriceSol)?executionPriceSol:null,
            markPriceSol:Number.isFinite(m.priceSol)?m.priceSol:null,
            isBuy:e.isBuy===true,
            solAmount:Number(e.solAmount)/1e9,
            tokenAmount:Number(e.tokenAmount)/1e6,
            source:Number.isFinite(executionPriceSol)
              ? 'pump-trade-execution'
              : 'pump-reserve-mark-fallback'
          });
        }catch{}
      }"""

new_chart_tick = """      // One chart authority: canonical post-trade Pump curve mark.
      // AI, holder refreshes and candidate polling never create candle points.
      const chartPriceSol=m.priceSol;

      if(Number.isFinite(chartPriceSol)&&chartPriceSol>0){
        try{
          onChartTick?.({
            id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
            mint:e.mint,
            t:eventAt,
            priceSol:chartPriceSol,
            markPriceSol:chartPriceSol,
            isBuy:e.isBuy===true,
            solAmount:Number(e.solAmount)/1e9,
            tokenAmount:Number(e.tokenAmount)/1e6,
            source:'pump-curve-mark'
          });
        }catch{}
      }"""

feed = replace_once(
    feed,
    old_chart_tick,
    new_chart_tick,
    "canonical Pump curve chart source",
)

feed = feed.replace(
    "// MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_TICKS",
    "// MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_TICKS\n// MEMEFLOW_TRADING_CHART_V30_6_CURVE_MARK",
    1,
)

# ---------------------------------------------------------------------------
# 2) Server: cache SOL/USD outside the trade-event hot path.
# ---------------------------------------------------------------------------
server = server0

gap_anchor = """const __MF_CHART_MIN_GAP_MS=Math.max(
  100,
  Math.min(1000,Number(process.env.CHART_HISTORY_MIN_GAP_MS||500))
);
"""

usd_cache = """const __MF_CHART_MIN_GAP_MS=Math.max(
  100,
  Math.min(1000,Number(process.env.CHART_HISTORY_MIN_GAP_MS||500))
);

// MEMEFLOW_TRADING_CHART_V30_6_SOL_USD_CACHE
const __MF_WSOL_MINT='So11111111111111111111111111111111111111112';
const __MF_SOL_USD_REFRESH_MS=15_000;
const __mfSolUsd={
  price:null,
  updatedAt:0,
  pair:null,
  error:null,
  inFlight:null
};

function __mfValidSolUsd(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>5&&n<5000?n:null;
}

function __mfSolUsdNow(){
  return __mfValidSolUsd(__mfSolUsd.price);
}

async function __mfRefreshSolUsd(force=false){
  const now=Date.now();
  const cached=__mfSolUsdNow();

  if(
    !force &&
    cached &&
    now-Number(__mfSolUsd.updatedAt||0)<__MF_SOL_USD_REFRESH_MS
  ){
    return cached;
  }

  if(__mfSolUsd.inFlight){
    return __mfSolUsd.inFlight;
  }

  const task=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),4000);

    try{
      const response=await fetch(
        `https://api.dexscreener.com/token-pairs/v1/solana/${__MF_WSOL_MINT}`,
        {
          headers:{
            accept:'application/json',
            'user-agent':'MEMEFLOW/1.0'
          },
          signal:controller.signal
        }
      );

      if(!response.ok){
        throw new Error(`DEX Screener SOL/USD HTTP ${response.status}`);
      }

      const body=await response.json();
      const rows=Array.isArray(body)?body:[];

      const direct=rows
        .filter(row=>
          row?.chainId==='solana' &&
          row?.baseToken?.address===__MF_WSOL_MINT &&
          __mfValidSolUsd(row?.priceUsd)
        )
        .sort(
          (a,b)=>
            Number(b?.liquidity?.usd||0)-
            Number(a?.liquidity?.usd||0)
        );

      let price=direct.length
        ? __mfValidSolUsd(direct[0]?.priceUsd)
        : null;
      let pair=direct[0]?.pairAddress||null;

      if(!price){
        const inverse=rows
          .map(row=>{
            if(
              row?.chainId!=='solana' ||
              row?.quoteToken?.address!==__MF_WSOL_MINT
            )return null;

            const baseUsd=Number(row?.priceUsd);
            const baseInSol=Number(row?.priceNative);
            const inferred=
              Number.isFinite(baseUsd)&&baseUsd>0&&
              Number.isFinite(baseInSol)&&baseInSol>0
                ? baseUsd/baseInSol
                : null;

            const px=__mfValidSolUsd(inferred);
            if(!px)return null;

            return {
              price:px,
              pair:row?.pairAddress||null,
              liquidity:Number(row?.liquidity?.usd||0)
            };
          })
          .filter(Boolean)
          .sort((a,b)=>b.liquidity-a.liquidity);

        if(inverse.length){
          price=inverse[0].price;
          pair=inverse[0].pair;
        }
      }

      if(!price){
        throw new Error('DEX Screener returned no usable SOL/USD pool');
      }

      __mfSolUsd.price=price;
      __mfSolUsd.updatedAt=Date.now();
      __mfSolUsd.pair=pair;
      __mfSolUsd.error=null;
      return price;
    }catch(error){
      __mfSolUsd.error=String(error?.message||error);
      return __mfSolUsdNow();
    }finally{
      clearTimeout(timeout);
    }
  })();

  __mfSolUsd.inFlight=task;

  try{
    return await task;
  }finally{
    if(__mfSolUsd.inFlight===task){
      __mfSolUsd.inFlight=null;
    }
  }
}

__mfRefreshSolUsd(true).catch(()=>{});

const __mfSolUsdTimer=setInterval(
  ()=>__mfRefreshSolUsd(true).catch(()=>{}),
  __MF_SOL_USD_REFRESH_MS
);
__mfSolUsdTimer.unref?.();
"""

server = replace_once(
    server,
    gap_anchor,
    usd_cache,
    "SOL/USD cache",
)

# Active/open chart mints are protected from the global 80-mint LRU eviction.
old_eviction = """  if(__mfChartHistory.size>__MF_CHART_MAX_MINTS){
    const old=[...__mfChartHistory.values()]
      .sort(
        (a,b)=>
          Number(a.lastSeenAt||0)-
          Number(b.lastSeenAt||0)
      )
      .slice(
        0,
        __mfChartHistory.size-__MF_CHART_MAX_MINTS
      );

    for(const item of old){
      __mfChartHistory.delete(item.mint);
    }
  }"""

new_eviction = """  if(__mfChartHistory.size>__MF_CHART_MAX_MINTS){
    const removeCount=
      __mfChartHistory.size-__MF_CHART_MAX_MINTS;

    const old=[...__mfChartHistory.values()]
      .filter(item=>!(streams.get(item.mint)?.size))
      .sort(
        (a,b)=>
          Number(a.lastSeenAt||0)-
          Number(b.lastSeenAt||0)
      )
      .slice(0,removeCount);

    for(const item of old){
      __mfChartHistory.delete(item.mint);
    }
  }"""

server = replace_once(
    server,
    old_eviction,
    new_eviction,
    "pin active chart history",
)

server = replace_once(
    server,
    "  const lastSource=points[points.length-1]?.source||'pump-trade-execution';",
    "  const lastSource=points[points.length-1]?.source||'pump-curve-mark';",
    "snapshot source",
)

server = replace_once(
    server,
    "      executionPriceTicks:lastSource==='pump-trade-execution'",
    "      executionPriceTicks:false,\n      canonicalCurveMark:true,\n      currency:'SOL'",
    "snapshot chart semantics",
)

server = replace_once(
    server,
    "  const source=tick?.source||'pump-trade-execution';",
    "  const source=tick?.source||'pump-curve-mark';",
    "tick source",
)

server = replace_once(
    server,
    "        executionPriceTicks:source==='pump-trade-execution'",
    "        executionPriceTicks:false,\n        canonicalCurveMark:true,\n        currency:'SOL'",
    "tick chart semantics",
)

route_anchor = " // Static files — served before session creation to avoid blocking store.save() on new users"

usd_route = """ if(url.pathname==='/api/market/sol-usd'&&req.method==='GET'){
  const tooOld=
    !__mfSolUsdNow() ||
    Date.now()-Number(__mfSolUsd.updatedAt||0)>(__MF_SOL_USD_REFRESH_MS*2);

  if(tooOld){
    await __mfRefreshSolUsd(true).catch(()=>{});
  }

  const priceUsd=__mfSolUsdNow();

  return json(
    res,
    priceUsd?200:503,
    {
      ok:Boolean(priceUsd),
      symbol:'SOL',
      currency:'USD',
      priceUsd,
      source:'dexscreener',
      pair:__mfSolUsd.pair,
      updatedAt:__mfSolUsd.updatedAt||null,
      stale:
        !priceUsd ||
        Date.now()-Number(__mfSolUsd.updatedAt||0)>120_000,
      error:priceUsd?null:__mfSolUsd.error
    }
  );
 }
"""

server = replace_once(
    server,
    route_anchor,
    usd_route + route_anchor,
    "SOL/USD route",
)

# ---------------------------------------------------------------------------
# 3) Trading browser: USD display; engine settings remain SOL internally.
# ---------------------------------------------------------------------------
js = js0

js = replace_once(
    js,
    "  unit: 'SOL',\n  timeframe: 1000,",
    "  unit: 'USD',\n  solUsd: null,\n  solUsdUpdatedAt: null,\n  timeframe: 1000,",
    "USD default state",
)

implied_block = """function impliedSolUsd(candidate) {
  const mcUsd = num(candidate?.marketCapUsd);
  const mcSol = num(candidate?.marketCapSol ?? candidate?.marketCap);
  if (mcUsd > 0 && mcSol > 0) return mcUsd / mcSol;

  const liqUsd = num(candidate?.liquidityUsd);
  const liqSol = num(candidate?.liquiditySol ?? candidate?.liquidity);
  if (liqUsd > 0 && liqSol > 0) return liqUsd / liqSol;

  return null;
}
"""

usd_helpers = implied_block + """
function solUsdRate(candidate = state.selected) {
  const live = num(state.solUsd);
  if (live > 0) return live;

  const direct = impliedSolUsd(candidate);
  if (direct > 0) return direct;

  for (const row of state.candidates || []) {
    const inferred = impliedSolUsd(row);
    if (inferred > 0) return inferred;
  }

  return null;
}

function usdFromSol(value, candidate = state.selected) {
  const sol = num(value);
  const rate = solUsdRate(candidate);
  return sol !== null && rate > 0 ? sol * rate : null;
}

async function loadSolUsd() {
  const payload = await api('/api/market/sol-usd');
  const next = num(payload?.priceUsd);

  if (!(next > 0)) {
    throw new Error('SOL/USD rate is unavailable.');
  }

  const previous = num(state.solUsd);
  state.solUsd = next;
  state.solUsdUpdatedAt = payload?.updatedAt || Date.now();

  if (!previous || Math.abs(next / previous - 1) >= 0.0001) {
    chartRuntime.dataKey = '';
    chartRuntime.forceFit = true;
    renderCandidates();
    renderSelected();
    updateAmountHint();
    scheduleChart();
  }

  return next;
}
"""

js = replace_once(
    js,
    implied_block,
    usd_helpers,
    "USD helpers",
)

old_amount_sol = """function amountSol() {
  const amount = num($('amountInput').value, 0);
  if (!(amount > 0)) throw new Error('Position amount must be greater than 0.');
  if (state.unit === 'SOL') return amount;

  const rate = impliedSolUsd(state.selected);
  if (!(rate > 0)) {
    throw new Error('USD → SOL conversion is unavailable until a selected candidate has both SOL and USD market data.');
  }
  return amount / rate;
}"""

new_amount_sol = """function amountSol() {
  const amount = num($('amountInput').value, 0);
  if (!(amount > 0)) throw new Error('Position amount must be greater than 0.');
  if (state.unit === 'SOL') return amount;

  const rate = solUsdRate();
  if (!(rate > 0)) {
    throw new Error('USD → SOL conversion is temporarily unavailable.');
  }
  return amount / rate;
}"""

js = replace_once(
    js,
    old_amount_sol,
    new_amount_sol,
    "position amount conversion",
)

js = replace_once(
    js,
    "  const rate = impliedSolUsd(state.selected);\n\n  if (state.unit === 'USD') {",
    "  const rate = solUsdRate();\n\n  if (state.unit === 'USD') {",
    "amount hint conversion source",
)

js = replace_once(
    js,
    "  $('amountInput').value = finite(s.positionSize) ? s.positionSize : 0.1;",
    """  const positionSol = finite(s.positionSize) ? Number(s.positionSize) : 0.1;
  const rate = solUsdRate();
  $('amountInput').value =
    state.unit === 'USD' && rate > 0
      ? (positionSol * rate).toFixed(2)
      : positionSol;""",
    "populate USD position amount",
)

old_candidate_price = """          <span class="candidate-price">${price ? `${fmt(price, 9)} SOL` : 'Price —'}</span>"""
new_candidate_price = """          <span class="candidate-price">${price ? formatPrice(usdFromSol(price, item)) : '$—'}</span>"""

js = replace_once(
    js,
    old_candidate_price,
    new_candidate_price,
    "candidate USD price",
)

old_selected = """  const price = candidatePrice(c);
  $('tokenPrice').textContent = price > 0 ? `${fmt(price, 10)} SOL` : '— SOL';
  $('tokenMarket').textContent = `MC ${finite(c.marketCapUsd) ? '$' + fmt(c.marketCapUsd, 0) : fmt(c.marketCapSol ?? c.marketCap, 1) + ' SOL'} · BP ${fmt(c.buyPressure, 2)}×`;"""

new_selected = """  const price = candidatePrice(c);
  const priceUsd = usdFromSol(price, c);
  const marketCapUsd =
    num(c.marketCapUsd) ??
    usdFromSol(c.marketCapSol ?? c.marketCap, c);

  $('tokenPrice').textContent =
    priceUsd > 0 ? formatPrice(priceUsd) : '$—';

  $('tokenMarket').textContent =
    `MC ${marketCapUsd > 0 ? '$' + fmt(marketCapUsd, 0) : '—'} · BP ${fmt(c.buyPressure, 2)}×`;"""

js = replace_once(
    js,
    old_selected,
    new_selected,
    "selected USD price",
)

old_liquidity = """  $('metricLiquidity').textContent = finite(c.liquidityUsd) ? `$${fmt(c.liquidityUsd, 0)}` : `${fmt(c.liquiditySol ?? c.liquidity, 2)} SOL`;"""
new_liquidity = """  const liquidityUsd =
    num(c.liquidityUsd) ??
    usdFromSol(c.liquiditySol ?? c.liquidity, c);
  $('metricLiquidity').textContent =
    liquidityUsd !== null ? `$${fmt(liquidityUsd, 0)}` : '—';"""

js = replace_once(
    js,
    old_liquidity,
    new_liquidity,
    "selected USD liquidity",
)

new_normalizer = """function normalizeChartPoint(point){
  const priceSol =
    finite(point?.priceSol)
      ? Number(point.priceSol)
      : finite(point?.markPrice)
        ? Number(point.markPrice)
        : finite(point?.price)
          ? Number(point.price)
          : null;

  const rate =
    finite(point?.solUsd)
      ? Number(point.solUsd)
      : solUsdRate();

  const priceUsd =
    priceSol > 0 && rate > 0
      ? priceSol * rate
      : null;

  if(
    !finite(point?.t) ||
    !(priceUsd > 0)
  ){
    return null;
  }

  return {
    id:point?.id?String(point.id):null,
    t:Number(point.t),
    price:Number(priceUsd),
    priceSol,
    solUsd:rate,
    source:point?.source||null,
    isBuy:point?.isBuy===true,
    solAmount:num(point?.solAmount,0),
    tokenAmount:num(point?.tokenAmount,0),
    markPrice:priceSol
  };
}"""

js = replace_between(
    js,
    "function normalizeChartPoint(point){",
    "function replaceChartSnapshot(",
    new_normalizer,
    "chart USD normalization",
)

new_strategy = """function strategyLevels() {
  if (!state.selectedMint) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const position = state.positions.find(
    p => p.status === 'OPEN' && p.mint === state.selectedMint
  );

  const entrySol = num(
    position?.entryPriceSol,
    candidatePrice(state.selected)
  );

  if (!(entrySol > 0)) return [];

  const entry = entrySol * rate;
  const hard = num($('hardStopPct').value, state.settings?.hardStopPct);
  const tp1 = num($('tp1Pct').value, state.settings?.tp1Pct);
  const tp2 = num($('tp2Pct').value, state.settings?.tp2Pct);
  const tp1Sell = num($('tp1SellPct').value, state.settings?.tp1SellPct);
  const tp2Sell = num($('tp2SellPct').value, state.settings?.tp2SellPct);

  return [
    { label: 'ENTRY', price: entry, kind: 'entry' },
    hard > 0
      ? { label: `SL -${fmt(hard, 1)}%`, price: entry * (1 - hard / 100), kind: 'stop' }
      : null,
    tp1 > 0
      ? { label: `TP1 +${fmt(tp1, 0)}% · SELL ${fmt(tp1Sell, 0)}%`, price: entry * (1 + tp1 / 100), kind: 'tp' }
      : null,
    tp2 > 0
      ? { label: `TP2 +${fmt(tp2, 0)}% · SELL ${fmt(tp2Sell, 0)}%`, price: entry * (1 + tp2 / 100), kind: 'tp2' }
      : null
  ].filter(Boolean);
}"""

js = replace_between(
    js,
    "function strategyLevels() {",
    "const chartRuntime={",
    new_strategy,
    "USD strategy levels",
)

new_formatter = """function formatPrice(price) {
  if (!finite(price)) return '$—';

  const p = Number(price);
  if (!(p >= 0)) return '$—';

  let body;

  if (p >= 1000) {
    body = p.toLocaleString(
      undefined,
      {maximumFractionDigits:2}
    );
  } else if (p >= 1) {
    body = p.toFixed(4);
  } else if (p >= .01) {
    body = p.toFixed(6);
  } else if (p >= .0001) {
    body = p.toFixed(8);
  } else if (p === 0) {
    body = '0';
  } else {
    const magnitude =
      Math.floor(Math.log10(Math.abs(p)));

    const decimals =
      Math.max(
        8,
        Math.min(
          14,
          -magnitude + 4
        )
      );

    body = p
      .toFixed(decimals)
      .replace(/0+$/,'')
      .replace(/\\.$/,'');
  }

  return `$${body}`;
}"""

js = replace_between(
    js,
    "function formatPrice(price) {",
    "async function loadPaper() {",
    new_formatter,
    "USD price formatter",
)

old_unit_toggle = """  document.querySelectorAll('#unitToggle button').forEach(button => {
    button.addEventListener('click', () => {
      state.unit = button.dataset.unit;
      document.querySelectorAll('#unitToggle button').forEach(b => b.classList.toggle('active', b === button));
      updateAmountHint();
    });
  });"""

new_unit_toggle = """  document.querySelectorAll('#unitToggle button').forEach(button => {
    button.addEventListener('click', () => {
      const nextUnit = button.dataset.unit;
      if (nextUnit === state.unit) return;

      const rate = solUsdRate();
      const value = num($('amountInput').value, 0);

      if (!(rate > 0)) {
        showError('SOL/USD conversion is temporarily unavailable.');
        return;
      }

      if (state.unit === 'SOL' && nextUnit === 'USD') {
        $('amountInput').value = (value * rate).toFixed(2);
      } else if (state.unit === 'USD' && nextUnit === 'SOL') {
        $('amountInput').value = (value / rate).toFixed(5);
      }

      state.unit = nextUnit;

      document
        .querySelectorAll('#unitToggle button')
        .forEach(
          b => b.classList.toggle(
            'active',
            b.dataset.unit === state.unit
          )
        );

      updateAmountHint();
    });
  });"""

js = replace_once(
    js,
    old_unit_toggle,
    new_unit_toggle,
    "numeric unit toggle",
)

realtime_legend = """  renderLegend(
    last,
    chartRuntime.candleCount||1,
    points.length,
    chartRuntime.offscreenLevels||[]
  );"""

js = replace_once(
    js,
    realtime_legend,
    realtime_legend + """

  if(mint===state.selectedMint){
    $('tokenPrice').textContent=formatPrice(last.close);
  }""",
    "live USD headline",
)

draw_legend = """  renderLegend(
    last,
    candles.length,
    totalTicks,
    offscreen
  );"""

js = replace_once(
    js,
    draw_legend,
    draw_legend + """

  $('tokenPrice').textContent=formatPrice(last.close);""",
    "snapshot USD headline",
)

old_init = """async function init() {
  bind();
  try {
    await loadSettings();
  } catch (error) {
    showError(`Settings: ${error.message}`);
  }

  await poll();
  setInterval(poll, 1800);
  scheduleChart();
}"""

new_init = """async function init() {
  bind();

  try {
    await loadSolUsd();
  } catch (error) {
    console.warn('[MEMEFLOW USD]', error);
  }

  try {
    await loadSettings();
  } catch (error) {
    showError(`Settings: ${error.message}`);
  }

  await poll();
  setInterval(poll, 1800);

  setInterval(
    () => loadSolUsd().catch(
      error => console.warn('[MEMEFLOW USD]', error)
    ),
    15_000
  );

  scheduleChart();
}"""

js = replace_once(
    js,
    old_init,
    new_init,
    "USD init",
)

js = js.replace(
    "/* MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC */",
    "/* MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC */\n/* MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK */",
    1,
)

# ---------------------------------------------------------------------------
# 4) HTML USD defaults/cache bust.
# ---------------------------------------------------------------------------
html = html0

html = replace_once(
    html,
    '<link rel="stylesheet" href="/trading.css?v=v305">',
    '<link rel="stylesheet" href="/trading.css?v=v306">',
    "CSS cache bust",
)

html = replace_once(
    html,
    '<div id="tokenPrice" class="token-price">— SOL</div>',
    '<div id="tokenPrice" class="token-price">$—</div>',
    "USD token placeholder",
)

html = replace_once(
    html,
    """              <button data-unit="SOL" class="active" type="button">SOL</button>
              <button data-unit="USD" type="button">USD</button>""",
    """              <button data-unit="SOL" type="button">SOL</button>
              <button data-unit="USD" class="active" type="button">USD</button>""",
    "USD default toggle",
)

html = replace_once(
    html,
    '<input id="amountInput" inputmode="decimal" type="number" min="0" step="0.01" value="0.10">',
    '<input id="amountInput" inputmode="decimal" type="number" min="0" step="0.01" value="10.00">',
    "USD amount placeholder",
)

html = replace_once(
    html,
    '<span>Select a token. Candles build from the existing Solana price stream.</span>',
    '<span>Select a token. USD candles build from the canonical Pump curve price.</span>',
    "chart empty copy",
)

html = replace_once(
    html,
    '<script type="module" src="/trading.js?v=v305"></script>',
    '<script type="module" src="/trading.js?v=v306"></script>',
    "JS cache bust",
)

html = html.replace(
    "<!-- MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC -->",
    "<!-- MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC -->\n  <!-- MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK -->",
    1,
)

# Write only after all anchors succeed.
FEED.write_text(feed)
SERVER.write_text(server)
JS.write_text(js)
HTML.write_text(html)

print(f"[CHART-{VERSION}] files patched")

for path in (FEED, SERVER, JS):
    run(["node", "--check", str(path)])

run(["git", "-C", str(REPO), "diff", "--check"])

checks = {
    "TradingView 5.2.0 preserved":
        "lightweight-charts@5.2.0" in html and "CandlestickSeries" in js,
    "execution-average removed":
        "executionPriceFromEvent" not in feed and "const chartPriceSol=m.priceSol;" in feed,
    "engine mark untouched":
        "patch.priceSol=m.priceSol" in feed,
    "canonical chart source":
        "source:'pump-curve-mark'" in feed,
    "SOL/USD cache":
        "MEMEFLOW_TRADING_CHART_V30_6_SOL_USD_CACHE" in server and
        "__MF_SOL_USD_REFRESH_MS=15_000" in server and
        "/api/market/sol-usd" in server,
    "active chart history pinned":
        ".filter(item=>!(streams.get(item.mint)?.size))" in server,
    "USD chart normalization":
        "priceSol * rate" in js and
        "MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK" in js,
    "USD strategy lines":
        "const entry = entrySol * rate;" in js,
    "USD price formatter":
        "return `$${body}`;" in js,
    "numeric SOL/USD amount toggle":
        "value * rate" in js and "value / rate" in js,
    "USD HTML default":
        '<div id="tokenPrice" class="token-price">$—</div>' in html and
        'data-unit="USD" class="active"' in html,
    "V30.6 cache bust":
        "trading.js?v=v306" in html and "trading.css?v=v306" in html,
}

for label, ok in checks.items():
    print(f"[CHART-{VERSION}] {'OK' if ok else 'FAIL'} {label}")
    if not ok:
        fail(f"post-flight failed: {label}")

run(["git", "-C", str(REPO), "add", "--", *target_rel])
run(["git", "-C", str(REPO), "diff", "--cached", "--check"])

staged = subprocess.run(
    ["git", "-C", str(REPO), "diff", "--cached", "--quiet"],
    check=False,
).returncode

if staged != 1:
    fail("no staged V30.6 diff found")

run([
    "git", "-C", str(REPO), "commit",
    "-m", "Trading chart V30.6 USD canonical curve candles",
])

run([
    "git", "-C", str(REPO), "push",
    "-u", "origin", branch,
])

print()
print(f"[CHART-{VERSION}] INSTALL + CHECK + COMMIT + PUSH COMPLETE")
print(f"[CHART-{VERSION}] branch: {branch}")
print(f"[CHART-{VERSION}] backup: {backup}")
print(f"[CHART-{VERSION}] restart the Replit workflow/app")
print(f"[CHART-{VERSION}] hard-refresh Trading Terminal")
print(f"[CHART-{VERSION}] chart display: USD")
print(f"[CHART-{VERSION}] chart source: canonical Pump curve mark")
print(f"[CHART-{VERSION}] no fake historical candles are synthesized")
