
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=fs.existsSync(path.join(root,'memeflow-app'))?path.join(root,'memeflow-app'):root;
const evaluatePath=path.join(appDir,'src','evaluate.mjs');
const storePath=path.join(appDir,'src','store.mjs');

for(const p of [evaluatePath,storePath]){
 if(!fs.existsSync(p)){console.error(`INSTALL ABORTED: ${p} not found`);process.exit(1)}
}

const evalBackup=evaluatePath+'.before-dead-candidate-fix';
const storeBackup=storePath+'.before-dead-candidate-fix';
if(!fs.existsSync(evalBackup))fs.copyFileSync(evaluatePath,evalBackup);
if(!fs.existsSync(storeBackup))fs.copyFileSync(storePath,storeBackup);

fs.copyFileSync(path.join(here,'evaluate.mjs'),evaluatePath);

let store=fs.readFileSync(storePath,'utf8');
const oldSet=`  setToken(mint,t){this.state.tokens[mint]={...(this.state.tokens[mint]||{}),...t,updatedAt:Date.now()};this.state.metrics.scanned++;this.save();return this.state.tokens[mint]}`;
const newSet=`  setToken(mint,t){
    const now=Date.now(),old=this.state.tokens[mint]||{};
    const nextPrice=Number(t?.priceSol),oldPrice=Number(old?.priceSol);
    const hasNextPrice=Number.isFinite(nextPrice)&&nextPrice>0;
    const priceChanged=hasNextPrice&&(!Number.isFinite(oldPrice)||Math.abs(nextPrice-oldPrice)>Math.max(1e-18,Math.abs(oldPrice)*0.000001));
    const peak=Math.max(Number(old?.peakPriceSol)||0,hasNextPrice?nextPrice:0);
    const pressureChanged=t?.buyPressure!==undefined&&Number(t.buyPressure)!==Number(old?.buyPressure);
    const activityChanged=priceChanged||pressureChanged||Number(t?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(t?.sellTransactions||0)!==Number(old?.sellTransactions||0);
    this.state.tokens[mint]={
      ...old,...t,
      peakPriceSol:peak||old.peakPriceSol||null,
      lastPriceAt:hasNextPrice?now:(old.lastPriceAt||null),
      lastPriceChangeAt:priceChanged?now:(old.lastPriceChangeAt||old.lastPriceAt||null),
      lastMarketActivityAt:activityChanged?now:(old.lastMarketActivityAt||old.lastPriceChangeAt||null),
      updatedAt:now
    };
    this.state.metrics.scanned++;this.save();return this.state.tokens[mint]
  }`;
if(!store.includes(oldSet)){
 console.error('INSTALL ABORTED: exact store.setToken implementation not found. No store changes made.');
 fs.copyFileSync(evalBackup,evaluatePath);
 process.exit(1);
}
store=store.replace(oldSet,newSet);

const oldDec=`  decisions(uid){
    const m=this._uidDec[uid];
    if(!m||!m.size)return[];
    return[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,200).map(([k])=>this.state.decisions[k]).filter(Boolean)
  }`;
const newDec=`  decisions(uid){
    const m=this._uidDec[uid];
    if(!m||!m.size)return[];
    const rank={ 'BUY READY':6, WATCH:5, WAITING:4, BLOCKED:2, EXPIRED:1 };
    return[...m.entries()]
      .map(([k,t])=>({k,t,d:this.state.decisions[k]}))
      .filter(x=>x.d)
      .sort((a,b)=>{
        const ar=rank[a.d.state]||0,br=rank[b.d.state]||0;
        if(ar!==br)return br-ar;
        if(Boolean(a.d.terminal)!==Boolean(b.d.terminal))return a.d.terminal?1:-1;
        return b.t-a.t;
      })
      .slice(0,200)
      .map(x=>x.d)
  }`;
if(!store.includes(oldDec)){
 console.error('INSTALL ABORTED: exact store.decisions implementation not found.');
 fs.copyFileSync(evalBackup,evaluatePath);
 fs.copyFileSync(storeBackup,storePath);
 process.exit(1);
}
store=store.replace(oldDec,newDec);
fs.writeFileSync(storePath,store,'utf8');

console.log('Installed MEMEFLOW dead-candidate lifecycle fix.');
console.log('Changed: src/evaluate.mjs');
console.log('Changed: src/store.mjs');
console.log('Backups created for both files.');
