#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"
[ -f "$APP/app-server.mjs" ] || { echo "ERROR: run from repository root"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.mf-backups/public-agent-v21-$STAMP"
mkdir -p "$BACKUP"
cp "$APP/app-server.mjs" "$APP/settings-page.js" "$APP/settings.html" "$BACKUP/"
echo "Backup: $BACKUP"

python3 - "$APP" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1])

# backend
f=app/"app-server.mjs"
s=f.read_text()

route_marker="/* ============================================================\n    MEMEFLOW_OWNER_INTELLIGENCE_V1_ROUTES"
if route_marker not in s:
    raise SystemExit("PATCH ABORTED: owner route marker missing")

test_route=r"""
 /* MEMEFLOW_PUBLIC_AGENT_TEST_V21
  * Owner-only dry-run generator. Never touches trading state or X.
  */
 if(url.pathname==='/api/owner/public-agent/test'&&req.method==='POST'){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const st=__mfPublicAgentState(u.id);
   if(!st.config.enabled||st.config.mode==='off'){
     return json(res,409,{error:'ENTITY_DISABLED',message:'Enable Public Agent first.'});
   }

   const b=await body(req);
   const type=String(b?.type||'WATCH').toUpperCase();
   if(!['WATCH','BUY READY','OPEN POSITION','EXIT','RISK','REJECT'].includes(type)){
     return json(res,400,{error:'INVALID_TEST_EVENT'});
   }

   const token={
     mint:'TEST_PUBLIC_AGENT_000000000000000000000000000000',
     symbol:'TEST',
     name:'Public Agent Test'
   };
   const meta={
     decision:{score:91,confidence:88},
     reason:type==='RISK'?'WALLET_RISK_BLOCKED':'ENTRY_NOT_READY',
     position:{
       id:'TEST_POSITION',
       mint:token.mint,
       symbol:'TEST',
       realizedPnlPct:37.42
     }
   };

   const item=__mfPublicAgentQueue(u.id,type,token,meta);
   if(!item){
     return json(res,409,{error:'EVENT_NOT_QUEUED',message:'That event type may be disabled or recently generated.'});
   }

   st.audit.unshift({
     at:new Date().toISOString(),
     type:'OWNER_TEST_EVENT',
     eventType:type,
     id:item.id
   });
   st.audit=st.audit.slice(0,200);
   store.save();

   return json(res,200,{ok:true,item,xPosted:false,test:true});
 }
"""
s=s.replace(route_marker,test_route+"\n "+route_marker,1)
f.write_text(s)

# UI
f=app/"settings-page.js"
j=f.read_text()

needle="""    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Publication queue</span><div id="mfEntityQueue" class="mf-agent-list">Loading…</div></div>"""
if needle not in j:
    raise SystemExit("PATCH ABORTED: publication queue UI marker missing")

replacement="""    <div class="mf293-field mf-agent-wide">
      <span class="mf293-field-label">Test entity</span>
      <div class="mf-agent-actions">
        <button type="button" class="mf293-secondary" data-mf-agent-test="WATCH">Test WATCH</button>
        <button type="button" class="mf293-secondary" data-mf-agent-test="BUY READY">Test BUY READY</button>
        <button type="button" class="mf293-secondary" data-mf-agent-test="OPEN POSITION">Test OPEN</button>
        <button type="button" class="mf293-secondary" data-mf-agent-test="EXIT">Test EXIT</button>
        <button type="button" class="mf293-secondary" data-mf-agent-test="RISK">Test RISK</button>
      </div>
      <span class="mf-agent-note">Dry-run only. Does not trade and cannot post to X.</span>
    </div>
    <div class="mf293-field mf-agent-wide"><span class="mf293-field-label">Publication queue</span><div id="mfEntityQueue" class="mf-agent-list">Loading…</div></div>"""
j=j.replace(needle,replacement,1)

listener_marker="""  el('mfEntityRefresh').addEventListener('click',load);
  await load();
}"""
if listener_marker not in j:
    raise SystemExit("PATCH ABORTED: refresh listener marker missing")

listeners=r"""  document.querySelectorAll('[data-mf-agent-test]').forEach(button=>{
    button.addEventListener('click',async()=>{
      const type=button.getAttribute('data-mf-agent-test');
      const r=await fetch('/api/owner/public-agent/test',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type})
      });
      const p=await r.json().catch(()=>({}));
      if(!r.ok){
        mf293Error(p?.message||p?.error||'Test event failed.');
        return;
      }
      mf293Status(`Test ${type} created`,'saved');
      await load();
    });
  });

  el('mfEntityRefresh').addEventListener('click',load);
  await load();
}"""
j=j.replace(listener_marker,listeners,1)
f.write_text(j)

# cache bust
f=app/"settings.html"
h=f.read_text()
h=h.replace("settings-page.js?v=public-agent-entity-v2-20260902",
            "settings-page.js?v=public-agent-entity-v21-test-20260902")
f.write_text(h)
PY

cd "$APP"
node --check app-server.mjs
node --check settings-page.js
git diff --check
echo
echo "OK — Public Agent V2.1 dry-run test tools installed."
echo "Backup: $BACKUP"
echo "X remains physically DISABLED."
echo
echo "DO NOT git add ."
echo "Stage only:"
echo "git add memeflow-app/app-server.mjs memeflow-app/settings-page.js memeflow-app/settings.html"
