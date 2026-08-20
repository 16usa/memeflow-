import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app');
const ledgerFile=path.join(APP,'src','event-holder-ledger.mjs');
const serverFile=path.join(APP,'app-server.mjs');

for(const f of [ledgerFile,serverFile]){
  if(!fs.existsSync(f)){
    console.error('[MEMEFLOW HOLDERS V8] Missing '+f);
    process.exit(1);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(APP,'.holders-v8-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});

for(const f of [ledgerFile,serverFile]){
  const rel=path.relative(APP,f);
  const dst=path.join(backupDir,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(f,dst);
}

function restoreAll(){
  for(const f of [ledgerFile,serverFile]){
    const rel=path.relative(APP,f);
    const src=path.join(backupDir,rel);
    if(fs.existsSync(src))fs.copyFileSync(src,f);
  }
}

function replaceOnce(src,from,to,label){
  const n=src.split(from).length-1;
  if(n!==1)throw new Error(`${label}: expected 1 match, found ${n}`);
  return src.replace(from,to);
}

try{
  // Require V7 first.
  let ledger=fs.readFileSync(ledgerFile,'utf8');
  let server=fs.readFileSync(serverFile,'utf8');

  if(!ledger.includes('seedCanonicalBalances(m, walletBalances')){
    throw new Error('HOLDERS V7 is not installed in event-holder-ledger.mjs');
  }
  if(!server.includes("reason:'fresh_pump_canonical_holder_scan'")){
    throw new Error('HOLDERS V7 is not installed in app-server.mjs');
  }

  // -------------------------------------------------------------------------
  // 1) Persist canonicalSeedAt across restarts.
  //    V7 created the canonical baseline but the old persistence schema did
  //    not save the marker, so after restart the live ledger could become
  //    provisional again.
  // -------------------------------------------------------------------------
  if(!ledger.includes('canonicalSeedAt:r.canonicalSeedAt||null,')){
    ledger=replaceOnce(
      ledger,
      `        txCount:r.txCount,
        decimals:r.decimals,
        balances:Object.fromEntries`,
      `        txCount:r.txCount,
        decimals:r.decimals,
        canonicalSeedAt:r.canonicalSeedAt||null,
        canonicalHolderCount:r.canonicalHolderCount??null,
        balances:Object.fromEntries`,
      'persist canonical seed'
    );
  }

  if(!ledger.includes('canonicalSeedAt:s.canonicalSeedAt||null,')){
    ledger=replaceOnce(
      ledger,
      `          txCount:s.txCount||0,
          decimals:Number.isInteger(s.decimals)?s.decimals:6,
          balances:new Map()`,
      `          txCount:s.txCount||0,
          decimals:Number.isInteger(s.decimals)?s.decimals:6,
          canonicalSeedAt:s.canonicalSeedAt||null,
          canonicalHolderCount:Number.isFinite(Number(s.canonicalHolderCount))
            ? Number(s.canonicalHolderCount)
            : null,
          balances:new Map()`,
      'load canonical seed'
    );
  }

  fs.writeFileSync(ledgerFile,ledger,'utf8');

  // -------------------------------------------------------------------------
  // 2) One-time bounded backfill for tokens that already have stale
  //    TradeEvent-only holder counts (Mage=163 is exactly this case).
  //
  //    This is intentionally separate from the fresh-token bridge, whose
  //    normal recovery window is short. Old existing cards need a migration.
  // -------------------------------------------------------------------------
  if(!server.includes('MEMEFLOW_HOLDERS_V8_EXISTING_CANONICAL_BACKFILL')){
    const bridgeMarker='/* MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE';
    const insertAt=server.indexOf(bridgeMarker);
    if(insertAt<0)throw new Error('discovery bridge marker not found');

    const block=String.raw`
/* MEMEFLOW_HOLDERS_V8_EXISTING_CANONICAL_BACKFILL
   One-time bounded migration for old TradeEvent-only holder snapshots.
   V7 fixes the authoritative path for new scans; V8 repairs cards that were
   already persisted as holderFresh=true before V7 (for example Mage=163).
*/
const holderBackfillV8Metrics={
  started:false,
  completed:false,
  candidates:0,
  attempted:0,
  succeeded:0,
  failed:0,
  rateLimited:0,
  lastMint:null,
  lastError:null,
  startedAt:null,
  completedAt:null
};

const holderBackfillV8Sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

function holderBackfillV8IsPump(t){
  const mint=String(t?.mint||'').toLowerCase();
  const platform=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
  const source=String(t?.source||'').toLowerCase();
  return platform==='pump'||mint.endsWith('pump')||source.includes('pump create');
}

function holderBackfillV8NeedsCanonical(t){
  if(!t||!holderBackfillV8IsPump(t))return false;

  const source=String(t?.holderSource||'').toLowerCase();

  // Already canonical — do not touch.
  if(source.includes('getprogramaccounts'))return false;
  if(source.includes('canonical') && !source.includes('provisional'))return false;

  // Old authoritative bug: a partial TradeEvent.user ledger was persisted as
  // a complete holder snapshot.
  const eventLedgerEvidence=
    source.includes('event-ledger') ||
    source.includes('ws-direct') ||
    t?.eventLedgerVersion!=null ||
    t?.eventLedgerTxCount!=null;

  return eventLedgerEvidence;
}

async function runHolderBackfillV8(){
  if(holderBackfillV8Metrics.started)return;
  holderBackfillV8Metrics.started=true;
  holderBackfillV8Metrics.startedAt=Date.now();

  const rows=Object.values(store?.state?.tokens||{})
    .filter(holderBackfillV8NeedsCanonical)
    .sort((a,b)=>Number(b?.discoveredAt||0)-Number(a?.discoveredAt||0))
    .slice(0,200);

  holderBackfillV8Metrics.candidates=rows.length;

  for(const token of rows){
    const mint=String(token?.mint||'').trim();
    if(!mint)continue;

    holderBackfillV8Metrics.attempted++;
    holderBackfillV8Metrics.lastMint=mint;

    // Do not allow a known-partial count to keep a false BUY READY while the
    // canonical scan is pending.
    try{
      const pending=store.setToken(mint,{
        holderFresh:false,
        holderCount:null,
        top10Pct:null,
        developerPct:null,
        developerSharePct:null,
        holderSource:'canonical-backfill-v8-pending',
        holderScannedAt:null
      });
      await Promise.resolve(evaluateAll(pending)).catch(()=>{});
      try{publish(mint)}catch{}
    }catch{}

    let success=false;
    for(let attempt=0;attempt<3&&!success;attempt++){
      try{
        const result=await enrichHolders(
          mint,
          {rpc,store,evaluateAll,publish,enrichDiag,eventHolderLedger}
        );

        if(result?.rateLimited){
          holderBackfillV8Metrics.rateLimited++;
          await holderBackfillV8Sleep(Math.min(30000,8000*(attempt+1)));
          continue;
        }

        const updated=store?.state?.tokens?.[mint]||null;
        const source=String(updated?.holderSource||'').toLowerCase();
        if(updated?.holderFresh===true && source.includes('getprogramaccounts')){
          success=true;
          holderBackfillV8Metrics.succeeded++;
          break;
        }

        throw new Error('canonical holder scan returned without authoritative state');
      }catch(e){
        holderBackfillV8Metrics.lastError=String(e?.message||e).slice(0,200);
        if(attempt<2)await holderBackfillV8Sleep(4000*(attempt+1));
      }
    }

    if(!success)holderBackfillV8Metrics.failed++;

    // Be gentle with Solana/RPC; the shared RPC limiter also applies.
    await holderBackfillV8Sleep(500);
  }

  holderBackfillV8Metrics.completed=true;
  holderBackfillV8Metrics.completedAt=Date.now();
}

setTimeout(()=>{
  void runHolderBackfillV8().catch(e=>{
    holderBackfillV8Metrics.lastError=String(e?.message||e).slice(0,200);
  });
},1500).unref?.();

`;

    server=server.slice(0,insertAt)+block+server.slice(insertAt);
    fs.writeFileSync(serverFile,server,'utf8');
  }

  // -------------------------------------------------------------------------
  // 3) Validate syntax and required markers.
  // -------------------------------------------------------------------------
  for(const f of [ledgerFile,serverFile]){
    execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
  }

  const ledgerCheck=fs.readFileSync(ledgerFile,'utf8');
  const serverCheck=fs.readFileSync(serverFile,'utf8');

  const required=[
    [ledgerCheck,'canonicalSeedAt:r.canonicalSeedAt||null,','canonical seed persistence'],
    [ledgerCheck,'canonicalSeedAt:s.canonicalSeedAt||null,','canonical seed reload'],
    [serverCheck,'MEMEFLOW_HOLDERS_V8_EXISTING_CANONICAL_BACKFILL','V8 backfill block'],
    [serverCheck,"holderSource:'canonical-backfill-v8-pending'",'stale holder invalidation'],
    [serverCheck,'await enrichHolders(','direct canonical backfill scan'],
    [serverCheck,'eventHolderLedger}','canonical ledger dependency']
  ];

  for(const [text,needle,label] of required){
    if(!text.includes(needle))throw new Error('verification missing: '+label);
  }

  console.log('');
  console.log('[MEMEFLOW HOLDERS V8] INSTALLED OK');
  console.log('[MEMEFLOW HOLDERS V8] V7 canonical marker now survives restarts.');
  console.log('[MEMEFLOW HOLDERS V8] Existing TradeEvent-only holder cards will be backfilled after restart.');
  console.log('[MEMEFLOW HOLDERS V8] Old partial holder counts are invalidated before rescan.');
  console.log('[MEMEFLOW HOLDERS V8] Backfill is sequential/bounded to avoid an RPC storm.');
  console.log('[MEMEFLOW HOLDERS V8] UI and user thresholds were not changed.');
  console.log('[MEMEFLOW HOLDERS V8] Backup: '+backupDir);
  console.log('');
}catch(e){
  restoreAll();
  console.error('');
  console.error('[MEMEFLOW HOLDERS V8] FAILED — touched files restored.');
  console.error('[MEMEFLOW HOLDERS V8] '+String(e?.message||e));
  console.error('[MEMEFLOW HOLDERS V8] Backup: '+backupDir);
  process.exit(1);
}
