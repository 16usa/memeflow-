import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const files={
 server:path.join(root,'memeflow-app','app-server.mjs'),
 enrich:path.join(root,'memeflow-app','src','enrich.mjs'),
 evaluate:path.join(root,'memeflow-app','src','evaluate.mjs'),
 index:path.join(root,'memeflow-app','index.html')
};
for(const [k,p] of Object.entries(files))if(!fs.existsSync(p))throw new Error(`Missing ${k}: ${p}. Run from ~/workspace.`);

for(const p of Object.values(files)){
 const b=p+'.before-final-backend-cycle-fix';
 if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

let server=fs.readFileSync(files.server,'utf8');
let enrich=fs.readFileSync(files.enrich,'utf8');
let evaluate=fs.readFileSync(files.evaluate,'utf8');
let index=fs.readFileSync(files.index,'utf8');

const MARK='MEMEFLOW_FINAL_BACKEND_CYCLE_V1';
if(server.includes(MARK)){
 console.log('✓ Final backend cycle fix already installed');
 process.exit(0);
}

// 1) Canonical freshness, route and history helpers.
const helperAnchor="const liveEvalMetrics=makeLiveEvalMetrics();";
if(!server.includes(helperAnchor))throw new Error('liveEvalMetrics anchor not found.');
server=server.replace(helperAnchor,`/* ${MARK} */
function appendPricePoint(token,price,source='Solana bonding curve'){
  if(!(Number(price)>0))return token?.priceHistory||[];
  const now=Date.now();
  const history=Array.isArray(token?.priceHistory)?token.priceHistory.slice(-1999):[];
  const last=history[history.length-1];
  if(!last||now-Number(last.t||0)>=500||Number(last.price)!==Number(price)){
    history.push({t:now,price:Number(price),source});
  }
  return history.slice(-2000);
}
function marketPatch(token,curveData){
  const now=Date.now();
  const price=Number(curveData?.priceSol);
  const liquidity=Number(curveData?.liquiditySol);
  const validPrice=Number.isFinite(price)&&price>0?price:null;
  const validLiquidity=Number.isFinite(liquidity)&&liquidity>=0?liquidity:null;
  const marketCap=validPrice&&Number(token?.totalSupply)>0?validPrice*Number(token.totalSupply):null;
  return {
    priceSol:validPrice,
    liquiditySol:validLiquidity,
    marketCapSol:marketCap,
    marketCap,
    liquidity:validLiquidity,
    priceUpdatedAt:validPrice?now:(token?.priceUpdatedAt||null),
    marketUpdatedAt:now,
    priceHistory:validPrice?appendPricePoint(token,validPrice):token?.priceHistory||[],
    complete:curveData?.complete??token?.complete??null,
    source:'Solana bonding curve'
  };
}
${helperAnchor}`);

// 2) Replace unsafe candidate freshness/route fields.
server=server.replace(
"    riskApproved:d.state==='BUY READY',\n    routeApproved:t.priceSol!=null,\n    holderFresh:t.holderFresh,\n    positionSize:null,\n    quoteAgeMs:Date.now()-(t.updatedAt||0),",
`    riskApproved:d.state==='BUY READY',
    routeApproved:Boolean(
      d.state==='BUY READY' &&
      Number(t.priceSol)>0 &&
      t.priceUpdatedAt &&
      Date.now()-Number(t.priceUpdatedAt)<=15000
    ),
    holderFresh:t.holderFresh===true,
    positionSize:null,
    quoteAgeMs:t.priceUpdatedAt?Date.now()-Number(t.priceUpdatedAt):null,`
);

// Add timestamps/history to payload if not present.
server=server.replace(
"    buyPressure,\n    momentum:buyPressure,\n    ageMinutes:",
`    buyPressure,
    momentum:buyPressure,
    priceUpdatedAt:t.priceUpdatedAt||null,
    holderUpdatedAt:t.holderUpdatedAt||null,
    marketUpdatedAt:t.marketUpdatedAt||null,
    decisionUpdatedAt:d.updatedAt||d.at||null,
    priceHistory:Array.isArray(t.priceHistory)?t.priceHistory:[],
    ageMinutes:`
);

// 3) Price timer: store canonical market patch, re-evaluate, publish.
const timerOld=/\/\* MEMEFLOW_TIMER_MARKETCAP_V1 \*\/ const liveMarketCap=.*?store\.setToken\(mint,\{priceSol:c\.priceSol,liquiditySol:c\.liquiditySol,marketCapSol:liveMarketCap,marketCap:liveMarketCap,liquidity:c\.liquiditySol,momentum:t\.buyPressure\?\?null,complete:c\.complete,source:'Solana bonding curve'\}\);publish\(mint\)/;
if(!timerOld.test(server))throw new Error('Current price timer block not found.');
server=server.replace(timerOld,
`/* MEMEFLOW_TIMER_MARKETCAP_V1 */ const updated=store.setToken(mint,marketPatch(t,c));evaluateAll(updated);publish(mint)`
);

// 4) SSE point must use verified price and its timestamp.
server=server.replace(
"point:t?.priceSol?{t:Date.now(),price:t.priceSol,source:'Solana'}:null,status:{stale:!t?.priceSol",
"point:Number(t?.priceSol)>0?{t:t.priceUpdatedAt||Date.now(),price:Number(t.priceSol),source:t.source||'Solana'}:null,status:{stale:!(Number(t?.priceSol)>0)"
);

// 5) Add a deterministic history endpoint before static fallback.
const historyRoute=`if(req.method==='GET'&&url.pathname==='/api/market/history'){
 const u=user(req,res);if(!u)return json(res,401,{error:'unauthorized'});
 const mint=url.searchParams.get('mint')||url.searchParams.get('token')||'';
 const t=store.state.tokens[mint];
 if(!t)return json(res,404,{error:'token not found',mint});
 const interval=url.searchParams.get('interval')||'1s';
 const limits={ '1s':600,'1m':1440,'5m':2016,'15m':2016,'1h':2160,'All':2000,all:2000 };
 const limit=limits[interval]||600;
 const points=(Array.isArray(t.priceHistory)?t.priceHistory:[])
   .filter(p=>Number(p?.price)>0&&Number(p?.t)>0)
   .slice(-limit);
 return json(res,200,{mint,interval,points,stale:!t.priceUpdatedAt||Date.now()-t.priceUpdatedAt>15000,priceUpdatedAt:t.priceUpdatedAt||null,source:t.source||'Solana'});
}
`;
const routeAnchor="if(req.method==='GET'&&url.pathname==='/api/discovery/status')";
if(!server.includes(routeAnchor))throw new Error('Discovery status route anchor not found.');
server=server.replace(routeAnchor,historyRoute+routeAnchor);

// 6) Enrichment stores independent timestamps and initial history.
const updateAnchor="      update.priceSol       = c.priceSol    ?? null;\n      update.liquiditySol   = c.liquiditySol ?? null;";
if(!enrich.includes(updateAnchor))throw new Error('Immediate curve update anchor not found.');
enrich=enrich.replace(updateAnchor,
`      update.priceSol       = Number(c.priceSol)>0 ? Number(c.priceSol) : null;
      update.liquiditySol   = Number.isFinite(Number(c.liquiditySol)) ? Number(c.liquiditySol) : null;
      update.priceUpdatedAt = update.priceSol ? Date.now() : null;
      update.marketUpdatedAt= Date.now();
      update.priceHistory   = update.priceSol ? [{t:update.priceUpdatedAt,price:update.priceSol,source:'Solana bonding curve'}] : [];`
);

enrich=enrich.replace(
"    holderFresh:true,\n    top10Pct:top10,\n    holderCount,",
`    holderFresh:true,
    holderUpdatedAt:Date.now(),
    top10Pct:top10,
    holderCount,`
);

// 7) Evaluate: missing buy pressure is pending, valid price must be >0.
const oldBuy="if(enabled(s.minBuyPressure))need(token.buyPressure==null?null:Number(token.buyPressure)>=Number(s.minBuyPressure),`buy pressure below ${s.minBuyPressure}×`,15);\n need(token.priceSol!=null,'price unavailable',12);";
if(!evaluate.includes(oldBuy))throw new Error('Buy pressure evaluation anchor not found.');
evaluate=evaluate.replace(oldBuy,
`if(enabled(s.minBuyPressure)){
   const bp=num(token,'buyPressure','momentum');
   if(bp===null)need(null,'Buy pressure data pending',15);
   else need(bp>=Number(s.minBuyPressure),\`Buy pressure \${bp.toFixed(2)}× below minimum \${s.minBuyPressure}×\`,15);
 }
 need(num(token,'priceSol')!==null&&num(token,'priceSol')>0,'price unavailable',12);`
);

// Avoid duplicate generic holder pending reason when range already handles it.
evaluate=evaluate.replace(
" need(token.holderCount==null&&enabled(s.minHolders)?null:true,'holder data pending',5);",
" if(!enabled(s.minHolders)&&token.holderCount==null&&s.requireFreshHolderSnapshot)need(null,'Holder data pending',5);"
);

// 8) Frontend RPC status + history loader + tiny-price precision.
const frontendScript=`
<script id="memeflow-final-backend-cycle-ui">
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const tinySol=v=>{
 const n=Number(v);if(!(n>0))return '—';
 if(n>=0.001)return n.toFixed(3)+' SOL';
 if(n>=0.000001)return n.toFixed(6)+' SOL';
 return n.toExponential(4)+' SOL';
};
async function syncRpc(){
 try{
  const r=await fetch('/api/discovery/status',{credentials:'include',headers:{accept:'application/json'}});
  if(!r.ok)throw new Error(String(r.status));
  const d=await r.json();
  const connected=Boolean(d.connected);
  const degraded=Boolean(d.rpcCircuitOpen||d.lastError||d.error);
  const host=d.rpcActiveHostname||'Solana';
  const label=connected?(degraded?'Degraded · '+host:'Connected · '+host):'Disconnected';
  const nodes=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/Unavailable|SOLANA RPC/i.test(e.textContent||''));
  for(const e of nodes){
    if(/Unavailable/i.test(e.textContent||''))e.textContent=label;
  }
 }catch{}
}
async function loadHistory(candidate){
 const mint=candidate?.mint||candidate?.tokenMint||candidate?.tokenAddress;
 if(!mint)return;
 try{
  const r=await fetch('/api/market/history?mint='+encodeURIComponent(mint)+'&interval=1s',{credentials:'include'});
  if(!r.ok)return;
  const d=await r.json();
  window.dispatchEvent(new CustomEvent('memeflow:markethistory',{detail:d}));
  const zero=[...document.querySelectorAll('*')].find(e=>/^0 points$/i.test((e.textContent||'').trim()));
  if(zero)zero.textContent=(d.points?.length||0)+' points';
  const stale=[...document.querySelectorAll('*')].filter(e=>/^(STALE|LIVE)$/i.test((e.textContent||'').trim()));
  stale.forEach(e=>e.textContent=d.stale?'STALE':'LIVE');
  const loading=[...document.querySelectorAll('*')].find(e=>/Loading market history/i.test(e.textContent||''));
  if(loading)loading.textContent=d.points?.length?'Market history connected':'Waiting for the first verified price point…';
 }catch{}
}
document.addEventListener('memeflow:statechange',e=>{
 const c=e.detail?.candidate;
 if(c){
  loadHistory(c);
  const price=[...document.querySelectorAll('.tree-node')].find(e=>/^Price/i.test(e.textContent||''));
  if(price&&Number(c.priceSol)>0)price.innerHTML='<b>Price</b><br>'+tinySol(c.priceSol);
  const liq=[...document.querySelectorAll('.tree-node')].find(e=>/^Liquidity/i.test(e.textContent||''));
  if(liq&&Number(c.liquiditySol)>0)liq.innerHTML='<b>Liquidity</b><br>'+tinySol(c.liquiditySol);
 }
});
syncRpc();setInterval(syncRpc,5000);
})();
</script>`;
if(!index.includes('memeflow-final-backend-cycle-ui')){
 const bodyEnd=index.lastIndexOf('</body>');
 if(bodyEnd<0)throw new Error('index </body> not found.');
 index=index.slice(0,bodyEnd)+frontendScript+index.slice(bodyEnd);
}

fs.writeFileSync(files.server,server);
fs.writeFileSync(files.enrich,enrich);
fs.writeFileSync(files.evaluate,evaluate);
fs.writeFileSync(files.index,index);

const testPath=path.join(root,'memeflow-app','src','final-backend-cycle.test.mjs');
const test=`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
const evaluate=fs.readFileSync(new URL('./evaluate.mjs',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('price timer persists history and re-evaluates decisions',()=>{
 assert.match(server,/MEMEFLOW_FINAL_BACKEND_CYCLE_V1/);
 assert.match(server,/priceHistory/);
 assert.match(server,/evaluateAll\\(updated\\);publish\\(mint\\)/);
 assert.match(server,/\\/api\\/market\\/history/);
});
test('freshness and route use priceUpdatedAt and positive price',()=>{
 assert.match(server,/priceUpdatedAt/);
 assert.match(server,/Date\\.now\\(\\)-Number\\(t\\.priceUpdatedAt\\)<=15000/);
 assert.match(server,/quoteAgeMs:t\\.priceUpdatedAt/);
});
test('holder enrichment has independent freshness timestamp',()=>{
 assert.match(enrich,/holderUpdatedAt:Date\\.now\\(\\)/);
});
test('missing buy pressure is pending, not falsely below threshold',()=>{
 assert.match(evaluate,/Buy pressure data pending/);
 assert.match(evaluate,/Buy pressure .* below minimum/);
});
test('frontend syncs RPC and market history',()=>{
 assert.match(page,/memeflow-final-backend-cycle-ui/);
 assert.match(page,/\\/api\\/discovery\\/status/);
 assert.match(page,/\\/api\\/market\\/history/);
});
`;
fs.writeFileSync(testPath,test);

console.log('✓ Final backend cycle fix installed');
console.log('✓ Market updates now re-evaluate AI decisions');
console.log('✓ Price/holder timestamps and route freshness installed');
console.log('✓ Price history endpoint and RPC status sync installed');
console.log('✓ Buy-pressure pending logic corrected');
console.log('Run: node --test memeflow-app/src/final-backend-cycle.test.mjs');
