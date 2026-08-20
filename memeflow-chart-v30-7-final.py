from pathlib import Path
import re, shutil, subprocess, sys, time

ROOTS = [
    Path('/home/runner/workspace/memeflow-app'),
    Path.home() / 'workspace' / 'memeflow-app',
    Path.cwd() / 'memeflow-app',
]
root = next((p for p in ROOTS if (p / 'trading.js').exists()), None)
if not root:
    raise SystemExit('[CHART-V30.7] ERROR: memeflow-app not found')
repo = root.parent

def run(*args, check=True):
    p = subprocess.run(args, cwd=repo, text=True, capture_output=True)
    if p.stdout.strip(): print(p.stdout.rstrip())
    if p.stderr.strip(): print(p.stderr.rstrip())
    if check and p.returncode:
        raise SystemExit(f'[CHART-V30.7] ERROR: command failed: {" ".join(args)}')
    return p

branch = run('git','branch','--show-current').stdout.strip()
head = run('git','rev-parse','HEAD').stdout.strip()
print(f'[CHART-V30.7] branch: {branch}')
print(f'[CHART-V30.7] head:   {head}')

EXPECTED_BRANCH = 'debug-trading-v30-4-2026-08-19-1734'
EXPECTED_HEAD = 'a63997c7d651398ca159e81334b97883f3450df2'

if branch != EXPECTED_BRANCH:
    raise SystemExit(
        f'[CHART-V30.7] ERROR: wrong branch: {branch}. '
        f'Expected {EXPECTED_BRANCH}. Nothing changed.'
    )

if head != EXPECTED_HEAD:
    raise SystemExit(
        f'[CHART-V30.7] ERROR: repository HEAD changed: {head}. '
        f'Expected verified V30.6 HEAD {EXPECTED_HEAD}. '
        'Nothing changed; push the fresh state and let the patch be re-verified first.'
    )

files = [
    root/'trading.js',
    root/'app-server.mjs',
    root/'src'/'pump-live-trade-feed.mjs',
]
for f in files:
    rel = f.relative_to(repo)
    p = subprocess.run(['git','diff','--quiet','--',str(rel)], cwd=repo)
    if p.returncode != 0:
        raise SystemExit(f'[CHART-V30.7] ERROR: target file has local changes: {rel}. Commit/push fresh state first.')

trading = (root/'trading.js').read_text()
server = (root/'app-server.mjs').read_text()
feed = (root/'src'/'pump-live-trade-feed.mjs').read_text()

if 'MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK' not in trading:
    raise SystemExit('[CHART-V30.7] ERROR: expected V30.6 trading.js marker not found')
if 'MEMEFLOW_TRADING_CHART_V30_6_SOL_USD_CACHE' not in server:
    raise SystemExit('[CHART-V30.7] ERROR: expected V30.6 app-server marker not found')
if 'MEMEFLOW_TRADING_CHART_V30_6_CURVE_MARK' not in feed:
    raise SystemExit('[CHART-V30.7] ERROR: expected V30.6 trade-feed marker not found')

stamp = time.strftime('%Y%m%d-%H%M%S')
backup = repo/'.patch-backups'/f'trading-chart-v30-7-{stamp}'
for f in files:
    dst = backup / f.relative_to(repo)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, dst)
print(f'[CHART-V30.7] backup: {backup}')

def sub1(text, pattern, repl, label, flags=re.S):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'[CHART-V30.7] ERROR: {label}: expected 1 anchor, found {n}')
    print(f'[CHART-V30.7] patched {label}')
    return out

