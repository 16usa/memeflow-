#!/usr/bin/env node
// Opt-in read-only SQLite price sampler. Does not infer Quantum decisions.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ingest} from './quantum-stage21-monitor.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultDb=path.join(root,'data','token-registry-v1.sqlite');
const defaultOut=path.join(root,'quantum-stage21');
export function sample({db=defaultDb,directory=defaultOut,limit=200,maxAgeMinutes=15,timestamp=Date.now(),write=true}={}){
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error('limit must be 1..1000');
 if(!Number.isFinite(maxAgeMinutes)||maxAgeMinutes<1)throw Error('maxAgeMinutes must be positive');
 const python=path.join(path.dirname(fileURLToPath(import.meta.url)),'quantum-stage22-sqlite-reader.py');
 const p=spawnSync('python3',[python,db,String(limit)],{encoding:'utf8',maxBuffer:3*1024*1024,timeout:20000});
 if(p.error||p.status!==0)throw Error('SQLite read failed: '+(p.stderr||p.error?.message||p.status));
 const data=JSON.parse(p.stdout);const cutoff=timestamp-maxAgeMinutes*60000;
 const events=[];let stale=0,missingPrice=0;
 for(const t of data.tokens){
  const price=Number(t.priceSol);const at=Number(t.lastPriceAt);
  if(!Number.isFinite(price)||price<=0){missingPrice++;continue}
  // Never treat old registry data as live market data.
  if(!Number.isFinite(at)||at<cutoff||at>timestamp+60000){stale++;continue}
  events.push({type:'price',mint:t.mint,price,timestamp});
 }
 const ingested=write?ingest(events,{directory}):{added:0,duplicates:0};
 return {source:'SQLITE_TOKEN_REGISTRY_READ_ONLY',rowsRead:data.tokens.length,eligiblePrices:events.length,stale,missingPrice,priceFieldsPresent:data.priceFieldsPresent,latestPriceAt:data.latestPriceAt,decisionsObserved:0,quantumAuthorityVerified:false,liveConnected:false,trading:false,write,...ingested};
}
function main(){const [cmd,...args]=process.argv.slice(2);if(!['once','watch'].includes(cmd))throw Error('Usage: once [db] | watch [seconds>=30] [db]');
 if(cmd==='once'){console.log(JSON.stringify(sample({db:args[0]?path.resolve(args[0]):defaultDb}),null,2));return}
 const seconds=Number(args[0]||30);if(!Number.isInteger(seconds)||seconds<30)throw Error('interval must be >=30 seconds');
 const db=args[1]?path.resolve(args[1]):defaultDb;
 console.log('Read-only SQLite registry sampling; Ctrl+C to stop. No Quantum decisions inferred.');
 const tick=()=>{try{console.log(JSON.stringify(sample({db})))}catch(e){console.error(e.message)}};tick();setInterval(tick,seconds*1000);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
