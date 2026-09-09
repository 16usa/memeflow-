#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

import {
  REPAIR_VERSION,
  finite,
  explicitNumericZero,
  isLegacyManualFlatCandidate,
  buildHistoricalFlatPlan,
  summarizePlans,
  selectFinalSell
} from '../src/historical-flat-repair-v79.mjs';
import {PlatformTradeAnalytics} from '../src/platform-trade-analytics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const dataDir = path.resolve(appRoot, process.env.DATA_DIR || 'data');
const stateFile = path.join(dataDir, 'state.json');
const archiveDbFile = path.join(dataDir, 'chart-history-archive-v1.sqlite');
const analyticsDbFile = path.join(dataDir, 'platform-trade-analytics-v2.sqlite');
const reportsDir = path.join(repoRoot, '.memeflow-reports');
const backupsDir = path.join(repoRoot, '.memeflow-backups');

const args = new Set(process.argv.slice(2));
const isApply = args.has('--apply');
const isAudit = !isApply;
const confirmArg = process.argv.find(v => v.startsWith('--confirm='));
const confirmation = confirmArg ? confirmArg.slice('--confirm='.length) : '';
const maxGapArg = process.argv.find(v => v.startsWith('--max-gap-ms='));
const maxGapMs = Math.max(
  1_000,
  Number(maxGapArg ? maxGapArg.slice('--max-gap-ms='.length) : 120_000) || 120_000
);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readState() {
  if (!fs.existsSync(stateFile)) {
    throw new Error(`STATE_NOT_FOUND: ${stateFile}`);
  }
  return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

function openArchive() {
  if (!fs.existsSync(archiveDbFile)) return null;
  return new DatabaseSync(archiveDbFile, {readOnly: true});
}

function archivePointFor(db, position) {
  if (!db) return null;
  const mint = String(position?.mint || '');
  const closedAtMs = finite(position?.closedAtMs);
  const openedAtMs = finite(position?.openedAtMs);
  if (!mint || closedAtMs === null || openedAtMs === null) return null;

  try {
    return db.prepare(`
      SELECT
        t_ms AS t,
        price_sol AS priceSol,
        sol_amount AS solAmount,
        event_id AS eventId
      FROM chart_points
      WHERE
        mint=? AND
        t_ms<=? AND
        t_ms>=? AND
        price_sol IS NOT NULL AND
        price_sol>0
      ORDER BY t_ms DESC
      LIMIT 1
    `).get(mint, closedAtMs, openedAtMs) || null;
  } catch {
    return null;
  }
}

function buildAudit(state) {
  const positions = Object.values(state?.paperPositions || {});
  const trades = Object.values(state?.paperTrades || {});
  const archive = openArchive();

  try {
    const closed = positions.filter(
      p => String(p?.status || '').toUpperCase() === 'CLOSED'
    );
    const explicitFlat = closed.filter(
      p => explicitNumericZero(p?.realizedPnlSol)
    );
    const candidates = closed.filter(isLegacyManualFlatCandidate);

    const plans = candidates.map(position => {
      const point = archivePointFor(archive, position);
      return buildHistoricalFlatPlan({
        position,
        trades,
        archivePoint: point,
        maxGapMs
      });
    });

    return {
      version: REPAIR_VERSION,
      mode: 'AUDIT',
      generatedAt: new Date().toISOString(),
      dataDir,
      archiveAvailable: Boolean(archive),
      maxGapMs,
      totals: {
        allPositions: positions.length,
        closedPositions: closed.length,
        explicitFlatPositions: explicitFlat.length,
        legacyManualFlatCandidates: candidates.length
      },
      summary: summarizePlans(plans),
      plans
    };
  } finally {
    try { archive?.close(); } catch {}
  }
}

function writeReport(report, suffix = 'audit') {
  fs.mkdirSync(reportsDir, {recursive: true});
  const file = path.join(
    reportsDir,
    `historical-flat-repair-v79-${suffix}-${stamp()}.json`
  );
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  return file;
}

function printAudit(report, reportFile) {
  const t = report.totals;
  const s = report.summary;

  console.log('');
  console.log('MEMEFLOW HISTORICAL FLAT REPAIR V79');
  console.log('===================================');
  console.log('MODE: AUDIT ONLY — NO TRADING DATA CHANGED');
  console.log('');
  console.log(`Closed positions:              ${t.closedPositions}`);
  console.log(`Explicit Flat positions:       ${t.explicitFlatPositions}`);
  console.log(`Legacy manual Flat candidates: ${t.legacyManualFlatCandidates}`);
  console.log(`Recoverable from archive:      ${s.recoverable}`);
  console.log(`  -> would become WIN:         ${s.wouldBecomeWins}`);
  console.log(`  -> would become LOSS:        ${s.wouldBecomeLosses}`);
  console.log(`  -> verified true Flat:       ${s.verifiedTrueFlat}`);
  console.log(`Unrecoverable -> UNKNOWN:      ${s.wouldBecomeUnknown}`);
  console.log(`Chart archive available:       ${report.archiveAvailable ? 'YES' : 'NO'}`);
  console.log(`Maximum accepted mark gap:     ${report.maxGapMs} ms`);

  if (Object.keys(s.unknownReasons || {}).length) {
    console.log('');
    console.log('Unknown reasons:');
    for (const [reason, count] of Object.entries(s.unknownReasons)) {
      console.log(`  ${reason}: ${count}`);
    }
  }

  console.log('');
  console.log(`Report: ${reportFile}`);
  console.log('');
  console.log('DO NOT APPLY YET.');
  console.log('Send this summary to ChatGPT first so the repair set can be reviewed.');
}

function serverResponsive(port) {
  return new Promise(resolve => {
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 700
      },
      res => {
        res.resume();
        done(true);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      done(false);
    });
    req.on('error', () => done(false));
  });
}

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.copyFileSync(src, dst);
  return true;
}