# 1) Keep raw chart history in SOL. Convert the whole series to USD at render time,
# so a SOL/USD refresh cannot create fake step changes between old and new points.
new_normalize = r'''function normalizeChartPoint(point){
  const priceSol =
    finite(point?.priceSol)
      ? Number(point.priceSol)
      : finite(point?.markPrice)
        ? Number(point.markPrice)
        : finite(point?.price)
          ? Number(point.price)
          : null;

  if(
    !finite(point?.t) ||
    !(priceSol > 0)
  ){
    return null;
  }

  return {
    id:point?.id?String(point.id):null,
    t:Number(point.t),
    // Raw history is canonical SOL mark price. USD is derived uniformly
    // for every candle at render time from the current SOL/USD rate.
    price:Number(priceSol),
    priceSol:Number(priceSol),
    source:point?.source||null,
    isBuy:point?.isBuy===true,
    solAmount:num(point?.solAmount,0),
    tokenAmount:num(point?.tokenAmount,0),
    markPrice:Number(priceSol)
  };
}

'''
trading = sub1(
    trading,
    r'function normalizeChartPoint\(point\)\{.*?\n\}\n\n(?=function replaceChartSnapshot)',
    new_normalize,
    'trading.js normalizeChartPoint'
)

# 2) A reconnect/snapshot may never make the browser history go backwards.
new_snapshot = r'''function replaceChartSnapshot(mint,incoming){
  const previous=rawPoints(mint).slice();
  const merged=[
    ...previous,
    ...(Array.isArray(incoming)?incoming:[])
      .map(normalizeChartPoint)
      .filter(Boolean)
  ].sort((a,b)=>a.t-b.t);

  const seenIds=new Set();
  const seenFallback=new Set();
  const points=[];

  for(const point of merged){
    if(point.id){
      if(seenIds.has(point.id))continue;
      seenIds.add(point.id);
    }else{
      const key=[
        Number(point.t),
        Number(point.priceSol||point.price||0),
        point.isBuy===true?1:0,
        Number(point.solAmount||0),
        Number(point.tokenAmount||0)
      ].join('|');
      if(seenFallback.has(key))continue;
      seenFallback.add(key);
    }
    points.push(point);
  }

  state.rawByMint.set(mint,points.slice(-8000));
  chartRuntime.dataKey='';
  // Fit only on the first real snapshot. Reconnects must not jump the viewport.
  if(!previous.length)chartRuntime.forceFit=true;
}

'''
trading = sub1(
    trading,
    r'function replaceChartSnapshot\(mint,incoming\)\{.*?\n\}\n\n(?=function addPoint)',
    new_snapshot,
    'trading.js reconnect-safe snapshot merge'
)

# 3) Cheap duplicate guard for live SSE replay/reconnect edge cases.
needle = "  const points=rawPoints(mint);\n  const last=points[points.length-1];\n\n  // Server history already de-duplicates"
replace = "  const points=rawPoints(mint);\n  const last=points[points.length-1];\n\n  if(\n    next.id &&\n    (last?.id===next.id || points.slice(-64).some(item=>item?.id===next.id))\n  ){\n    return false;\n  }\n\n  // Server history already de-duplicates"
if trading.count(needle) != 1:
    raise SystemExit(f'[CHART-V30.7] ERROR: addPoint duplicate anchor count={trading.count(needle)}')
trading = trading.replace(needle, replace, 1)
print('[CHART-V30.7] patched trading.js live duplicate guard')

