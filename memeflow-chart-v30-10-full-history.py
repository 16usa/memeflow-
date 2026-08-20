#!/usr/bin/env python3
from pathlib import Path
import datetime
import os
import re
import shutil
import subprocess
import sys

TAG = "CHART-V30.10"
EXPECTED_BRANCH = "debug-trading-v30-4-2026-08-19-1734"

def log(msg):
    print(f"[{TAG}] {msg}", flush=True)

def run(cmd, cwd=None, check=True):
    log("$ " + " ".join(cmd))
    return subprocess.run(cmd, cwd=cwd, text=True, check=check)

workspace = Path("/home/runner/workspace")
app = workspace / "memeflow-app"
if not app.exists():
    here = Path.cwd()
    if (here / "memeflow-app").exists():
        workspace = here
        app = here / "memeflow-app"
    elif here.name == "memeflow-app":
        app = here
        workspace = here.parent
    else:
        raise SystemExit(f"[{TAG}] ERROR: memeflow-app not found")

branch = subprocess.check_output(
    ["git", "branch", "--show-current"], cwd=workspace, text=True
).strip()
if branch != EXPECTED_BRANCH:
    raise SystemExit(
        f"[{TAG}] ERROR: expected branch {EXPECTED_BRANCH}, found {branch}. "
        "Switch to the pushed debug branch first."
    )

server = app / "app-server.mjs"
trading = app / "trading.js"
archive = app / "src" / "chart-history-archive.mjs"

for target in (server, trading):
    if not target.exists():
        raise SystemExit(f"[{TAG}] ERROR: missing {target}")

server_text = server.read_text()
trading_text = trading.read_text()

required_server = [
    "const __mfChartHistory=new Map();",
    "function __mfChartSnapshot(mint){",
    "function __mfChartTradeTick(tick){",
    "if(!added)return false;",
]
required_trading = [
    "function replaceChartSnapshot(mint,incoming){",
    "function addPoint(mint,point,redraw=true)",
    "function candlesFor(points, timeframe)",
    "Math.max(\n      Number(clean[clean.length - 1].t),\n      Date.now()\n    )",
    "return candles.slice(-500);",
]
for anchor in required_server:
    if anchor not in server_text:
        raise SystemExit(f"[{TAG}] ERROR: app-server anchor not found: {anchor[:80]}")
for anchor in required_trading:
    if anchor not in trading_text:
        raise SystemExit(f"[{TAG}] ERROR: trading.js anchor not found: {anchor[:80]}")

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
backup = app / ".patch-backups" / f"trading-chart-v30-10-{stamp}"
backup.mkdir(parents=True, exist_ok=True)
shutil.copy2(server, backup / "app-server.mjs")
shutil.copy2(trading, backup / "trading.js")
if archive.exists():
    shutil.copy2(archive, backup / "chart-history-archive.mjs")
log(f"backup: {backup}")

