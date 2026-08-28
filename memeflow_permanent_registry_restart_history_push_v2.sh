#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW permanent scanner registry V2 (resume-safe) =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run from ~/workspace or memeflow-app."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

def replace_once(path, old, new, label):
    p=Path(path)
    s=p.read_text()
    if old in s:
        p.write_text(s.replace(old,new,1))
        print(f"patched: {path} :: {label}")
        return True
    if new in s:
        print(f"already patched: {path} :: {label}")
        return False
    raise SystemExit(f"PATCH FAILED [{label}] in {path}")

# ============================================================================
# 1) Permanent token registry — SQLite, batched WAL writes.
# ============================================================================
registry = r"""import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

function n(v){
  const x=Number(v);
  return Number.isFinite(x)&&x>0?x:null;
}
function safeJson(value,fallback=null){
  try{return JSON.stringify(value)}catch{return fallback}
}
function parseJson(value,fallback=null){
  try{return JSON.parse(value)}catch{return fallback}
}

export class TokenRegistry{
  constructor(dir,opts={}){
    fs.mkdirSync(dir,{recursive:true});
    this.file=path.join(dir,opts.fileName||'token-registry-v1.sqlite');
    this.db=new DatabaseSync(this.file);

    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      PRAGMA temp_store=MEMORY;
      PRAGMA busy_timeout=3000;

      CREATE TABLE IF NOT EXISTS tokens(
        mint TEXT PRIMARY KEY,
        pump_created_at INTEGER,
        discovered_at INTEGER,
        last_activity_at INTEGER,
        updated_at INTEGER NOT NULL,
        ws_first INTEGER NOT NULL DEFAULT 0,
        historical INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        token_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_created
        ON tokens(pump_created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tokens_discovered
        ON tokens(discovered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tokens_activity
        ON tokens(last_activity_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tokens_ws_hot
        ON tokens(ws_first,updated_at DESC);

      CREATE TABLE IF NOT EXISTS checkpoints(
        key TEXT PRIMARY KEY,
        value_json TEXT,
        updated_at INTEGER NOT NULL
      );
    `);

    this.upsertStmt=this.db.prepare(`
      INSERT INTO tokens(
        mint,pump_created_at,discovered_at,last_activity_at,updated_at,
        ws_first,historical,source,token_json
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(mint) DO UPDATE SET
        pump_created_at=COALESCE(excluded.pump_created_at,tokens.pump_created_at),
        discovered_at=COALESCE(tokens.discovered_at,excluded.discovered_at),
        last_activity_at=CASE
          WHEN excluded.last_activity_at IS NULL THEN tokens.last_activity_at
          WHEN tokens.last_activity_at IS NULL THEN excluded.last_activity_at
          WHEN excluded.last_activity_at>tokens.last_activity_at THEN excluded.last_activity_at
          ELSE tokens.last_activity_at
        END,
        updated_at=CASE
          WHEN excluded.updated_at>tokens.updated_at THEN excluded.updated_at
          ELSE tokens.updated_at
        END,
        ws_first=CASE WHEN excluded.ws_first=1 OR tokens.ws_first=1 THEN 1 ELSE 0 END,
        historical=CASE WHEN excluded.historical=1 OR tokens.historical=1 THEN 1 ELSE 0 END,
        source=COALESCE(excluded.source,tokens.source),
        token_json=excluded.token_json
    `);
    this.getStmt=this.db.prepare(`SELECT token_json FROM tokens WHERE mint=?`);
    this.countStmt=this.db.prepare(`SELECT COUNT(*) AS n FROM tokens`);
    this.hotStmt=this.db.prepare(`
      SELECT token_json
      FROM tokens
      WHERE ws_first=1
      ORDER BY COALESCE(last_activity_at,discovered_at,updated_at) DESC
      LIMIT ?
    `);
    this.pageStmt=this.db.prepare(`
      SELECT token_json
      FROM tokens
      ORDER BY COALESCE(pump_created_at,discovered_at,updated_at) DESC
      LIMIT ? OFFSET ?
    `);
    this.checkpointGetStmt=this.db.prepare(`SELECT value_json FROM checkpoints WHERE key=?`);
    this.checkpointSetStmt=this.db.prepare(`
      INSERT INTO checkpoints(key,value_json,updated_at)
      VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET
        value_json=excluded.value_json,
        updated_at=excluded.updated_at
    `);

    this.pending=new Map();
    this.flushMs=Math.max(100,Number(opts.flushMs||process.env.TOKEN_REGISTRY_FLUSH_MS||250));
    this.flushTimer=setInterval(()=>this.flush(),this.flushMs);
    this.flushTimer.unref?.();

    this.metrics={
      version:'TOKEN_REGISTRY_V1',
      startedAt:Date.now(),
      queued:0,
      flushed:0,
      flushes:0,
      flushErrors:0,
      lazyHits:0,
      lazyMisses:0,
      restoredHot:0,
      dbFile:path.basename(this.file),
      lastFlushAt:null,
      lastError:null
    };
  }

  queueUpsert(token,{historical=false,activityAt=null}={}){
    const mint=String(token?.mint||'').trim();
    if(!mint)return false;

    const now=Date.now();
    const old=this.pending.get(mint)?.token||null;
    const merged=old?{...old,...token}:{...token};

    this.pending.set(mint,{
      token:merged,
      historical:Boolean(historical||token?.registryHistorical),
      activityAt:n(activityAt??token?.lastMarketActivityAt??token?.lastPriceAt),
      queuedAt:now
    });

    this.metrics.queued++;
    return true;
  }

  flush(){
    if(!this.pending.size)return 0;
    const rows=[...this.pending.values()];
    this.pending.clear();

    try{
      this.db.exec('BEGIN IMMEDIATE');
      for(const row of rows){
        let token=row.token||{};
        const mint=String(token.mint||'').trim();
        if(!mint)continue;

        // Deep/history rows are intentionally sparse. Never let a later
        // historical page overwrite richer live scanner state already stored.
        if(row.historical){
          const existingRow=this.getStmt.get(mint);
          const existing=existingRow?.token_json
            ? parseJson(existingRow.token_json,null)
            : null;
          if(existing)token={...existing,...token};
        }

        const updatedAt=n(token.updatedAt)||Date.now();
        this.upsertStmt.run(
          mint,
          n(token.pumpCreatedAt??token.createdAt??token.created_at??token.createTimestamp??token.blockTime),
          n(token.discoveredAt),
          row.activityAt,
          updatedAt,
          token.wsFirst===true?1:0,
          row.historical?1:0,
          token.source?String(token.source):null,
          safeJson(token,'{}')
        );
      }
      this.db.exec('COMMIT');
      this.metrics.flushed+=rows.length;
      this.metrics.flushes++;
      this.metrics.lastFlushAt=Date.now();
      this.metrics.lastError=null;
      return rows.length;
    }catch(error){
      try{this.db.exec('ROLLBACK')}catch{}
      for(const row of rows){
        const mint=String(row?.token?.mint||'');
        if(mint&&!this.pending.has(mint))this.pending.set(mint,row);
      }
      this.metrics.flushErrors++;
      this.metrics.lastError=String(error?.message||error);
      return 0;
    }
  }

  get(mint){
    mint=String(mint||'').trim();
    if(!mint)return null;

    const pending=this.pending.get(mint)?.token;
    if(pending){
      this.metrics.lazyHits++;
      return {...pending};
    }

    const row=this.getStmt.get(mint);
    if(!row?.token_json){
      this.metrics.lazyMisses++;
      return null;
    }

    const token=parseJson(row.token_json,null);
    if(!token){
      this.metrics.lazyMisses++;
      return null;
    }

    this.metrics.lazyHits++;
    return token;
  }

  loadHot(limit=5000){
    limit=Math.max(1,Math.floor(Number(limit)||5000));
    const out=[];
    for(const row of this.hotStmt.all(limit)){
      const token=parseJson(row.token_json,null);
      if(token?.mint)out.push(token);
    }
    this.metrics.restoredHot+=out.length;
    return out;
  }

  page({limit=100,offset=0}={}){
    limit=Math.max(1,Math.floor(Number(limit)||100));
    offset=Math.max(0,Math.floor(Number(offset)||0));
    return this.pageStmt.all(limit,offset)
      .map(row=>parseJson(row.token_json,null))
      .filter(token=>token?.mint);
  }

  count(){
    return Number(this.countStmt.get()?.n||0);
  }

  getCheckpoint(key,fallback=null){
    const row=this.checkpointGetStmt.get(String(key));
    return row?.value_json?parseJson(row.value_json,fallback):fallback;
  }

  setCheckpoint(key,value){
    this.checkpointSetStmt.run(
      String(key),
      safeJson(value,'null'),
      Date.now()
    );
    return value;
  }

  status(){
    return {
      ...this.metrics,
      permanentTokens:this.count(),
      queuedWrites:this.pending.size
    };
  }

  close(){
    clearInterval(this.flushTimer);
    this.flush();
    try{this.db.close()}catch{}
  }
}
"""
Path("src/token-registry.mjs").write_text(registry)
print("created: src/token-registry.mjs")

