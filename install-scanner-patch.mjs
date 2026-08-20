import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const files = {
  server: path.join(ROOT, 'memeflow-app', 'app-server.mjs'),
  queue: path.join(ROOT, 'memeflow-app', 'src', 'discqueue.mjs'),
  live: path.join(ROOT, 'memeflow-app', 'src', 'pump-live-trade-feed.mjs'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.error(`[MEMEFLOW PATCH] Missing ${name}: ${file}`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, 'memeflow-app', '.scanner-backpressure-backup', stamp);
fs.mkdirSync(backupDir, { recursive: true });

for (const file of Object.values(files)) {
  const rel = path.relative(path.join(ROOT, 'memeflow-app'), file);
  const dst = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(file, dst);
}

function restoreAll() {
  for (const file of Object.values(files)) {
    const rel = path.relative(path.join(ROOT, 'memeflow-app'), file);
    const src = path.join(backupDir, rel);
    if (fs.existsSync(src)) fs.copyFileSync(src, file);
  }
}

function replaceOnce(src, from, to, label) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  return src.replace(from, to);
}

function insertAfterOnce(src, needle, addition, label) {
  return replaceOnce(src, needle, needle + addition, label);
}

try {
  // ---------------------------------------------------------------------------
  // 1) pump-live-trade-feed.mjs
  //    - ignore unrelated Pump mints
  //    - one store update / one evaluate per trade event instead of two
  // ---------------------------------------------------------------------------
  let live = fs.readFileSync(files.live, 'utf8');

  if (!live.includes('untrackedEventsIgnored:0,')) {
    live = replaceOnce(
      live,
      `    notifications:0,programDataSeen:0,tradeEventsDecoded:0,decodeErrors:0,\n    holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,`,
      `    notifications:0,programDataSeen:0,tradeEventsDecoded:0,decodeErrors:0,\n    untrackedEventsIgnored:0,\n    holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,`,
      'live metrics'
    );
  }

  if (!live.includes('const trackedToken=tokenFromStore(store,e.mint);')) {
    live = replaceOnce(
      live,
      `    metrics.lastMint=e.mint;\n    metrics.lastUser=e.user;\n    users.add(e.user); metrics.distinctUsers=users.size;`,
      `    metrics.lastMint=e.mint;\n    metrics.lastUser=e.user;\n\n    // This WS subscribes to all Pump.fun trades. Never allow an unrelated\n    // trade mint to create state or trigger evaluation inside MEMEFLOW.\n    const trackedToken=tokenFromStore(store,e.mint);\n    if(!trackedToken){\n      metrics.untrackedEventsIgnored++;\n      return;\n    }\n\n    users.add(e.user); metrics.distinctUsers=users.size;`,
      'tracked-token guard'
    );
  }

  if (live.includes(`      const t=tokenFromStore(store,e.mint);\n      const creator=t?.creator||t?.developer||t?.creatorWallet||null;`)) {
    live = replaceOnce(
      live,
      `      const t=tokenFromStore(store,e.mint);\n      const creator=t?.creator||t?.developer||t?.creatorWallet||null;`,
      `      const creator=trackedToken?.creator||trackedToken?.developer||trackedToken?.creatorWallet||null;`,
      'creator tracked token'
    );
  }

  const oldHolder = `    try{\n      const snap=eventHolderLedger?.ingestTradeEventDirect?.(e);\n      if(snap){\n        metrics.holderSnapshots++;\n        const updated=eventHolderLedger?.applyToStore?.(store,e.mint);\n        if(updated){\n          try{__v1226Evaluate(updated,e.mint,'holder-event')}catch{}\n          try{publish?.(e.mint)}catch{}\n        }\n      }\n    }catch(err){\n      metrics.lastError='holder:'+String(err?.message||err);\n    }\n\n    // Market update directly from the same TradeEvent; no HTTP RPC.\n    try{\n      const m=marketFromEvent(e);\n      const buyPressure=updatePressure(e);\n      const patch={\n        marketSource:'ws-direct-trade-event',\n        buyPressure,\n        lastPriceAt:Date.now()\n      };\n      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;\n      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;\n      const updated=store?.setToken?.(e.mint,patch);\n      if(updated){\n        metrics.marketSnapshots++;\n        try{__v1226Evaluate(updated,e.mint,'market-event')}catch{}\n        try{publish?.(e.mint)}catch{}\n      }\n    }catch(err){\n      metrics.lastError='market:'+String(err?.message||err);\n    }`;

  const newHolder = `    let holderPatch=null;\n    try{\n      const snap=eventHolderLedger?.ingestTradeEventDirect?.(e);\n      if(snap){\n        metrics.holderSnapshots++;\n        holderPatch=snap;\n      }\n    }catch(err){\n      metrics.lastError='holder:'+String(err?.message||err);\n    }\n\n    // Market update directly from the same TradeEvent; no HTTP RPC.\n    let marketPatch=null;\n    try{\n      const m=marketFromEvent(e);\n      const buyPressure=updatePressure(e);\n      marketPatch={\n        marketSource:'ws-direct-trade-event',\n        buyPressure,\n        lastPriceAt:Date.now()\n      };\n      if(Number.isFinite(m.priceSol)&&m.priceSol>0)marketPatch.priceSol=m.priceSol;\n      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)marketPatch.liquiditySol=m.liquiditySol;\n    }catch(err){\n      metrics.lastError='market:'+String(err?.message||err);\n    }\n\n    // One canonical write and one active-user evaluation per trade event.\n    if(holderPatch||marketPatch){\n      try{\n        const updated=store?.setToken?.(e.mint,{\n          ...(holderPatch||{}),\n          ...(marketPatch||{})\n        });\n        if(updated){\n          if(marketPatch)metrics.marketSnapshots++;\n          try{__v1226Evaluate(updated,e.mint,'trade-event-combined')}catch{}\n          try{publish?.(e.mint)}catch{}\n        }\n      }catch(err){\n        metrics.lastError='store:'+String(err?.message||err);\n      }\n    }`;

  if (!live.includes(`'trade-event-combined'`)) {
    live = replaceOnce(live, oldHolder, newHolder, 'combined live trade update');
  }

  fs.writeFileSync(files.live, live, 'utf8');

  // ---------------------------------------------------------------------------
  // 2) app-server.mjs
  //    - fix undefined mint -> result.mint
  //    - remove duplicate fastPhaseAStart; enrich() already calls it immediately
  // ---------------------------------------------------------------------------
  let server = fs.readFileSync(files.server, 'utf8');

  if (server.includes(`try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}`)) {
    const createAnchor = `store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,isMayhemMode:false,launchMode:'standard',launchPlatform:'pump',protocol:'pump',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});`;
    const idx = server.indexOf(createAnchor);
    if (idx < 0) throw new Error('CREATE anchor not found');
    const tail = server.slice(idx, idx + 1800);
    if (!tail.includes(`try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}`)) {
      throw new Error('CREATE creator-link bug pattern not found near Pump create');
    }
    const fixedTail = tail
      .replace(
        `try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}`,
        `try{__v1224LinkCreator(result.mint,__v1223Token(result.mint))}catch{}`
      )
      .replace(
        `const __created=store.state?.tokens?.[mint];`,
        `const __created=store.state?.tokens?.[result.mint];`
      )
      .replace(
        `if(__creator)eventHolderLedger.setCreator(mint,__creator);`,
        `if(__creator)eventHolderLedger.setCreator(result.mint,__creator);`
      );
    server = server.slice(0, idx) + fixedTail + server.slice(idx + 1800);
  }

  const duplicateBootstrap = `      // MEMEFLOW V12.4 immediate discovery bootstrap\n      fastPhaseAStart(result.mint,result.curve);\n      \n      void enrich(result.mint,result.curve).catch`;
  const singleBootstrap = `      // enrich() invokes fastPhaseAStart() synchronously before its first await.\n      // Do not bootstrap/evaluate a newly-created token twice.\n      void enrich(result.mint,result.curve).catch`;
  if (server.includes(duplicateBootstrap)) {
    server = replaceOnce(server, duplicateBootstrap, singleBootstrap, 'duplicate CREATE bootstrap');
  } else if (!server.includes(`// Do not bootstrap/evaluate a newly-created token twice.`)) {
    throw new Error('duplicate CREATE bootstrap pattern not found');
  }

  fs.writeFileSync(files.server, server, 'utf8');

  // ---------------------------------------------------------------------------
  // 3) discqueue.mjs
  //    - close retry-scheduling dedupe gap
  //    - bound retry queue
  //    - short recent-success dedupe window
  // ---------------------------------------------------------------------------
  let queue = fs.readFileSync(files.queue, 'utf8');

  if (!queue.includes('signaturesRecentlyDeduplicated: 0,')) {
    queue = replaceOnce(
      queue,
      `    signaturesDeduplicated: 0,\n    queueDropped: 0,`,
      `    signaturesDeduplicated: 0,\n    signaturesRecentlyDeduplicated: 0,\n    queueDropped: 0,\n    retryQueueDropped: 0,`,
      'queue metrics'
    );
  }

  if (!queue.includes('recentDedupeMs = 300000')) {
    queue = replaceOnce(
      queue,
      `    retryDelays = [250, 750, 2000, 5000],\n  } = config || {};`,
      `    retryDelays = [250, 750, 2000, 5000],\n    recentDedupeMs = 300000,\n    retryQueueMax = queueMax,\n  } = config || {};`,
      'queue config'
    );
  }

  if (!queue.includes('const retryScheduled = new Set();')) {
    queue = replaceOnce(
      queue,
      `  const retryQueue = [];\n  const retrySet   = new Set();\n\n  const processing = new Set();`,
      `  const retryQueue = [];\n  const retrySet   = new Set();\n  const retryScheduled = new Set();\n\n  const processing = new Set();\n  const recentDone = new Map();`,
      'queue sets'
    );
  }

  if (!queue.includes('function _pruneRecent(')) {
    queue = replaceOnce(
      queue,
      `  function _openCircuit() {`,
      `  function _pruneRecent(now=Date.now()) {\n    for (const [sig, at] of recentDone) {\n      if (now - at <= recentDedupeMs) break;\n      recentDone.delete(sig);\n    }\n  }\n\n  function _rememberDone(sig) {\n    recentDone.delete(sig);\n    recentDone.set(sig, Date.now());\n    _pruneRecent();\n  }\n\n  function _openCircuit() {`,
      'recent dedupe helpers'
    );
  }

  if (!queue.includes('_rememberDone(sig);')) {
    queue = replaceOnce(
      queue,
      `      discMetrics.signaturesProcessed++;\n      if (onSignatureProcessed) onSignatureProcessed();`,
      `      discMetrics.signaturesProcessed++;\n      _rememberDone(sig);\n      if (onSignatureProcessed) onSignatureProcessed();`,
      'remember processed signature'
    );
  }

  const oldRetry = `        discMetrics.transactionRetryScheduled++;\n        processing.delete(sig);\n        _sync();\n        setTimeout(() => {\n          if (!retrySet.has(sig) && !processing.has(sig)) {\n            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });\n            retrySet.add(sig);\n            _sync();\n            _drain();\n          }\n        }, delayMs);`;

  const newRetry = `        discMetrics.transactionRetryScheduled++;\n        processing.delete(sig);\n        retryScheduled.add(sig);\n        _sync();\n        setTimeout(() => {\n          retryScheduled.delete(sig);\n          _pruneRecent();\n\n          if (Date.now() - enqueuedAt > maxSignatureAgeMs) {\n            discMetrics.staleSignaturesDropped++;\n            _sync();\n            _drain();\n            return;\n          }\n\n          if (!freshSet.has(sig) && !retrySet.has(sig) &&\n              !processing.has(sig) && !recentDone.has(sig)) {\n            if (retryQueue.length >= retryQueueMax) {\n              const dropped = retryQueue.shift();\n              retrySet.delete(dropped.sig);\n              discMetrics.retryQueueDropped++;\n              discMetrics.queueDropped++;\n            }\n            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });\n            retrySet.add(sig);\n            _sync();\n            _drain();\n          } else {\n            discMetrics.signaturesDeduplicated++;\n          }\n        }, delayMs);`;

  if (!queue.includes('retryScheduled.add(sig);')) {
    queue = replaceOnce(queue, oldRetry, newRetry, 'retry scheduling');
  }

  const oldEnqueue = `  function enqueue(sig) {\n    if (freshSet.has(sig) || retrySet.has(sig) || processing.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      return false;\n    }`;
  const newEnqueue = `  function enqueue(sig) {\n    _pruneRecent();\n    if (recentDone.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      discMetrics.signaturesRecentlyDeduplicated++;\n      return false;\n    }\n    if (freshSet.has(sig) || retrySet.has(sig) || retryScheduled.has(sig) || processing.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      return false;\n    }`;

  if (!queue.includes('signaturesRecentlyDeduplicated++;')) {
    queue = replaceOnce(queue, oldEnqueue, newEnqueue, 'enqueue dedupe');
  }

  fs.writeFileSync(files.queue, queue, 'utf8');

  // Syntax validation. Any failure restores every touched file.
  for (const file of Object.values(files)) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }

  console.log('');
  console.log('[MEMEFLOW PATCH] INSTALLED OK');
  console.log(`[MEMEFLOW PATCH] Backup: ${backupDir}`);
  console.log('[MEMEFLOW PATCH] Changed only:');
  console.log('  - memeflow-app/app-server.mjs');
  console.log('  - memeflow-app/src/discqueue.mjs');
  console.log('  - memeflow-app/src/pump-live-trade-feed.mjs');
  console.log('[MEMEFLOW PATCH] Mayhem/UI/settings were not changed.');
  console.log('');
} catch (err) {
  restoreAll();
  console.error('');
  console.error('[MEMEFLOW PATCH] FAILED — all touched files were restored.');
  console.error('[MEMEFLOW PATCH] ' + String(err?.message || err));
  console.error(`[MEMEFLOW PATCH] Backup: ${backupDir}`);
  process.exit(1);
}
