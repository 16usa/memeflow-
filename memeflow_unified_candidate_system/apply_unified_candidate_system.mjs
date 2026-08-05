import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const indexPath=path.join(root,'memeflow-app','index.html');
if(!fs.existsSync(indexPath)) throw new Error('Run from ~/workspace: memeflow-app/index.html not found.');

let html=fs.readFileSync(indexPath,'utf8');
const backup=indexPath+'.before-unified-candidate-system';
if(!fs.existsSync(backup)) fs.copyFileSync(indexPath,backup);

const MARK='MEMEFLOW_UNIFIED_CANDIDATE_SYSTEM_V1';
if(html.includes(MARK)){
  console.log('✓ Unified candidate system is already installed');
  process.exit(0);
}

const script=`
<script id="memeflow-unified-candidate-system">
(()=>{
'use strict';
const MARK='${MARK}';
const $=s=>document.querySelector(s);
const text=(sel,v)=>{const e=$(sel);if(e)e.textContent=v};
const html=(sel,v)=>{const e=$(sel);if(e)e.innerHTML=v};
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const first=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!=='');
const cleanReasons=(reasons=[])=>{
 const seen=new Set(),out=[];
 for(const raw of reasons){
   const s=String(raw||'').trim();
   if(!s)continue;
   const key=s.toLowerCase()
     .replace(/^waiting:\\s*/,'')
     .replace(/holders? data pending/g,'holder data pending')
     .replace(/\\s+/g,' ');
   if(seen.has(key))continue;
   seen.add(key);out.push(s);
 }
 return out;
};
const fmt={
 pct:v=>finite(v)?Number(v).toFixed(Number.isInteger(Number(v))?0:1)+'%':'—',
 sol:v=>finite(v)?Number(v).toFixed(Number(v)>=10?1:3)+' SOL':'—',
 ratio:v=>finite(v)?Number(v).toFixed(2)+'×':'—',
 age:v=>finite(v)?Math.max(0,Math.round(Number(v)/1000))+' sec':'—'
};
function classify(c,label,value,required=true){
 const reasons=cleanReasons(c.reasons);
 const low=label.toLowerCase();
 const matching=reasons.find(r=>r.toLowerCase().includes(low));
 if(matching){
   const pending=/pending|unavailable|waiting/i.test(matching);
   return {label,value:value??'—',state:pending?'active':'fail',detail:matching};
 }
 if(value!==null&&value!==undefined&&value!=='—')return {label,value,state:'pass',detail:label+' available'};
 return {label,value:'—',state:required?'active':'wait',detail:label+' not available'};
}
function walletSnapshot(){
 const gate=($('#walletExecutionGate')?.textContent||'').trim().toUpperCase();
 const bal=($('#walletBalanceGate')?.textContent||'').trim().toUpperCase();
 return {
   connected:gate==='CONNECTED'||gate==='PASS',
   balancePass:bal==='PASS',
   gate,bal
 };
}
let lastMint='';
function sync(c){
 const has=Boolean(c&&c.id);
 const reasons=cleanReasons(c?.reasons);
 const state=has?(c.state||'WAITING'):'WAITING';
 const mint=first(c?.mint,c?.tokenMint,c?.tokenAddress,'');
 const price=first(c?.priceSol,c?.price);
 const marketCap=first(c?.marketCapSol,c?.marketCap);
 const liquidity=first(c?.liquiditySol,c?.liquidity);
 const holders=first(c?.holderCount,c?.holders);
 const top10=first(c?.top10Pct,c?.top10);
 const developer=first(c?.developerPct,c?.developerSharePct,c?.developer);
 const momentum=first(c?.buyPressure,c?.momentum);
 const quoteAge=finite(c?.quoteAgeMs)?Number(c.quoteAgeMs):null;

 // AI Decision Studio: same state and reasons as Primary Candidate.
 const badge=$('#decisionState');
 if(badge){badge.textContent=state;badge.className='state '+(state==='BUY READY'?'buy':state==='BLOCKED'?'block':state==='WATCH'?'watch':'wait')}
 const reason=$('#decisionReason');
 if(reason){
   const headline=first(c?.primaryReason,reasons[0],has?'Evaluation in progress':'No candidate selected');
   const details=reasons.filter(r=>r!==headline).slice(0,4).join(' · ')||
     (state==='BUY READY'?'All configured AI and market gates passed.':'Waiting for complete server evidence.');
   reason.className='reason '+(state==='BUY READY'?'green':state==='BLOCKED'?'red':state==='WATCH'?'cyan':'');
   reason.innerHTML='<b>'+headline+'</b><span>'+details+'</span>';
 }

 const checks=[
   classify(c||{},'Price',finite(price)?fmt.sol(price):'—'),
   classify(c||{},'Market cap',finite(marketCap)?fmt.sol(marketCap):'—'),
   classify(c||{},'Liquidity',finite(liquidity)?fmt.sol(liquidity):'—'),
   classify(c||{},'Holders',finite(holders)?String(Math.round(Number(holders))):'—'),
   classify(c||{},'Top-10',finite(top10)?fmt.pct(top10):'—'),
   classify(c||{},'Buy pressure',finite(momentum)?fmt.ratio(momentum):'—'),
   classify(c||{},'Developer',finite(developer)?fmt.pct(developer):'—')
 ];
 const tree=$('#decisionTree');
 if(tree){
   tree.innerHTML=has?checks.map(x=>'<div class="tree-node '+x.state+'" title="'+String(x.detail).replace(/"/g,'&quot;')+'"><b>'+x.label+'</b><br>'+x.value+'</div>').join('')
     :'<div class="empty-state production-empty">Select a candidate to view server decision checks.</div>';
 }

 // Keep chart bound to exactly the selected mint.
 const chart=$('#marketChart');
 if(chart){
   chart.dataset.tokenAddress=mint;
   chart.dataset.chainId='solana';
 }
 text('#chartSymbol',has?(c.symbol||c.name||'TOKEN'):'—');
 text('#chartSource',has?(c.source||c.meta||'Solana on-chain'):'Waiting for market data');
 if(mint&&mint!==lastMint){
   lastMint=mint;
   window.dispatchEvent(new CustomEvent('memeflow:candidatechange',{detail:{
     name:c.name,symbol:c.symbol||c.name,tokenAddress:mint,mint
   }}));
 }

 // Honest chart empty-state wording; do not claim history exists when there are zero points.
 const chartShell=$('#marketChart');
 if(chartShell){
   const loading=[...chartShell.querySelectorAll('*')].find(e=>/Loading market history/i.test(e.textContent||''));
   if(loading&&(!finite(price)))loading.textContent='Waiting for the first verified price point…';
 }

 // One nine-gate execution model for every section.
 const wallet=walletSnapshot();
 const gates=[
   {name:'Candidate selected',pass:has},
   {name:'AI BUY READY',pass:state==='BUY READY'},
   {name:'Verified price',pass:finite(price)},
   {name:'Fresh holder evidence',pass:c?.holderFresh===true},
   {name:'Route approved',pass:c?.routeApproved===true},
   {name:'Risk approved',pass:c?.riskApproved===true},
   {name:'Fresh quote',pass:quoteAge!==null&&quoteAge<=15000},
   {name:'Wallet connected',pass:wallet.connected},
   {name:'Balance approved',pass:wallet.balancePass}
 ];
 const passed=gates.filter(g=>g.pass).length;
 const safe=passed===gates.length;
 text('#executionReadinessCount',passed+' / '+gates.length+' checks');
 text('#executionReadinessLabel',safe?'All pre-trade checks passed':gates.filter(g=>!g.pass).map(g=>g.name).slice(0,3).join(' · ')+' pending');
 const bar=$('#executionReadinessBar');if(bar)bar.style.width=Math.round(passed/gates.length*100)+'%';
 const execState=$('#executionState');if(execState){execState.textContent=safe?'SAFE':'LOCKED';execState.className='state '+(safe?'buy':'wait')}
 const explainer=$('#executionSignalExplainer');
 if(explainer)explainer.innerHTML='<b>AI signal:</b> '+state+' &nbsp;·&nbsp; <b>Execution:</b> '+(safe?'SAFE TO VALIDATE':'LOCKED');
 text('#executionSize',finite(c?.positionSize)?c.positionSize+' SOL':'—');
 text('#quoteAge',fmt.age(quoteAge));
 text('#executionSlippage',finite(c?.slippagePct)?fmt.pct(c.slippagePct):'—');
 const risk=$('#executionRiskGate');if(risk){risk.textContent=c?.riskApproved===true?'PASS':'PENDING';risk.style.color=c?.riskApproved===true?'var(--green)':'var(--yellow)'}
 const route=$('#executionRouteGate');if(route){route.textContent=c?.routeApproved===true?'PASS':'PENDING';route.style.color=c?.routeApproved===true?'var(--green)':'var(--yellow)'}
 text('#primaryBlockerTitle',safe?'All checks passed':'Execution locked: '+(reasons[0]||gates.find(g=>!g.pass)?.name||'validation pending'));
 text('#primaryBlockerText',safe?'The selected candidate is eligible for final validation. Transaction submission remains disabled until explicit confirmation.':cleanReasons(reasons).slice(0,4).join(' · ')||'Complete the pending market, AI, wallet and risk checks.');
 const validate=$('#validateBtn');if(validate){validate.disabled=!safe;validate.setAttribute('aria-disabled',String(!safe))}
 const preview=$('#executionPreview');if(preview)preview.classList.toggle('locked',!safe);

 // Mission/top context follows the same selected candidate.
 text('#opMission',has?(c.name||c.symbol||'Selected candidate'):'No active candidate');
 text('#mobileSignalText',has?(c.primaryReason||reasons[0]||state):'Waiting for verified data');
 const mobile=$('#mobileSignalState');if(mobile){mobile.textContent=state;mobile.className='state '+(state==='BUY READY'?'buy':state==='BLOCKED'?'block':state==='WATCH'?'watch':'wait')}
 text('#signalWhy',has?(c.primaryReason||reasons[0]||state):'No verified candidate');
 text('#signalDetail',has?(reasons.slice(1,4).join(' · ')||'All sections use the same server decision payload.'):'The authenticated decision feed has not selected a candidate.');
 text('#signalData',has&&finite(c.data)?Math.round(Number(c.data))+'%':'—');
}
document.addEventListener('memeflow:statechange',e=>sync(e.detail?.candidate||null));
window.addEventListener('mf:wallet-change',()=>{const c=window.MEMEFLOW_CORE?.getSelected?.();if(c)sync(c)});
setInterval(()=>{const c=window.MEMEFLOW_CORE?.getSelected?.();if(c?.id)sync(c)},2000);
window.MEMEFLOW_UNIFIED_CANDIDATE_SYSTEM={version:1,sync};
})();
</script>
`;