# ============================================================================
# 2) Low-priority Pump history backfill.
#    No Solana RPC; live WebSocket remains priority #1.
# ============================================================================
history = r"""const DEFAULT_URL='https://frontend-api-v3.pump.fun/coins';

function finite(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}
function createdMs(coin){
  const raw=finite(
    coin?.created_timestamp ??
    coin?.createdTimestamp ??
    coin?.created_at ??
    coin?.createdAt
  );
  if(raw===null||raw<=0)return null;
  return raw<1e12?raw*1000:raw;
}
function listFromBody(body){
  if(Array.isArray(body))return body;
  if(Array.isArray(body?.data))return body.data;
  if(Array.isArray(body?.coins))return body.coins;
  if(Array.isArray(body?.data?.coins))return body.data.coins;
  if(Array.isArray(body?.results))return body.results;
  return [];
}
function coinToken(coin,{recent=false}={}){
  const mint=String(coin?.mint||coin?.address||'').trim();
  if(!mint)return null;

  const created=createdMs(coin);
  const now=Date.now();

  return {
    mint,
    name:coin?.name||null,
    symbol:coin?.symbol||null,
    uri:coin?.metadata_uri||coin?.metadataUri||coin?.uri||null,
    imageUri:coin?.image_uri||coin?.imageUri||null,
    creator:coin?.creator||null,
    curve:coin?.bonding_curve||coin?.bondingCurve||null,
    bondingCurve:coin?.bonding_curve||coin?.bondingCurve||null,
    pumpCreatedAt:created,
    discoveredAt:created||now,
    marketCapUsd:finite(coin?.usd_market_cap??coin?.marketCapUsd),
    marketCapSol:finite(coin?.market_cap??coin?.marketCap),
    totalSupply:finite(coin?.total_supply??coin?.totalSupply),
    complete:coin?.complete===true,
    raydiumPool:coin?.raydium_pool||coin?.raydiumPool||null,
    twitterUrl:coin?.twitter||null,
    telegramUrl:coin?.telegram||null,
    websiteUrl:coin?.website||null,
    launchPlatform:'pump',
    protocol:'pump',
    registryHistorical:true,
    // Recent head-sync repairs a restart/deploy gap. Deep history stays cold
    // until it has fresh activity.
    wsFirst:recent===true,
    source:recent?'Pump history gap sync':'Pump historical backfill',
    updatedAt:now
  };
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

export function startPumpHistoryBackfill({
  registry,
  onRecentToken=null
}={}){
  const metrics={
    version:'PUMP_HISTORY_BACKFILL_V1',
    enabled:process.env.PUMPFUN_HISTORY_ENABLED!=='false',
    startedAt:Date.now(),
    running:false,
    authRequired:false,
    requests:0,
    pages:0,
    coinsSeen:0,
    coinsStored:0,
    recentGapCoins:0,
    rateLimited:0,
    errors:0,
    offset:0,
    caughtUp:false,
    lastRequestAt:null,
    lastSuccessAt:null,
    lastError:null
  };

  if(!registry||metrics.enabled!==true){
    return {metrics:()=>({...metrics}),stop(){}};
  }

  const endpoint=String(process.env.PUMPFUN_HISTORY_URL||DEFAULT_URL).trim();
  const jwt=String(process.env.PUMPFUN_HISTORY_JWT||'').trim();
  const pageSize=Math.max(10,Math.min(100,Number(process.env.PUMPFUN_HISTORY_PAGE_SIZE||100)));
  const intervalMs=Math.max(1000,Number(process.env.PUMPFUN_HISTORY_INTERVAL_MS||2500));
  const recentEveryMs=Math.max(30000,Number(process.env.PUMPFUN_HISTORY_RECENT_SYNC_MS||60000));
  const startDelayMs=Math.max(3000,Number(process.env.PUMPFUN_HISTORY_START_DELAY_MS||5000));

  let stopped=false;
  let lastRecentAt=0;

  const checkpoint=registry.getCheckpoint('pump-history-deep-v1',{offset:0})||{offset:0};
  metrics.offset=Math.max(0,Number(checkpoint.offset)||0);

  async function requestPage({offset,order}){
    const url=new URL(endpoint);
    url.searchParams.set('limit',String(pageSize));
    url.searchParams.set('offset',String(offset));
    url.searchParams.set('sort','created_timestamp');
    url.searchParams.set('order',order);
    url.searchParams.set('includeNsfw','true');

    const headers={
      accept:'application/json',
      origin:'https://pump.fun'
    };
    if(jwt)headers.authorization=`Bearer ${jwt}`;

    metrics.requests++;
    metrics.lastRequestAt=Date.now();

    const response=await fetch(url,{
      method:'GET',
      headers,
      signal:AbortSignal.timeout(12000)
    });

    if(response.status===401||response.status===403){
      metrics.authRequired=true;
      throw new Error('PUMPFUN_HISTORY_AUTH_REQUIRED');
    }

    if(response.status===429){
      metrics.rateLimited++;
      const retry=Number(response.headers.get('retry-after'));
      const error=new Error('PUMPFUN_HISTORY_RATE_LIMITED');
      error.retryAfterMs=Number.isFinite(retry)&&retry>0?retry*1000:60000;
      throw error;
    }

    if(!response.ok){
      throw new Error(`PUMPFUN_HISTORY_HTTP_${response.status}`);
    }

    metrics.authRequired=false;
    const body=await response.json();
    return listFromBody(body);
  }

  async function recentGapSync(){
    const coins=await requestPage({offset:0,order:'DESC'});
    metrics.pages++;

    for(const coin of coins){
      const token=coinToken(coin,{recent:true});
      if(!token)continue;

      metrics.coinsSeen++;
      metrics.recentGapCoins++;
      registry.queueUpsert(token,{historical:true});
      metrics.coinsStored++;

      try{onRecentToken?.(token)}catch{}
    }

    registry.setCheckpoint('pump-history-head-v1',{
      syncedAt:Date.now(),
      count:coins.length
    });

    lastRecentAt=Date.now();
  }

  async function deepStep(){
    const coins=await requestPage({
      offset:metrics.offset,
      order:'ASC'
    });

    metrics.pages++;

    for(const coin of coins){
      const token=coinToken(coin,{recent:false});
      if(!token)continue;
      metrics.coinsSeen++;
      registry.queueUpsert(token,{historical:true});
      metrics.coinsStored++;
    }

    if(coins.length){
      metrics.offset+=coins.length;
      registry.setCheckpoint('pump-history-deep-v1',{
        offset:metrics.offset,
        updatedAt:Date.now()
      });
    }

    metrics.caughtUp=coins.length<pageSize;
    metrics.lastSuccessAt=Date.now();
    metrics.lastError=null;
  }

  async function loop(){
    await sleep(startDelayMs);

    while(!stopped){
      metrics.running=true;

      try{
        // Head sync first: deploy/restart gaps are repaired before deep history.
        if(Date.now()-lastRecentAt>=recentEveryMs){
          await recentGapSync();
          await sleep(Math.min(1000,intervalMs));
        }

        await deepStep();
      }catch(error){
        metrics.errors++;
        metrics.lastError=String(error?.message||error);

        const wait=
          Number(error?.retryAfterMs) ||
          (metrics.authRequired?10*60_000:Math.max(5000,intervalMs*2));

        await sleep(wait);
        continue;
      }

      await sleep(metrics.caughtUp?Math.max(30000,recentEveryMs):intervalMs);
    }

    metrics.running=false;
  }

  void loop();

  return {
    metrics:()=>({...metrics}),
    stop(){stopped=true;metrics.running=false}
  };
}
"""
Path("src/pump-history-backfill.mjs").write_text(history)
print("created: src/pump-history-backfill.mjs")

