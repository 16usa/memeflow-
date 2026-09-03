#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"; APP="$ROOT/memeflow-app"
[ -f "$APP/app-server.mjs" ] || { echo "ERROR: run from repository root"; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.mf-backups/public-agent-v2-$STAMP"
mkdir -p "$BACKUP"
for f in app-server.mjs settings-page.js settings.html; do cp "$APP/$f" "$BACKUP/$f"; done
echo "Backup: $BACKUP"

python3 - "$APP" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1])
f=app/"app-server.mjs"; s=f.read_text()
start=s.find("/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1")
end=s.find("const liveEvalMetrics=makeLiveEvalMetrics();",start)
if start<0 or end<0: raise SystemExit("PATCH ABORTED: Public Agent V1 block not found")
v2=r"""
/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2 */
const __mfPublicAgentRuntimeByOwner=new Map();
function __mfPublicAgentRuntime(uid){let x=__mfPublicAgentRuntimeByOwner.get(uid);if(!x){x={lastDecision:new Map(),recent:new Map()};__mfPublicAgentRuntimeByOwner.set(uid,x)}return x}
function __mfPublicAgentState(uid){store.state.publicAgent||={};let x=store.state.publicAgent[uid];if(!x||typeof x!=='object'){x={config:{enabled:false,mode:'approval',displayName:'',voice:'terminal',xConnected:false,events:{watch:true,buyReady:true,positions:true,risk:true}},queue:[],audit:[]};store.state.publicAgent[uid]=x}x.config||={};x.config.events||={};x.config={enabled:x.config.enabled===true,mode:['off','approval','autonomous'].includes(String(x.config.mode))?String(x.config.mode):'approval',displayName:String(x.config.displayName||'').slice(0,40),voice:['terminal','minimal'].includes(String(x.config.voice))?String(x.config.voice):'terminal',xConnected:false,events:{watch:x.config.events.watch!==false,buyReady:x.config.events.buyReady!==false,positions:x.config.events.positions!==false,risk:x.config.events.risk!==false}};if(!Array.isArray(x.queue))x.queue=[];if(!Array.isArray(x.audit))x.audit=[];return x}
function __mfPublicAgentSafe(v,n=80){return String(v??'').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}
function __mfPublicAgentRiskClass(reason){const x=String(reason||'').toUpperCase();if(/WALLET|RISK|INSIDER|MAYHEM/.test(x))return'RISK';if(/KILL|LOSS|SAFETY/.test(x))return'SAFETY';if(/STALE|EXPIRED/.test(x))return'STALE';if(/MAX_|LIMIT|CAPITAL|SPEND|POSITION_SIZE/.test(x))return'LIMIT';return'REJECT'}
function __mfPublicAgentPublicReason(reason){switch(__mfPublicAgentRiskClass(reason)){case'RISK':return'Risk verification rejected the entry.';case'SAFETY':return'A safety control blocked execution.';case'STALE':return'The signal expired before execution.';case'LIMIT':return'Execution constraints rejected the entry.';default:return'Entry conditions changed before execution.'}}
function __mfPublicAgentAllowed(st,type){const e=st?.config?.events||{};if(type==='WATCH')return e.watch!==false;if(type==='BUY READY')return e.buyReady!==false;if(type==='OPEN POSITION'||type==='EXIT')return e.positions!==false;if(type==='RISK'||type==='REJECT')return e.risk!==false;return false}
function __mfPublicAgentDraft(type,t,meta={}){const sym=__mfPublicAgentSafe(t?.symbol||t?.name||meta?.symbol||'UNKNOWN',24).toUpperCase(),d=meta?.decision||{},p=meta?.position||{};const sc=Number.isFinite(Number(d?.score??meta?.score))?Math.round(Number(d?.score??meta?.score)):null,cf=Number.isFinite(Number(d?.confidence??meta?.confidence))?Math.round(Number(d?.confidence??meta?.confidence)):null,pnl=Number.isFinite(Number(p?.realizedPnlPct))?Number(p.realizedPnlPct):null;const out=[];if(type==='WATCH'){out.push('SIGNAL DETECTED.',`$${sym}`);if(sc!==null)out.push(`Score: ${sc}`);if(cf!==null)out.push(`Confidence: ${cf}%`);out.push('I am watching.')}else if(type==='BUY READY'){out.push('ENTRY CONDITIONS DETECTED.',`$${sym}`);if(sc!==null)out.push(`Score: ${sc}`);if(cf!==null)out.push(`Confidence: ${cf}%`);out.push('The market is becoming interesting.')}else if(type==='OPEN POSITION'){out.push('POSITION OPEN.',`$${sym}`);if(sc!==null)out.push(`Signal: ${sc}`);out.push('Execution confirmed.')}else if(type==='EXIT'){out.push('POSITION CLOSED.',`$${sym}`);if(pnl!==null)out.push(`Realized: ${pnl>=0?'+':''}${pnl.toFixed(2)}%`);out.push('The position is no longer active.')}else if(type==='RISK'){out.push('RISK DETECTED.',`$${sym}`,__mfPublicAgentPublicReason(meta?.reason))}else{out.push('ENTRY REJECTED.',`$${sym}`,__mfPublicAgentPublicReason(meta?.reason))}return out.join('\n').slice(0,270)}
function __mfPublicAgentQueue(uid,type,t,meta={}){if(!uid||store.user(uid)?.isOwner!==true)return null;const st=__mfPublicAgentState(uid);if(!st.config.enabled||st.config.mode==='off'||!__mfPublicAgentAllowed(st,type))return null;const mint=String(t?.mint||meta?.position?.mint||'').trim();if(!mint)return null;const rt=__mfPublicAgentRuntime(uid),fp=[type,mint,meta?.position?.id||'',__mfPublicAgentRiskClass(meta?.reason||''),Math.round(Number(meta?.decision?.score??meta?.score??0))].join(':'),now=Date.now(),last=Number(rt.recent.get(fp)||0);if(last&&now-last<60000)return null;rt.recent.set(fp,now);const item={id:crypto.randomUUID(),createdAt:new Date(now).toISOString(),status:st.config.mode==='autonomous'?'READY':'PENDING',eventType:type,mint,symbol:__mfPublicAgentSafe(t?.symbol||t?.name||meta?.position?.symbol||'',24),score:Number.isFinite(Number(meta?.decision?.score??meta?.score))?Number(meta?.decision?.score??meta?.score):null,confidence:Number.isFinite(Number(meta?.decision?.confidence??meta?.confidence))?Number(meta?.decision?.confidence??meta?.confidence):null,reasonClass:(type==='RISK'||type==='REJECT')?__mfPublicAgentRiskClass(meta?.reason):null,text:__mfPublicAgentDraft(type,t,meta)};st.queue.unshift(item);st.queue=st.queue.slice(0,100);st.audit.unshift({at:item.createdAt,type:'DRAFT_CREATED',id:item.id,eventType:type,status:item.status});st.audit=st.audit.slice(0,200);store.save();return item}
function __mfPublicAgentDecision(uid,t,d){if(!uid||store.user(uid)?.isOwner!==true||!t?.mint||!d)return;const rt=__mfPublicAgentRuntime(uid),mint=String(t.mint),next=String(d.state||'').toUpperCase(),prev=rt.lastDecision.get(mint)||null;rt.lastDecision.set(mint,next);if(prev===next||!['WATCH','BUY READY'].includes(next))return;__mfPublicAgentQueue(uid,next,t,{decision:d})}
function __mfPublicAgentExecution(uid,t,d,result){if(!result)return;const reason=result?.reason||result?.code||null,action=String(result?.action||'').toUpperCase();if(['OBSERVED','PROPOSED','PROPOSAL_EXISTS','OPENED'].includes(action))return;if(['NONE',''].includes(action)&&['NOT_PAPER','POSITION_EXISTS','IDEMPOTENT','UNKNOWN_MODE'].includes(String(reason||'')))return;if(!reason&&action!=='REJECTED')return;const type=__mfPublicAgentRiskClass(reason)==='RISK'?'RISK':'REJECT';__mfPublicAgentQueue(uid,type,t,{decision:d,reason})}
const __mfPublicAgentOpenPositionOriginal=paper.openPosition.bind(paper);
paper.openPosition=function(uid,t,d,rawSettings,idempotencyKey){const result=__mfPublicAgentOpenPositionOriginal(uid,t,d,rawSettings,idempotencyKey);if(result?.ok===true&&result?.position){__mfPublicAgentQueue(uid,'OPEN POSITION',t,{decision:d,position:result.position})}else if(result?.ok===false&&result?.code){const type=__mfPublicAgentRiskClass(result.code)==='RISK'?'RISK':'REJECT';__mfPublicAgentQueue(uid,type,t,{decision:d,reason:result.code})}return result};
const __mfPublicAgentFinalizePositionOriginal=paper.finalizePosition.bind(paper);
paper.finalizePosition=function(position,price,reason){const wasOpen=String(position?.status||'').toUpperCase()==='OPEN';const result=__mfPublicAgentFinalizePositionOriginal(position,price,reason);if(wasOpen&&String(position?.status||'').toUpperCase()==='CLOSED'){const token=store.state.tokens?.[position.mint]||{mint:position.mint,symbol:position.symbol,name:position.name};__mfPublicAgentQueue(position.userId,'EXIT',token,{position,reason})}return result};
"""
s=s[:start]+v2+"\n"+s[end:]
old="""  const finish=(result)=>{
    try{openaiAI.recordExecution(uid,token,decision,result||{})}catch{}
    return result;
  };"""
