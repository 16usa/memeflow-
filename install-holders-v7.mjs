import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app');
const files={
  ledger:path.join(APP,'src','event-holder-ledger.mjs'),
  enrich:path.join(APP,'src','enrich.mjs'),
  server:path.join(APP,'app-server.mjs')
};

for(const [k,f] of Object.entries(files)){
  if(!fs.existsSync(f)){
    console.error(`[MEMEFLOW HOLDERS V7] Missing ${k}: ${f}`);
    process.exit(1);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(APP,'.holders-v7-backup',stamp);
fs.mkdirSync(backupDir,{recursive:true});

for(const f of Object.values(files)){
  const rel=path.relative(APP,f);
  const dst=path.join(backupDir,rel);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(f,dst);
}

function restoreAll(){
  for(const f of Object.values(files)){
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
  // 1) Event holder ledger:
  //    TradeEvent users alone are only a provisional subset.
  //    A canonical getProgramAccounts scan seeds the complete wallet baseline.
  // =========================================================================
  let ledger=fs.readFileSync(files.ledger,'utf8');

  if(!ledger.includes('seedCanonicalBalances(m, walletBalances')){
    const snapNeedle='\n  snapshot(m){';
    const pos=ledger.indexOf(snapNeedle);
    if(pos<0)throw new Error('event-holder-ledger snapshot(m) anchor not found');

    const method=`
  // MEMEFLOW_HOLDERS_V7_CANONICAL_BASELINE
  // Seed the live TradeEvent ledger from a complete Solana unique-wallet scan.
  // After this baseline, Pump TradeEvents update the same wallet map incrementally.
  seedCanonicalBalances(m, walletBalances, opts={}){
    if(!m || !(walletBalances instanceof Map))return null;

    const decimals=Number.isInteger(Number(opts.decimals))
      ? Number(opts.decimals)
      : 6;

    const r=this.row(m,decimals);
    const scale=10**Math.max(0,decimals);
    const next=new Map();

    for(const [wallet,uiAmount] of walletBalances){
      if(!wallet)continue;
      const n=Number(uiAmount);
      if(!(n>0) || !Number.isFinite(n))continue;

      // Pump supply (1e9 @ 6 decimals) remains inside Number safe-integer range.
      const rawNumber=Math.round(n*scale);
      if(!Number.isSafeInteger(rawNumber) || rawNumber<=0)continue;

      next.set(wallet,BigInt(rawNumber));
    }

    r.balances=next;
    r.decimals=decimals;
    if(opts.creator)r.creator=opts.creator;
    r.canonicalSeedAt=Date.now();
    r.lastSeenAt=r.canonicalSeedAt;
    r.canonicalHolderCount=next.size;

    this.schedule();
    return this.snapshot(m);
  }
`;
    ledger=ledger.slice(0,pos)+method+ledger.slice(pos);
  }

  // Patch only snapshot(m) body.
  const snapStart=ledger.indexOf('  snapshot(m){');
  if(snapStart<0)throw new Error('snapshot(m) not found after seed insertion');
  const snapOpen=ledger.indexOf('{',snapStart);
  const snapClose=findMatchingBrace(ledger,snapOpen);
  if(snapClose<0)throw new Error('snapshot(m) closing brace not found');
  let snap=ledger.slice(snapStart,snapClose+1);

  // Provisional TradeEvent-only counts must never be advertised as authoritative.
  snap=snap.replace(
    /holderFresh\s*:\s*true\s*,/,
    'holderFresh:Boolean(r.canonicalSeedAt),'
  );

  snap=snap.replace(
    /holderSource\s*:\s*['"][^'"]+['"]\s*,/,
    "holderSource:r.canonicalSeedAt?'Solana getProgramAccounts baseline + live Pump TradeEvent delta':'event-ledger-provisional',"
  );

  snap=snap.replace(
    /holderCount\s*:\s*holders\.length\s*,/,
    'holderCount:r.canonicalSeedAt?holders.length:null,'
  );

  snap=snap.replace(
    /top10Pct\s*:\s*pct\(top10,totalSupply\)\s*,/,
    'top10Pct:r.canonicalSeedAt?pct(top10,totalSupply):null,'
  );

  snap=snap.replace(
    /developerPct\s*:\s*r\.creator\?pct\(dev,totalSupply\):null\s*,/,
    'developerPct:r.canonicalSeedAt&&r.creator?pct(dev,totalSupply):null,'
  );

  snap=snap.replace(
    /developerSharePct\s*:\s*r\.creator\?pct\(dev,totalSupply\):null\s*,/,
    'developerSharePct:r.canonicalSeedAt&&r.creator?pct(dev,totalSupply):null,'
  );

  if(!snap.includes('holderFresh:Boolean(r.canonicalSeedAt)')){
    throw new Error('could not convert event ledger holderFresh to canonical-seed semantics');
  }
  if(!snap.includes('holderCount:r.canonicalSeedAt?holders.length:null')){
    throw new Error('could not convert provisional holderCount to null-before-canonical semantics');
  }

  ledger=ledger.slice(0,snapStart)+snap+ledger.slice(snapClose+1);
  fs.writeFileSync(files.ledger,ledger,'utf8');

  // =========================================================================
  // 2) enrichHolders:
  //    Pass the complete unique-wallet Map into the event ledger as baseline.
  // =========================================================================
  let enrich=fs.readFileSync(files.enrich,'utf8');

  const fnStart=enrich.indexOf('export async function enrichHolders(');
  if(fnStart<0)throw new Error('enrichHolders() not found');
  const fnOpen=enrich.indexOf('{',fnStart);
  const fnClose=findMatchingBrace(enrich,fnOpen);
  if(fnClose<0)throw new Error('enrichHolders() closing brace not found');
  let holderFn=enrich.slice(fnStart,fnClose+1);

  if(!holderFn.includes('eventHolderLedger')){
    holderFn=holderFn.replace(
      /const\s*\{\s*rpc\s*,\s*store\s*,\s*evaluateAll\s*,\s*publish\s*,\s*enrichDiag\s*\}\s*=\s*deps\s*;/,
      'const {rpc,store,evaluateAll,publish,enrichDiag,eventHolderLedger=null}=deps;'
    );
  }

  if(!holderFn.includes('seedCanonicalBalances?.(')){
    const creatorMarker=/(\n\s*const\s+developerPct\s*=\s*creator&&total>0\?creatorAmount\/total\*100:null\s*;)/;
    if(!creatorMarker.test(holderFn)){
      throw new Error('developerPct anchor in enrichHolders() not found');
    }
    holderFn=holderFn.replace(
      creatorMarker,
      `$1

  // Seed the full unique-wallet baseline before the live TradeEvent ledger
  // continues applying incremental buys/sells.
  try{
    eventHolderLedger?.seedCanonicalBalances?.(
      mint,
      walletBalances,
      {decimals,creator}
    );
  }catch(_){}
`
    );
  }

  if(!holderFn.includes('eventHolderLedger=null')){
    throw new Error('could not add eventHolderLedger dependency to enrichHolders()');
  }
  if(!holderFn.includes('seedCanonicalBalances?.(')){
    throw new Error('could not seed canonical balances from enrichHolders()');
  }

  enrich=enrich.slice(0,fnStart)+holderFn+enrich.slice(fnClose+1);
  fs.writeFileSync(files.enrich,enrich,'utf8');

  // =========================================================================
  // 3) app-server:
  //    - pass eventHolderLedger into the canonical holder scan
  //    - stop treating provisional TradeEvent-only rows as a full holder scan
  // =========================================================================
  let server=fs.readFileSync(files.server,'utf8');

  if(!server.includes('enrichDiag,eventHolderLedger')){
    const callRe=/enrichHolders\(\s*mint\s*,\s*\{\s*rpc\s*,\s*store\s*,\s*evaluateAll\s*,\s*publish\s*,\s*enrichDiag\s*\}\s*\)/;
    if(!callRe.test(server)){
      throw new Error('app-server enrichHolders dependency call not recognized');
    }
    server=server.replace(
      callRe,
      'enrichHolders(mint,{rpc,store,evaluateAll,publish,enrichDiag,eventHolderLedger})'
    );
  }

  const admissionStart=server.indexOf('function holderAdmissionForActiveUsers(mint){');
  if(admissionStart<0)throw new Error('holderAdmissionForActiveUsers() not found');
  const admissionOpen=server.indexOf('{',admissionStart);
  const admissionClose=findMatchingBrace(server,admissionOpen);
  if(admissionClose<0)throw new Error('holderAdmissionForActiveUsers() closing brace not found');

  let admission=server.slice(admissionStart,admissionClose+1);

  // The fresh Pump branch used to drop the full RPC scan as soon as *any*
  // TradeEvent users existed. Only a canonical-seeded snapshot may short-circuit.
  admission=admission.replace(
    /if\(\s*__eventHolder\s*\)\s*\{/,
    'if(__eventHolder?.holderFresh===true){'
  );

  // If the fresh ledger is still provisional, allow the normal canonical
  // unique-wallet scan instead of permanently dropping it.
  admission=admission.replace(
    /return\s*\{\s*allow:false\s*,\s*drop:true\s*,\s*reason:['"]fresh_pump_holder_warming['"]\s*,\s*source:['"]ws-direct['"]\s*\}\s*;/,
    "return {allow:true,reason:'fresh_pump_canonical_holder_scan',source:'Solana getProgramAccounts'};"
  );

  // Same rule for the later generic event-ledger shortcut.
  admission=admission.replace(
    /if\(\s*__h\s*\)\s*\{/,
    'if(__h?.holderFresh===true){'
  );

  if(!admission.includes('if(__eventHolder?.holderFresh===true){')){
    throw new Error('fresh Pump event-holder gate was not converted to canonical-only');
  }
  if(!admission.includes("reason:'fresh_pump_canonical_holder_scan'")){
    throw new Error('fresh Pump canonical holder scan allow-path was not installed');
  }
  if(!admission.includes('if(__h?.holderFresh===true){')){
    throw new Error('generic event-holder gate was not converted to canonical-only');
  }

  server=server.slice(0,admissionStart)+admission+server.slice(admissionClose+1);
  fs.writeFileSync(files.server,server,'utf8');

  // =========================================================================
  // Syntax + semantic checks
  // =========================================================================
  for(const f of Object.values(files)){
    execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
  }

  const ledgerCheck=fs.readFileSync(files.ledger,'utf8');
  const enrichCheck=fs.readFileSync(files.enrich,'utf8');
  const serverCheck=fs.readFileSync(files.server,'utf8');

  const required=[
    [ledgerCheck,'seedCanonicalBalances(m, walletBalances','ledger canonical seed method'],
    [ledgerCheck,'holderFresh:Boolean(r.canonicalSeedAt)','ledger canonical holderFresh'],
    [enrichCheck,'seedCanonicalBalances?.(','canonical scan seeds live ledger'],
    [serverCheck,'enrichDiag,eventHolderLedger','server passes event ledger'],
    [serverCheck,"reason:'fresh_pump_canonical_holder_scan'",'fresh Pump full scan allow path']
  ];
  for(const [text,needle,label] of required){
    if(!text.includes(needle))throw new Error('verification missing: '+label);
  }

  console.log('');
  console.log('[MEMEFLOW HOLDERS V7] INSTALLED OK');
  console.log('[MEMEFLOW HOLDERS V7] TradeEvent-only holder counts are now provisional, not authoritative.');
  console.log('[MEMEFLOW HOLDERS V7] Fresh Pump tokens can receive a full Solana unique-wallet holder scan.');
  console.log('[MEMEFLOW HOLDERS V7] Full scan seeds the live ledger; later Pump trades update that complete baseline.');
  console.log('[MEMEFLOW HOLDERS V7] Score/Top10/Developer will use the canonical-seeded holder state.');
  console.log('[MEMEFLOW HOLDERS V7] UI and user filter thresholds were not changed.');
  console.log('[MEMEFLOW HOLDERS V7] Backup: '+backupDir);
  console.log('');
}catch(e){
  restoreAll();
  console.error('');
  console.error('[MEMEFLOW HOLDERS V7] FAILED — all touched files restored.');
  console.error('[MEMEFLOW HOLDERS V7] '+String(e?.message||e));
  console.error('[MEMEFLOW HOLDERS V7] Backup: '+backupDir);
  process.exit(1);
}