# ============================================================================
# 3) JsonStore: state.json stays small, registry keeps every token permanently.
# ============================================================================
store=Path("src/store.mjs")
s=store.read_text()

if "from './token-registry.mjs'" not in s:
    s=s.replace(
        "import {defaultSettings,normalizeSettings} from './settings.mjs';\n",
        "import {defaultSettings,normalizeSettings} from './settings.mjs';\nimport {TokenRegistry} from './token-registry.mjs';\n",
        1
    )

old="""    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted
    fs.mkdirSync(dir,{recursive:true});
    this.load();
  }
"""
new="""    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted
    fs.mkdirSync(dir,{recursive:true});

    // MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1
    // state.json remains compact; every discovered/scanned token is persisted
    // independently in SQLite with WAL + batched writes.
    this.tokenRegistry=new TokenRegistry(dir);
    this.load();

    const warmLimit=Math.max(
      1000,
      Number(process.env.TOKEN_REGISTRY_WARM_LIMIT||5000)
    );

    for(const token of this.tokenRegistry.loadHot(warmLimit)){
      const mint=String(token?.mint||'');
      if(!mint)continue;
      this.state.tokens[mint]={
        ...token,
        ...(this.state.tokens[mint]||{}),
        registryRestored:true
      };
    }
  }
"""
if old in s:
    s=s.replace(old,new,1)
elif "MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1" not in s:
    raise SystemExit("PATCH FAILED: JsonStore constructor anchor changed")

old="""  getToken(mint){return this.state.tokens?.[mint]||null}
  addToken(t){const old=this.state.tokens[t.mint]||{};this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};this.state.metrics.discovered++;if(this._tokenPersistenceRequired(t.mint))this.save();return this.state.tokens[t.mint]}
"""
new="""  getToken(mint){
    mint=String(mint||'');
    if(!mint)return null;

    const hot=this.state.tokens?.[mint]||null;
    if(hot)return hot;

    // Permanent registry lazy-hydration lets an old known Pump token become
    // hot again immediately when a new live event references it.
    const restored=this.tokenRegistry?.get?.(mint)||null;
    if(!restored)return null;

    this.state.tokens[mint]={
      ...restored,
      registryRestored:true
    };
    return this.state.tokens[mint];
  }
  addToken(t){
    const old=this.state.tokens[t.mint]||{};
    this.state.tokens[t.mint]={...old,...t,updatedAt:Date.now()};
    this.state.metrics.discovered++;
    this.tokenRegistry?.queueUpsert?.(
      this.state.tokens[t.mint],
      {
        historical:t?.registryHistorical===true,
        activityAt:t?.lastMarketActivityAt??t?.lastPriceAt??null
      }
    );
    if(this._tokenPersistenceRequired(t.mint))this.save();
    return this.state.tokens[t.mint]
  }
"""
if old in s:
    s=s.replace(old,new,1)
elif "Permanent registry lazy-hydration" not in s:
    raise SystemExit("PATCH FAILED: getToken/addToken anchor changed")

old="""    this.state.metrics.scanned++;if(this._tokenPersistenceRequired(mint))this.save();return this.state.tokens[mint]
  }
"""
new="""    this.state.metrics.scanned++;
    this.tokenRegistry?.queueUpsert?.(
      this.state.tokens[mint],
      {
        historical:this.state.tokens[mint]?.registryHistorical===true,
        activityAt:this.state.tokens[mint]?.lastMarketActivityAt??this.state.tokens[mint]?.lastPriceAt??null
      }
    );
    if(this._tokenPersistenceRequired(mint))this.save();
    return this.state.tokens[mint]
  }
"""
if old in s:
    s=s.replace(old,new,1)
