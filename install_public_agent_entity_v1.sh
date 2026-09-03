#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"; APP="$ROOT/memeflow-app"
[ -f "$APP/app-server.mjs" ] || { echo "Run from repository root"; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.mf-backups/public-agent-v1-$STAMP"
mkdir -p "$BACKUP"; cp "$APP/app-server.mjs" "$APP/settings-page.js" "$APP/settings.html" "$BACKUP/"
python3 - "$APP" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]); f=app/'app-server.mjs'; s=f.read_text()
marker='const liveEvalMetrics=makeLiveEvalMetrics();'
assert marker in s, 'live marker missing'
entity="""
/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1 — owner-only, read-only toward trading */
const __mfPublicAgentByOwner=new Map();
function __mfPublicAgentState(uid){let x=__mfPublicAgentByOwner.get(uid);if(!x){x={config:{enabled:false,mode:'approval',displayName:'',voice:'terminal',xConnected:false},lastDecision:new Map(),queue:[],audit:[]};__mfPublicAgentByOwner.set(uid,x)}return x}
function __mfPublicAgentSafe(v,n=80){return String(v??'').replace(/[^\\x20-\\x7E]/g,' ').replace(/\\s+/g,' ').trim().slice(0,n)}
function __mfPublicAgentDraft(type,t,d){const sym=__mfPublicAgentSafe(t?.symbol||t?.name||'UNKNOWN',24).toUpperCase();const sc=Number.isFinite(Number(d?.score))?Math.round(Number(d.score)):null;const cf=Number.isFinite(Number(d?.confidence))?Math.round(Number(d.confidence)):null;const a=[type==='WATCH'?'SIGNAL DETECTED.':'ENTRY CONDITIONS DETECTED.',`$${sym}`];if(sc!==null)a.push(`Score: ${sc}`);if(cf!==null)a.push(`Confidence: ${cf}%`);a.push(type==='WATCH'?'I am watching.':'The market is becoming interesting.');return a.join('\\n').slice(0,270)}
function __mfPublicAgentDecision(uid,t,d){if(!uid||store.user(uid)?.isOwner!==true||!t?.mint||!d)return;const st=__mfPublicAgentState(uid);if(!st.config.enabled||st.config.mode==='off')return;const mint=String(t.mint),next=String(d.state||'').toUpperCase(),prev=st.lastDecision.get(mint)||null;st.lastDecision.set(mint,next);if(prev===next||!['WATCH','BUY READY'].includes(next))return;const item={id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:st.config.mode==='autonomous'?'READY':'PENDING',eventType:next,mint,symbol:__mfPublicAgentSafe(t.symbol||t.name||'',24),score:Number.isFinite(Number(d.score))?Number(d.score):null,confidence:Number.isFinite(Number(d.confidence))?Number(d.confidence):null,text:__mfPublicAgentDraft(next,t,d)};st.queue.unshift(item);st.queue=st.queue.slice(0,100);st.audit.unshift({at:item.createdAt,type:'DRAFT_CREATED',id:item.id,eventType:next});st.audit=st.audit.slice(0,200)}
"""
s=s.replace(marker,entity+'\n'+marker,1)
old="try{openaiAI.recordDecision(uid,token,decision,{source:'live-evaluate'})}catch{}\n    void __mfHandleDecision(uid,token,decision).catch(()=>{});"
assert old in s, 'decision hook missing'
s=s.replace(old,"try{openaiAI.recordDecision(uid,token,decision,{source:'live-evaluate'})}catch{}\n    try{__mfPublicAgentDecision(uid,token,decision)}catch{}\n    void __mfHandleDecision(uid,token,decision).catch(()=>{});",1)
rm=' /* ============================================================\n    MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES'
assert rm in s, 'owner route marker missing'
routes="""
 /* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_ROUTES */
 if(url.pathname==='/api/owner/public-agent'&&req.method==='GET'){if(!u)return json(res,401,{error:'AUTH_REQUIRED'});if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});const st=__mfPublicAgentState(u.id);return json(res,200,{ok:true,owner:true,config:st.config,queue:st.queue.slice(0,50),audit:st.audit.slice(0,50),x:{connected:false,transport:'disabled-v1'}})}
 if(url.pathname==='/api/owner/public-agent/config'&&req.method==='PUT'){if(!u)return json(res,401,{error:'AUTH_REQUIRED'});if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});const b=await body(req),st=__mfPublicAgentState(u.id),mode=String(b?.mode||st.config.mode||'approval').toLowerCase();if(!['off','approval','autonomous'].includes(mode))return json(res,400,{error:'INVALID_MODE'});st.config={...st.config,enabled:b?.enabled===true,mode,displayName:__mfPublicAgentSafe(b?.displayName??st.config.displayName,40),voice:['terminal','minimal'].includes(String(b?.voice))?String(b.voice):st.config.voice,xConnected:false};return json(res,200,{ok:true,config:st.config})}
 {const m=url.pathname.match(/^\\/api\\/owner\\/public-agent\\/queue\\/([^/]+)\\/(approve|reject)$/);if(m&&req.method==='POST'){if(!u)return json(res,401,{error:'AUTH_REQUIRED'});if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});const st=__mfPublicAgentState(u.id),item=st.queue.find(x=>x.id===m[1]);if(!item)return json(res,404,{error:'DRAFT_NOT_FOUND'});item.status=m[2]==='approve'?'READY':'REJECTED';item.reviewedAt=new Date().toISOString();return json(res,200,{ok:true,item,xPosted:false})}}
"""
s=s.replace(rm,routes+'\n'+rm,1); f.write_text(s)