archive_source = r"""// MEMEFLOW_TRADING_CHART_V30_10_FULL_HISTORY
// Persistent Pump.fun TradeEvent history for the Trading Terminal.
// - live chart ticks are appended to disk
// - historical signatures are paged newest -> oldest
// - confirmed transactions are decoded with the same TradeEvent layout as the live feed
// - history is never used for AI/risk/execution decisions
// - all reads are deduplicated and sorted before they reach the chart

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DISC = crypto
  .createHash('sha256')
  .update('event:TradeEvent')
  .digest()
  .subarray(0, 8);

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58(buf) {
  let x = 0n;
  for (const byte of buf) x = (x << 8n) + BigInt(byte);
  let out = '';
  while (x) {
    const r = Number(x % 58n);
    out = B58[r] + out;
    x /= 58n;
  }
  for (const byte of buf) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out || '1';
}

function u64(buf, offset) {
  return buf.length >= offset + 8 ? buf.readBigUInt64LE(offset) : null;
}

function decodeTradeEvent(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 89 || !buf.subarray(0, 8).equals(DISC)) {
    return null;
  }

  let o = 8;
  const mint = b58(buf.subarray(o, o + 32)); o += 32;
  const solAmount = u64(buf, o); o += 8;
  const tokenAmount = u64(buf, o); o += 8;
  if (solAmount === null || tokenAmount === null) return null;

  const isBuy = buf[o++] !== 0;
  const user = b58(buf.subarray(o, o + 32)); o += 32;

  let timestamp = null;
  let virtualSolReserves = null;
  let virtualTokenReserves = null;
  let realSolReserves = null;
  let realTokenReserves = null;

  if (buf.length >= o + 8) { timestamp = buf.readBigInt64LE(o); o += 8; }
  if (buf.length >= o + 8) { virtualSolReserves = u64(buf, o); o += 8; }
  if (buf.length >= o + 8) { virtualTokenReserves = u64(buf, o); o += 8; }
  if (buf.length >= o + 8) { realSolReserves = u64(buf, o); o += 8; }
  if (buf.length >= o + 8) { realTokenReserves = u64(buf, o); o += 8; }

  return {
    mint,
    user,
    isBuy,
    solAmount,
    tokenAmount,
    timestamp,
    virtualSolReserves,
    virtualTokenReserves,
    realSolReserves,
    realTokenReserves
  };
}

function programData(log) {
  const match = /^Program data:\s*([A-Za-z0-9+/=]+)\s*$/.exec(String(log || '').trim());
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

function marketPriceSol(event) {
  if (
    event?.virtualSolReserves > 0n &&
    event?.virtualTokenReserves > 0n
  ) {
    return (
      (Number(event.virtualSolReserves) / 1e9) /
      (Number(event.virtualTokenReserves) / 1e6)
    );
  }
  return null;
}

function cleanMint(mint) {
  const value = String(mint || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value)) return null;
  return value;
}

function cleanPoint(point) {
  const t = Number(point?.t);
  const priceSol = Number(point?.priceSol ?? point?.price ?? point?.markPrice);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(priceSol) || priceSol <= 0) {
    return null;
  }

  return {
    id: point?.id ? String(point.id) : null,
    t,
    price: priceSol,
    priceSol,
    source: point?.source || 'pump-history',
    isBuy: point?.isBuy === true,
    solAmount: Number(point?.solAmount) || 0,
    tokenAmount: Number(point?.tokenAmount) || 0,
    markPrice: Number.isFinite(Number(point?.markPrice ?? point?.markPriceSol))
      ? Number(point?.markPrice ?? point?.markPriceSol)
      : priceSol
  };
}

function fallbackKey(point) {
  return [
    Number(point?.t || 0),
    Number(point?.priceSol ?? point?.price ?? 0),
    point?.isBuy === true ? 1 : 0,
    Number(point?.solAmount || 0),
    Number(point?.tokenAmount || 0)
  ].join('|');
}

export class ChartHistoryArchive {
  constructor({ dataDir, rpc, pageSize = 1000, txConcurrency = 3 } = {}) {
    this.root = path.join(String(dataDir || 'data'), 'chart-history-v30-10');
    this.rpc = rpc;
    this.pageSize = Math.max(100, Math.min(1000, Number(pageSize) || 1000));
    this.txConcurrency = Math.max(1, Math.min(6, Number(txConcurrency) || 3));
    this.inFlight = new Map();
    fs.mkdirSync(this.root, { recursive: true });
  }

  _paths(mint) {
    const safe = cleanMint(mint);
    if (!safe) throw new Error('invalid chart history mint');
    return {
      points: path.join(this.root, `${safe}.jsonl`),
      meta: path.join(this.root, `${safe}.meta.json`)
    };
  }

  _readMeta(mint) {
    const { meta } = this._paths(mint);
    try {
      const parsed = JSON.parse(fs.readFileSync(meta, 'utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  _writeMeta(mint, value) {
    const { meta } = this._paths(mint);
    const tmp = `${meta}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, meta);
  }

  readPointsSync(mint) {
    const { points } = this._paths(mint);
    let text = '';
    try {
      text = fs.readFileSync(points, 'utf8');
    } catch {
      return [];
    }

    const ids = new Set();
    const fallback = new Set();
    const out = [];

    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let parsed;
      try {
        parsed = cleanPoint(JSON.parse(line));
      } catch {
        parsed = null;
      }
      if (!parsed) continue;

      if (parsed.id) {
        if (ids.has(parsed.id)) continue;
        ids.add(parsed.id);
      } else {
        const key = fallbackKey(parsed);
        if (fallback.has(key)) continue;
        fallback.add(key);
      }
      out.push(parsed);
    }

    out.sort((a, b) => Number(a.t) - Number(b.t));
    return out;
  }

  mergePointsSync(mint, hotPoints = []) {
    const merged = [
      ...this.readPointsSync(mint),
      ...(Array.isArray(hotPoints) ? hotPoints : [])
        .map(cleanPoint)
        .filter(Boolean)
    ].sort((a, b) => Number(a.t) - Number(b.t));

    const ids = new Set();
    const fallback = new Set();
    const out = [];

    for (const point of merged) {
      if (point.id) {
        if (ids.has(point.id)) continue;
        ids.add(point.id);
      } else {
        const key = fallbackKey(point);
        if (fallback.has(key)) continue;
        fallback.add(key);
      }
      out.push(point);
    }

    return out;
  }

  statusSync(mint) {
    const meta = this._readMeta(mint);
    return {
      running: this.inFlight.has(String(mint)),
      oldestComplete: meta.oldestComplete === true,
      pages: Number(meta.pages) || 0,
      signatures: Number(meta.signatures) || 0,
      transactions: Number(meta.transactions) || 0,
      historyPoints: Number(meta.historyPoints) || 0,
      historyStartAt: Number(meta.historyStartAt) || null,
      historyEndAt: Number(meta.historyEndAt) || null,
      lastError: meta.lastError || null,
      updatedAt: Number(meta.updatedAt) || null
    };
  }

  appendPoint(mint, point) {
    const safe = cleanMint(mint);
    const cleaned = cleanPoint(point);
    if (!safe || !cleaned) return false;

    const { points } = this._paths(safe);
    const line = JSON.stringify(cleaned) + '\n';
    fs.appendFile(points, line, () => {});
    return true;
  }

  _transactionPoints(mint, signatureRow) {
    return (async () => {
      const signature = String(signatureRow?.signature || '');
      if (!signature) return [];

      const tx = await this.rpc.call('getTransaction', [
        signature,
        {
          encoding: 'json',
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        }
      ]);

      if (!tx || tx?.meta?.err) return [];

      const logs = Array.isArray(tx?.meta?.logMessages)
        ? tx.meta.logMessages
        : [];

      const out = [];
      let eventIndex = 0;

      for (const log of logs) {
        const buf = programData(log);
        if (!buf) continue;
        const event = decodeTradeEvent(buf);
        if (!event) continue;

        const index = eventIndex++;
        if (event.mint !== mint) continue;

        const priceSol = marketPriceSol(event);
        if (!(Number.isFinite(priceSol) && priceSol > 0)) continue;

        const eventAt = (
          event.timestamp !== null &&
          event.timestamp !== undefined &&
          event.timestamp > 0n
        )
          ? Number(event.timestamp) * 1000
          : Number(tx?.blockTime || signatureRow?.blockTime || 0) * 1000;

        if (!(Number.isFinite(eventAt) && eventAt > 0)) continue;

        out.push(cleanPoint({
          id: `${signature}:${index}`,
          t: eventAt,
          priceSol,
          markPrice: priceSol,
          source: 'pump-history-backfill',
          isBuy: event.isBuy === true,
          solAmount: Number(event.solAmount) / 1e9,
          tokenAmount: Number(event.tokenAmount) / 1e6
        }));
      }

      return out.filter(Boolean);
    })();
  }

  ensureBackfill(mint, { onProgress = null } = {}) {
    const safe = cleanMint(mint);
    if (!safe) return Promise.reject(new Error('invalid chart history mint'));
    if (!this.rpc || typeof this.rpc.call !== 'function') {
      return Promise.reject(new Error('chart history RPC is unavailable'));
    }

    const existingJob = this.inFlight.get(safe);
    if (existingJob) return existingJob;

    const job = this._runBackfill(safe, onProgress)
      .finally(() => {
        if (this.inFlight.get(safe) === job) {
          this.inFlight.delete(safe);
        }
      });

    this.inFlight.set(safe, job);
    return job;
  }

  async _runBackfill(mint, onProgress) {
    const existing = this.readPointsSync(mint);
    const seenIds = new Set(existing.map(p => p.id).filter(Boolean));
    const seenSignatures = new Set(
      [...seenIds].map(id => String(id).split(':')[0]).filter(Boolean)
    );

    let meta = this._readMeta(mint);
    const wasOldestComplete = meta.oldestComplete === true;
    let before = null;
    let exhausted = false;
    let reachedKnown = false;
    let pagesThisRun = 0;
    let signaturesThisRun = 0;
    let transactionsThisRun = 0;
    let pointsThisRun = 0;

    meta = {
      ...meta,
      running: true,
      lastError: null,
      lastStartedAt: Date.now(),
      updatedAt: Date.now()
    };
    this._writeMeta(mint, meta);

    try {
      for (let pageNo = 0; pageNo < 10000; pageNo++) {
        const config = {
          limit: this.pageSize,
          commitment: 'confirmed'
        };
        if (before) config.before = before;

        const rows = await this.rpc.call('getSignaturesForAddress', [
          mint,
          config
        ]);

        const page = Array.isArray(rows) ? rows : [];
        pagesThisRun++;

        if (!page.length) {
          exhausted = true;
          break;
        }

        const toFetch = [];
        for (const row of page) {
          const signature = String(row?.signature || '');
          if (!signature || row?.err) continue;

          if (wasOldestComplete && seenSignatures.has(signature)) {
            reachedKnown = true;
            break;
          }

          toFetch.push(row);
        }

        for (let i = 0; i < toFetch.length; i += this.txConcurrency) {
          const chunk = toFetch.slice(i, i + this.txConcurrency);
          const results = await Promise.all(
            chunk.map(row => this._transactionPoints(mint, row))
          );

          const fresh = [];
          for (let j = 0; j < chunk.length; j++) {
            const signature = String(chunk[j]?.signature || '');
            if (signature) {
              signaturesThisRun++;
              seenSignatures.add(signature);
            }
            transactionsThisRun++;

            for (const point of results[j] || []) {
              if (!point) continue;
              if (point.id && seenIds.has(point.id)) continue;
              if (point.id) seenIds.add(point.id);
              fresh.push(point);
            }
          }

          if (fresh.length) {
            const { points } = this._paths(mint);
            fs.appendFileSync(
              points,
              fresh.map(point => JSON.stringify(point)).join('\n') + '\n'
            );
            pointsThisRun += fresh.length;
          }
        }

        const allNow = this.readPointsSync(mint);
        meta = {
          ...meta,
          running: true,
          pages: (Number(meta.pages) || 0) + 1,
          signatures: (Number(meta.signatures) || 0) + toFetch.length,
          transactions: (Number(meta.transactions) || 0) + toFetch.length,
          historyPoints: allNow.length,
          historyStartAt: allNow[0]?.t || null,
          historyEndAt: allNow[allNow.length - 1]?.t || null,
          lastCursor: page[page.length - 1]?.signature || null,
          updatedAt: Date.now()
        };
        this._writeMeta(mint, meta);

        if (typeof onProgress === 'function') {
          try {
            onProgress({
              mint,
              page: pagesThisRun,
              points: allNow.length,
              oldestComplete: wasOldestComplete
            });
          } catch {}
        }

        if (reachedKnown && wasOldestComplete) break;

        if (page.length < this.pageSize) {
          exhausted = true;
          break;
        }

        before = page[page.length - 1]?.signature || null;
        if (!before) {
          exhausted = true;
          break;
        }
      }

      const all = this.readPointsSync(mint);
      const oldestComplete = wasOldestComplete || exhausted;

      meta = {
        ...meta,
        running: false,
        oldestComplete,
        lastCompletedAt: Date.now(),
        historyPoints: all.length,
        historyStartAt: all[0]?.t || null,
        historyEndAt: all[all.length - 1]?.t || null,
        lastRun: {
          pages: pagesThisRun,
          signatures: signaturesThisRun,
          transactions: transactionsThisRun,
          points: pointsThisRun,
          reachedKnown,
          exhausted
        },
        updatedAt: Date.now(),
        lastError: null
      };
      this._writeMeta(mint, meta);

      return {
        mint,
        oldestComplete,
        points: all.length,
        pages: pagesThisRun,
        signatures: signaturesThisRun,
        transactions: transactionsThisRun,
        added: pointsThisRun
      };
    } catch (error) {
      meta = {
        ...meta,
        running: false,
        lastError: String(error?.message || error),
        lastFailedAt: Date.now(),
        updatedAt: Date.now()
      };
      this._writeMeta(mint, meta);
      throw error;
    }
  }
}
"""
archive.parent.mkdir(parents=True, exist_ok=True)
archive.write_text(archive_source)