elif "this.tokenRegistry?.queueUpsert?.(" not in s[s.find("setToken(mint,t)"):]:
    raise SystemExit("PATCH FAILED: setToken return anchor changed")

old="""  decisions(uid){
"""
new="""  registryStatus(){return this.tokenRegistry?.status?.()||null}
  close(){try{this.tokenRegistry?.close?.()}catch{}}
  decisions(uid){
"""
if old in s and "registryStatus()" not in s:
    s=s.replace(old,new,1)

store.write_text(s)
print("patched: src/store.mjs :: permanent token registry")

# ============================================================================
# 4) App server: no session reset, no token TTL deletion, cache-cap only.
# ============================================================================
app_path=Path("app-server.mjs")
app=app_path.read_text()

# imports
if "startPumpHistoryBackfill" not in app:
    app=app.replace(
        "import {rankCandidateViews} from './src/feed-ranking.mjs'; // MEMEFLOW_FEED_RELEVANCE_RANKING_V1\n",
        "import {rankCandidateViews} from './src/feed-ranking.mjs'; // MEMEFLOW_FEED_RELEVANCE_RANKING_V1\nimport {startPumpHistoryBackfill} from './src/pump-history-backfill.mjs'; // MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1\n",
        1
    )

# Remove accidental duplicate age wake from previous patch; canonical sweep remains.
wake_start=app.find("// MEMEFLOW_AGE_THRESHOLD_WAKE_V1")
wake_end=app.find("// A TradeEvent causes immediate admission re-check.",wake_start)
if wake_start>=0 and wake_end>wake_start:
    app=app[:wake_start]+app[wake_end:]
    print("patched: app-server.mjs :: removed duplicate age wake scheduler")

old="""// MEMEFLOW_FRESH_SESSION_SCANNER_V1
// Live scanner data is session-scoped. A restart starts a clean scanner while
// OPEN-position token snapshots remain available for position continuity.
const __mfScannerRuntimeStartedAt=Date.now();
const __mfScannerTokenTtlMs=Math.max(
  5*60_000,
  Number(process.env.LIVE_SCANNER_TOKEN_TTL_MS||3*60*60_000)
);
"""
new="""// MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1
// Token lifetime is permanent in the registry. There is NO 3-hour token TTL.
// RAM is only a hot cache and may be capacity-evicted without deleting history.
const __mfScannerRuntimeStartedAt=Date.now(); // diagnostics only
const __mfScannerCacheMaxTokens=Math.max(
  1000,
  Number(process.env.LIVE_SCANNER_CACHE_MAX_TOKENS||20000)
);
let __mfPumpHistoryBackfill=null;
"""
if old in app:
    app=app.replace(old,new,1)
elif "MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1" not in app[:5000]:
    raise SystemExit("PATCH FAILED: fresh-session TTL block changed")

old="""{
  const keep=__mfOpenPositionMints();
  for(const mint of Object.keys(store.state.tokens||{})){
    if(!keep.has(String(mint)))delete store.state.tokens[mint];
  }
  store.state.decisions={};
  store._uidDec={};
  store.save();
}

function __mfIsCurrentScannerToken(token,now=Date.now()){
  if(!token||token.wsFirst!==true)return false;
  const discovered=Number(token.discoveredAt||0);
  if(!(discovered>=__mfScannerRuntimeStartedAt))return false;

  // MEMEFLOW_SETTINGS_CONTROL_SCANNER_RETENTION_V1
  // Opportunity/dead state may BLOCK a trade, but it must not silently remove
  // a Pump token before the user's age/settings filters get a chance to run.
  return now-discovered<=__mfScannerTokenTtlMs;
}
"""
new="""{
  // MEMEFLOW_RESTART_CONTINUITY_V1
  // A restart/deploy NEVER wipes scanner inventory. JsonStore already restored
  // the hot cache from the permanent registry. Only decisions are rebuilt from
  // the user's current settings.
  store.state.decisions={};
  store._uidDec={};
  store.save();
}

function __mfIsCurrentScannerToken(token,now=Date.now()){
  void now;
  // Token age is NOT a lifetime rule. A known hot Pump token remains scanner
  // inventory until RAM cache capacity requires a cold eviction.
  return Boolean(token&&token.wsFirst===true);
}
"""
if old in app:
    app=app.replace(old,new,1)
elif "MEMEFLOW_RESTART_CONTINUITY_V1" not in app:
    raise SystemExit("PATCH FAILED: startup reset/current scanner block changed")

# replace prune function wholesale using stable anchors
prune_start=app.find("function __mfPruneScannerRuntimeState(now=Date.now()){")
prune_end=app.find("const __mfScannerPruneTimer=setInterval(",prune_start)
if prune_start<0 or prune_end<0:
    raise SystemExit("PATCH FAILED: prune function boundaries not found")

new_prune=r"""function __mfPruneScannerRuntimeState(now=Date.now()){
  // MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1
  // No age TTL and no settings-based deletion. This function is RAM hygiene
  // only; SQLite remains the permanent source of truth.
  const open=__mfOpenPositionMints();
  const scannerRows=Object.values(store.state.tokens||{})
    .filter(token=>__mfIsCurrentScannerToken(token,now));

  if(scannerRows.length>__mfScannerCacheMaxTokens){
    const excess=scannerRows.length-__mfScannerCacheMaxTokens;

    const evictable=scannerRows
      .filter(token=>!open.has(String(token?.mint||'')))
      .sort((a,b)=>{
        const at=Number(
          a?.lastMarketActivityAt ??
          a?.lastPriceAt ??
          a?.updatedAt ??
          a?.discoveredAt ??
          0
        );
        const bt=Number(
          b?.lastMarketActivityAt ??
          b?.lastPriceAt ??
          b?.updatedAt ??
          b?.discoveredAt ??
          0
        );
        return at-bt;
      })
      .slice(0,excess);

    for(const token of evictable){
      __mfDropScannerToken(token.mint,'HOT_CACHE_CAPACITY_EVICTED');
    }
  }

  const liveMints=new Set(
    __mfLiveScannerTokens(now)
      .map(token=>String(token?.mint||''))
      .filter(Boolean)
  );

  for(const [key,d] of Object.entries(store.state.decisions||{})){
    const mint=String(d?.mint||'');
    if(mint&&!liveMints.has(mint)&&!open.has(mint))delete store.state.decisions[key];
  }

  for(const [uid,index] of Object.entries(store._uidDec||{})){
    for(const key of [...index.keys()]){
      if(!store.state.decisions?.[key])index.delete(key);
    }
    if(!index.size)delete store._uidDec[uid];
  }
}

"""
app=app[:prune_start]+new_prune+app[prune_end:]
print("patched: app-server.mjs :: TTL replaced with capacity-only hot cache")

