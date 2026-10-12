#!/usr/bin/env node
// Stage 23: explicit decision-event adapter. No synthetic decisions, no server hooks.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ingest} from './quantum-stage21-monitor.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'quantum-stage21');
const allowed=new Set(['BUY_READY','WAITING','BLOCKED']);
const number=(x)=>typeof x==='number'&&Number.isFinite(x)?x:null;
export function convertDecision(raw,{now=Date.now()}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Decision object required');
 const mint=String(raw.mint||'').trim();
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))throw Error('Invalid Solana mint');
 const timestamp=number(raw.timestamp);
 if(timestamp===null||timestamp<now-24*3600_000||timestamp>now+60_000)throw Error('Missing/stale/future decision timestamp');
 if(!allowed.has(raw.decision)||!allowed.has(raw.quantumDecision))throw Error('Explicit baseline and Quantum decisions required');
 const price=number(raw.priceSol);
 if(price===null||price<=0)throw Error('Decision-time priceSol required; cannot substitute latest SQLite price');
 const priceAt=number(raw.priceAt);
 if(priceAt===null||priceAt>timestamp+1000||timestamp-priceAt>60_000)throw Error('Decision-time price timestamp missing/stale');
 const score=number(raw.quantumScore),risk=number(raw.quantumRisk);
 if(score===null||risk===null||score<0||score>100||risk<0||risk>100)throw Error('Explicit Quantum score/risk 0..100 required');
 if(typeof raw.quantumPattern!=='string'||!raw.quantumPattern.trim())throw Error('Explicit Quantum pattern required');
 if(raw.quantumAuthorityVerified!==true)throw Error('Unverified Quantum authority: not ingesting');
 return {type:'prediction',mint,timestamp,price,decision:raw.decision,quantumDecision:raw.quantumDecision,quantumScore:score,quantumRisk:risk,quantumPattern:raw.quantumPattern};
}
export function ingestDecisions(rows,{directory=output,now=Date.now()}={}){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Expected <=1000 decision rows');
 const events=rows.map(row=>convertDecision(row,{now}));
 return {source:'EXPLICIT_VERIFIED_DECISION_EVENTS',decisionsObserved:events.length,quantumAuthorityVerified:events.length>0,trading:false,...ingest(events,{directory})};
}
function main(){const [cmd,filename]=process.argv.slice(2);if(cmd!=='ingest'||!filename)throw Error('Usage: node quantum-stage23-decisions.mjs ingest <verified-decisions.jsonl>');
 const file=path.resolve(filename);if(fs.statSync(file).size>2*1024*1024)throw Error('Input too large');
 const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean);if(lines.length>1000)throw Error('Too many rows');
 console.log(JSON.stringify(ingestDecisions(lines.map(x=>JSON.parse(x))),null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error('Stage 23 refused:',e.message);process.exitCode=1}}