# 1) import
import_anchor = "import { createDexVerificationGate } from './src/dex-verification-gate.mjs'; // MEMEFLOW_PUMP_DEX_GATE_V33\n"
import_line = "import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; // MEMEFLOW_TRADING_CHART_V30_10_FULL_HISTORY\n"
if import_line not in server_text:
    if import_anchor not in server_text:
        raise SystemExit(f"[{TAG}] ERROR: import anchor missing")
    server_text = server_text.replace(import_anchor, import_anchor + import_line, 1)

# 2) dedicated history RPC + archive
rpc_anchor = "const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');\n"
rpc_insert = """const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
const __mfChartHistoryRpcUrls=(process.env.CHART_HISTORY_RPC_URLS||process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);
const __mfChartHistoryRpc=new RpcPool(__mfChartHistoryRpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
__mfChartHistoryRpc.minIntervalMs=Math.max(250,Number(process.env.CHART_HISTORY_RPC_MIN_INTERVAL_MS||450));
__mfChartHistoryRpc.methodMinIntervalMs.getTransaction=Math.max(250,Number(process.env.CHART_HISTORY_GET_TRANSACTION_MIN_INTERVAL_MS||350));
const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  pageSize:Number(process.env.CHART_HISTORY_PAGE_SIZE||1000),
  txConcurrency:Number(process.env.CHART_HISTORY_TX_CONCURRENCY||3)
});
"""
if "const __mfChartArchive=new ChartHistoryArchive" not in server_text:
    if rpc_anchor not in server_text:
        raise SystemExit(f"[{TAG}] ERROR: RPC anchor missing")
    server_text = server_text.replace(rpc_anchor, rpc_insert, 1)

