const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=process.argv[2]||process.cwd();

class Style{constructor(){this.map=new Map()}setProperty(k,v){this.map.set(k,String(v))}getPropertyValue(k){return this.map.get(k)||''}}
class ClassList{add(){}remove(){}toggle(){return false}contains(){return false}}
const ctx={setTransform(){},clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},scale(){},globalAlpha:1,fillStyle:''};
class El{
  constructor(id=''){this.id=id;this.style=new Style();this.dataset={};this.attrs={};this.classList=new ClassList();this.hidden=false;this.disabled=false;this.inert=false;this.value=id==='betInput'?'100':id==='autoCashout'?'1.5':id==='stopLoss'?'0.75':'';this.textContent='';this.innerHTML='';this.listeners={};}
  addEventListener(type,fn,opts){(this.listeners[type]??=[]).push({fn,opts})}removeEventListener(){}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}focus(){}animate(){return{cancel(){}}}
  dispatch(type,event={}){for(const x of this.listeners[type]||[])x.fn({...event,target:this,currentTarget:this})}
  querySelector(sel){if(sel==='b')return get(this.id+'__b');return new El()}querySelectorAll(){return[]}getBoundingClientRect(){return{width:800,height:600}}getContext(){return ctx}
  get offsetWidth(){return 100}
}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
const docListeners={};
global.document={hidden:false,title:'',querySelector(sel){return sel.startsWith('#')?get(sel.slice(1)):new El()},querySelectorAll(){return[]},addEventListener(type,fn){(docListeners[type]??=[]).push(fn)}};
global.window=global;global.innerWidth=1200;global.innerHeight=800;global.devicePixelRatio=1;
global.performance={now:()=>Date.now()};

let wakeRequests=0,lastWakeLock=null;
function makeWakeLock(){
  const listeners={};
  return {
    released:false,
    addEventListener(type,fn){listeners[type]=fn},
    async release(){if(this.released)return;this.released=true;listeners.release?.()},
    forceRelease(){if(this.released)return;this.released=true;listeners.release?.()}
  };
}
Object.defineProperty(global,'navigator',{value:{onLine:true,vibrate(){},connection:{saveData:false},wakeLock:{async request(){wakeRequests++;lastWakeLock=makeWakeLock();return lastWakeLock;}}},configurable:true});
global.localStorage={getItem(){return null},setItem(){}};
global.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
global.ResizeObserver=class{observe(){}disconnect(){}};

let rafSeq=0;const rafTimers=new Map();
global.requestAnimationFrame=cb=>{const id=++rafSeq;const t=setTimeout(()=>{rafTimers.delete(id);cb(Date.now())},2);rafTimers.set(id,t);return id};
global.cancelAnimationFrame=id=>{const t=rafTimers.get(id);if(t)clearTimeout(t);rafTimers.delete(id)};

const winListeners={};global.addEventListener=(t,fn)=>{(winListeners[t]??=[]).push(fn)};global.removeEventListener=()=>{};
let lastES=null, esCount=0;
global.EventSource=class{
  static CLOSED=2;
  constructor(){this.readyState=0;this.listeners={};lastES=this;esCount++;}
  addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}
  emit(t,data){for(const fn of this.listeners[t]||[])fn({data:JSON.stringify(data)})}
  close(){this.readyState=2;}
};

let statusCalls=0, resetMode='ok', statusSession=null;
function response(data,ok=true,status=200){return {ok,status,json:async()=>data}}
global.fetch=async(url,opts={})=>{
  if(url==='/api/game/status'){
    statusCalls++;
    const n=100+statusCalls;
    return response({version:'5.7.1',engineEpoch:'smoke',serverTime:Date.now(),eventSeq:n,stateRevision:n,balance:10000,history:[],stats:{rounds:0},session:statusSession});
  }
  if(url==='/api/game/reset'){
    if(resetMode==='timeout'){const e=new Error('timeout');e.name='AbortError';throw e;}
    return response({engineEpoch:'smoke',serverTime:Date.now(),eventSeq:5000,stateRevision:5000,balance:10000,history:[],stats:{rounds:0},session:null});
  }
  if(url==='/api/game/start')return response({code:'NO_CANDIDATE',message:'none',selector:{buyReady:0,eligible:0}},false,409);
  return response({});
};
global.crypto={randomUUID:()=> '00000000-0000-4000-8000-000000000001'};

const js=fs.readFileSync(path.join(app,'game.js'),'utf8');
vm.runInThisContext(js,{filename:'game.js'});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const emit=(type,data)=>lastES.emit(type,data);

