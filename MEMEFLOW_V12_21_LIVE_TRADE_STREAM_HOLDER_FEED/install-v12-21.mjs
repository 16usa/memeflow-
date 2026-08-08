#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const app=path.join(root,'memeflow-app','app-server.mjs');
const holder=path.join(root,'memeflow-app','src','event-holder-ledger.mjs');
const feedDst=path.join(root,'memeflow-app','src','pump-live-trade-feed.mjs');
const MARK='MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED';
const fail=x=>{console.error('ABORT:',x);process.exit(1)};

if(!fs.existsSync(app)||!fs.existsSync(holder))fail('Run from ~/workspace with V12.20 installed');
let a=fs.readFileSync(app,'utf8'),h=fs.readFileSync(holder,'utf8');
if(!h.includes("VERSION='V12.20'"))fail('V12.20 holder ledger not detected');
if(!a.includes('eventMarketLedger'))fail('V12.18 market ledger not detected');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const ab=app+'.before-v12-21-'+stamp,hb=holder+'.before-v12-21-'+stamp;
fs.copyFileSync(app,ab);fs.copyFileSync(holder,hb);
fs.copyFileSync(new URL('./pump-live-trade-feed.mjs',import.meta.url),feedDst);

// Holder TradeEvent decoder is already scoped by Pump-program transaction stream.
// Do not reject valid Pump mints merely because their address does not end in "pump".
h=h.replace("const VERSION='V12.20';","const VERSION='V12.21';");
h=h.replace("if(!pump(mint)||!user)return null;","if(!mint||!user)return null;");
h=h.replace("holderSource:'event-ledger-v12-20-user-only'","holderSource:'event-ledger-v12-21-live-user-only'");
h=h.replace("eventLedgerVersion:VERSION,","eventLedgerVersion:VERSION,\n      eventLedgerLastUser:r.lastUser||null,");
h=h.replace("r.txCount++;","r.txCount++;\n      r.lastUser=e.user;");
h=h.replace("stateFile:path.basename(STATE)","stateFile:path.basename(STATE),liveTradeStreamCompatible:true");

// Import live feed after imports.
if(!a.includes(MARK)){
  const ims=[...a.matchAll(/^import .*?;\s*$/gm)];
  const line=`import { startPumpLiveTradeFeed } from './src/pump-live-trade-feed.mjs'; // ${MARK}\n`;
  if(ims.length){
    const x=ims.at(-1),i=x.index+x[0].length;
    a=a.slice(0,i)+'\n'+line+a.slice(i);
  }else a=line+a;

  // Add top-level start near the end. All references are guarded with typeof.
  a += `

// ${MARK}
const __pumpLiveTradeFeed=startPumpLiveTradeFeed({
  eventHolderLedger: typeof eventHolderLedger!=='undefined'?eventHolderLedger:null,
  eventMarketLedger: typeof eventMarketLedger!=='undefined'?eventMarketLedger:null,
  store: typeof store!=='undefined'?store:null,
  publish: typeof publish==='function'?publish:null,
  evaluateAI: typeof evaluateAI==='function'?evaluateAI:null
});
`;

  // Expose diagnostics inside existing V10.2 object.
  const needle="diagnosticVersion:'V10.2-same-instance',";
  if(a.includes(needle)){
    a=a.replace(needle,needle+"\n      liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,");
  }
}

fs.writeFileSync(holder,h);
fs.writeFileSync(app,a);

for(const p of [holder,feedDst,app]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){
    fs.copyFileSync(ab,app);fs.copyFileSync(hb,holder);
    try{fs.rmSync(feedDst,{force:true})}catch{}
    console.error('ABORT: syntax check failed; backups restored');
    console.error(r.stderr||r.stdout);process.exit(2);
  }
}
console.log('PASS: V12.21 LIVE TRADE STREAM HOLDER FEED installed');
console.log('App backup:',ab);
console.log('Holder backup:',hb);
console.log('Pump program logs stream:', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
console.log('V12.18 market ledger preserved.');