# 3) replace snapshot block with persistent merged snapshot + async backfill
snapshot_start = server_text.index("function __mfChartSnapshot(mint){")
trade_start = server_text.index("function __mfChartTradeTick(tick){", snapshot_start)

snapshot_block = r"""const __mfChartBackfillJobs=new Map();

function __mfBroadcastChartSnapshot(mint){
  const listeners=streams.get(mint);
  if(!listeners?.size)return;

  const payload=
    `event: snapshot\n`+
    `data: ${JSON.stringify(__mfChartSnapshot(mint,{startBackfill:false}))}\n\n`;

  for(const res of [...listeners]){
    try{res.write(payload)}catch{}
  }
}

function __mfStartChartBackfill(mint){
  if(!mint || __mfChartBackfillJobs.has(mint))return;

  const job=__mfChartArchive.ensureBackfill(mint,{
    onProgress:()=>__mfBroadcastChartSnapshot(mint)
  })
    .then(()=>__mfBroadcastChartSnapshot(mint))
    .catch(error=>{
      console.warn('[MEMEFLOW CHART HISTORY]',mint,String(error?.message||error));
      __mfBroadcastChartSnapshot(mint);
    })
    .finally(()=>{
      if(__mfChartBackfillJobs.get(mint)===job){
        __mfChartBackfillJobs.delete(mint);
      }
    });

  __mfChartBackfillJobs.set(mint,job);
}

function __mfChartSnapshot(mint,{startBackfill=true}={}){
  const token=store.state?.tokens?.[mint]||null;
  const row=__mfChartHistory.get(mint);

  // Always keep one visible point while historical RPC sync starts.
  // This seed is discarded by the normal real-trade path as soon as a
  // canonical Pump TradeEvent arrives.
  if(
    (!row || !row.points?.length) &&
    token?.priceSol
  ){
    __mfChartRecord(
      mint,
      token.priceSol,
      Number(token.lastPriceAt)||Date.now(),
      'current-price-seed'
    );
  }

  const hot=(__mfChartHistory.get(mint)?.points||[]);
  const points=__mfChartArchive.mergePointsSync(mint,hot);
  const archiveStatus=__mfChartArchive.statusSync(mint);

  if(startBackfill){
    queueMicrotask(()=>__mfStartChartBackfill(mint));
  }

  const lastSource=points[points.length-1]?.source||'pump-curve-mark';

  return {
    points,
    status:{
      stale:points.length===0,
      source:lastSource,
      historyPoints:points.length,
      historyStartAt:points[0]?.t||null,
      historyEndAt:points[points.length-1]?.t||null,
      backfillRunning:archiveStatus.running===true || __mfChartBackfillJobs.has(mint),
      fullHistoryReady:archiveStatus.oldestComplete===true,
      backfillError:archiveStatus.lastError||null,
      directTradeTicks:true,
      executionPriceTicks:false,
      canonicalCurveMark:true,
      persistentHistory:true,
      currency:'SOL'
    }
  };
}

"""
server_text = server_text[:snapshot_start] + snapshot_block + server_text[trade_start:]

