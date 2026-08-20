import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app');
const serverFile=path.join(APP,'app-server.mjs');
const queueFile=path.join(APP,'src','discqueue.mjs');
const liveFile=path.join(APP,'src','pump-live-trade-feed.mjs');

for(const f of [serverFile,queueFile,liveFile]){
  if(!fs.existsSync(f)){
    console.error('[MEMEFLOW V2] Missing file: '+f);
    process.exit(1);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(APP,'.scanner-v2-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});

function backup(file){
  const rel=path.relative(APP,file);
  const dst=path.join(backupDir,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(file,dst);
}
function restore(file){
  const rel=path.relative(APP,file);
  const src=path.join(backupDir,rel);
  if(fs.existsSync(src))fs.copyFileSync(src,file);
}
for(const f of [serverFile,queueFile,liveFile])backup(f);

let changedServer=false,changedQueue=false,changedLive=false;

function replaceOnce(src,from,to,label){
  const n=src.split(from).length-1;
  if(n!==1)throw new Error(label+': expected 1 match, found '+n);
  return src.replace(from,to);
}

try{
  // -------------------------------------------------------------------------
  // LIVE FEED
  // Your current Replit build already has:
  // trackedPumpToken(...) guard + ignoredUntrackedTradeEvents + a single
  // evaluate call after holder+market updates. Detect that and leave it alone.
  // -------------------------------------------------------------------------
  let live=fs.readFileSync(liveFile,'utf8');
  const liveHasTrackedGuard =
    /trackedPumpToken\s*\(\s*store\s*,\s*e\.mint\s*\)/.test(live) &&
    /ignoredUntrackedTradeEvents/.test(live);

  const evalCallsInsideApply=(()=>{
    const start=live.indexOf('function applyEvent');
    if(start<0)return -1;
    const end=live.indexOf('\nfunction ',start+20);
    const block=live.slice(start,end>start?end:Math.min(live.length,start+7000));
    return (block.match(/__v1226Evaluate\s*\(/g)||[]).length;
  })();

  if(liveHasTrackedGuard && evalCallsInsideApply<=1){
    console.log('[MEMEFLOW V2] Live feed: already protected in current Replit build — skipped.');
  }else{
    // Only support the known older GitHub form. If the live file is another
    // unknown variant, stop instead of guessing.
    const oldGuardNeedle=`    metrics.lastMint=e.mint;\n    metrics.lastUser=e.user;\n    users.add(e.user); metrics.distinctUsers=users.size;`;
    if(!live.includes(oldGuardNeedle)){
      throw new Error('live feed is neither current protected layout nor known old layout');
    }

    live=replaceOnce(
      live,
      oldGuardNeedle,
      `    metrics.lastMint=e.mint;\n    metrics.lastUser=e.user;\n\n    const trackedToken=tokenFromStore(store,e.mint);\n    if(!trackedToken){\n      metrics.untrackedEventsIgnored=(metrics.untrackedEventsIgnored||0)+1;\n      return;\n    }\n\n    users.add(e.user); metrics.distinctUsers=users.size;`,
      'live tracked guard'
    );
    changedLive=true;
    fs.writeFileSync(liveFile,live,'utf8');
  }

  // -------------------------------------------------------------------------
  // APP SERVER
  // Fix the silent undefined "mint" bug in CREATE path and remove the
  // duplicate fastPhaseAStart() when enrich() already performs it.
  // -------------------------------------------------------------------------
  let server=fs.readFileSync(serverFile,'utf8');

  const createAnchor="store.addToken({mint:result.mint";
  const createAt=server.indexOf(createAnchor);
  if(createAt<0)throw new Error('Pump CREATE store.addToken anchor not found');

  const createWindowLen=2200;
  let win=server.slice(createAt,createAt+createWindowLen);
  const beforeWin=win;

  win=win.replace(
    /try\{__v1224LinkCreator\(mint,__v1223Token\(mint\)\)\}catch\{\}/,
    'try{__v1224LinkCreator(result.mint,__v1223Token(result.mint))}catch{}'
  );
  win=win.replace(
    /const __created=store\.state\?\.tokens\?\.\[mint\];/,
    'const __created=store.state?.tokens?.[result.mint];'
  );
  win=win.replace(
    /if\(__creator\)eventHolderLedger\.setCreator\(mint,__creator\);/,
    'if(__creator)eventHolderLedger.setCreator(result.mint,__creator);'
  );

  // Remove only the duplicate call that immediately precedes background enrich.
  win=win.replace(
    /\s*\/\/ MEMEFLOW V12\.4 immediate discovery bootstrap\s*\n\s*fastPhaseAStart\(result\.mint,result\.curve\);\s*\n\s*\n(\s*void enrich\(result\.mint,result\.curve\)\.catch)/,
    '\n      // enrich() performs the immediate fast bootstrap itself.\n$1'
  );

  if(win!==beforeWin){
    server=server.slice(0,createAt)+win+server.slice(createAt+createWindowLen);
    changedServer=true;
    fs.writeFileSync(serverFile,server,'utf8');
  }else{
    const creatorFixed=
      win.includes('__v1224LinkCreator(result.mint,__v1223Token(result.mint))') ||
      !win.includes('__v1224LinkCreator(mint,__v1223Token(mint))');
    const duplicateStillThere=
      /fastPhaseAStart\(result\.mint,result\.curve\)[\s\S]{0,180}void enrich\(result\.mint,result\.curve\)/.test(win);
    if(!creatorFixed || duplicateStillThere){
      throw new Error('CREATE path differs from expected layout; no safe automatic replacement');
    }
    console.log('[MEMEFLOW V2] CREATE path: already fixed — skipped.');
  }

  // -------------------------------------------------------------------------
  // DISCOVERY QUEUE
  // Close the delayed-retry dedupe hole and bound retry backlog. If this
  // newer Replit build already contains an equivalent mechanism, skip it.
  // -------------------------------------------------------------------------
  let q=fs.readFileSync(queueFile,'utf8');

  const queueAlreadyFixed =
    q.includes('retryScheduled') &&
    (q.includes('recentDone') || q.includes('recentlyProcessed') || q.includes('recentDedupe')) &&
    (q.includes('retryQueueMax') || /retryQueue\.length\s*>=/.test(q));

  if(queueAlreadyFixed){
    console.log('[MEMEFLOW V2] Discovery queue: retry/dedupe protection already present — skipped.');
  }else{
    const original=q;

    if(!q.includes('signaturesRecentlyDeduplicated: 0,')){
      q=replaceOnce(
        q,
        `    signaturesDeduplicated: 0,\n    queueDropped: 0,`,
        `    signaturesDeduplicated: 0,\n    signaturesRecentlyDeduplicated: 0,\n    queueDropped: 0,\n    retryQueueDropped: 0,`,
        'queue metrics'
      );
    }

    if(!q.includes('recentDedupeMs = 300000')){
      q=replaceOnce(
        q,
        `    retryDelays = [250, 750, 2000, 5000],\n  } = config || {};`,
        `    retryDelays = [250, 750, 2000, 5000],\n    recentDedupeMs = 300000,\n    retryQueueMax = queueMax,\n  } = config || {};`,
        'queue config'
      );
    }

    if(!q.includes('const retryScheduled = new Set();')){
      q=replaceOnce(
        q,
        `  const retryQueue = [];\n  const retrySet   = new Set();\n\n  const processing = new Set();`,
        `  const retryQueue = [];\n  const retrySet   = new Set();\n  const retryScheduled = new Set();\n\n  const processing = new Set();\n  const recentDone = new Map();`,
        'queue sets'
      );
    }

    if(!q.includes('function _pruneRecent(')){
      q=replaceOnce(
        q,
        `  function _openCircuit() {`,
        `  function _pruneRecent(now=Date.now()) {\n    for (const [sig, at] of recentDone) {\n      if (now - at <= recentDedupeMs) break;\n      recentDone.delete(sig);\n    }\n  }\n\n  function _rememberDone(sig) {\n    recentDone.delete(sig);\n    recentDone.set(sig, Date.now());\n    _pruneRecent();\n  }\n\n  function _openCircuit() {`,
        'queue recent helpers'
      );
    }

    if(!q.includes('_rememberDone(sig);')){
      q=replaceOnce(
        q,
        `      discMetrics.signaturesProcessed++;\n      if (onSignatureProcessed) onSignatureProcessed();`,
        `      discMetrics.signaturesProcessed++;\n      _rememberDone(sig);\n      if (onSignatureProcessed) onSignatureProcessed();`,
        'queue success remember'
      );
    }

    if(!q.includes('retryScheduled.add(sig);')){
      q=replaceOnce(
        q,
        `        discMetrics.transactionRetryScheduled++;\n        processing.delete(sig);\n        _sync();\n        setTimeout(() => {\n          if (!retrySet.has(sig) && !processing.has(sig)) {\n            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });\n            retrySet.add(sig);\n            _sync();\n            _drain();\n          }\n        }, delayMs);`,
        `        discMetrics.transactionRetryScheduled++;\n        processing.delete(sig);\n        retryScheduled.add(sig);\n        _sync();\n        setTimeout(() => {\n          retryScheduled.delete(sig);\n          _pruneRecent();\n          if (Date.now() - enqueuedAt > maxSignatureAgeMs) {\n            discMetrics.staleSignaturesDropped++;\n            _sync();\n            _drain();\n            return;\n          }\n          if (!freshSet.has(sig) && !retrySet.has(sig) && !processing.has(sig) && !recentDone.has(sig)) {\n            if (retryQueue.length >= retryQueueMax) {\n              const dropped = retryQueue.shift();\n              retrySet.delete(dropped.sig);\n              discMetrics.retryQueueDropped++;\n              discMetrics.queueDropped++;\n            }\n            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });\n            retrySet.add(sig);\n            _sync();\n            _drain();\n          } else {\n            discMetrics.signaturesDeduplicated++;\n          }\n        }, delayMs);`,
        'queue delayed retry'
      );
    }

    if(!q.includes('signaturesRecentlyDeduplicated++;')){
      q=replaceOnce(
        q,
        `  function enqueue(sig) {\n    if (freshSet.has(sig) || retrySet.has(sig) || processing.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      return false;\n    }`,
        `  function enqueue(sig) {\n    _pruneRecent();\n    if (recentDone.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      discMetrics.signaturesRecentlyDeduplicated++;\n      return false;\n    }\n    if (freshSet.has(sig) || retrySet.has(sig) || retryScheduled.has(sig) || processing.has(sig)) {\n      discMetrics.signaturesDeduplicated++;\n      return false;\n    }`,
        'queue enqueue dedupe'
      );
    }

    if(q===original)throw new Error('discovery queue needs fix but no safe known pattern matched');
    changedQueue=true;
    fs.writeFileSync(queueFile,q,'utf8');
  }

  // Syntax check all three authoritative files.
  for(const f of [serverFile,queueFile,liveFile]){
    execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
  }

  console.log('');
  console.log('[MEMEFLOW V2] INSTALLED OK');
  console.log('[MEMEFLOW V2] server changed: '+changedServer);
  console.log('[MEMEFLOW V2] queue changed:  '+changedQueue);
  console.log('[MEMEFLOW V2] live changed:   '+changedLive);
  console.log('[MEMEFLOW V2] Backup: '+backupDir);
  console.log('[MEMEFLOW V2] Mayhem, UI and user filter settings were not changed.');
  console.log('');
}catch(e){
  for(const f of [serverFile,queueFile,liveFile])restore(f);
  console.error('');
  console.error('[MEMEFLOW V2] FAILED — touched files restored.');
  console.error('[MEMEFLOW V2] '+String(e?.message||e));
  console.error('[MEMEFLOW V2] Backup: '+backupDir);
  process.exit(1);
}
