import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const index=path.join(appDir,'index.html');
const modulePath=path.join(appDir,'src','candidate-visibility.mjs');

for(const p of [server,index]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-qualified-candidates-v8';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}
if(fs.existsSync(modulePath)&&!fs.existsSync(modulePath+'.before-qualified-candidates-v8')){
  fs.copyFileSync(modulePath,modulePath+'.before-qualified-candidates-v8');
}

fs.writeFileSync(modulePath,"const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);\n\nexport function classifyDecisionVisibility(decision={}){\n  const state=String(decision.state||'WAITING').trim().toUpperCase();\n  const closed=decision.terminal===true||String(decision.lifecycle||'').toLowerCase()==='closed'||terminalStates.has(state);\n\n  if(state==='BUY READY'&&!closed)return 'candidate';\n  if(state==='WAITING'&&!closed)return 'processing';\n  return 'filtered';\n}\n\nexport function candidateFeed(decisions=[],scope='candidates'){\n  const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];\n  const normalized=String(scope||'candidates').trim().toLowerCase();\n\n  if(normalized==='all'||normalized==='audit')return rows;\n  if(normalized==='processing')return rows.filter(x=>classifyDecisionVisibility(x)==='processing');\n  if(normalized==='filtered')return rows.filter(x=>classifyDecisionVisibility(x)==='filtered');\n\n  // Default public/user Candidates feed: only fully qualified BUY READY decisions.\n  return rows.filter(x=>classifyDecisionVisibility(x)==='candidate');\n}\n\nexport function candidateVisibilityCounts(decisions=[]){\n  const counts={candidates:0,processing:0,filtered:0,totalEvaluated:0};\n  for(const row of Array.isArray(decisions)?decisions:[]){\n    if(!row)continue;\n    counts.totalEvaluated++;\n    const kind=classifyDecisionVisibility(row);\n    if(kind==='candidate')counts.candidates++;\n    else if(kind==='processing')counts.processing++;\n    else counts.filtered++;\n  }\n  return counts;\n}\n",'utf8');
console.log('Changed:',modulePath);

// ── SERVER ──────────────────────────────────────────────────────────────────
let s=fs.readFileSync(server,'utf8');

if(!s.includes("from './src/candidate-visibility.mjs'")){
  const anchor="import {makeDiscoveryMetrics,makeDiscoveryQueue} from './src/discqueue.mjs';";
  if(!s.includes(anchor)){console.error('ABORT: server import anchor missing');process.exit(1)}
  s=s.replace(anchor,anchor+"\nimport {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';");
}

const decisionRoute=/ if\(url\.pathname==='\/api\/ai\/decisions'\)\{[^\n]*\}\n/;
const match=s.match(decisionRoute);
if(!match){
  console.error('ABORT: /api/ai/decisions route not found in expected single-line form.');
  process.exit(1);
}
const newDecisionRoute=` if(url.pathname==='/api/ai/decisions'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
  const _off=Math.max(0,Number(url.searchParams.get('offset')||0));
  const _scope=String(url.searchParams.get('scope')||'candidates').toLowerCase();
  if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT});
  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);
  return json(res,200,{
    decisions:_selected.slice(_off,_off+_lim).map(candidateView),
    total:_selected.length,
    limit:_lim,
    offset:_off,
    scope:_scope,
    counts:_counts
  });
}
`;
s=s.replace(decisionRoute,newDecisionRoute);

// Chart should never silently bind itself to a token that failed the user's gates.
const oldChart=" if(url.pathname==='/api/chart/config')return json(res,200,{chainId:'solana',tokenAddress:store.decisions(u.id)[0]?.mint||''});";
const newChart=" if(url.pathname==='/api/chart/config'){const qualified=candidateFeed(store.decisions(u.id),'candidates');return json(res,200,{chainId:'solana',tokenAddress:qualified[0]?.mint||''});}";
if(s.includes(oldChart))s=s.replace(oldChart,newChart);
else if(!s.includes("const qualified=candidateFeed(store.decisions(u.id),'candidates')")){
  console.error('ABORT: chart config anchor not found');
  process.exit(1);
}

fs.writeFileSync(server,s,'utf8');
console.log('Changed:',server);

// ── FRONTEND ────────────────────────────────────────────────────────────────
let h=fs.readFileSync(index,'utf8');

// Explicitly request the clean candidate feed. Server default is also candidates,
// but making the scope explicit prevents a future API-default change from leaking rejects.
h=h.replace(
  "fetch('/api/ai/decisions?limit=50'",
  "fetch('/api/ai/decisions?scope=candidates&limit=50'"
);

// Defense in depth: even if a malformed backend payload contains a rejected row,
// only BUY READY is allowed into Candidates.
const oldFilter=`   .filter(c=>{
    const stateName=String(c.state||'WAITING').toUpperCase();
    return c.terminal!==true&&c.lifecycle!=='closed'&&!terminalStates.has(stateName);
   })`;
const newFilter=`   .filter(c=>{
    const stateName=String(c.state||'WAITING').toUpperCase();
    return stateName==='BUY READY'&&c.terminal!==true&&c.lifecycle!=='closed'&&!terminalStates.has(stateName);
   })`;
if(h.includes(oldFilter))h=h.replace(oldFilter,newFilter);
else if(!h.includes("return stateName==='BUY READY'")){
  console.error('ABORT: frontend candidate filter anchor not found');
  process.exit(1);
}

// Make the empty-state copy explain the new behavior.
h=h.replaceAll(
  'No candidates yet. Waiting for the live discovery and decision feed.',
  'No qualified candidates yet. Tokens appear here only after they pass your Settings, AI thresholds and anti-rug confirmation.'
);
h=h.replace(
  'Candidates will appear after the backend, decision engine and Solana data stream are connected.',
  'Only fully qualified candidates appear here. Failed or incomplete tokens stay out of the candidate feed.'
);

// Add a compact explanatory note once, without changing the layout system.
if(!h.includes('id="qualifiedCandidatePolicyNote"')){
  const queueMarker='<div class="panel-body"><div class="queue" id="candidateQueue">';
  if(h.includes(queueMarker)){
    h=h.replace(queueMarker,
      '<div class="panel-body"><div id="qualifiedCandidatePolicyNote" style="font-size:9px;color:var(--muted);line-height:1.45;margin:0 0 9px">Qualified only · Tokens must pass server Settings, AI score/confidence and anti-rug confirmation before appearing here.</div><div class="queue" id="candidateQueue">');
  }
}

fs.writeFileSync(index,h,'utf8');
console.log('Changed:',index);

// Syntax checks.
for(const f of [modulePath,server]){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0){
    console.error('FAIL syntax:',f);
    console.error(r.stderr||r.stdout);
    process.exit(r.status||1);
  }
  console.log('PASS syntax:',path.relative(appDir,f));
}

console.log('');
console.log('INSTALLED MEMEFLOW QUALIFIED CANDIDATES V8');
console.log('Run self-test.mjs. Restart only after ALL V8 SELF-TESTS PASSED.');
