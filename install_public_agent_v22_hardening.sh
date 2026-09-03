#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"

[ -f "$APP/app-server.mjs" ] || { echo "ERROR: run from repository root"; exit 1; }
grep -q "MEMEFLOW_PUBLIC_AGENT_ENTITY_V2" "$APP/app-server.mjs" || { echo "ERROR: Public Agent V2 not installed"; exit 1; }
grep -q "/api/owner/public-agent/test" "$APP/app-server.mjs" || { echo "ERROR: Public Agent V2.1 test route not installed"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.mf-backups/public-agent-v22-$STAMP"
mkdir -p "$BACKUP"
cp "$APP/app-server.mjs" "$APP/settings-page.js" "$APP/settings.html" "$BACKUP/"
echo "Backup: $BACKUP"

python3 - "$APP" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1])

# ---------------- backend ----------------
f=app/"app-server.mjs"
s=f.read_text()

# 1) add helper that permanently identifies test drafts
anchor="function __mfPublicAgentSafe(v,n=80){return String(v??'').replace(/[^\\x20-\\x7E]/g,' ').replace(/\\s+/g,' ').trim().slice(0,n)}"
if anchor not in s:
    raise SystemExit("PATCH ABORTED: safe helper anchor missing")

helper=anchor+"""
function __mfPublicAgentIsTestItem(item){
  if(!item||typeof item!=='object')return false;
  if(item.test===true)return true;
  if(String(item.mint||'').startsWith('TEST_PUBLIC_AGENT_'))return true;
  if(String(item.symbol||'').toUpperCase()==='TEST')return true;
  return false;
}
function __mfPublicAgentPublishable(item){
  return Boolean(item&&item.status==='READY'&&!__mfPublicAgentIsTestItem(item));
}"""
s=s.replace(anchor,helper,1)

# 2) mark test draft itself, not only API response
old="""   const item=__mfPublicAgentQueue(u.id,type,token,meta);
   if(!item){"""
new="""   const item=__mfPublicAgentQueue(u.id,type,token,meta);
   if(item)item.test=true;
   if(!item){"""
if old not in s:
    raise SystemExit("PATCH ABORTED: test item creation anchor missing")
s=s.replace(old,new,1)

# 3) replace review route with idempotent review + archive
old_start=s.find(" {const m=url.pathname.match(/^\\/api\\/owner\\/public-agent\\/queue\\/([^/]+)\\/(approve|reject)$/);")
if old_start<0:
    raise SystemExit("PATCH ABORTED: review route start missing")
old_end=s.find("\n\n /* MEMEFLOW_PUBLIC_AGENT_TEST_V21",old_start)
if old_end<0:
    raise SystemExit("PATCH ABORTED: review route end missing")