# 4) Curve-mark candles are a continuous mark-price series: the next active
# bucket opens at the previous close. A one-trade second therefore shows the
# real movement instead of a misleading zero-body doji.
new_candles = r'''function candlesFor(points, timeframe) {
  const clean=(Array.isArray(points)?points:[])
    .filter(
      point=>
        finite(point?.t) &&
        finite(point?.priceSol ?? point?.price) &&
        Number(point?.priceSol ?? point?.price)>0
    );

  if(!clean.length)return [];

  const rate=solUsdRate();
  if(!(rate>0))return [];

  const interval=chartInterval(clean,timeframe);
  const candles=[];
  let candle=null;
  let previousClose=null;

  for(const point of clean){
    const priceSol=Number(point?.priceSol ?? point?.price);
    const price=priceSol*rate;
    const bucket=
      Math.floor(Number(point.t)/interval)*interval;

    if(!candle || candle.t!==bucket){
      const open=previousClose===null?price:previousClose;
      candle={
        t:bucket,
        open,
        high:Math.max(open,price),
        low:Math.min(open,price),
        close:price,
        samples:1,
        interval
      };
      candles.push(candle);
    }else{
      candle.high=Math.max(candle.high,price);
      candle.low=Math.min(candle.low,price);
      candle.close=price;
      candle.samples++;
    }

    previousClose=candle.close;
  }

  return candles.slice(-500);
}

'''
trading = sub1(
    trading,
    r'function candlesFor\(points, timeframe\) \{.*?\n\}\n\n(?=function latestCandleFor)',
    new_candles,
    'trading.js continuous canonical candles'
)

new_latest = r'''function latestCandleFor(points,timeframe){
  if(timeframe==='all')return null;
  if(!Array.isArray(points)||!points.length)return null;

  const rate=solUsdRate();
  if(!(rate>0))return null;

  const interval=Math.max(1000,Number(timeframe)||1000);
  let i=points.length-1;

  while(i>=0 && !(
    finite(points[i]?.t) &&
    finite(points[i]?.priceSol ?? points[i]?.price) &&
    Number(points[i]?.priceSol ?? points[i]?.price)>0
  ))i--;

  if(i<0)return null;

  const bucket=
    Math.floor(Number(points[i].t)/interval)*interval;

  let first=i;
  while(
    first>0 &&
    Number(points[first-1]?.t)>=bucket
  ){
    first--;
  }

  let previousClose=null;
  for(let j=first-1;j>=0;j--){
    const p=Number(points[j]?.priceSol ?? points[j]?.price);
    if(finite(points[j]?.t) && Number.isFinite(p) && p>0){
      previousClose=p*rate;
      break;
    }
  }

  let candle=null;
  for(let j=first;j<=i;j++){
    const point=points[j];
    const pointSol=Number(point?.priceSol ?? point?.price);
    if(
      !finite(point?.t) ||
      !Number.isFinite(pointSol) ||
      pointSol<=0
    )continue;

    const pointBucket=
      Math.floor(Number(point.t)/interval)*interval;
    if(pointBucket!==bucket)continue;

    const price=pointSol*rate;
    if(!candle){
      const open=previousClose===null?price:previousClose;
      candle={
        t:bucket,
        open,
        high:Math.max(open,price),
        low:Math.min(open,price),
        close:price,
        samples:1,
        interval
      };
    }else{
      candle.high=Math.max(candle.high,price);
      candle.low=Math.min(candle.low,price);
      candle.close=price;
      candle.samples++;
    }
  }

  return candle;
}

'''
trading = sub1(
    trading,
    r'function latestCandleFor\(points,timeframe\)\{.*?\n\}\n\n(?=function strategyLevels)',
    new_latest,
    'trading.js realtime candle parity'
)

trading = trading.replace(
    '/* MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK */',
    '/* MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK */\n/* MEMEFLOW_TRADING_CHART_V30_7_STABLE_HISTORY */',
    1
)

# 5) Chart-cache eviction must depend on market recency, not whether a user has
# the chart open. Viewer arrival/departure must never change backend history policy.
old = ".filter(item=>!(streams.get(item.mint)?.size))\n      .sort("
if server.count(old) != 1:
    raise SystemExit(f'[CHART-V30.7] ERROR: app-server viewer-dependent eviction anchor count={server.count(old)}')
server = server.replace(old, '.sort(', 1)
server = server.replace(
    '// MEMEFLOW_TRADING_CHART_V30_6_SOL_USD_CACHE',
    '// MEMEFLOW_TRADING_CHART_V30_6_SOL_USD_CACHE\n// MEMEFLOW_TRADING_CHART_V30_7_VIEWER_INDEPENDENT_CACHE',
    1
)
print('[CHART-V30.7] patched app-server viewer-independent chart cache')