new="""  const finish=(result)=>{
    try{openaiAI.recordExecution(uid,token,decision,result||{})}catch{}
    try{__mfPublicAgentExecution(uid,token,decision,result||{})}catch{}
    return result;
  };"""
if old not in s: raise SystemExit("PATCH ABORTED: finish hook missing")
s=s.replace(old,new,1)
rs=s.find("/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_ROUTES */")
re=s.find("/* ============================================================\n    MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES",rs)
if rs<0 or re<0: raise SystemExit("PATCH ABORTED: V1 routes missing")
routes=r"""
/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
 if(url.pathname==='/api/owner/public-agent'&&req.method==='GET'){if(!u)return json(res,401,{error:'AUTH_REQUIRED'});if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});const st=__mfPublicAgentState(u.id);return json(res,200,{ok:true,owner:true,config:st.config,queue:st.queue.slice(0,50),audit:st.audit.slice(0,50),x:{connected:false,transport:'disabled-v2'}})}
 if(url.pathname==='/api/owner/public-agent/config'&&req.method==='PUT'){if(!u)return json(res,401,{error:'AUTH_REQUIRED'});if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});const b=await body(req),st=__mfPublicAgentState(u.id),mode=String(b?.mode||st.config.mode||'approval').toLowerCase();if(!['off','approval','autonomous'].includes(mode))return json(res,400,{error:'INVALID_MODE'});const e=b?.events&&typeof b.events==='object'?b.events:{};st.config={...st.config,enabled:b?.enabled===true,mode,displayName:__mfPublicAgentSafe(b?.displayName??st.config.displayName,40),voice:['terminal','minimal'].includes(String(b?.voice))?String(b.voice):st.config.voice,xConnected:false,events:{watch:e.watch!==false,buyReady:e.buyReady!==false,positions:e.positions!==false,risk:e.risk!==false}};const at=new Date().toISOString();st.audit.unshift({at,type:'CONFIG_UPDATED',mode:st.config.mode,enabled:st.config.enabled});st.audit=st.audit.slice(0,200);store.save();return json(res,200,{ok:true,config:st.config})}
 {const m=url.pathname.match(/^\/api\/owner\/public-agent\/queue\/([^/]+)\/(approve|reject)$/);if(m&&req.method==='POST'){if(!u)return json(res,401,{error:'AUTH_REQUIRED'});if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});const st=__mfPublicAgentState(u.id),item=st.queue.find(x=>x.id===m[1]);if(!item)return json(res,404,{error:'DRAFT_NOT_FOUND'});item.status=m[2]==='approve'?'READY':'REJECTED';item.reviewedAt=new Date().toISOString();st.audit.unshift({at:item.reviewedAt,type:m[2]==='approve'?'DRAFT_APPROVED':'DRAFT_REJECTED',id:item.id,eventType:item.eventType});st.audit=st.audit.slice(0,200);store.save();return json(res,200,{ok:true,item,xPosted:false,xConnected:false})}}
"""
s=s[:rs]+routes+"\n "+s[re:]
f.write_text(s)
PY