# 4) persist each accepted live chart tick
persist_anchor = "  if(!added)return false;\n\n  const listeners=streams.get(mint);"
persist_insert = """  if(!added)return false;

  // V30.10: accepted live TradeEvents are persisted independently from the
  // bounded in-memory hot cache. This survives Replit/server restarts.
  try{
    __mfChartArchive.appendPoint(mint,{
      id:tick?.id||null,
      t:at,
      priceSol:price,
      price,
      source,
      isBuy:tick?.isBuy===true,
      solAmount:Number(tick?.solAmount)||0,
      tokenAmount:Number(tick?.tokenAmount)||0,
      markPrice:Number.isFinite(Number(tick?.markPriceSol))
        ? Number(tick.markPriceSol)
        : price
    });
  }catch{}

  const listeners=streams.get(mint);"""
if "V30.10: accepted live TradeEvents are persisted" not in server_text:
    if persist_anchor not in server_text:
        raise SystemExit(f"[{TAG}] ERROR: live persist anchor missing")
    server_text = server_text.replace(persist_anchor, persist_insert, 1)

server.write_text(server_text)

# 5) browser keeps complete snapshot instead of truncating to 8k
trading_text = trading_text.replace(
    "  state.rawByMint.set(mint,points.slice(-8000));",
    "  // V30.10: the selected token keeps its complete persistent history in the browser.\n"
    "  // Rendering still aggregates to candles, so All can start at token creation.\n"
    "  state.rawByMint.set(mint,points);",
    1
)