# 6) The global Pump WS currently does expensive holder/evaluation work for any
# Pump TradeEvent it sees. Restrict that work to tokens already discovered by
# MEMEFLOW, and emit the chart tick before holder sorting/evaluation.
feed = feed.replace(
    'holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,',
    'holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,ignoredUntrackedTradeEvents:0,',
    1
)

helper_anchor = "function tokenFromStore(store,mint){\n  try{\n    return store?.getToken?.(mint) ||\n      store?.state?.tokens?.[mint] ||\n      (Array.isArray(store?.state?.tokens)?store.state.tokens.find(x=>x?.mint===mint):null) ||\n      null;\n  }catch{return null}\n}\n"
if feed.count(helper_anchor) != 1:
    raise SystemExit('[CHART-V30.7] ERROR: tokenFromStore anchor not unique')
helper = helper_anchor + r'''function trackedPumpToken(store,mint){
  const token=tokenFromStore(store,mint);
  if(!token)return null;
  const discoveredAt=Number(token?.discoveredAt);
  const launch=String(token?.launchPlatform||'').toLowerCase();
  const protocol=String(token?.protocol||'').toLowerCase();
  const source=String(token?.source||'').toLowerCase();
  const discovered=Number.isFinite(discoveredAt)&&discoveredAt>0;
  const pumpOrigin=launch==='pump'||protocol==='pump'||source.includes('pump create');
  return discovered&&pumpOrigin?token:null;
}
'''
feed = feed.replace(helper_anchor, helper, 1)

new_apply = r'''  function applyEvent(e){
    // Decode metrics count the physical Pump stream; expensive engine work below
    // is limited to tokens MEMEFLOW actually discovered.
    metrics.tradeEventsDecoded++;
    metrics.lastMint=e.mint;
    metrics.lastUser=e.user;

    const knownToken=trackedPumpToken(store,e.mint);
    if(!knownToken){
      metrics.ignoredUntrackedTradeEvents++;
      return;
    }

    users.add(e.user);
    metrics.distinctUsers=users.size;
    const prev=mintCounts.get(e.mint)||0;
    mintCounts.set(e.mint,prev+1);
    if(prev>0)metrics.repeatTradeEvents++;
    metrics.distinctMints=mintCounts.size;

    const eventAt=(
      e.timestamp!==null &&
      e.timestamp!==undefined &&
      e.timestamp>0n
    )
      ? Number(e.timestamp)*1000
      : Date.now();

    const market=marketFromEvent(e);

    // CHART FIRST: a browser candle must not wait for holder sorting,
    // disk scheduling, per-user evaluation, or paper-engine callbacks.
    if(Number.isFinite(market.priceSol)&&market.priceSol>0){
      try{
        onChartTick?.({
          id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
          mint:e.mint,
          t:eventAt,
          priceSol:market.priceSol,
          markPriceSol:market.priceSol,
          isBuy:e.isBuy===true,
          solAmount:Number(e.solAmount)/1e9,
          tokenAmount:Number(e.tokenAmount)/1e6,
          source:'pump-curve-mark'
        });
      }catch{}
    }

    let updatedForEval=null;

    try{
      const creator=knownToken?.creator||knownToken?.developer||knownToken?.creatorWallet||null;
      if(creator)eventHolderLedger?.setCreator?.(e.mint,creator);
    }catch{}

    try{
      const snap=eventHolderLedger?.ingestTradeEventDirect?.(e);
      if(snap){
        metrics.holderSnapshots++;
        // ingestTradeEventDirect already calculated this exact snapshot.
        // Do not sort the same holder ledger a second time in applyToStore().
        const updated=store?.setToken?.(e.mint,snap);
        if(updated)updatedForEval=updated;
      }
    }catch(err){metrics.lastError='holder:'+String(err?.message||err)}

    try{
      const buyPressure=updatePressure(e);
      const patch={
        marketSource:'ws-direct-trade-event',
        buyPressure,
        lastPriceAt:eventAt
      };

      if(Number.isFinite(market.priceSol)&&market.priceSol>0)patch.priceSol=market.priceSol;
      if(Number.isFinite(market.liquiditySol)&&market.liquiditySol>=0)patch.liquiditySol=market.liquiditySol;

      const updated=store?.setToken?.(e.mint,patch);
      if(updated){
        metrics.marketSnapshots++;
        updatedForEval=updated;
      }
    }catch(err){metrics.lastError='market:'+String(err?.message||err)}

    if(updatedForEval){
      try{__v1226Evaluate(updatedForEval,e.mint,'trade-event')}catch{}
      try{onTokenUpdate?.(e.mint,updatedForEval)}catch{}
      try{publish?.(e.mint)}catch{}
    }
  }

'''
feed = sub1(
    feed,
    r'  function applyEvent\(e\)\{.*?\n  \}\n\n(?=  async function connect\(\)\{)',
    new_apply,
    'pump-live-trade-feed tracked-token + chart-first hot path'
)
feed = feed.replace(
    '// MEMEFLOW_TRADING_CHART_V30_6_CURVE_MARK',
    '// MEMEFLOW_TRADING_CHART_V30_6_CURVE_MARK\n// MEMEFLOW_TRADING_CHART_V30_7_CHART_FIRST_TRACKED_ONLY',
    1
)