# Make live CREATE checkpoint permanent.
# Current main evaluates the accepted CREATE immediately after
# discMetrics.lastSuccessfulScanAt. Patch only that stable one-line anchor
# instead of depending on the exact function tail.
if "'pump-live-create-v1'" not in app:
    checkpoint_anchor="  discMetrics.lastSuccessfulScanAt=Date.now();"
    if checkpoint_anchor not in app:
        raise SystemExit("PATCH FAILED: direct CREATE checkpoint anchor not found")

    checkpoint_insert="""  discMetrics.lastSuccessfulScanAt=Date.now();

  try{
    store.tokenRegistry?.setCheckpoint?.(
      'pump-live-create-v1',
      {
        mint:e.mint,
        signature:String(signature||''),
        slot:slot??null,
        seenAt:Date.now()
      }
    );
  }catch{}"""

    app=app.replace(checkpoint_anchor,checkpoint_insert,1)
    print("patched: app-server.mjs :: permanent CREATE checkpoint")
else:
    print("already patched: app-server.mjs :: permanent CREATE checkpoint")

# Live Token States: scanner sees all; DISPLAY + TRADE use Entry Filters.
route_start=app.find(" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){")
route_end=app.find("if(url.pathname==='/api/ai/decisions'){",route_start)
if route_start<0 or route_end<0:
    raise SystemExit("PATCH FAILED: live-token-states route boundaries not found")

new_route=r""" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_SCAN_ALL_DISPLAY_FILTERED_V2
  // SCAN: every Pump token in the hot scanner cache.
  // DISPLAY: only Entry-Filter-admitted tokens + OPEN positions.
  // TRADE: the same Entry Filters remain mandatory before Logic/execution.
  //
  // The old fixed API cap of 500 is removed. "limit" is optional; when the
  // current client does not send it, all matching hot-cache rows are returned
  // and the existing UI paginates them. Permanent registry size is unlimited.
  const _requestedLimit=Math.floor(Number(url.searchParams.get('limit')||0));
  const _limit=Number.isFinite(_requestedLimit)&&_requestedLimit>0
    ? _requestedLimit
    : null;

  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  let _admitted=0;
  let _hiddenBySettings=0;
  let _openOverride=0;
  let _evalErrors=0;
  let _viewErrors=0;

  const _displayRows=[];

  for(const _token of _rawTokens){
    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    let _admission=null;
    try{
      _admission=__mfEntryAdmissionForUser(
        _token,
        u.id,
        _settings
      );
    }catch(_error){
      _evalErrors++;
    }

    const _eligible=_admission?.admitted===true;
    const _isOpen=_openMints.has(_mint);

    if(!_eligible&&!_isOpen){
      _hiddenBySettings++;
      continue;
    }

    if(_eligible)_admitted++;
    if(_isOpen&&!_eligible)_openOverride++;

    const _key=u.id+':'+_mint;
    let _decision=store.state.decisions?.[_key]||null;

    if(!_decision){
      try{
        _decision=evaluate(_token,_settings);
      }catch(_error){
        _evalErrors++;
        _decision={
          state:'WAITING',
          score:0,
          confidence:0,
          primaryReason:'Scanner data is still being collected',
          reasons:['Scanner data is still being collected']
        };
      }
    }

    _displayRows.push({
      ..._decision,
      mint:_mint,
      tradeEligible:_eligible,
      openPositionOverride:_isOpen&&!_eligible,
      entryAdmissionState:_admission?.state||null,
      entryAdmissionReasons:Array.isArray(_admission?.reasons)
        ? _admission.reasons
        : []
    });
  }

  const _selected=candidateFeed(_displayRows,'all');
  const _counts=candidateVisibilityCounts(_displayRows);
  const _stateCounts={};

  for(const _decision of _selected){
    const _state=String(_decision?.state||'WAITING').trim().toUpperCase()||'WAITING';
    _stateCounts[_state]=(_stateCounts[_state]||0)+1;
  }

  const _unrankedViews=[];
  for(const _decision of _selected){
    try{_unrankedViews.push(candidateView(_decision))}
    catch(_error){_viewErrors++}
  }

  const _rankedViews=rankCandidateViews(_unrankedViews);
  const _views=_limit
    ? _rankedViews.slice(0,_limit)
    : _rankedViews;

  return json(res,200,{
    decisions:_views,
    total:_rankedViews.length,
    returned:_views.length,
    limit:_limit,
    source:'system-live-token-states-filtered-unbounded-v2',

    // Scanner truth.
    rawScannerTokens:_rawTokens.length,
    permanentRegistryTokens:store.tokenRegistry?.count?.()||0,

    // Display/trading-filter truth.
    preAdmissionAdmitted:_admitted,
    preAdmissionHidden:_hiddenBySettings,
    openPositionOverride:_openOverride,

    evaluationErrors:_evalErrors,
    viewErrors:_viewErrors,
    stateCounts:_stateCounts,
    counts:_counts
  });
 }
"""
app=app[:route_start]+new_route+app[route_end:]
print("patched: app-server.mjs :: filtered display + no 500 dataset cap")

# Discovery status: no TTL lifetime, expose permanent registry/backfill.
old="""    scannerSessionStartedAt:__mfScannerRuntimeStartedAt,
    scannerTokenTtlMs:__mfScannerTokenTtlMs,
    opportunityEngine:opportunityEngine.diagnostics(),
"""
new="""    scannerSessionStartedAt:__mfScannerRuntimeStartedAt,
    scannerTokenTtlMs:null,
    scannerTokenLifetime:'permanent-registry',
    scannerCacheMaxTokens:__mfScannerCacheMaxTokens,
    tokenRegistry:store.registryStatus?.()||null,
    historyBackfill:__mfPumpHistoryBackfill?.metrics?.()||null,
    opportunityEngine:opportunityEngine.diagnostics(),
"""
if old in app:
    app=app.replace(old,new,1)
elif "scannerTokenLifetime:'permanent-registry'" not in app:
    raise SystemExit("PATCH FAILED: discovery status TTL block changed")

# Start live first; history only after server is listening.
old="""  console.log(`MEMEFLOW listening on ${process.env.PORT||3000}`);
  startDiscovery();
  startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:0,processing:0}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})
"""
new="""  console.log(`MEMEFLOW listening on ${process.env.PORT||3000}`);

  // Priority #1: live WebSocket starts immediately.
  startDiscovery();

  // Priority #2: low-rate history/gap sync starts in the background. It never
  // blocks the live scanner and never consumes Solana RPC capacity.
  __mfPumpHistoryBackfill=startPumpHistoryBackfill({
    registry:store.tokenRegistry,
    onRecentToken:(token)=>{
      // Recent head-sync repairs tokens missed while the server was down.
      // Deep historical pages stay cold in SQLite until they become active.
      const age=tokenAgeMinutes(token);
      if(!Number.isFinite(Number(age))||Number(age)>360)return;

      const current=store.getToken(token.mint);
      const hot=current
        ? store.setToken(token.mint,{...token,wsFirst:true,historyGapRestored:true})
        : store.addToken({...token,wsFirst:true,historyGapRestored:true});

      Promise.resolve(evaluateAll(hot)).catch(()=>{});
      try{publish(token.mint)}catch{}
    }
  });

  startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:0,processing:0}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})
"""
if old in app:
    app=app.replace(old,new,1)
