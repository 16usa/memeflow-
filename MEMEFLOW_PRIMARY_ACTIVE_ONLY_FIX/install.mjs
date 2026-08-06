import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'index.html');

if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} not found.`);
  process.exit(1);
}

const backup = `${target}.before-primary-active-only-fix`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

const oldRefresh = `async function refresh(){state.loading=true;try{const _dac=new AbortController();setTimeout(()=>_dac.abort(),8000);const r=await fetch('/api/ai/decisions?limit=50',{credentials:'include',headers:{accept:'application/json'},signal:_dac.signal});if(!r.ok)throw new Error(\`Decision feed \${r.status}\`);const d=await r.json();const rows=Array.isArray(d)?d:Array.isArray(d.decisions)?d.decisions:[];state.candidates=rows.filter(Boolean).map((row,i)=>{const mint=row.mint||row.tokenMint||row.tokenAddress||row.address||'';return {...row,mint,id:row.id||mint||\`decision-\${i}\`};});if(!state.candidates.some(c=>c.id===state.selected))state.selected=state.candidates[0]?.id||null;}catch(error){state.candidates=[];state.selected=null;console.info('Decision feed unavailable:',error.message)}finally{state.loading=false;render()}}`;

const newRefresh = `async function refresh(){
 state.loading=true;
 const previousSelected=state.selected;
 try{
  const _dac=new AbortController();setTimeout(()=>_dac.abort(),8000);
  const r=await fetch('/api/ai/decisions?limit=50',{credentials:'include',headers:{accept:'application/json'},signal:_dac.signal});
  if(!r.ok)throw new Error(\`Decision feed \${r.status}\`);
  const d=await r.json();
  const rows=Array.isArray(d)?d:Array.isArray(d.decisions)?d.decisions:[];
  const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);
  const rank={'BUY READY':4,'WATCH':3,'WAITING':2};
  state.candidates=rows
   .filter(Boolean)
   .map((row,i)=>{
    const mint=row.mint||row.tokenMint||row.tokenAddress||row.address||'';
    return {...row,mint,id:row.id||mint||\`decision-\${i}\`};
   })
   .filter(c=>{
    const stateName=String(c.state||'WAITING').toUpperCase();
    return c.terminal!==true&&c.lifecycle!=='closed'&&!terminalStates.has(stateName);
   })
   .sort((a,b)=>{
    const stateDiff=(rank[String(b.state||'WAITING').toUpperCase()]||0)-(rank[String(a.state||'WAITING').toUpperCase()]||0);
    if(stateDiff)return stateDiff;
    const priorityDiff=Number(b.priority||0)-Number(a.priority||0);
    if(priorityDiff)return priorityDiff;
    return Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0);
   });
  if(!state.candidates.some(c=>c.id===state.selected)){
   state.selected=state.candidates[0]?.id||null;
  }
 }catch(error){
  state.candidates=[];state.selected=null;
  console.info('Decision feed unavailable:',error.message);
 }finally{
  state.loading=false;
  render();
  if(previousSelected!==state.selected){
   const c=selected();
   window.dispatchEvent(new CustomEvent('memeflow:candidatechange',{detail:c.id?{
    name:c.name,
    symbol:c.symbol||c.name,
    tokenAddress:c.mint||c.tokenAddress||'',
    mint:c.mint||c.tokenAddress||''
   }:{
    name:'',
    symbol:'',
    tokenAddress:'',
    mint:''
   }}));
  }
 }
}`;

if (!html.includes(oldRefresh)) {
  console.error('INSTALL ABORTED: exact refresh() implementation was not found.');
  console.error('No files were changed.');
  process.exit(1);
}

html = html.replace(oldRefresh, newRefresh);

const oldChartSync = ` if(mint&&mint!==lastMint){
   lastMint=mint;
   window.dispatchEvent(new CustomEvent('memeflow:candidatechange',{detail:{
     name:c.name,symbol:c.symbol||c.name,tokenAddress:mint,mint
   }}));
 }`;

const newChartSync = ` if(mint!==lastMint){
   lastMint=mint;
   window.dispatchEvent(new CustomEvent('memeflow:candidatechange',{detail:mint?{
     name:c.name,symbol:c.symbol||c.name,tokenAddress:mint,mint
   }:{
     name:'',symbol:'',tokenAddress:'',mint:''
   }}));
 }`;

if (!html.includes(oldChartSync)) {
  console.error('INSTALL ABORTED: chart candidate synchronization block was not found.');
  console.error('No files were changed.');
  process.exit(1);
}

html = html.replace(oldChartSync, newChartSync);

fs.writeFileSync(target, html, 'utf8');

console.log('Installed MEMEFLOW Primary Active-Only fix.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);
console.log('EXPIRED/BLOCKED/terminal decisions can no longer become Primary Candidate.');
console.log('Market Chart now clears or switches when the active candidate changes.');