trading_text = trading_text.replace(
    """  if(points.length>8000){
    points.splice(0,points.length-8000);
  }

""",
    "",
    1
)

# 6) a quiet token must not become blank merely because wall-clock time advanced
trading_text = trading_text.replace(
    """    const end = Math.max(
      Number(clean[clean.length - 1].t),
      Date.now()
    );
""",
    """    // V30.10: window relative to the token's last real trade, not Date.now().
    // Otherwise a quiet token's entire 1s/1m chart disappears after the horizon.
    const end = Number(clean[clean.length - 1].t);
""",
    1
)

# 7) All must render from the first historical bucket, not only the last 500
trading_text = trading_text.replace(
    "  return candles.slice(-500);",
    "  return timeframe === 'all' ? candles : candles.slice(-500);",
    1
)

# 8) expose backfill state in feed label without changing chart logic
snapshot_listener_old = """      $('feedState').textContent=
        payload?.status?.stale===false || incoming.length
          ? 'LIVE'
          : 'WAITING';
"""
snapshot_listener_new = """      $('feedState').textContent=
        payload?.status?.backfillRunning===true
          ? 'HISTORY SYNC'
          : payload?.status?.fullHistoryReady===true
            ? 'LIVE · FULL HISTORY'
            : payload?.status?.stale===false || incoming.length
              ? 'LIVE'
              : 'WAITING';
"""
if snapshot_listener_old in trading_text:
    trading_text = trading_text.replace(snapshot_listener_old, snapshot_listener_new, 1)