elif "Priority #2: low-rate history/gap sync" not in app:
    raise SystemExit("PATCH FAILED: server listen startDiscovery block changed")

app_path.write_text(app)

# ============================================================================
# 4b) A fresh Pump TradeEvent reactivates a cold historical registry token.
# ============================================================================
trade=Path("src/pump-live-trade-feed.mjs")
pt=trade.read_text()

old_token_from_store="""function tokenFromStore(store,mint){try{return store?.getToken?.(mint)||store?.state?.tokens?.[mint]||(Array.isArray(store?.state?.tokens)?store.state.tokens.find(x=>x?.mint===mint):null)||null}catch{return null}}
"""
new_token_from_store="""function tokenFromStore(store,mint){
  try{
    const token=
      store?.getToken?.(mint)||
      store?.state?.tokens?.[mint]||
      (Array.isArray(store?.state?.tokens)
        ? store.state.tokens.find(x=>x?.mint===mint)
        : null)||
      null;

    if(
      token?.registryHistorical===true &&
      token?.wsFirst!==true &&
      typeof store?.setToken==='function'
    ){
      return store.setToken(mint,{
        wsFirst:true,
        registryReactivatedAt:Date.now(),
        source:token.source||'Pump registry reactivated by live trade'
      });
    }

    return token;
  }catch{
    return null
  }
}
"""
if old_token_from_store in pt:
    pt=pt.replace(old_token_from_store,new_token_from_store,1)
    trade.write_text(pt)
    print("patched: src/pump-live-trade-feed.mjs :: historical token live reactivation")
elif "registryReactivatedAt" in pt:
    print("already patched: src/pump-live-trade-feed.mjs :: live reactivation")
else:
    raise SystemExit("PATCH FAILED: tokenFromStore shape changed")

# ============================================================================
# 5) Settings semantics: scanner sees all; Entry Filters control cards + trades.
# ============================================================================
replace_once(
    "src/settings-gate.mjs",
"""// 1) ENTRY_ADMISSION_KEYS
//    Decide TRADE eligibility only. They never control Pump discovery,
//    scanner retention, data collection, or Live Token States visibility.
//
// 2) LOGIC_DECISION_KEYS
//    Run only AFTER trade admission. They may produce WAITING / WATCH /
//    BUY READY, but they never remove a token from scanner/display inventory.
//
// 3) PREOPEN_RPC_KEYS
//    Heavy linked/funded-wallet verification. These are FINAL-ONLY and remain
//    behind BUY READY. They never participate in scanner/display admission.
""",
"""// 1) ENTRY_ADMISSION_KEYS
//    Scanner collection is unconditional. These keys decide BOTH whether a
//    token card is visible in Live Token States and whether it may enter the
//    trading Logic pipeline.
//
// 2) LOGIC_DECISION_KEYS
//    Run only AFTER Entry admission. They decide WAITING / WATCH / BUY READY
//    and execution eligibility; they never stop raw Pump scanning.
//
// 3) PREOPEN_RPC_KEYS
//    Heavy linked/funded-wallet verification. These are FINAL-ONLY and remain
//    behind BUY READY. They never participate in raw scanner collection.
""",
    "Entry filters = display + trade, never raw scan"
)

for file_name, old_text, new_text in [
    (
      "settings-page.js",
      "['filters', 'Entry filters', 'Trading eligibility only · scanner and cards always stay live', false, [",
      "['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, ["
    ),
    (
      "system.js",
      "['filters', 'Entry filters', 'Trading eligibility · scanner and cards always stay live', false, [",
      "['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, ["
    )
]:
    p=Path(file_name)
    text=p.read_text()
    if old_text in text:
        p.write_text(text.replace(old_text,new_text,1))
        print(f"patched: {file_name} :: settings semantics")
    elif new_text in text:
        print(f"already patched: {file_name} :: settings semantics")
    else:
        raise SystemExit(f"PATCH FAILED: settings label changed in {file_name}")

# ============================================================================
# 6) .gitignore and env example.
# ============================================================================
gi=Path("../.gitignore") if Path("../.gitignore").exists() else Path(".gitignore")
g=gi.read_text()
for line in [
    "memeflow-app/data/token-registry-v1.sqlite",
    "memeflow-app/data/token-registry-v1.sqlite-wal",
    "memeflow-app/data/token-registry-v1.sqlite-shm"
]:
    if line not in g:
        g += "\n"+line
gi.write_text(g)

env=Path(".env.example")
e=env.read_text()
e=e.replace(
"""# Scanner is WebSocket-only.
SOLANA_WS_URLS=wss://YOUR_PRIMARY_WS,wss://YOUR_BACKUP_WS
# Solana HTTP RPC is reserved ONLY for final BUY READY wallet-cluster verification.
""",
"""# Live scanner is WebSocket-first and always highest priority.
SOLANA_WS_URLS=wss://YOUR_PRIMARY_WS,wss://YOUR_BACKUP_WS
# Solana HTTP RPC is reserved ONLY for final BUY READY wallet-cluster verification.
""",
1
)

if "LIVE_SCANNER_CACHE_MAX_TOKENS" not in e:
    e += r"""

# Permanent token registry
# Token lifetime itself has NO TTL. This only bounds hot RAM; evicted tokens
# remain permanently in data/token-registry-v1.sqlite and lazy-reactivate.
LIVE_SCANNER_CACHE_MAX_TOKENS=20000
TOKEN_REGISTRY_WARM_LIMIT=5000
TOKEN_REGISTRY_FLUSH_MS=250

# Low-priority Pump historical + restart-gap backfill.
# Live WebSocket starts first; this worker uses Pump's HTTP coin index only.
PUMPFUN_HISTORY_ENABLED=true
PUMPFUN_HISTORY_URL=https://frontend-api-v3.pump.fun/coins
# Pump Frontend API v3 currently requires a JWT on protected installations.
# Put it in Replit Secrets, never commit it.
PUMPFUN_HISTORY_JWT=
PUMPFUN_HISTORY_PAGE_SIZE=100
PUMPFUN_HISTORY_INTERVAL_MS=2500
PUMPFUN_HISTORY_RECENT_SYNC_MS=60000
"""
env.write_text(e)

# ============================================================================
# 7) Tests.
# ============================================================================
fresh=Path("tests/fresh-session-scanner.mjs")
t=fresh.read_text()

