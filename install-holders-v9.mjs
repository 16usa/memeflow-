import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app');
const ledgerFile=path.join(APP,'src','event-holder-ledger.mjs');
const storeFile=path.join(APP,'src','store.mjs');
const serverFile=path.join(APP,'app-server.mjs');

for(const f of [ledgerFile,storeFile,serverFile]){
  if(!fs.existsSync(f)){
    console.error('[MEMEFLOW HOLDERS V9] Missing '+f);
    process.exit(1);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(APP,'.holders-v9-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});

for(const f of [ledgerFile,storeFile,serverFile]){
  const rel=path.relative(APP,f);
  const dst=path.join(backupDir,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(f,dst);
}

function restoreAll(){
  for(const f of [ledgerFile,storeFile,serverFile]){
    const rel=path.relative(APP,f);
    const src=path.join(backupDir,rel);
    if(fs.existsSync(src))fs.copyFileSync(src,f);
  }
}

function findMatchingBrace(text,openIndex){
  let depth=0,quote=null,esc=false,lineComment=false,blockComment=false;
  for(let i=openIndex;i<text.length;i++){
    const c=text[i],n=text[i+1];

    if(lineComment){if(c==='\n')lineComment=false;continue;}
    if(blockComment){if(c==='*'&&n==='/'){blockComment=false;i++;}continue;}

    if(quote){
      if(esc){esc=false;continue;}
      if(c==='\\'){esc=true;continue;}
      if(c===quote)quote=null;
      continue;
    }

    if(c==='/'&&n==='/'){lineComment=true;i++;continue;}
    if(c==='/'&&n==='*'){blockComment=true;i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}

    if(c==='{')depth++;
    else if(c==='}'){
      depth--;
      if(depth===0)return i;
    }
  }
  return -1;
}

try{
  // =========================================================================
  // 1) event-holder-ledger:
  //    "user-only" TradeEvent coverage can NEVER be authoritative unless a
  //    canonical baseline has already been seeded.
  // =========================================================================
  let ledger=fs.readFileSync(ledgerFile,'utf8');

  if(!ledger.includes('MEMEFLOW_HOLDERS_V9_PROVISIONAL_GUARD')){
    const snapStart=ledger.indexOf('  snapshot(m){');
    if(snapStart<0)throw new Error('snapshot(m) not found in event-holder-ledger');
    const open=ledger.indexOf('{',snapStart);
    const close=findMatchingBrace(ledger,open);
    if(close<0)throw new Error('snapshot(m) closing brace not found');

    let snap=ledger.slice(snapStart,close+1);

    // Normalize the known old authoritative fields, regardless of V12.24/V12.27 label.
    snap=snap.replace(
      /holderFresh\s*:\s*(?:true|Boolean\(r\.canonicalSeedAt\))\s*,/,
      'holderFresh:Boolean(r.canonicalSeedAt),'
    );

    snap=snap.replace(
      /holderSource\s*:\s*(?:r\.canonicalSeedAt\?[^,\n]+|['"][^'"]*event-ledger[^'"]*['"])\s*,/,
      "holderSource:r.canonicalSeedAt?'Solana getProgramAccounts baseline + live Pump TradeEvent delta':'event-ledger-user-only-provisional',"
    );

    snap=snap.replace(
      /holderCount\s*:\s*(?:r\.canonicalSeedAt\?holders\.length:null|holders\.length)\s*,/,
      'holderCount:r.canonicalSeedAt?holders.length:null,'
    );

    snap=snap.replace(
      /top10Pct\s*:\s*(?:r\.canonicalSeedAt\?pct\(top10,totalSupply\):null|pct\(top10,totalSupply\))\s*,/,
      'top10Pct:r.canonicalSeedAt?pct(top10,totalSupply):null,'
    );

    snap=snap.replace(
      /developerPct\s*:\s*(?:r\.canonicalSeedAt&&r\.creator\?pct\(dev,totalSupply\):null|r\.creator\?pct\(dev,totalSupply\):null)\s*,/,
      'developerPct:r.canonicalSeedAt&&r.creator?pct(dev,totalSupply):null,'
    );

    snap=snap.replace(
      /developerSharePct\s*:\s*(?:r\.canonicalSeedAt&&r\.creator\?pct\(dev,totalSupply\):null|r\.creator\?pct\(dev,totalSupply\):null)\s*,/,
      'developerSharePct:r.canonicalSeedAt&&r.creator?pct(dev,totalSupply):null,'
    );

    if(!snap.includes('holderFresh:Boolean(r.canonicalSeedAt)')){
      throw new Error('could not install conditional holderFresh in snapshot(m)');
    }
    if(!snap.includes('holderCount:r.canonicalSeedAt?holders.length:null')){
      throw new Error('could not install provisional holderCount behavior');
    }

    snap=snap.replace(
      '  snapshot(m){',
      `  snapshot(m){
    // MEMEFLOW_HOLDERS_V9_PROVISIONAL_GUARD
    // TradeEvent.user balances are a delta stream, not a complete holder census.`
    );

    ledger=ledger.slice(0,snapStart)+snap+ledger.slice(close+1);
    fs.writeFileSync(ledgerFile,ledger,'utf8');
  }

  // =========================================================================
  // 2) store.mjs:
  //    Final defensive wall. Even if any old module tries to write
  //    holderSource=event-ledger-*-user-only with holderFresh=true, it cannot
  //    overwrite a canonical scan or become a BUY READY input.
  // =========================================================================
  let store=fs.readFileSync(storeFile,'utf8');

  if(!store.includes('MEMEFLOW_HOLDERS_V9_STORE_PRECEDENCE')){
    const needle=`    const patch={...(t||{})};

`;
    const pos=store.indexOf(needle);
    if(pos<0)throw new Error('store.setToken patch anchor not found');

    const guard=`    const patch={...(t||{})};

    // MEMEFLOW_HOLDERS_V9_STORE_PRECEDENCE
    // A user-only Pump TradeEvent ledger is partial by construction.
    // Never let it become authoritative or overwrite a completed canonical scan.
    const incomingHolderSource=String(patch?.holderSource||'').toLowerCase();
    const oldHolderSource=String(old?.holderSource||'').toLowerCase();

    const incomingUserOnlyLedger=
      incomingHolderSource.includes('event-ledger') &&
      (incomingHolderSource.includes('user-only') ||
       incomingHolderSource.includes('provisional'));

    const oldCanonicalHolderState=
      old?.holderFresh===true &&
      Number.isFinite(Number(old?.holderCount)) &&
      (
        oldHolderSource.includes('getprogramaccounts') ||
        oldHolderSource.includes('canonical') ||
        oldHolderSource.includes('baseline + live')
      );

    if(incomingUserOnlyLedger){
      if(oldCanonicalHolderState){
        // Keep the complete census. Live trades may still update their own
        // internal ledger, but cannot replace the canonical holder fields.
        for(const k of [
          'holderFresh','holderCount','holders','top10Pct','top10',
          'developerPct','developerSharePct','creatorPct',
          'holderSource','holderScannedAt','holderTokenProgram'
        ]) delete patch[k];
      }else{
        // No canonical census yet: explicitly WAIT for the full Solana scan.
        patch.holderFresh=false;
        patch.holderCount=null;
        patch.holders=null;
        patch.top10Pct=null;
        patch.top10=null;
        patch.developerPct=null;
        patch.developerSharePct=null;
        patch.creatorPct=null;
        patch.holderSource='event-ledger-user-only-provisional';
        patch.holderScannedAt=null;
      }
    }

`;

    store=store.slice(0,pos)+guard+store.slice(pos+needle.length);
    fs.writeFileSync(storeFile,store,'utf8');
  }

  // =========================================================================
  // 3) app-server:
  //    Fresh one-time migration run after restart. This does NOT depend on V8
  //    having run successfully before. It targets the exact stale source shown
  //    by Mage: event-ledger-v12-27-user-only.
  // =========================================================================
  let server=fs.readFileSync(serverFile,'utf8');

  if(!server.includes('MEMEFLOW_HOLDERS_V9_FORCE_CANONICAL_BACKFILL')){
    const bridgeMarker='/* MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE';
    const insertAt=server.indexOf(bridgeMarker);
    if(insertAt<0)throw new Error('discovery bridge marker not found in app-server');

    const backfill=String.raw`
/* MEMEFLOW_HOLDERS_V9_FORCE_CANONICAL_BACKFILL
   Repair persisted user-only holder snapshots regardless of token age.
   Sequential and bounded so it cannot create an RPC storm.
*/
const holderBackfillV9={
  running:false,
  completed:false,
  candidates:0,
  attempted:0,
  succeeded:0,
  failed:0,
  rateLimited:0,
  lastMint:null,
  lastError:null
};

const holderBackfillV9Sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

function holderBackfillV9IsPump(t){
  const mint=String(t?.mint||'').toLowerCase();
  const platform=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
  const source=String(t?.source||'').toLowerCase();
  return platform==='pump'||mint.endsWith('pump')||source.includes('pump create');
}

function holderBackfillV9NeedsScan(t){
  if(!t||!holderBackfillV9IsPump(t))return false;

  const src=String(t?.holderSource||'').toLowerCase();

  if(
    t?.holderFresh===true &&
    Number.isFinite(Number(t?.holderCount)) &&
    (
      src.includes('getprogramaccounts') ||
      src.includes('baseline + live')
    )
  ) return false;

  return (
    src.includes('event-ledger') ||
    src.includes('user-only') ||
    src.includes('provisional')
  );
}

async function runHolderBackfillV9(){
  if(holderBackfillV9.running||holderBackfillV9.completed)return;
  holderBackfillV9.running=true;

  try{
    const rows=Object.values(store?.state?.tokens||{})
      .filter(holderBackfillV9NeedsScan)
      .sort((a,b)=>Number(b?.discoveredAt||0)-Number(a?.discoveredAt||0))
      .slice(0,200);

    holderBackfillV9.candidates=rows.length;

    for(const token of rows){
      const mint=String(token?.mint||'').trim();
      if(!mint)continue;

      holderBackfillV9.attempted++;
      holderBackfillV9.lastMint=mint;

      // Immediately invalidate the known-partial values. The V9 store guard
      // prevents the live user-only ledger from putting them back.
      try{
        const pending=store.setToken(mint,{
          holderFresh:false,
          holderCount:null,
          holders:null,
          top10Pct:null,
          developerPct:null,
          developerSharePct:null,
          holderSource:'canonical-v9-pending',
          holderScannedAt:null
        });
        await Promise.resolve(evaluateAll(pending)).catch(()=>{});
        try{publish(mint)}catch{}
      }catch{}

      let success=false;

      for(let attempt=0;attempt<4&&!success;attempt++){
        try{
          const result=await enrichHolders(
            mint,
            {rpc,store,evaluateAll,publish,enrichDiag,eventHolderLedger}
          );

          if(result?.rateLimited){
            holderBackfillV9.rateLimited++;
            await holderBackfillV9Sleep(Math.min(30000,6000*(attempt+1)));
            continue;
          }

          const updated=store?.state?.tokens?.[mint]||null;
          const source=String(updated?.holderSource||'').toLowerCase();

          if(
            updated?.holderFresh===true &&
            Number.isFinite(Number(updated?.holderCount)) &&
            source.includes('getprogramaccounts')
          ){
            success=true;
            holderBackfillV9.succeeded++;
            break;
          }

          throw new Error('canonical scan did not produce authoritative holder state');
        }catch(e){
          holderBackfillV9.lastError=String(e?.message||e).slice(0,200);
          if(attempt<3)await holderBackfillV9Sleep(4000*(attempt+1));
        }
      }

      if(!success)holderBackfillV9.failed++;

      await holderBackfillV9Sleep(750);
    }

    holderBackfillV9.completed=true;
  }finally{
    holderBackfillV9.running=false;
  }
}

setTimeout(()=>{
  void runHolderBackfillV9().catch(e=>{
    holderBackfillV9.lastError=String(e?.message||e).slice(0,200);
  });
},2000).unref?.();

`;

    server=server.slice(0,insertAt)+backfill+server.slice(insertAt);
    fs.writeFileSync(serverFile,server,'utf8');
  }

  // =========================================================================
  // Validation
  // =========================================================================
  for(const f of [ledgerFile,storeFile,serverFile]){
    execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
  }

  const lc=fs.readFileSync(ledgerFile,'utf8');
  const sc=fs.readFileSync(storeFile,'utf8');
  const ac=fs.readFileSync(serverFile,'utf8');

  const required=[
    [lc,'MEMEFLOW_HOLDERS_V9_PROVISIONAL_GUARD','ledger guard'],
    [lc,'holderFresh:Boolean(r.canonicalSeedAt)','conditional event holder freshness'],
    [sc,'MEMEFLOW_HOLDERS_V9_STORE_PRECEDENCE','store precedence'],
    [sc,"patch.holderSource='event-ledger-user-only-provisional'","provisional store source"],
    [ac,'MEMEFLOW_HOLDERS_V9_FORCE_CANONICAL_BACKFILL','forced canonical migration'],
    [ac,"holderSource:'canonical-v9-pending'",'pending invalidation'],
    [ac,'source.includes(\'getprogramaccounts\')','canonical success test']
  ];

  for(const [text,needle,label] of required){
    if(!text.includes(needle))throw new Error('verification missing: '+label);
  }

  console.log('');
  console.log('[MEMEFLOW HOLDERS V9] INSTALLED OK');
  console.log('[MEMEFLOW HOLDERS V9] event-ledger user-only data can no longer be holderFresh.');
  console.log('[MEMEFLOW HOLDERS V9] canonical getProgramAccounts data has precedence in store.');
  console.log('[MEMEFLOW HOLDERS V9] stale persisted holder cards will be rescanned after restart.');
  console.log('[MEMEFLOW HOLDERS V9] UI and user thresholds were not changed.');
  console.log('[MEMEFLOW HOLDERS V9] Backup: '+backupDir);
  console.log('');
}catch(e){
  restoreAll();
  console.error('');
  console.error('[MEMEFLOW HOLDERS V9] FAILED — all touched files restored.');
  console.error('[MEMEFLOW HOLDERS V9] '+String(e?.message||e));
  console.error('[MEMEFLOW HOLDERS V9] Backup: '+backupDir);
  process.exit(1);
}
