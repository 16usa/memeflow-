import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const file = path.join(ROOT, 'memeflow-app', 'src', 'discqueue.mjs');

if (!fs.existsSync(file)) {
  console.error('[MEMEFLOW QUEUE V3] Missing: ' + file);
  process.exit(1);
}

const original = fs.readFileSync(file, 'utf8');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, 'memeflow-app', '.queue-v3-backup', stamp);
const backupFile = path.join(backupDir, 'src', 'discqueue.mjs');
fs.mkdirSync(path.dirname(backupFile), { recursive: true });
fs.copyFileSync(file, backupFile);

function restore() {
  try { fs.copyFileSync(backupFile, file); } catch {}
}
function once(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 match, found ${n}`);
  return src.replace(from, to);
}

try {
  let q = original;

  const alreadyFixed =
    q.includes('retryScheduled') &&
    q.includes('recentDone') &&
    q.includes('retryQueueMax') &&
    q.includes('signaturesRecentlyDeduplicated');

  if (alreadyFixed) {
    console.log('[MEMEFLOW QUEUE V3] Already installed — no changes needed.');
    process.exit(0);
  }

  if (!q.includes('signaturesRecentlyDeduplicated: 0,')) {
    q = once(
      q,
      `    signaturesDeduplicated: 0,\n    queueDropped: 0,`,
      `    signaturesDeduplicated: 0,\n    signaturesRecentlyDeduplicated: 0,\n    queueDropped: 0,\n    retryQueueDropped: 0,`,
      'metrics'
    );
  }

  if (!q.includes('recentDedupeMs = 300000')) {
    q = once(
      q,
      `    retryDelays = [250, 750, 2000, 5000],\n  } = config || {};`,
      `    retryDelays = [250, 750, 2000, 5000],\n    recentDedupeMs = 300000,\n    retryQueueMax = queueMax,\n  } = config || {};`,
      'config'
    );
  }

  if (!q.includes('const retryScheduled = new Set();')) {
    q = once(
      q,
      `  const retryQueue = [];\n  const retrySet   = new Set();\n\n  const processing = new Set();`,
      `  const retryQueue = [];\n  const retrySet   = new Set();\n  const retryScheduled = new Set();\n\n  const processing = new Set();\n  const recentDone = new Map();`,
      'sets'
    );
  }

  if (!q.includes('function _pruneRecent(')) {
    q = once(
      q,
      `  function _openCircuit() {`,
      `  function _pruneRecent(now = Date.now()) {\n    for (const [sig, at] of recentDone) {\n      if (now - at <= recentDedupeMs) break;\n      recentDone.delete(sig);\n    }\n  }\n\n  function _rememberDone(sig) {\n    recentDone.delete(sig);\n    recentDone.set(sig, Date.now());\n    _pruneRecent();\n  }\n\n  function _openCircuit() {`,
      'recent helpers'
    );
  }

  if (!q.includes('_rememberDone(sig);')) {
    q = once(
      q,
      `      discMetrics.signaturesProcessed++;\n      if (onSignatureProcessed) onSignatureProcessed();`,
      `      discMetrics.signaturesProcessed++;\n      _rememberDone(sig);\n      if (onSignatureProcessed) onSignatureProcessed();`,
      'remember success'
    );
  }

  if (!q.includes('retryScheduled.add(sig);')) {
    q = once(
      q,
      `        discMetrics.transactionRetryScheduled++;\n        processing.delete(sig);\n        _sync();\n        setTimeout(() => {\n          if (!retrySet.has(sig) && !processing.has(sig)) {\n            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });\n            retrySet.add(sig);\n            _sync();\n            _drain();\n          }\n        }, delayMs);`,
      `        discMetrics.transactionRetryScheduled++;\n        processing.delete(sig);\n        retryScheduled.add(sig);\n        _sync();\n        setTimeout(() => {\n          retryScheduled.delete(sig);\n          _pruneRecent();\n\n          if (Date.now() - enqueuedAt > maxSignatureAgeMs) {\n            discMetrics.staleSignaturesDropped++;\n            _sync();\n            _drain();\n            return;\n          }\n\n          if (!freshSet.has(sig) && !retrySet.has(sig) &&\n              !processing.has(sig) && !recentDone.has(sig)) {\n            if (retryQueue.length >= retryQueueMax) {\n              const dropped = retryQueue.shift();\n              retrySet.delete(dropped.sig);\n              discMetrics.retryQueueDropped++;\n              discMetrics.queueDropped++;\n            }\n            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });\n            retrySet.add(sig);\n            _sync();\n            _drain();\n          } else {\n            discMetrics.signaturesDeduplicated++;\n          }\n        }, delayMs);`,
      'retry scheduling'
    );
  }

  if (!q.includes('signaturesRecentlyDeduplicated++;')) {
    q = once(
      q,
      `  function enqueue(sig) {\n    if (freshSet.has(sig) || retrySet.has(sig) || processing.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      return false;\n    }`,
      `  function enqueue(sig) {\n    _pruneRecent();\n    if (recentDone.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      discMetrics.signaturesRecentlyDeduplicated++;\n      return false;\n    }\n    if (freshSet.has(sig) || retrySet.has(sig) || retryScheduled.has(sig) || processing.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      return false;\n    }`,
      'enqueue dedupe'
    );
  }

  fs.writeFileSync(file, q, 'utf8');

  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });

  const check = fs.readFileSync(file, 'utf8');
  const markers = [
    'retryScheduled.add(sig);',
    'signaturesRecentlyDeduplicated++;',
    'retryQueue.length >= retryQueueMax',
    '_rememberDone(sig);'
  ];
  const missing = markers.filter(x => !check.includes(x));
  if (missing.length) throw new Error('verification failed: ' + missing.join(', '));

  console.log('');
  console.log('[MEMEFLOW QUEUE V3] INSTALLED OK');
  console.log('[MEMEFLOW QUEUE V3] Retry scheduling dedupe gap closed.');
  console.log('[MEMEFLOW QUEUE V3] Retry queue is bounded.');
  console.log('[MEMEFLOW QUEUE V3] Recent processed signatures are deduplicated.');
  console.log('[MEMEFLOW QUEUE V3] Backup: ' + backupDir);
  console.log('');
} catch (e) {
  restore();
  console.error('');
  console.error('[MEMEFLOW QUEUE V3] FAILED — original queue file restored.');
  console.error('[MEMEFLOW QUEUE V3] ' + String(e?.message || e));
  console.error('[MEMEFLOW QUEUE V3] Backup: ' + backupDir);
  process.exit(1);
}