old="""assert.match(app,/MEMEFLOW_FRESH_SESSION_SCANNER_V1/);
assert.match(app,/__mfScannerRuntimeStartedAt/);
assert.match(app,/__mfLiveScannerTokens/);
assert.match(app,/const _rawTokens=__mfLiveScannerTokens\\(\\)/);
assert.match(app,/const _tokens=_rawTokens\\.slice\\(0,_lim\\)/);
assert.match(app,/freshScannerTokens:__mfLiveScannerTokens\\(\\)\\.length/);
assert.match(app,/setHeader\\('cache-control','no-store'\\)/);

// MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1 regression
// Live Token States must show raw scanner inventory. User settings only decide
// trade eligibility / trading decisions.
const liveRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveRoute,/MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1_ROUTE/);
assert.match(liveRoute,/tradeEligible:/);
assert.match(liveRoute,/displayOnly:/);
assert.match(liveRoute,/preAdmissionHidden:0/);
assert.doesNotMatch(liveRoute,/const _admittedAll=_rawTokens\\.filter/);
assert.doesNotMatch(liveRoute,/store\\.setDecision/);
assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);
assert.match(app,/const __mfPreAdmissionSweepTimer=setInterval/);
assert.match(app,/trade-ineligible -> trade-eligible/);
assert.match(app,/MEMEFLOW_CREATE_DECODE_COVERAGE_V1/);
assert.match(app,/createDecodeCoveragePct/);
"""
new="""assert.match(app,/MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1/);
assert.match(app,/MEMEFLOW_RESTART_CONTINUITY_V1/);
assert.match(app,/__mfScannerRuntimeStartedAt/);
assert.match(app,/__mfLiveScannerTokens/);
assert.match(app,/freshScannerTokens:__mfLiveScannerTokens\\(\\)\\.length/);
assert.match(app,/scannerTokenLifetime:'permanent-registry'/);
assert.match(app,/scannerCacheMaxTokens:__mfScannerCacheMaxTokens/);
assert.doesNotMatch(app,/LIVE_SCANNER_TOKEN_TTL_MS/);
assert.doesNotMatch(app,/SESSION_OR_TTL_EXPIRED/);
assert.match(app,/setHeader\\('cache-control','no-store'\\)/);

// Scanner sees all. Entry Filters control cards + trading.
const liveRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveRoute,/MEMEFLOW_SCAN_ALL_DISPLAY_FILTERED_V2/);
assert.match(liveRoute,/const _rawTokens=__mfLiveScannerTokens\\(\\)/);
assert.match(liveRoute,/if\\(!_eligible&&!_isOpen\\)/);
assert.match(liveRoute,/_hiddenBySettings\\+\\+/);
assert.match(liveRoute,/preAdmissionHidden:_hiddenBySettings/);
assert.match(liveRoute,/system-live-token-states-filtered-unbounded-v2/);
assert.doesNotMatch(liveRoute,/Math\\.min\\(500/);
assert.doesNotMatch(liveRoute,/_rawTokens\\.slice\\(0,_lim\\)/);

assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);
assert.match(app,/const __mfPreAdmissionSweepTimer=setInterval/);
assert.match(app,/trade-ineligible -> trade-eligible/);
assert.match(app,/MEMEFLOW_CREATE_DECODE_COVERAGE_V1/);
assert.match(app,/createDecodeCoveragePct/);
"""
if old in t:
    t=t.replace(old,new,1)
elif "MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1" not in t:
    raise SystemExit("PATCH FAILED: fresh-session top assertions changed")

# Update prune assertions to permanent cache semantics.
old="""const pruneScannerFn=app.slice(
  app.indexOf('function __mfPruneScannerRuntimeState('),
  app.indexOf('const __mfScannerPruneTimer=')
);
assert.doesNotMatch(pruneScannerFn,/opportunityEngine\\?\\.staleReason/);
assert.doesNotMatch(pruneScannerFn,/const lifecycleReason=/);
assert.doesNotMatch(pruneScannerFn,/STABLE_SETTINGS_REJECTED/);
"""
new="""const pruneScannerFn=app.slice(
  app.indexOf('function __mfPruneScannerRuntimeState('),
  app.indexOf('const __mfScannerPruneTimer=')
);
assert.doesNotMatch(pruneScannerFn,/opportunityEngine\\?\\.staleReason/);
assert.doesNotMatch(pruneScannerFn,/const lifecycleReason=/);
assert.doesNotMatch(pruneScannerFn,/STABLE_SETTINGS_REJECTED/);
assert.doesNotMatch(pruneScannerFn,/SESSION_OR_TTL_EXPIRED/);
assert.match(pruneScannerFn,/HOT_CACHE_CAPACITY_EVICTED/);
"""
if old in t:
    t=t.replace(old,new,1)

old="""// JsonStore must persist token snapshots ONLY for OPEN positions.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-fresh-store-'));
try{
  const s=new JsonStore(tmp);
  s.state.tokens={
    stale:{mint:'stale',name:'STALE'},
    open:{mint:'open',name:'OPEN'}
  };
  s.state.paperPositions={
    p1:{id:'p1',mint:'open',status:'OPEN'}
  };
  s.save();
  await new Promise(r=>setTimeout(r,350));
  const disk=JSON.parse(fs.readFileSync(path.join(tmp,'state.json'),'utf8'));
  assert.deepEqual(Object.keys(disk.tokens||{}),['open']);
  assert.equal(disk.decisions,undefined);
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
"""
new="""// state.json stays compact, while SQLite permanently preserves scanner tokens.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-registry-store-'));
let s=null,s2=null;
try{
  s=new JsonStore(tmp);
  s.state.paperPositions={
    p1:{id:'p1',mint:'open',status:'OPEN'}
  };

  s.addToken({
    mint:'recent',
    name:'RECENT',
    wsFirst:true,
    launchPlatform:'pump',
    pumpCreatedAt:Date.now()-60_000,
    discoveredAt:Date.now()-60_000
  });

  s.addToken({
    mint:'open',
    name:'OPEN',
    wsFirst:true,
    launchPlatform:'pump',
    pumpCreatedAt:Date.now()-120_000,
    discoveredAt:Date.now()-120_000
  });

  s.save();
  await new Promise(r=>setTimeout(r,500));
  s.tokenRegistry.flush();

  const disk=JSON.parse(fs.readFileSync(path.join(tmp,'state.json'),'utf8'));
  assert.deepEqual(Object.keys(disk.tokens||{}),['open']);
  assert.equal(disk.decisions,undefined);

  assert.ok(s.tokenRegistry.count()>=2);
  s.close();s=null;

  s2=new JsonStore(tmp);
  assert.equal(s2.getToken('recent')?.mint,'recent');
  assert.equal(s2.getToken('open')?.mint,'open');
  assert.ok(s2.registryStatus().permanentTokens>=2);
}finally{
  try{s?.close?.()}catch{}
  try{s2?.close?.()}catch{}
  fs.rmSync(tmp,{recursive:true,force:true});
}
"""
if old in t:
    t=t.replace(old,new,1)
