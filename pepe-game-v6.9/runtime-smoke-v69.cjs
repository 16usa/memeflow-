const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=process.argv[2]||process.cwd();
class Style{constructor(){this.map=new Map()}setProperty(k,v){this.map.set(k,String(v))}getPropertyValue(k){return this.map.get(k)||''}}
class ClassList{constructor(){this.s=new Set()}add(...x){x.forEach(v=>this.s.add(v))}remove(...x){x.forEach(v=>this.s.delete(v))}toggle(v,on){if(on===undefined){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}on?this.s.add(v):this.s.delete(v);return on}contains(v){return this.s.has(v)}}
const ctx={setTransform(){},clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},scale(){},globalAlpha:1,fillStyle:''};
class El{constructor(id=''){this.id=id;this.style=new Style();this.dataset={};this.attrs={};this.classList=new ClassList();this.hidden=false;this.disabled=false;this.inert=false;this.value=id==='betInput'?'100':id==='autoCashout'?'1.5':id==='stopLoss'?'0.75':'';this.textContent='';this.innerHTML='';this.className='';this.listeners={};}addEventListener(t,fn,o){(this.listeners[t]??=[]).push({fn,o})}removeEventListener(){}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}focus(){}blur(){}animate(){return{cancel(){}}}dispatch(t,e={}){for(const x of this.listeners[t]||[])x.fn({...e,target:this,currentTarget:this})}querySelector(sel){if(sel==='b')return get(this.id+'__b');return new El()}querySelectorAll(){return[]}getBoundingClientRect(){return{width:800,height:600}}getContext(){return ctx}get offsetWidth(){return 100}}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
const docListeners={};const docEl=new El('html');
global.document={hidden:false,title:'',documentElement:docEl,querySelector(sel){return sel.startsWith('#')?get(sel.slice(1)):new El()},querySelectorAll(){return[]},addEventListener(t,fn){(docListeners[t]??=[]).push(fn)},removeEventListener(){}};
global.window=global;global.innerWidth=390;global.innerHeight=844;global.devicePixelRatio=1;global.performance={now:()=>Date.now()};
Object.defineProperty(global,'navigator',{value:{onLine:true,vibrate(){},connection:{saveData:false},wakeLock:{async request(){return{released:false,addEventListener(){},async release(){this.released=true}}}}},configurable:true});
global.localStorage={getItem(){return null},setItem(){}};global.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});global.ResizeObserver=class{observe(){}disconnect(){}};
let rafSeq=0;const rafTimers=new Map();global.requestAnimationFrame=cb=>{const id=++rafSeq;const t=setTimeout(()=>{rafTimers.delete(id);cb(Date.now())},2);rafTimers.set(id,t);return id};global.cancelAnimationFrame=id=>{const t=rafTimers.get(id);if(t)clearTimeout(t);rafTimers.delete(id)};
const winListeners={};global.addEventListener=(t,fn)=>{(winListeners[t]??=[]).push(fn)};global.removeEventListener=()=>{};
let lastES=null;global.EventSource=class{static CLOSED=2;constructor(){this.readyState=0;this.listeners={};lastES=this;}addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}emit(t,data){for(const fn of this.listeners[t]||[])fn({data:JSON.stringify(data)})}close(){this.readyState=2;}};
let statusSession=null,statusBalance=10000,statusRev=1,startCalls=0;
function response(data,ok=true,status=200){return{ok,status,json:async()=>data}}
global.fetch=async(url,options={})=>{
  if(url==='/api/game/status'){statusRev++;return response({version:'5.7.1',engineEpoch:'v68',serverTime:Date.now(),eventSeq:statusRev,stateRevision:statusRev,balance:statusBalance,history:[],stats:{rounds:1,wins:1,losses:0,netProfit:52,bestMultiplier:1.52},session:statusSession});}
  if(url==='/api/game/reset'){statusSession=null;statusRev++;return response({engineEpoch:'v68',serverTime:Date.now(),eventSeq:statusRev,stateRevision:statusRev,balance:statusBalance,history:[],stats:{rounds:1,wins:1,losses:0,netProfit:52,bestMultiplier:1.52},session:null});}
  if(url==='/api/game/start'){startCalls++;return response({message:'No candidate',code:'NO_CANDIDATE',selector:{buyReady:0,eligible:0,noPrice:0,noToken:0}},false,409);}
  return response({});
};
global.crypto={randomUUID:()=> '00000000-0000-4000-8000-000000000001'};
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');vm.runInThisContext(js,{filename:'game.js'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const emit=(t,d)=>lastES.emit(t,d);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
(async()=>{
  await sleep(60);assert(lastES,'EventSource not created');lastES.readyState=1;lastES.onopen?.();
  const t0=Date.now();emit('snapshot',{engineEpoch:'v68',serverTime:t0,eventSeq:100,stateRevision:100,balance:10000,history:[],stats:{rounds:0},session:null});await sleep(20);
  const liveAt=Date.now();statusSession={id:'r1',revision:1,updatedAt:liveAt,startedAt:liveAt,latestPriceAt:liveAt,state:'LIVE',bet:100,multiplier:1.52,peak:1.52,drawdownPct:0,feedFresh:true,canCashout:true,autoCashout:1.5,stopLoss:.75,token:{symbol:'T',name:'Token'}};
  emit('state',{engineEpoch:'v68',serverTime:liveAt,eventSeq:110,stateRevision:110,balance:9900,history:[],stats:{rounds:0},session:statusSession});await sleep(40);
  assert(get('multiplierNumber').textContent==='1.520','live multiplier did not render immediate 1.520x');
  assert(get('peakHud').textContent==='1.52×','live peak did not render');
  assert(get('thrustHud').textContent!=='0%','live thrust unexpectedly zero');

  // Rapid-tick test: authoritative numbers must update synchronously on every accepted SSE tick.
  let seq=111,rev=111,priceAt=liveAt;
  for(let i=1;i<=120;i++){
    priceAt+=4;
    const mm=1.52+i/10000;
    statusSession={...statusSession,revision:++rev,updatedAt:priceAt,latestPriceAt:priceAt,multiplier:mm,peak:mm};
    emit('tick',{engineEpoch:'v68',serverTime:priceAt,eventSeq:++seq,stateRevision:rev,balance:9900,session:statusSession});
    const expected=mm<2?mm.toFixed(3):mm.toFixed(2);
    assert(get('multiplierNumber').textContent===expected,`rapid tick HUD lagged at ${i}: ${get('multiplierNumber').textContent} != ${expected}`);
  }
  assert(get('paperValue').textContent.includes('153.20'),'rapid tick paper value did not update immediately');

  const doneAt=Date.now();statusBalance=10052;statusSession={...statusSession,revision:401,updatedAt:doneAt,multiplier:1.52,peak:1.532,completedAt:doneAt,state:'COMPLETE',payout:152,profit:52,reason:'AUTO_CASH_OUT',currentPrice:1,entryPrice:.5,priceUpdateCount:2,maxDrawdownPct:0,maxAdverseExcursionPct:0,timeToPeakMs:500};
  emit('state',{engineEpoch:'v68',serverTime:doneAt,eventSeq:400,stateRevision:400,balance:10000,history:[],stats:{rounds:1,wins:1,losses:0,netProfit:52,bestMultiplier:1.52},session:statusSession});
  await sleep(360);
  assert(get('balanceTop').textContent.includes('10,052'),'post-round summary did not refresh balance');

  get('playAgain').dispatch('click');await sleep(80);
  assert(get('multiplierNumber').textContent==='1.000','Play Again did not reset multiplier to 1.000x');
  assert(get('peakHud').textContent==='1.00×','Play Again did not reset peak to 1.00x');
  assert(get('drawdownHud').textContent==='0.0%','Play Again did not reset drawdown');
  assert(get('thrustHud').textContent==='0%','Play Again did not reset thrust to 0%');
  assert(get('stageLabel').textContent==='LAUNCHPAD','Play Again did not reset stage to Launchpad');
  assert(get('cashoutCapture').textContent==='—','idle cashout capture should not show stale 100%');

  // Recreate the exact screenshot failure: stale visual values, then start scanning.
  get('multiplierNumber').textContent='1.520';get('peakHud').textContent='1.52×';get('thrustHud').textContent='100%';get('stageLabel').textContent='ORBIT';
  get('startBtn').dispatch('click');await sleep(40);
  assert(startCalls>0,'search did not start');
  assert(get('multiplierNumber').textContent==='1.000','SCANNING retained previous multiplier');
  assert(get('peakHud').textContent==='1.00×','SCANNING retained previous peak');
  assert(get('thrustHud').textContent==='0%','SCANNING retained previous thrust');
  assert(get('stageLabel').textContent==='LAUNCHPAD','SCANNING retained previous stage');
  assert(get('paperValue').textContent.includes('100.00'),'SCANNING paper value did not return to stake');
  assert(get('profitValue').textContent.includes('0.00'),'SCANNING P&L did not return to zero');
  assert(get('autoDistance').textContent==='—'&&get('stopDistance').textContent==='—','SCANNING showed live trigger distances');
  console.log('V6.9 runtime smoke: PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