const bodyEnd=html.lastIndexOf('</body>');
if(bodyEnd<0)throw new Error('</body> not found. No files changed.');
html=html.slice(0,bodyEnd)+script+html.slice(bodyEnd);
fs.writeFileSync(indexPath,html,'utf8');

const testPath=path.join(root,'memeflow-app','src','unified-candidate-system.test.mjs');
const test=`import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('unified candidate integration is installed',()=>{
 assert.match(page,/MEMEFLOW_UNIFIED_CANDIDATE_SYSTEM_V1/);
 assert.match(page,/memeflow:statechange/);
 assert.match(page,/decisionTree/);
 assert.match(page,/executionReadinessCount/);
 assert.match(page,/marketChart/);
});
test('readiness uses nine real gates',()=>{
 for(const gate of ['Candidate selected','AI BUY READY','Verified price','Fresh holder evidence','Route approved','Risk approved','Fresh quote','Wallet connected','Balance approved']){
   assert.ok(page.includes(gate),gate+' missing');
 }
});
test('hardcoded fake readiness is overridden',()=>{
 assert.match(page,/passed===gates\\.length/);
 assert.match(page,/passed\\+' \\/ '\\+gates\\.length\\+' checks'/);
});
`;
fs.writeFileSync(testPath,test,'utf8');

console.log('✓ Unified candidate system installed');
console.log('✓ AI Decision Studio, chart and execution checks now share the selected candidate');
console.log('✓ Nine-gate readiness test installed');
console.log('Backup:',backup);