trading.write_text(trading_text)

def rollback():
    log("rolling back files from backup")
    shutil.copy2(backup / "app-server.mjs", server)
    shutil.copy2(backup / "trading.js", trading)
    old_archive = backup / "chart-history-archive.mjs"
    if old_archive.exists():
        shutil.copy2(old_archive, archive)
    elif archive.exists():
        archive.unlink()

try:
    run(["node", "--check", str(archive)], cwd=workspace)
    run(["node", "--check", str(server)], cwd=workspace)
    run(["node", "--check", str(trading)], cwd=workspace)
    run(["git", "diff", "--check"], cwd=workspace)

    final_server = server.read_text()
    final_trading = trading.read_text()
    checks = {
        "archive import": "MEMEFLOW_TRADING_CHART_V30_10_FULL_HISTORY" in final_server,
        "persistent append": "V30.10: accepted live TradeEvents are persisted" in final_server,
        "backfill": "__mfStartChartBackfill" in final_server,
        "no browser 8k slice": "points.slice(-8000)" not in final_trading,
        "quiet-token fix": "window relative to the token's last real trade" in final_trading,
        "All full candles": "timeframe === 'all' ? candles : candles.slice(-500)" in final_trading,
    }
    for name, ok in checks.items():
        log(f"{'OK' if ok else 'FAIL'}: {name}")
        if not ok:
            raise RuntimeError(f"post-check failed: {name}")

except Exception:
    rollback()
    raise

run([
    "git", "add",
    "memeflow-app/app-server.mjs",
    "memeflow-app/trading.js",
    "memeflow-app/src/chart-history-archive.mjs"
], cwd=workspace)

diff = subprocess.run(
    ["git", "diff", "--cached", "--quiet"], cwd=workspace
)
if diff.returncode == 0:
    log("no staged changes; nothing to commit")
else:
    run([
        "git", "commit", "-m",
        "Trading chart V30.10 persistent full history"
    ], cwd=workspace)
    run([
        "git", "push", "-u", "origin", branch
    ], cwd=workspace)

log("INSTALL + CHECK + COMMIT + PUSH COMPLETE")
log(f"branch: {branch}")
log(f"backup: {backup}")
log("Restart the Replit workflow/app and hard-refresh Trading Terminal.")
log("Open a token: HISTORY SYNC means RPC backfill is running; LIVE · FULL HISTORY means creation-to-now history is ready.")
