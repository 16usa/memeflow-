const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=process.argv[2]||process.cwd();
class Style{setProperty(){}}
class ClassList{add(){}remove(){}toggle(){return false}contains(){return false}}
const ctx={setTransform(){},clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},scale(){},globalAlpha:1,fillStyle:''};
class El{
  constructor(id=''){this.id=id;this.style=new Style();this.dataset={};this.classList=new ClassList();this.hidden=false;this.disabled=false;this.inert=false;this.value=id==='betInput'?'100':id==='autoCashout'?'1.5':id==='stopLoss'?'0.75':'';this.textContent='';this.innerHTML='';}
  addEventListener(){}removeEventListener(){}setAttribute(){}getAttribute(){return null}focus(){}animate(){return{cancel(){}}}
  querySelector(){return new El()}querySelectorAll(){return[]}getBoundingClientRect(){return{width:800,height:600}}getContext(){return ctx}
  get offsetWidth(){return 100}
}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
global.document={hidden:false,title:'',querySelector(sel){return sel.startsWith('#')?get(sel.slice(1)):new El()},querySelectorAll(){return[]},addEventListener(){}};
global.window=global;global.innerWidth=1200;global.innerHeight=800;global.devicePixelRatio=1;
global.performance={now:()=>Date.now()};
global.navigator={onLine:true,vibrate(){},connection:{saveData:false},wakeLock:null};
global.localStorage={getItem(){return null},setItem(){}};
global.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
global.ResizeObserver=class{observe(){}disconnect(){}};
let rafSeq=0;const timers=new Map();
global.requestAnimationFrame=cb=>{const id=++rafSeq;const t=setTimeout(()=>{timers.delete(id);cb(Date.now())},1);timers.set(id,t);return id};
global.cancelAnimationFrame=id=>{const t=timers.get(id);if(t)clearTimeout(t);timers.delete(id)};
global.addEventListener=()=>{};global.removeEventListener=()=>{};
global.EventSource=class{static CLOSED=2;constructor(){this.readyState=1;}addEventListener(){}close(){this.readyState=2;}};
global.fetch=async()=>({ok:true,status:200,json:async()=>({version:'5.7.1',engineEpoch:'smoke',serverTime:Date.now(),eventSeq:1,stateRevision:1,balance:10000,history:[],stats:{rounds:0},session:null})});
global.crypto={randomUUID:()=> '00000000-0000-4000-8000-000000000001'};
const code=fs.readFileSync(path.join(app,'game.js'),'utf8');
try{vm.runInThisContext(code,{filename:'game.js'});}catch(error){console.error(error);process.exit(1);}
setTimeout(()=>{console.log('V6.1 runtime smoke: PASS');process.exit(0)},90);
