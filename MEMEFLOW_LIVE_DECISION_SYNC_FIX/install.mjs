import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const evaluatePath=path.join(appDir,'src','evaluate.mjs');
const serverPath=path.join(appDir,'app-server.mjs');
for(const file of [evaluatePath,serverPath]){if(!fs.existsSync(file)){console.error(`INSTALL ABORTED: missing ${file}`);process.exit(1)}}
for(const file of [evaluatePath,serverPath]){const b=`${file}.before-live-decision-sync-fix`;if(!fs.existsSync(b))fs.copyFileSync(file,b)}
function rep(text,before,after,label){if(text.includes(after))return text;if(!text.includes(before))throw new Error(`INSTALL ABORTED: ${label} anchor not found`);return text.replace(before,after)}
let evaluate=fs.readFileSync(evaluatePath,'utf8');
evaluate=rep(evaluate,`const MAX_WAITING_MS=60_000;\n\nfunction lifecycle(token,s,now=Date.now()){\n const discovered=Number(token?.discoveredAt||token?.createdAt||0);\n const ageMinutes=num(token,'ageMinutes')??(discovered?Math.max(0,(now-discovered)/60000):null);`,`const MAX_WAITING_MS=60_000;\n\nexport function tokenAgeMinutes(token,now=Date.now()){\n const discovered=Number(token?.discoveredAt||token?.createdAt||0);\n if(Number.isFinite(discovered)&&discovered>0)return Math.max(0,(now-discovered)/60000);\n return num(token,'ageMinutes');\n}\n\nfunction lifecycle(token,s,now=Date.now()){\n const ageMinutes=tokenAgeMinutes(token,now);`,'live token age helper');
evaluate=rep(evaluate,` const age=num(token,'ageMinutes')??(token?.discoveredAt?Math.max(0,(Date.now()-Number(token.discoveredAt))/60000):null);`,` const age=tokenAgeMinutes(token);`,'evaluation age calculation');
let server=fs.readFileSync(serverPath,'utf8');
server=rep(server,`import {evaluate} from './src/evaluate.mjs';`,`import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';`,'evaluate import');
server=rep(server,`    ageMinutes:finite(t.ageMinutes)??(t.discoveredAt?Math.max(0,(Date.now()-t.discoveredAt)/60000):null),`,`    ageMinutes:tokenAgeMinutes(t),`,'candidate age output');
server=rep(server,`    quoteAgeMs:Date.now()-(t.updatedAt||0),`,`    quoteAgeMs:t.lastPriceAt?Math.max(0,Date.now()-t.lastPriceAt):null,`,'quote freshness output');
server=rep(server,`store.setToken(mint,{priceSol:c.priceSol,liquiditySol:c.liquiditySol,marketCapSol:liveMarketCap,marketCap:liveMarketCap,liquidity:c.liquiditySol,momentum:t.buyPressure??null,complete:c.complete,source:'Solana bonding curve'});publish(mint);try{paper.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}}}catch(e){store.setToken(mint,{scanError:e.message})}}`,`store.setToken(mint,{priceSol:c.priceSol,liquiditySol:c.liquiditySol,marketCapSol:liveMarketCap,marketCap:liveMarketCap,liquidity:c.liquiditySol,momentum:t.buyPressure??null,complete:c.complete,source:'Solana bonding curve'});await evaluateAll(store.state.tokens[mint]);publish(mint);try{paper.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}}}catch(e){store.setToken(mint,{scanError:e.message});await evaluateAll(store.state.tokens[mint])}}`,'live timer decision refresh');
fs.writeFileSync(evaluatePath,evaluate,'utf8');
fs.writeFileSync(serverPath,server,'utf8');
console.log('Installed MEMEFLOW live decision synchronization fix.');
console.log('- one live age calculation for API and AI reason');
console.log('- quoteAgeMs uses last successful price quote');
console.log('- price polling and RPC errors trigger AI re-evaluation');