python3 - "$APP" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1])
f=app/"settings-page.js"; j=f.read_text()
us=j.find("/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_UI */")
ue=j.find("/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1",us)
if us<0 or ue<0: raise SystemExit("PATCH ABORTED: V1 UI missing")
ui=r"""
/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_UI */
async function mfPublicAgentInstall(){
  let owner=false;
  try{const r=await fetch('/api/owner/status',{credentials:'same-origin',cache:'no-store'}),p=await r.json();owner=r.ok&&p?.isOwner===true}catch{}
  if(!owner)return;
  const body=document.getElementById('mf293SettingsBody');
  if(!body||document.getElementById('mfPublicAgentGroup'))return;

  if(!document.getElementById('mfPublicAgentV2Styles')){
    const style=document.createElement('style');
    style.id='mfPublicAgentV2Styles';
    style.textContent=`
      #mfPublicAgentGroup .mf-agent-wide{grid-column:1/-1}
      #mfPublicAgentGroup .mf-agent-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      #mfPublicAgentGroup .mf-agent-save{width:auto;min-height:38px;padding:8px 14px}
      #mfPublicAgentGroup .mf-agent-note{font-size:11px;line-height:1.45;color:var(--muted)}
      #mfPublicAgentGroup .mf-agent-list{display:grid;gap:8px;margin-top:7px}
      #mfPublicAgentGroup .mf-agent-item{border:1px solid var(--line);border-radius:10px;padding:9px;background:rgba(127,127,127,.035)}
      #mfPublicAgentGroup .mf-agent-item-top{display:flex;gap:8px;align-items:center;justify-content:space-between}
      #mfPublicAgentGroup .mf-agent-item b{font-size:12px}
      #mfPublicAgentGroup .mf-agent-status{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
      #mfPublicAgentGroup .mf-agent-copy{white-space:pre-wrap;font-size:12px;line-height:1.45;margin-top:6px}
      #mfPublicAgentGroup .mf-agent-review{display:flex;gap:6px;margin-top:8px}
      #mfPublicAgentGroup .mf-agent-review button{min-height:32px;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:transparent}
      #mfPublicAgentGroup .mf-agent-events{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #mfPublicAgentGroup .mf-agent-event{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:10px;padding:9px}
      #mfPublicAgentGroup .mf-agent-history{font-size:11px;line-height:1.5;color:var(--muted);white-space:pre-wrap}
      @media(max-width:620px){#mfPublicAgentGroup .mf-agent-events{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  const sec=document.createElement('details');
  sec.id='mfPublicAgentGroup';
  sec.className='mf293-settings-group';
  sec.innerHTML=`<summary><span><strong>Public Agent</strong><small>Owner only · entity + future X publisher</small></span><i></i></summary>
  <div class="mf293-settings-grid">
    <label class="mf293-field mf293-field-switch"><span class="mf293-field-label">Enable entity</span><span class="mf293-switch"><input id="mfEntityEnabled" type="checkbox"><span class="mf293-switch-track"></span></span></label>
    <label class="mf293-field"><span class="mf293-field-label">Mode</span><select id="mfEntityMode"><option value="off">Off</option><option value="approval">Approval</option><option value="autonomous">Autonomous</option></select></label>
    <label class="mf293-field"><span class="mf293-field-label">Display name</span><input id="mfEntityName" type="text" maxlength="40" placeholder="Choose later"></label>
    <label class="mf293-field"><span class="mf293-field-label">Voice</span><select id="mfEntityVoice"><option value="terminal">Terminal</option><option value="minimal">Minimal</option></select></label>
    <label class="mf293-field mf-agent-wide"><span class="mf293-field-label">X connection</span><input value="Not connected · publishing physically disabled" disabled></label>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Events the entity may speak about</span>
      <div class="mf-agent-events">
        <label class="mf-agent-event"><span>WATCH</span><input id="mfEntityEventWatch" type="checkbox"></label>
        <label class="mf-agent-event"><span>BUY READY</span><input id="mfEntityEventBuyReady" type="checkbox"></label>
        <label class="mf-agent-event"><span>OPEN / EXIT</span><input id="mfEntityEventPositions" type="checkbox"></label>
        <label class="mf-agent-event"><span>REJECT / RISK</span><input id="mfEntityEventRisk" type="checkbox"></label>
      </div>
    </div>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Publication queue</span><div id="mfEntityQueue" class="mf-agent-list">Loading…</div></div>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Entity history</span><div id="mfEntityHistory" class="mf-agent-history">Loading…</div></div>
    <div class="mf-agent-wide mf-agent-actions"><button id="mfEntitySave" class="mf293-primary mf-agent-save" type="button">Save Public Agent</button><button id="mfEntityRefresh" class="mf293-secondary" type="button">Refresh queue</button><span class="mf-agent-note">Approved drafts remain READY until X is connected.</span></div>
  </div>`;
  body.prepend(sec);

  const el=id=>document.getElementById(id);

  async function review(id,action){
    const r=await fetch(`/api/owner/public-agent/queue/${encodeURIComponent(id)}/${action}`,{method:'POST',credentials:'same-origin'});
    const p=await r.json().catch(()=>({}));
    if(!r.ok){mf293Error(p?.error||'Draft review failed.');return}
    mf293Status(action==='approve'?'Draft approved':'Draft rejected','saved');
    await load();
  }

  function renderQueue(rows){
    const q=el('mfEntityQueue');q.innerHTML='';
    if(!rows?.length){q.textContent='No drafts yet.';return}
    for(const item of rows.slice(0,10)){
      const wrap=document.createElement('div');wrap.className='mf-agent-item';
      const top=document.createElement('div');top.className='mf-agent-item-top';
      const title=document.createElement('b');title.textContent=`${item.eventType} · ${item.symbol||String(item.mint||'').slice(0,6)}`;
      const status=document.createElement('span');status.className='mf-agent-status';status.textContent=item.status||'PENDING';
      top.append(title,status);
      const copy=document.createElement('div');copy.className='mf-agent-copy';copy.textContent=item.text||'';
      wrap.append(top,copy);
      if(item.status==='PENDING'){
        const actions=document.createElement('div');actions.className='mf-agent-review';
        const approve=document.createElement('button');approve.type='button';approve.textContent='Approve';approve.addEventListener('click',()=>review(item.id,'approve'));
        const reject=document.createElement('button');reject.type='button';reject.textContent='Reject';reject.addEventListener('click',()=>review(item.id,'reject'));
        actions.append(approve,reject);wrap.appendChild(actions);
      }
      q.appendChild(wrap);
    }
  }

  function renderHistory(rows){
    const h=el('mfEntityHistory');
    if(!rows?.length){h.textContent='No entity activity yet.';return}
    h.textContent=rows.slice(0,12).map(x=>`${x.at?new Date(x.at).toLocaleString():'—'} · ${x.type}${x.eventType?` · ${x.eventType}`:''}`).join('\n');
  }

  async function load(){
    const r=await fetch('/api/owner/public-agent',{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)return;
    const p=await r.json(),c=p.config||{},e=c.events||{};
    el('mfEntityEnabled').checked=c.enabled===true;
    el('mfEntityMode').value=c.mode||'approval';
    el('mfEntityName').value=c.displayName||'';
    el('mfEntityVoice').value=c.voice||'terminal';
    el('mfEntityEventWatch').checked=e.watch!==false;
    el('mfEntityEventBuyReady').checked=e.buyReady!==false;
    el('mfEntityEventPositions').checked=e.positions!==false;
    el('mfEntityEventRisk').checked=e.risk!==false;
    renderQueue(p.queue||[]);renderHistory(p.audit||[]);
  }

  el('mfEntitySave').addEventListener('click',async()=>{
    const r=await fetch('/api/owner/public-agent/config',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      enabled:el('mfEntityEnabled').checked,
      mode:el('mfEntityMode').value,
      displayName:el('mfEntityName').value,
      voice:el('mfEntityVoice').value,
      events:{watch:el('mfEntityEventWatch').checked,buyReady:el('mfEntityEventBuyReady').checked,positions:el('mfEntityEventPositions').checked,risk:el('mfEntityEventRisk').checked}
    })});
    const p=await r.json().catch(()=>({}));
    if(!r.ok){mf293Error(p?.error||'Public Agent settings could not be saved.');return}
    mf293Status('Public Agent saved','saved');await load();
  });
  el('mfEntityRefresh').addEventListener('click',load);
  await load();
}
"""
j=j[:us]+ui+"\n\n"+j[ue:]
f.write_text(j)