(root/'trading.js').write_text(trading)
(root/'app-server.mjs').write_text(server)
(root/'src'/'pump-live-trade-feed.mjs').write_text(feed)

print('[CHART-V30.7] running syntax checks...')
run('node','--check',str(root/'trading.js'))
run('node','--check',str(root/'app-server.mjs'))
run('node','--check',str(root/'src'/'pump-live-trade-feed.mjs'))
run('git','diff','--check')

# Structural checks: exactly one final marker and no old viewer-dependent cache line.
checks = [
    ('trading marker', trading.count('MEMEFLOW_TRADING_CHART_V30_7_STABLE_HISTORY') == 1),
    ('server marker', server.count('MEMEFLOW_TRADING_CHART_V30_7_VIEWER_INDEPENDENT_CACHE') == 1),
    ('feed marker', feed.count('MEMEFLOW_TRADING_CHART_V30_7_CHART_FIRST_TRACKED_ONLY') == 1),
    ('no viewer cache coupling', 'filter(item=>!(streams.get(item.mint)?.size))' not in server),
    ('snapshot merge', '...previous,' in trading),
    ('continuous open', 'previousClose===null?price:previousClose' in trading),
    ('tracked gate', 'ignoredUntrackedTradeEvents++' in feed),
]
for name, ok in checks:
    print(f'[CHART-V30.7] {"OK" if ok else "FAIL"}: {name}')
    if not ok:
        raise SystemExit(f'[CHART-V30.7] ERROR: structural check failed: {name}')

print('[CHART-V30.7] diff stat:')
run('git','diff','--stat','--',*(str(f.relative_to(repo)) for f in files))

run('git','add','--',*(str(f.relative_to(repo)) for f in files))
commit = subprocess.run(
    ['git','commit','-m','Trading chart V30.7 stable history and chart-first feed'],
    cwd=repo,text=True,capture_output=True
)
print(commit.stdout.rstrip())
if commit.stderr.strip(): print(commit.stderr.rstrip())
if commit.returncode != 0:
    raise SystemExit('[CHART-V30.7] ERROR: git commit failed')

run('git','push','-u','origin',branch)
print('[CHART-V30.7] INSTALL + CHECK + COMMIT + PUSH COMPLETE')
print(f'[CHART-V30.7] branch: {branch}')
print('[CHART-V30.7] restart the Replit workflow/app, then hard-refresh Trading Terminal')