routes=r""" {const m=url.pathname.match(/^\/api\/owner\/public-agent\/queue\/([^/]+)\/(approve|reject)$/);
  if(m&&req.method==='POST'){
    if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
    if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});
    const st=__mfPublicAgentState(u.id),item=st.queue.find(x=>x.id===m[1]);
    if(!item)return json(res,404,{error:'DRAFT_NOT_FOUND'});

    const target=m[2]==='approve'?'READY':'REJECTED';

    // Idempotent review: repeat taps must not create duplicate audit rows.
    if(item.status===target){
      return json(res,200,{
        ok:true,
        item,
        unchanged:true,
        xPosted:false,
        xConnected:false,
        publishable:__mfPublicAgentPublishable(item)
      });
    }

    // Once resolved, do not allow opposite review without creating a new draft.
    if(item.status!=='PENDING'){
      return json(res,409,{
        error:'DRAFT_ALREADY_RESOLVED',
        status:item.status
      });
    }

    item.status=target;
    item.reviewedAt=new Date().toISOString();
    st.audit.unshift({
      at:item.reviewedAt,
      type:m[2]==='approve'?'DRAFT_APPROVED':'DRAFT_REJECTED',
      id:item.id,
      eventType:item.eventType,
      test:__mfPublicAgentIsTestItem(item)
    });
    st.audit=st.audit.slice(0,200);
    store.save();

    return json(res,200,{
      ok:true,
      item,
      unchanged:false,
      xPosted:false,
      xConnected:false,
      publishable:__mfPublicAgentPublishable(item)
    });
  }
 }

 {const m=url.pathname.match(/^\/api\/owner\/public-agent\/queue\/([^/]+)\/archive$/);
  if(m&&req.method==='POST'){
    if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
    if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

    const st=__mfPublicAgentState(u.id);
    const index=st.queue.findIndex(x=>x.id===m[1]);
    if(index<0)return json(res,404,{error:'DRAFT_NOT_FOUND'});

    const item=st.queue[index];
    if(item.status==='PENDING'){
      return json(res,409,{error:'PENDING_DRAFT_CANNOT_ARCHIVE'});
    }

    st.queue.splice(index,1);
    const at=new Date().toISOString();
    st.audit.unshift({
      at,
      type:'DRAFT_ARCHIVED',
      id:item.id,
      eventType:item.eventType,
      finalStatus:item.status,
      test:__mfPublicAgentIsTestItem(item)
    });
    st.audit=st.audit.slice(0,200);
    store.save();

    return json(res,200,{ok:true,archivedId:item.id});
  }
 }

 if(url.pathname==='/api/owner/public-agent/queue/clear-tests'&&req.method==='POST'){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const st=__mfPublicAgentState(u.id);
   const before=st.queue.length;
   st.queue=st.queue.filter(item=>!__mfPublicAgentIsTestItem(item));
   const removed=before-st.queue.length;

   if(removed>0){
     const at=new Date().toISOString();
     st.audit.unshift({at,type:'TEST_DRAFTS_CLEARED',removed});
     st.audit=st.audit.slice(0,200);
     store.save();
   }

   return json(res,200,{ok:true,removed});
 }
"""
s=s[:old_start]+routes+s[old_end:]

# 4) expose a safety flag in GET response
old="""x:{connected:false,transport:'disabled-v2'}})}"""
new="""x:{connected:false,transport:'disabled-v2'},safety:{testDraftsNeverPublish:true})})}"""
if old not in s:
    raise SystemExit("PATCH ABORTED: GET response anchor missing")
s=s.replace(old,new,1)

f.write_text(s)

# ---------------- frontend ----------------
f=app/"settings-page.js"
j=f.read_text()

# Add queue maintenance buttons near refresh
old="""<button id="mfEntityRefresh" class="mf293-secondary" type="button">Refresh queue</button><span class="mf-agent-note">Approved drafts remain READY until X is connected.</span>"""
new="""<button id="mfEntityRefresh" class="mf293-secondary" type="button">Refresh queue</button><button id="mfEntityClearTests" class="mf293-secondary" type="button">Clear TEST drafts</button><span class="mf-agent-note">Approved drafts remain READY until X is connected. TEST drafts can never be published.</span>"""
if old not in j:
    raise SystemExit("PATCH ABORTED: action row anchor missing")
j=j.replace(old,new,1)

# Replace renderQueue block with archive-aware/test-aware UI
start=j.find("  function renderQueue(rows){")
end=j.find("\n\n  function renderHistory(rows){",start)
if start<0 or end<0:
    raise SystemExit("PATCH ABORTED: renderQueue block missing")

