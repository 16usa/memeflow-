const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=process.argv[2]||process.cwd();
class Style{constructor(){this.map=new Map()}setProperty(k,v){this.map.set(k,String(v))}getPropertyValue(k){return this.map.get(k)||''}}
class ClassList{add(){}remove(){}toggle(){return false}contains(){return false}}
const ctx={setTransform(){},clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},scale(){},globalAlpha:1,fillStyle:''};
class El{
  constructor(id=''){this.id=id;this.style=new Style();this.dataset={};this.attrs={};this.classList=new ClassList();this.hidden=false;this.disabled=false;this.inert=false;this.value=id==='betInput'?'100':id==='autoCashout'?'1.5':id==='stopLoss'?'0.75':'';this.textContent='';this.innerHTML='';this.listeners={};}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}removeEventListener(){}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}focus(){}animate(){return{cancel(){}}}
  dispatch(type,event={}){for(const fn of this.listeners[type]||[])fn({...event,target:this,currentTarget:this})}
  querySelector(sel){if(sel==='b')return get(this.id+'__b');return new El()}querySelectorAll(){return[]}getBoundingClientRect(){return{width:800,height:600}}getContext(){return ctx}
  get offsetWidth(){return 100}
  setAttributeNode(){}
}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
const docListeners={};
global.document={hidden:false,title:'',querySelector(sel){return sel.startsWith('#')?get(sel.slice(1)):new El()},querySelectorAll(){return[]},addEventListener(type,fn){(docListeners[type]??=[]).push(fn)}};
global.window=global;global.innerWidth=1200;global.innerHeight=800;global.devicePixelRatio=1;
global.performance={now:()=>Date.now()};
global.navigator={onLine:true,vibrate(){},connection:{saveData:false},wakeLock:null};
global.localStorage={getItem(){return null},setItem(){}};
global.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
global.ResizeObserver=class{observe(){}disconnect(){}};
let rafSeq=0;const timers=new Map();
global.requestAnimationFrame=cb=>{const id=++rafSeq;const t=setTimeout(()=>{timers.delete(id);cb(Date.now())},2);timers.set(id,t);return id};
global.cancelAnimationFrame=id=>{const t=timers.get(id);if(t)clearTimeout(t);timers.delete(id)};
const winListeners={};global.addEventListener=(t,fn)=>{(winListeners[t]??=[]).push(fn)};global.removeEventListener=()=>{};
let lastES=null;
global.EventSource=class{static CLOSED=2;constructor(){this.readyState=0;this.listeners={};lastES=this;}addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}emit(t,data){for(const fn of this.listeners[t]||[])fn({data:JSON.stringify(data)})}close(){this.readyState=2;}};
let startCalls=0,statusCalls=0;
function response(data,ok=true,status=200){return {ok,status,json:async()=>data}}
global.fetch=async(url,opts={})=>{
  if(url==='/api/game/status'){statusCalls++;return response({version:'5.7.1',engineEpoch:'smoke',serverTime:Date.now(),eventSeq:statusCalls,stateRevision:statusCalls,balance:10000,history:[],stats:{rounds:0},session:null});}
  if(url==='/api/game/start'){
    startCalls++;
    await new Promise(r=>setTimeout(r,250));
    return response({code:'NO_CANDIDATE',message:'none',selector:{buyReady:0,eligible:0}},false,409);
  }
  if(url==='/api/game/reset')return response({engineEpoch:'smoke',serverTime:Date.now(),eventSeq:20,stateRevision:20,balance:10000,history:[],stats:{rounds:0},session:null});
  return response({});
};
global.crypto={randomUUID:()=> '00000000-0000-4000-8000-000000000001'};
const code=fs.readFileSync(path.join(app,'game.js'),'utf8');
try{vm.runInThisContext(code,{filename:'game.js'});}catch(error){console.error(error);process.exit(1);}
(async()=>{
  await new Promise(r=>setTimeout(r,55));
  if(!lastES)throw new Error('EventSource not created');
  if(statusCalls<2)throw new Error('fallback did not start while EventSource was CONNECTING');

  lastES.readyState=1;lastES.onopen?.();
  if(!/awaiting server snapshot/i.test(get('streamState').textContent))throw new Error('SSE onopen incorrectly marked healthy');

  // A stale stream packet must not be able to mark the stream healthy and disable fallback.
  lastES.emit('tick',{engineEpoch:'smoke',serverTime:1,eventSeq:1,stateRevision:1,balance:10000,session:null});
  await new Promise(r=>setTimeout(r,10));
  if(!/ignored|fallback/i.test(get('streamState').textContent))throw new Error('stale SSE packet incorrectly marked healthy');

  // A current packet should promote the stream to healthy.
  const seq=1000+statusCalls, now=Date.now();
  lastES.emit('snapshot',{engineEpoch:'smoke',serverTime:now,eventSeq:seq,stateRevision:seq,balance:10000,history:[],stats:{rounds:0},session:null});
  await new Promise(r=>setTimeout(r,10));
  if(!/stream live/i.test(get('streamState').textContent))throw new Error('valid SSE snapshot did not mark stream healthy');

  // Rapid second START is ignored during the short anti-double-tap guard.
  const start=get('startBtn');start.dispatch('click');await new Promise(r=>setTimeout(r,40));start.dispatch('click');
  if(get('stateLabel').textContent!=='SCANNING')throw new Error('rapid second START cancelled search');
  if(startCalls!==1)throw new Error('unexpected duplicate start request');

  // Cancel search after guard, then simulate a live server session and countdown.
  await new Promise(r=>setTimeout(r,720));start.dispatch('click');
  const liveNow=Date.now();
  lastES.emit('state',{engineEpoch:'smoke',serverTime:liveNow,eventSeq:seq+10,stateRevision:seq+10,balance:9900,history:[],stats:{rounds:0},session:{id:'r-live',revision:1,updatedAt:liveNow,startedAt:liveNow,latestPriceAt:liveNow,priceAgeMs:0,state:'LIVE',bet:100,multiplier:1,peak:1,feedFresh:true,canCashout:true,autoCashout:1.5,stopLoss:.75,token:{symbol:'T',name:'Token'}}});
  await new Promise(r=>setTimeout(r,55));
  document.hidden=true;for(const fn of docListeners.visibilitychange||[])fn();
  await new Promise(r=>setTimeout(r,420));
  if(!get('centerState').hidden)throw new Error('countdown continued while page hidden');

  // Bring the page back and send a complete state; result trace should be callable without runtime errors.
  document.hidden=false;for(const fn of docListeners.visibilitychange||[])fn();
  const done=Date.now();
  lastES.emit('state',{engineEpoch:'smoke',serverTime:done,eventSeq:seq+20,stateRevision:seq+20,balance:10020,history:[],stats:{rounds:1,wins:1,losses:0},session:{id:'r-live',revision:2,updatedAt:done,startedAt:liveNow,completedAt:done,latestPriceAt:done,state:'COMPLETE',bet:100,payout:120,profit:20,multiplier:1.2,peak:1.25,feedFresh:true,canCashout:false,autoCashout:1.5,stopLoss:.75,reason:'MANUAL_CASHOUT',priceUpdateCount:2,entryPrice:.001,currentPrice:.0012,token:{symbol:'T',name:'Token'}}});
  await new Promise(r=>setTimeout(r,500));
  if(get('result').hidden)throw new Error('complete round did not render result');
  if(!get('resultTracePath').getAttribute('d'))throw new Error('result flight trace was not rendered');

  console.log('V6.3 runtime smoke: PASS');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