f=app/"settings.html"; h=f.read_text()
h=h.replace("settings-page.js?v=public-agent-entity-v1-20260902","settings-page.js?v=public-agent-entity-v2-20260902")
f.write_text(h)

test=app/"tests/public-agent-v2.mjs"
test.write_text(r"""import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const cwd=path.resolve(new URL('..',import.meta.url).pathname),port=39242,data='data-public-agent-v2-test';
const p=spawn(process.execPath,['app-server.mjs'],{cwd,env:{...process.env,PORT:String(port),DISCOVERY_ENABLED:'false',DATA_DIR:`./${data}`,OWNER_ACCESS_KEY:'entity-owner-test'},stdio:['ignore','pipe','pipe']});
await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('start timeout')),8000);p.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);ok()}});p.on('exit',c=>fail(Error('server exited '+c)))});
let cookie='';async function q(route,opt={}){const r=await fetch(`http://127.0.0.1:${port}${route}`,{...opt,headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...(opt.headers||{})}});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return[r,await r.json().catch(()=>null)]}
try{
 let[r,s]=await q('/api/owner/public-agent');assert.equal(r.status,403);assert.equal(s.error,'OWNER_REQUIRED');
 [r,s]=await q('/api/owner/claim',{method:'POST',body:JSON.stringify({accessKey:'entity-owner-test'})});assert.equal(r.status,200);assert.equal(s.isOwner,true);
 [r,s]=await q('/api/owner/public-agent');assert.equal(r.status,200);assert.equal(s.x.connected,false);assert.equal(s.x.transport,'disabled-v2');
 [r,s]=await q('/api/owner/public-agent/config',{method:'PUT',body:JSON.stringify({enabled:true,mode:'approval',displayName:'PUBLIC_AGENT',voice:'terminal',events:{watch:true,buyReady:true,positions:true,risk:true}})});assert.equal(r.status,200);assert.equal(s.config.enabled,true);assert.equal(s.config.events.positions,true);
 [r,s]=await q('/api/owner/public-agent');assert.equal(r.status,200);assert.equal(s.config.displayName,'PUBLIC_AGENT');assert.deepEqual(s.queue,[]);
 console.log('public agent v2 owner api ok');
}finally{p.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));fs.rmSync(path.join(cwd,data),{recursive:true,force:true})}
""")
PY

cd "$APP"
node --check app-server.mjs
node --check settings-page.js
node tests/public-agent-v2.mjs
git diff --check
echo
echo "OK — Public Agent V2 installed and tested."
echo "X publishing remains physically DISABLED."
echo "Backup: $BACKUP"
echo
echo "DO NOT git add ."
echo "Stage only:"
echo "git add memeflow-app/app-server.mjs memeflow-app/settings-page.js memeflow-app/settings.html memeflow-app/tests/public-agent-v2.mjs"