render=r"""  function renderQueue(rows){
    const q=el('mfEntityQueue');q.innerHTML='';
    if(!rows?.length){q.textContent='No drafts yet.';return}
    for(const item of rows.slice(0,12)){
      const isTest=item.test===true||String(item.mint||'').startsWith('TEST_PUBLIC_AGENT_')||String(item.symbol||'').toUpperCase()==='TEST';
      const wrap=document.createElement('div');wrap.className='mf-agent-item';
      const top=document.createElement('div');top.className='mf-agent-item-top';
      const title=document.createElement('b');
      title.textContent=`${item.eventType} · ${item.symbol||String(item.mint||'').slice(0,6)}${isTest?' · TEST':''}`;
      const status=document.createElement('span');status.className='mf-agent-status';status.textContent=item.status||'PENDING';
      top.append(title,status);

      const copy=document.createElement('div');copy.className='mf-agent-copy';copy.textContent=item.text||'';
      wrap.append(top,copy);

      const actions=document.createElement('div');
      actions.className='mf-agent-review';

      if(item.status==='PENDING'){
        const approve=document.createElement('button');
        approve.type='button';approve.textContent='Approve';
        approve.addEventListener('click',()=>review(item.id,'approve'));

        const reject=document.createElement('button');
        reject.type='button';reject.textContent='Reject';
        reject.addEventListener('click',()=>review(item.id,'reject'));

        actions.append(approve,reject);
      }else{
        const archive=document.createElement('button');
        archive.type='button';archive.textContent='Archive';
        archive.addEventListener('click',async()=>{
          const r=await fetch(`/api/owner/public-agent/queue/${encodeURIComponent(item.id)}/archive`,{
            method:'POST',
            credentials:'same-origin'
          });
          const p=await r.json().catch(()=>({}));
          if(!r.ok){mf293Error(p?.error||'Archive failed.');return}
          mf293Status('Draft archived','saved');
          await load();
        });
        actions.append(archive);
      }

      if(actions.childNodes.length)wrap.appendChild(actions);
      q.appendChild(wrap);
    }
  }"""
j=j[:start]+render+j[end:]

# improve review function to surface unchanged idempotent response
old="""    mf293Status(action==='approve'?'Draft approved':'Draft rejected','saved');
    await load();"""
new="""    mf293Status(
      p?.unchanged
        ? (action==='approve'?'Already approved':'Already rejected')
        : (action==='approve'?'Draft approved':'Draft rejected'),
      'saved'
    );
    await load();"""
if old not in j:
    raise SystemExit("PATCH ABORTED: review success anchor missing")
j=j.replace(old,new,1)

# add clear-tests listener
old="""  el('mfEntityRefresh').addEventListener('click',load);
  await load();
}"""
new="""  el('mfEntityClearTests').addEventListener('click',async()=>{
    const r=await fetch('/api/owner/public-agent/queue/clear-tests',{
      method:'POST',
      credentials:'same-origin'
    });
    const p=await r.json().catch(()=>({}));
    if(!r.ok){mf293Error(p?.error||'Could not clear TEST drafts.');return}
    mf293Status(`Cleared ${Number(p?.removed||0)} TEST drafts`,'saved');
    await load();
  });

  el('mfEntityRefresh').addEventListener('click',load);
  await load();
}"""
if old not in j:
    raise SystemExit("PATCH ABORTED: refresh listener anchor missing")
j=j.replace(old,new,1)

f.write_text(j)

# cache bust
f=app/"settings.html"
h=f.read_text()
for old in [
    "settings-page.js?v=public-agent-entity-v211-testbuttons-20260902",
    "settings-page.js?v=public-agent-entity-v21-test-20260902",
    "settings-page.js?v=public-agent-entity-v2-20260902"
]:
    if old in h:
        h=h.replace(old,"settings-page.js?v=public-agent-v22-hardening-20260902")
f.write_text(h)
PY

cd "$APP"
node --check app-server.mjs
node --check settings-page.js
git diff --check

echo
echo "OK — Public Agent V2.2 hardening installed."
echo "Added:"
echo "  - idempotent Approve/Reject"
echo "  - Archive for resolved drafts"
echo "  - Clear TEST drafts"
echo "  - TEST drafts permanently marked non-publishable"
echo "X publishing remains physically DISABLED."
echo "Backup: $BACKUP"
echo
echo "DO NOT git add ."