f=app/'settings-page.js'; j=f.read_text()
ui="""
/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V1_UI */
async function mfPublicAgentInstall(){let owner=false;try{const r=await fetch('/api/owner/status',{credentials:'same-origin',cache:'no-store'}),p=await r.json();owner=r.ok&&p?.isOwner===true}catch{}if(!owner)return;const body=document.getElementById('mf293SettingsBody');if(!body||document.getElementById('mfPublicAgentGroup'))return;const sec=document.createElement('details');sec.id='mfPublicAgentGroup';sec.className='mf293-settings-group';sec.innerHTML=`<summary><span><strong>Public Agent</strong><small>Owner only · entity + future X publisher</small></span><i></i></summary><div class="mf293-settings-grid"><label class="mf293-field mf293-field-switch"><span class="mf293-field-label">Enable entity</span><span class="mf293-switch"><input id="mfEntityEnabled" type="checkbox"><span class="mf293-switch-track"></span></span></label><label class="mf293-field"><span class="mf293-field-label">Mode</span><select id="mfEntityMode"><option value="off">Off</option><option value="approval">Approval</option><option value="autonomous">Autonomous</option></select></label><label class="mf293-field"><span class="mf293-field-label">Display name</span><input id="mfEntityName" placeholder="Choose later"></label><label class="mf293-field"><span class="mf293-field-label">Voice</span><select id="mfEntityVoice"><option value="terminal">Terminal</option><option value="minimal">Minimal</option></select></label><label class="mf293-field"><span class="mf293-field-label">X connection</span><input value="Not connected · V1 safe mode" disabled></label><div class="mf293-field mf293-field-wide"><span class="mf293-field-label">Publication queue</span><div id="mfEntityQueue">Loading…</div></div><button id="mfEntitySave" class="mf293-primary" type="button">Save Public Agent</button></div>`;body.prepend(sec);async function load(){const r=await fetch('/api/owner/public-agent',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const p=await r.json(),c=p.config||{};mfEntityEnabled.checked=c.enabled===true;mfEntityMode.value=c.mode||'approval';mfEntityName.value=c.displayName||'';mfEntityVoice.value=c.voice||'terminal';mfEntityQueue.textContent=(p.queue||[]).length?(p.queue||[]).slice(0,8).map(x=>`${x.status} · ${x.eventType} · ${x.symbol||x.mint.slice(0,6)} · ${x.text.replace(/\\n/g,' / ')}`).join('\\n'):'No drafts yet.';mfEntityQueue.style.whiteSpace='pre-wrap'}mfEntitySave.addEventListener('click',async()=>{const r=await fetch('/api/owner/public-agent/config',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:mfEntityEnabled.checked,mode:mfEntityMode.value,displayName:mfEntityName.value,voice:mfEntityVoice.value})});if(!r.ok){mf293Error('Public Agent settings could not be saved.');return}mf293Status('Public Agent saved','saved');await load()});await load()}
"""
j=ui+'\n'+j
needle='  mf293Build();'; assert needle in j, 'settings install marker missing'
j=j.replace(needle,needle+'\n  void mfPublicAgentInstall();',1); f.write_text(j)
f=app/'settings.html'; h=f.read_text(); h=h.replace('settings-page.js?v=settings-page-6dd8543-cachefix-c6663c7-20260826-v1','settings-page.js?v=public-agent-entity-v1-20260902'); f.write_text(h)
PY
cd "$APP"
node --check app-server.mjs
node --check settings-page.js
git diff --check
echo "OK — Public Agent V1 installed. X posting is DISABLED."
echo "Backup: $BACKUP"
echo "Review first. Then: git add memeflow-app/app-server.mjs memeflow-app/settings-page.js memeflow-app/settings.html && git commit -m 'feat: owner-only public agent entity v1' && git push"