function createBackup(auditReport) {
  fs.mkdirSync(backupsDir, {recursive: true});
  const dir = path.join(
    backupsDir,
    `historical-flat-repair-v79-${stamp()}`
  );
  fs.mkdirSync(dir, {recursive: true});

  const manifest = {
    version: REPAIR_VERSION,
    createdAt: new Date().toISOString(),
    dataDir,
    files: {}
  };

  const sources = [
    stateFile,
    analyticsDbFile,
    analyticsDbFile + '-wal',
    analyticsDbFile + '-shm'
  ];

  for (const src of sources) {
    const rel = path.basename(src);
    const existed = copyIfExists(src, path.join(dir, rel));
    manifest.files[rel] = {source: src, existed};
  }

  fs.writeFileSync(
    path.join(dir, 'audit-before.json'),
    JSON.stringify(auditReport, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  return dir;
}

function atomicWriteJson(file, value) {
  const tmp = `${file}.v79-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

function annotatePosition(position, plan) {
  position.historicalOutcomeRepair = {
    version: REPAIR_VERSION,
    repairedAt: new Date().toISOString(),
    kind: plan.kind,
    code: plan.code,
    legacy: {
      exitPriceSol: plan.legacyExitPriceSol ?? null,
      realizedPnlSol: plan.legacyRealizedPnlSol ?? null,
      realizedPnlPct: plan.legacyRealizedPnlPct ?? null
    },
    evidence:
      plan.kind === 'RECOVERABLE'
        ? {
            source: 'chart-history-archive-v1',
            markAtMs: plan.markAtMs,
            markPriceSol: plan.markPriceSol,
            gapMs: plan.gapMs,
            finalTradeId: plan.finalTradeId
          }
        : null
  };

  if (plan.kind === 'RECOVERABLE') {
    position.exitPriceSol = plan.markPriceSol;
    position.currentPriceSol = plan.markPriceSol;
    position.realizedPnlSol = plan.newRealizedPnlSol;
    position.realizedPnlPct = plan.newRealizedPnlPct;
    position.exitPriceSource = 'historical-chart-archive-v1';
    position.exitPriceAtMs = plan.markAtMs;
    position.exitPriceAt = new Date(plan.markAtMs).toISOString();
    position.exitSettlementVersion = REPAIR_VERSION;
    position.outcomeStatus = plan.outcome;
  } else {
    position.exitPriceSol = null;
    position.realizedPnlSol = null;
    position.realizedPnlPct = null;
    position.exitPriceSource = 'historical-price-unverified';
    position.exitPriceAtMs = null;
    position.exitPriceAt = null;
    position.exitSettlementVersion = REPAIR_VERSION;
    position.outcomeStatus = 'UNKNOWN';
  }
}

function annotateFinalTrade(trade, position, plan) {
  if (!trade) return;

  trade.historicalOutcomeRepair = {
    version: REPAIR_VERSION,
    repairedAt: new Date().toISOString(),
    kind: plan.kind,
    legacy: {
      priceSol: plan.legacyFinalTradePriceSol ?? finite(trade.priceSol),
      valueSol: plan.legacyFinalTradeValueSol ?? finite(trade.valueSol),
      realizedPnlSol:
        plan.legacyFinalTradePnlSol ?? finite(trade.realizedPnlSol)
    }
  };

  if (plan.kind === 'RECOVERABLE') {
    trade.priceSol = plan.markPriceSol;
    trade.valueSol = plan.finalTradeQuantity * plan.markPriceSol;
    trade.realizedPnlSol = plan.finalLegPnlSol;
    trade.priceSource = 'historical-chart-archive-v1';
    trade.priceAtMs = plan.markAtMs;
    trade.outcomeStatus = plan.outcome;
  } else {
    trade.priceSol = null;
    trade.valueSol = null;
    trade.realizedPnlSol = null;
    trade.priceSource = 'historical-price-unverified';
    trade.priceAtMs = null;
    trade.outcomeStatus = 'UNKNOWN';
  }
}

function restoreBackup(dir) {
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`BACKUP_MANIFEST_NOT_FOUND: ${manifestFile}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

  for (const suffix of ['-wal', '-shm']) {
    try { fs.rmSync(analyticsDbFile + suffix, {force: true}); } catch {}
  }

  for (const [name, meta] of Object.entries(manifest.files || {})) {
    const dst = meta.source;
    const src = path.join(dir, name);
    if (meta.existed) {
      if (!fs.existsSync(src)) {
        throw new Error(`BACKUP_FILE_NOT_FOUND: ${src}`);
      }
      fs.copyFileSync(src, dst);
    } else {
      try { fs.rmSync(dst, {force: true}); } catch {}
    }
  }
}

async function applyRepair() {
  if (confirmation !== 'REPAIR_HISTORICAL_FLATS') {
    throw new Error(
      'CONFIRMATION_REQUIRED: use --confirm=REPAIR_HISTORICAL_FLATS'
    );
  }

  const port = Math.max(1, Number(process.env.PORT || 3000) || 3000);
  if (await serverResponsive(port)) {
    throw new Error(
      `SERVER_RUNNING_STOP_REQUIRED: MEMEFLOW is responding on port ${port}. Stop the app before historical repair so in-memory state cannot overwrite repaired data.`
    );
  }

  const state = readState();
  const audit = buildAudit(state);
  const beforeReport = writeReport(audit, 'pre-apply');

  const backupDir = createBackup(audit);
  const positionsById = state.paperPositions || {};
  const tradesById = state.paperTrades || {};
  const changedPositions = [];
  const changedTrades = [];

  try {
    for (const plan of audit.plans) {
      if (plan.kind !== 'RECOVERABLE' && plan.kind !== 'UNKNOWN') continue;

      const position = positionsById[plan.positionId];
      if (!position) continue;

      const finalTrade =
        plan.finalTradeId
          ? tradesById[plan.finalTradeId]
          : selectFinalSell(Object.values(tradesById), position);

      annotatePosition(position, plan);
      annotateFinalTrade(finalTrade, position, plan);

      changedPositions.push(position);
      if (finalTrade) changedTrades.push({trade: finalTrade, position});
    }

    atomicWriteJson(stateFile, state);

    const analytics = new PlatformTradeAnalytics({dir: dataDir});
    try {
      const updateTrade = analytics.db.prepare(`
        UPDATE platform_trade_events
        SET
          price_sol=?,
          value_sol=?,
          realized_pnl_sol=?
        WHERE trade_id=?
      `);

      for (const position of changedPositions) {
        analytics.recordPosition(position);
      }

      for (const {trade, position} of changedTrades) {
        updateTrade.run(
          finite(trade.priceSol),
          finite(trade.valueSol),
          finite(trade.realizedPnlSol),
          String(trade.id)
        );

        // Inserts the row if it was historically absent; existing rows remain
        // unchanged by INSERT OR IGNORE after the direct UPDATE above.
        analytics.recordTrade(trade, position);
      }
    } finally {
      analytics.close();
    }

    const result = {
      version: REPAIR_VERSION,
      mode: 'APPLY',
      appliedAt: new Date().toISOString(),
      backupDir,
      preApplyReport: beforeReport,
      changedPositions: changedPositions.length,
      changedTrades: changedTrades.length,
      summary: audit.summary
    };
    const resultFile = writeReport(result, 'applied');

    console.log('');
    console.log('V79 APPLY COMPLETE');
    console.log(`Changed positions: ${changedPositions.length}`);
    console.log(`Changed final SELL rows: ${changedTrades.length}`);
    console.log(`Backup: ${backupDir}`);
    console.log(`Result report: ${resultFile}`);
    console.log('');
    console.log('Rollback (with MEMEFLOW stopped):');
    console.log(
      `node memeflow-app/scripts/historical-flat-repair-v79.mjs --rollback="${backupDir}" --confirm=ROLLBACK_HISTORICAL_FLATS`
    );
  } catch (error) {
    try {
      restoreBackup(backupDir);
      console.error(`Automatic rollback restored: ${backupDir}`);
    } catch (rollbackError) {
      console.error(
        'AUTOMATIC_ROLLBACK_FAILED:',
        rollbackError?.message || rollbackError
      );
    }
    throw error;
  }
}

async function rollbackRequested() {
  const raw = process.argv.find(v => v.startsWith('--rollback='));
  if (!raw) return false;

  if (confirmation !== 'ROLLBACK_HISTORICAL_FLATS') {
    throw new Error(
      'ROLLBACK_CONFIRMATION_REQUIRED: use --confirm=ROLLBACK_HISTORICAL_FLATS'
    );
  }

  const port = Math.max(1, Number(process.env.PORT || 3000) || 3000);
  if (await serverResponsive(port)) {
    throw new Error(
      `SERVER_RUNNING_STOP_REQUIRED: stop MEMEFLOW on port ${port} before rollback.`
    );
  }

  const dir = raw.slice('--rollback='.length).replace(/^["']|["']$/g, '');
  restoreBackup(dir);
  console.log(`ROLLBACK OK: restored ${dir}`);
  return true;
}

try {
  if (await rollbackRequested()) {
    process.exit(0);
  }

  if (isApply) {
    await applyRepair();
  } else {
    const state = readState();
    const report = buildAudit(state);
    const reportFile = writeReport(report, 'audit');
    printAudit(report, reportFile);
  }
} catch (error) {
  console.error('');
  console.error('V79 ERROR:', error?.message || error);
  process.exitCode = 1;
}