(async()=>{
  await sleep(70);
  if(!lastES)throw new Error('EventSource not created');
  lastES.readyState=1;lastES.onopen?.();

  // Establish one accepted stream snapshot.
  const t0=Date.now();
  emit('snapshot',{engineEpoch:'smoke',serverTime:t0,eventSeq:1000,stateRevision:1000,balance:10000,history:[],stats:{rounds:0},session:null});
  await sleep(15);
  if(!/stream live/i.test(get('streamState').textContent))throw new Error('valid SSE did not become healthy');

  // BUG REGRESSION: stale packet after a healthy stream must not demote the stream.
  emit('tick',{engineEpoch:'smoke',serverTime:t0-5000,eventSeq:2000,stateRevision:900,balance:1,session:null});
  await sleep(10);
  if(!/stream live/i.test(get('streamState').textContent))throw new Error('ignored stale SSE demoted a healthy stream');

  // BUG REGRESSION: rejected packet must not poison eventSeq/state ordering.
  emit('state',{engineEpoch:'smoke',serverTime:t0+100,eventSeq:1500,stateRevision:1100,balance:9900,history:[],stats:{rounds:0},session:null});
  await sleep(10);
  if(!/9,900/.test(get('balanceTop').textContent))throw new Error('rejected packet poisoned ordering counters');

  // Restored LIVE session must display server-locked flight-plan values, not local dropdown defaults.
  const liveAt=Date.now();
  const live={id:'live-v64',revision:1,updatedAt:liveAt,startedAt:liveAt,latestPriceAt:liveAt,priceAgeMs:0,state:'LIVE',bet:100,multiplier:1.1,peak:1.12,feedFresh:true,canCashout:true,autoCashout:2,stopLoss:.9,token:{symbol:'T',name:'Token'}};
  emit('state',{engineEpoch:'smoke',serverTime:liveAt,eventSeq:1600,stateRevision:1200,balance:9900,history:[],stats:{rounds:0},session:live});
  await sleep(80);
  if(!/200/.test(get('projectedPayout').textContent))throw new Error('restored LIVE flight plan used local auto-cashout instead of locked session value');
  if(!/10/.test(get('projectedLoss').textContent))throw new Error('restored LIVE flight plan used local stop instead of locked session value');

  // Flight Director should track display state without runtime errors.
  if(!get('flightDirectorState').textContent)throw new Error('flight director state missing');

  // Wake lock should be reacquired after an external/system release while LIVE.
  await sleep(30);
  if(wakeRequests<1||!lastWakeLock)throw new Error('wake lock was not requested in LIVE');
  lastWakeLock.forceRelease();
  await sleep(780);
  if(wakeRequests<2)throw new Error('wake lock was not reacquired after system release');

  // Offline should close the EventSource instead of leaving a reconnect loop running.
  navigator.onLine=false;
  for(const fn of winListeners.offline||[])fn();
  if(lastES.readyState!==EventSource.CLOSED)throw new Error('offline did not close EventSource');
  navigator.onLine=true;
  for(const fn of winListeners.online||[])fn();
  await sleep(40);
  if(esCount<2)throw new Error('online resync did not recreate EventSource');
  lastES.readyState=1;lastES.onopen?.();

  // Complete the same round and verify observed result area/entry line render.
  const done=Date.now();
  statusSession={...live,state:'COMPLETE',revision:2,updatedAt:done,completedAt:done,latestPriceAt:done,multiplier:1.2,peak:1.25,payout:120,profit:20,canCashout:false,reason:'MANUAL_CASHOUT',priceUpdateCount:3,entryPrice:.001,currentPrice:.0012};
  emit('state',{engineEpoch:'smoke',serverTime:done,eventSeq:1700,stateRevision:1300,balance:10020,history:[],stats:{rounds:1,wins:1,losses:0},session:statusSession});
  await sleep(520);
  if(get('result').hidden)throw new Error('complete round did not render result');
  if(!get('resultTraceArea').getAttribute('d'))throw new Error('result trace area missing');
  if(get('resultTraceEntry').getAttribute('y1')===null)throw new Error('result entry reference missing');

  // Lost reset response: status reconciliation says session is gone, so old result must disappear.
  resetMode='timeout';statusSession=null;
  get('playAgain').dispatch('click');
  await sleep(80);
  if(!get('result').hidden)throw new Error('lost PLAY AGAIN response left stale result after server reset reconciliation');

  console.log('V6.4 runtime smoke: PASS');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
