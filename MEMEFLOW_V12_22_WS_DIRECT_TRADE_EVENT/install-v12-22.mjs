#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const HOLDER=path.join(ROOT,'memeflow-app','src','event-holder-ledger.mjs');
const FEED=path.join(ROOT,'memeflow-app','src','pump-live-trade-feed.mjs');
const MARK='MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT';

function fail(x){console.error('ABORT:',x);process.exit(1)}
if(!fs.existsSync(APP)||!fs.existsSync(HOLDER)||!fs.existsSync(FEED))fail('Run from ~/workspace with V12.21 installed.');

let a=fs.readFileSync(APP,'utf8');
let h=fs.readFileSync(HOLDER,'utf8');
if(!a.includes('startPumpLiveTradeFeed'))fail('V12.21 live feed hook not found.');
if(!h.includes("VERSION='V12.21'"))fail('V12.21 holder ledger not found.');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const ab=APP+'.before-v12-22-'+stamp;
const hb=HOLDER+'.before-v12-22-'+stamp;
const fb=FEED+'.before-v12-22-'+stamp;
fs.copyFileSync(APP,ab);fs.copyFileSync(HOLDER,hb);fs.copyFileSync(FEED,fb);

// Replace live feed: direct WS decode, no getTransaction queue.
fs.copyFileSync(new URL('./pump-live-trade-feed-v12-22.mjs',import.meta.url),FEED);

// Upgrade holder ledger with direct event method.
h=h.replace("const VERSION='V12.21';","const VERSION='V12.22';");
h=h.replace("holderSource:'event-ledger-v12-21-live-user-only'","holderSource:'event-ledger-v12-22-ws-direct-user-only'");

if(!h.includes('ingestTradeEventDirect(e)')){
  const needle='  snapshot(m){';
  const at=h.indexOf(needle);
  if(at<0)fail('Could not find snapshot(m) insertion point.');

  const method=`  ingestTradeEventDirect(e){
    if(!e?.mint||!e?.user||e?.tokenAmount===null||e?.tokenAmount===undefined)return null;
    this.metrics.transactionsSeen++;
    this.metrics.pumpTransactionsSeen++;
    this.metrics.tradeEventsSeen++;
    this.metrics.lastTxAt=Date.now();

    const r=this.row(e.mint,6);
    r.txCount++;
    r.lastSeenAt=Date.now();
    r.lastUser=e.user;

    const before=r.balances.get(e.user)||0n;
    const amount=typeof e.tokenAmount==='bigint'?e.tokenAmount:BigInt(String(e.tokenAmount||0));
    const after=e.isBuy?before+amount:(before>amount?before-amount:0n);

    if(after>0n)r.balances.set(e.user,after);
    else{
      r.balances.delete(e.user);
      this.metrics.userZeroBalanceRemovals++;
    }

    this.metrics.userBalanceUpdates++;
    this.metrics.holderSnapshots++;
    this.metrics.lastMint=e.mint;
    this.schedule();
    return this.snapshot(e.mint);
  }

`;
  h=h.slice(0,at)+method+h.slice(at);
}

h=h.replace("liveTradeStreamCompatible:true","liveTradeStreamCompatible:true,wsDirectCompatible:true");
fs.writeFileSync(HOLDER,h);

// Mark app for audit, without changing the existing start call.
if(!a.includes(MARK))a += `\n// ${MARK}: live feed module now decodes Pump TradeEvent directly from logsSubscribe; no per-signature HTTP getTransaction.\n`;
fs.writeFileSync(APP,a);

for(const p of [APP,HOLDER,FEED]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){
    fs.copyFileSync(ab,APP);fs.copyFileSync(hb,HOLDER);fs.copyFileSync(fb,FEED);
    console.error('ABORT: node --check failed; V12.21 backups restored.');
    console.error(r.stderr||r.stdout);
    process.exit(2);
  }
}

console.log('PASS: V12.22 WS-DIRECT TRADE EVENT installed');
console.log('HTTP getTransaction removed from live feed hot path.');
console.log('Backups:',ab,hb,fb);
