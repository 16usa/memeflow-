// MEMEFLOW_TRADING_CHART_V30_10_FULL_HISTORY
// MEMEFLOW_TRADING_CHART_V30_12_FULL_HISTORY_FREE_PAN_IMAGES
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
    if (!safe) {
      return Promise.reject(new Error('invalid chart history mint'));
    }

    const status = this.statusSync(safe);

    if (status.oldestComplete === true) {
      const result = {
        ...status,
        mint: safe,
        backfillDisabled: false,
        cached: true
      };
      if (typeof onProgress === 'function') {
        try { onProgress(result); } catch {}
      }
      return Promise.resolve(result);
    }

    const existing = this.inFlight.get(safe);
    if (existing) return existing;

    if (!this.rpc || typeof this.rpc.call !== 'function') {
      const error = new Error('CHART_HISTORY_RPC_UNAVAILABLE');
      error.code = 'CHART_HISTORY_RPC_UNAVAILABLE';
      return Promise.reject(error);
    }

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
    let lastProgressAt = 0;

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

          if (seenSignatures.has(signature)) {
            if (wasOldestComplete) {
              reachedKnown = true;
              break;
            }
            continue;
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

          const progressDue =
            typeof onProgress === 'function' &&
            (
              Date.now() - lastProgressAt >= 800 ||
              i + chunk.length >= toFetch.length
            );

          if (progressDue) {
            lastProgressAt = Date.now();
            try {
              onProgress({
                mint,
                page: pagesThisRun,
                points: null,
                oldestComplete: false
              });
            } catch {}
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

// MEMEFLOW_CHART_HISTORY_LIVE_LEVELS_V9_1_DIRTY_SAFE
