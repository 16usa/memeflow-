const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=process.argv[2]||process.cwd();
class Style{constructor(){this.map=new Map()}setProperty(k,v){this.map.set(k,String(v))}getPropertyValue(k){return this.map.get(k)||''}}
class ClassList{add(){}remove(){}toggle(){return false}contains(){return false}}
const ctx={setTransform(){},clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},scale(){},globalAlpha:1,fillStyle:''};
class El{constructor(id=''){this.id=id;this.style=new Style();this.dataset={};this.attrs={};this.classList=new ClassList();this.hidden=false;this.disabled=false;this.inert=false;this.value=id==='betInput'?'100':id==='autoCashout'?'1.5':id==='stopLoss'?'0.75':'';this.textContent='';this.innerHTML='';this.listeners={};}addEventListener(t,fn,o){(this.listeners[t]??=[]).push({fn,o})}removeEventListener(){}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}focus(){}animate(){return{cancel(){}}}dispatch(t,e={}){for(const x of this.listeners[t]||[])x.fn({...e,target:this,currentTarget:this})}querySelector(sel){if(sel==='b')return get(this.id+'__b');return new El()}querySelectorAll(){return[]}getBoundingClientRect(){return{width:800,height:600}}getContext(){return ctx}get offsetWidth(){return 100}}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
const docListeners={};const docEl=new El('html');
global.document={hidden:false,title:'',documentElement:docEl,querySelector(sel){return sel.startsWith('#')?get(sel.slice(1)):new El()},querySelectorAll(){return[]},addEventListener(t,fn){(docListeners[t]??=[]).push(fn)},removeEventListener(){}};
global.window=global;global.innerWidth=1200;global.innerHeight=800;global.devicePixelRatio=1;global.performance={now:()=>Date.now()};
const vvListeners={};global.visualViewport={height:760,addEventListener(t,fn){(vvListeners[t]??=[]).push(fn)},removeEventListener(){}};
let vibrates=0,wakeRequests=0,lastWakeLock=null;function makeWake(){const l={released:false,listeners:{},addEventListener(t,fn){this.listeners[t]=fn},async release(){if(this.released)return;this.released=true;this.listeners.release?.()}};return l}
Object.defineProperty(global,'navigator',{value:{onLine:true,vibrate(){vibrates++},connection:{saveData:false},wakeLock:{async request(){wakeRequests++;lastWakeLock=makeWake();return lastWakeLock;}}},configurable:true});
global.localStorage={getItem(){return null},setItem(){}};global.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});global.ResizeObserver=class{observe(){}disconnect(){}};
let rafSeq=0;const rafTimers=new Map();global.requestAnimationFrame=cb=>{const id=++rafSeq;const t=setTimeout(()=>{rafTimers.delete(id);cb(Date.now())},2);rafTimers.set(id,t);return id};global.cancelAnimationFrame=id=>{const t=rafTimers.get(id);if(t)clearTimeout(t);rafTimers.delete(id)};
const winListeners={};global.addEventListener=(t,fn)=>{(winListeners[t]??=[]).push(fn)};global.removeEventListener=()=>{};
let lastES=null,esCount=0;global.EventSource=class{static CLOSED=2;constructor(){this.readyState=0;this.listeners={};lastES=this;esCount++;}addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}emit(t,data){for(const fn of this.listeners[t]||[])fn({data:JSON.stringify(data)})}close(){this.readyState=2;}};
let statusCalls=0,statusSession=null;function response(data,ok=true,status=200){return{ok,status,json:async()=>data}}
global.fetch=async(url)=>{if(url==='/api/game/status'){statusCalls++;const n=100+statusCalls;return response({version:'5.7.1',engineEpoch:'v67',serverTime:Date.now(),eventSeq:n,stateRevision:n,balance:10000,history:[],stats:{rounds:0},session:statusSession});}return response({});};
global.crypto={randomUUID:()=> '00000000-0000-4000-8000-000000000001'};
const js=fs.readFileSync(path.join(app,'game.js'),'utf8');vm.runInThisContext(js,{filename:'game.js'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const emit=(t,d)=>lastES.emit(t,d);
(async()=>{
  await sleep(60);if(!lastES)throw new Error('EventSource not created');if(Object.values(vvListeners).flat().length!==0)throw new Error('visualViewport listeners reintroduced; may cause iOS scroll jitter');if(docEl.style.getPropertyValue('--vvh'))throw new Error('dynamic --vvh layout mutation reintroduced');lastES.readyState=1;lastES.onopen?.();
  const t0=Date.now();emit('snapshot',{engineEpoch:'v67',serverTime:t0,eventSeq:1000,stateRevision:1000,balance:10000,history:[],stats:{rounds:0},session:null});await sleep(20);
  if(!/stream live/i.test(get('streamState').textContent))throw new Error('valid SSE did not become healthy');

  const liveAt=Date.now();statusSession={id:'live-v67',revision:1,updatedAt:liveAt,startedAt:liveAt,latestPriceAt:liveAt,priceAgeMs:0,state:'LIVE',bet:100,multiplier:1.01,peak:1.01,feedFresh:true,canCashout:true,autoCashout:8,stopLoss:.7,token:{symbol:'T',name:'Token'}};
  emit('state',{engineEpoch:'v67',serverTime:liveAt,eventSeq:1100,stateRevision:1100,balance:9900,history:[],stats:{rounds:0},session:statusSession});
  await sleep(430);vibrates=0;

  const jumpAt=Date.now();statusSession={...statusSession,revision:2,updatedAt:jumpAt,latestPriceAt:jumpAt,multiplier:5.2,peak:5.2};
  emit('state',{engineEpoch:'v67',serverTime:jumpAt,eventSeq:1200,stateRevision:1200,balance:9900,history:[],stats:{rounds:0},session:statusSession});
  await sleep(35);
  if(vibrates!==1)throw new Error('large multiplier jump emitted more than one milestone haptic: '+vibrates);
  if(get('milestoneValue').textContent!=='5.00×')throw new Error('highest crossed milestone was not shown');

  const oldES=lastES;document.hidden=true;for(const fn of docListeners.visibilitychange||[])fn();await sleep(10);
  if(oldES.readyState!==2)throw new Error('visibility hidden did not close EventSource');
  if(!/paused in background/i.test(get('streamState').textContent))throw new Error('background stream state not shown');

  const before=esCount;document.hidden=false;for(const fn of docListeners.visibilitychange||[])fn();await sleep(40);
  if(esCount<=before)throw new Error('visible resync did not reopen EventSource');

  if(get('flightPositionCurrent').textContent!=='5.20×')throw new Error('flight position current HUD not updated');
  if(get('flightPositionPeak').textContent!=='5.20×')throw new Error('flight position peak HUD not updated');
  console.log('V6.7 runtime smoke: PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