elif "mf-registry-store-" not in t:
    raise SystemExit("PATCH FAILED: old JsonStore persistence test changed")

fresh.write_text(t)

# strict entry admission route contract.
strict=Path("tests/strict-entry-admission.mjs")
st=strict.read_text()

old="""// Entry admission is a TRADING gate, never a scanner/display gate.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/const _tokens=_rawTokens\\.slice\\(0,_lim\\)/);
assert.doesNotMatch(liveStatesRoute,/_admittedAll=_rawTokens\\.filter/);
assert.match(liveStatesRoute,/tradeEligible:_tradeEligible/);
assert.match(liveStatesRoute,/preAdmissionHidden:0/);
"""
new="""// Entry admission controls BOTH card visibility and trading eligibility.
// Raw Pump scanning itself remains unconditional.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/MEMEFLOW_SCAN_ALL_DISPLAY_FILTERED_V2/);
assert.match(liveStatesRoute,/const _rawTokens=__mfLiveScannerTokens\\(\\)/);
assert.match(liveStatesRoute,/if\\(!_eligible&&!_isOpen\\)/);
assert.match(liveStatesRoute,/preAdmissionHidden:_hiddenBySettings/);
assert.doesNotMatch(liveStatesRoute,/Math\\.min\\(500/);
"""
if old in st:
    st=st.replace(old,new,1)
elif "Entry admission controls BOTH card visibility" not in st:
    raise SystemExit("PATCH FAILED: strict entry display contract changed")

strict.write_text(st)

# settings architecture UI wording.
replace_once(
  "tests/settings-architecture-v2.mjs",
  "assert.match(settingsPage,/Trading eligibility only/);",
  "assert.match(settingsPage,/Scanner scans all · these filters control cards \\+ trading/);",
  "settings architecture wording"
)

# Add a small registry-focused test invoked from npm test.
registry_test=r"""import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {TokenRegistry} from '../src/token-registry.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-token-registry-'));
let registry=null;

try{
  registry=new TokenRegistry(dir,{flushMs:100});

  registry.queueUpsert({
    mint:'MintA',
    name:'A',
    wsFirst:true,
    pumpCreatedAt:Date.now()-10000,
    discoveredAt:Date.now()-9000,
    updatedAt:Date.now()
  });

  registry.queueUpsert({
    mint:'MintB',
    name:'B',
    wsFirst:false,
    registryHistorical:true,
    pumpCreatedAt:Date.now()-100000,
    discoveredAt:Date.now()-100000,
    updatedAt:Date.now()
  },{historical:true});

  registry.flush();

  assert.equal(registry.count(),2);
  assert.equal(registry.get('MintA')?.name,'A');
  assert.equal(registry.loadHot(10).some(t=>t.mint==='MintA'),true);
  assert.equal(registry.loadHot(10).some(t=>t.mint==='MintB'),false);

  registry.setCheckpoint('x',{offset:123});
  assert.equal(registry.getCheckpoint('x').offset,123);

  const page=registry.page({limit:10,offset:0});
  assert.equal(page.length,2);

  registry.close();registry=null;
}finally{
  try{registry?.close?.()}catch{}
  fs.rmSync(dir,{recursive:true,force:true});
}

console.log('token registry v1 ok');
"""
Path("tests/token-registry.mjs").write_text(registry_test)

# Add registry test to package test chain, once.
pkg=Path("package.json")
ps=pkg.read_text()
if "tests/token-registry.mjs" not in ps:
    ps=ps.replace(
      "node tests/fresh-session-scanner.mjs &&",
      "node tests/fresh-session-scanner.mjs && node tests/token-registry.mjs &&",
      1
    )
    pkg.write_text(ps)
    print("patched: package.json :: token registry test")

print("Patch source generation completed.")
PY

echo
echo "== Focused architecture tests =="
node tests/token-registry.mjs
node tests/settings-architecture-v2.mjs
node tests/strict-entry-admission.mjs
node tests/fresh-session-scanner.mjs
node tests/ws-only-preopen-rpc-v1.mjs

echo
echo "== Full npm test suite =="
npm test

echo
echo "== Stage only this architecture change =="
git add \
  app-server.mjs \
  src/store.mjs \
  src/token-registry.mjs \
  src/pump-history-backfill.mjs \
  src/pump-live-trade-feed.mjs \
  src/settings-gate.mjs \
  settings-page.js \
  system.js \
  tests/token-registry.mjs \
  tests/fresh-session-scanner.mjs \
  tests/strict-entry-admission.mjs \
  tests/settings-architecture-v2.mjs \
  package.json \
  .env.example \
  ../.gitignore 2>/dev/null || \
git add \
  app-server.mjs \
  src/store.mjs \
  src/token-registry.mjs \
  src/pump-history-backfill.mjs \
  src/pump-live-trade-feed.mjs \
  src/settings-gate.mjs \
  settings-page.js \
  system.js \
  tests/token-registry.mjs \
  tests/fresh-session-scanner.mjs \
  tests/strict-entry-admission.mjs \
  tests/settings-architecture-v2.mjs \
  package.json \
  .env.example \
  .gitignore

echo
echo "== Diff summary (no pager) =="
git --no-pager diff --cached --stat

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "feat: persist scanner registry and preserve restart continuity"
fi

echo
echo "== Push current branch =="
git push origin HEAD

echo
echo "SUCCESS."
echo
echo "Architecture after patch:"
echo "  LIVE SCAN       = WebSocket first, unchanged priority"
echo "  TOKEN LIFETIME  = permanent SQLite registry; no 3h deletion TTL"
echo "  RAM             = bounded hot cache only; cold eviction never deletes registry"
echo "  RESTART/DEPLOY  = hot cache restored; scanner is not reset"
echo "  MISSED DOWNTIME = low-priority Pump history head sync repairs recent gaps"
echo "  DEEP HISTORY    = low-priority Pump history pages go to permanent registry"
echo "  OLD TOKEN LIVE  = a new Pump TradeEvent lazy-reactivates a cold registry token"
echo "  DISPLAY         = Entry Filters decide cards; OPEN positions always stay visible"
echo "  TRADE           = same Entry Filters + Logic + final pre-open checks"
echo "  API 500 CAP     = removed from Live Token States dataset"
echo
echo "NOTE:"
echo "  Pump Frontend API v3 may require PUMPFUN_HISTORY_JWT."
echo "  If it returns 401/403, live scanning still works at full speed; only historical"
echo "  backfill pauses and /api/discovery/status reports historyBackfill.authRequired=true."
