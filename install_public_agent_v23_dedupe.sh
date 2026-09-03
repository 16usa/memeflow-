#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"
FILE="$APP/app-server.mjs"

[ -f "$FILE" ] || { echo "ERROR: run from repository root"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.mf-backups/public-agent-v23-$STAMP"
mkdir -p "$BACKUP"
cp "$APP/app-server.mjs" "$APP/settings-page.js" "$APP/settings.html" "$BACKUP/"
echo "Backup: $BACKUP"

python3 - "$APP" <<'PY'
from pathlib import Path
import sys, re

app = Path(sys.argv[1])
f = app / "app-server.mjs"
s = f.read_text()

# Add a robust public label helper after __mfPublicAgentSafe.
safe_anchor = "function __mfPublicAgentSafe(v,n=80){return String(v??'').replace(/[^\\x20-\\x7E]/g,' ').replace(/\\s+/g,' ').trim().slice(0,n)}"
if safe_anchor not in s:
    raise SystemExit("PATCH ABORTED: __mfPublicAgentSafe anchor not found")

if "function __mfPublicAgentLabel(" not in s:
    label_helper = safe_anchor + r"""
function __mfPublicAgentLabel(t,meta={}){
  const symbol=__mfPublicAgentSafe(t?.symbol||meta?.symbol||'',24);
  if(symbol)return symbol.toUpperCase();

  const name=__mfPublicAgentSafe(t?.name||meta?.name||'',24);
  if(name&&name.toUpperCase()!=='UNKNOWN')return name.toUpperCase();

  const mint=String(t?.mint||meta?.mint||meta?.position?.mint||'').trim();
  if(mint)return mint.slice(0,6).toUpperCase();

  return 'TOKEN';
}"""
    s = s.replace(safe_anchor, label_helper, 1)

# Replace draft function so body never renders a naked "$".
draft_start = s.find("function __mfPublicAgentDraft(type,t,meta={}){")
queue_start = s.find("function __mfPublicAgentQueue(uid,type,t,meta={}){", draft_start)
if draft_start < 0 or queue_start < 0:
    raise SystemExit("PATCH ABORTED: Public Agent draft/queue functions not found")

new_draft = r"""function __mfPublicAgentDraft(type,t,meta={}){
  const sym=__mfPublicAgentLabel(t,meta);
  const d=meta?.decision||{},p=meta?.position||{};
  const sc=Number.isFinite(Number(d?.score??meta?.score))?Math.round(Number(d?.score??meta?.score)):null;
  const cf=Number.isFinite(Number(d?.confidence??meta?.confidence))?Math.round(Number(d?.confidence??meta?.confidence)):null;
  const pnl=Number.isFinite(Number(p?.realizedPnlPct))?Number(p.realizedPnlPct):null;
  const out=[];

  if(type==='WATCH'){
    out.push('SIGNAL DETECTED.',`$${sym}`);
    if(sc!==null)out.push(`Score: ${sc}`);
    if(cf!==null)out.push(`Confidence: ${cf}%`);
    out.push('I am watching.');
  }else if(type==='BUY READY'){
    out.push('ENTRY CONDITIONS DETECTED.',`$${sym}`);
    if(sc!==null)out.push(`Score: ${sc}`);
    if(cf!==null)out.push(`Confidence: ${cf}%`);
    out.push('The market is becoming interesting.');
  }else if(type==='OPEN POSITION'){
    out.push('POSITION OPEN.',`$${sym}`);
    if(sc!==null)out.push(`Signal: ${sc}`);
    out.push('Execution confirmed.');
  }else if(type==='EXIT'){
    out.push('POSITION CLOSED.',`$${sym}`);
    if(pnl!==null)out.push(`Realized: ${pnl>=0?'+':''}${pnl.toFixed(2)}%`);
    out.push('The position is no longer active.');
  }else if(type==='RISK'){
    out.push('RISK DETECTED.',`$${sym}`,__mfPublicAgentPublicReason(meta?.reason));
  }else{
    out.push('ENTRY REJECTED.',`$${sym}`,__mfPublicAgentPublicReason(meta?.reason));
  }

  return out.join('\n').slice(0,270);
}
"""

s = s[:draft_start] + new_draft + s[queue_start:]

# Replace queue function with active-draft coalescing + cooldown.
queue_start = s.find("function __mfPublicAgentQueue(uid,type,t,meta={}){")
decision_start = s.find("function __mfPublicAgentDecision(uid,t,d){", queue_start)
if queue_start < 0 or decision_start < 0:
    raise SystemExit("PATCH ABORTED: Public Agent queue/decision functions not found")

new_queue = r"""function __mfPublicAgentQueue(uid,type,t,meta={}){
  if(!uid||store.user(uid)?.isOwner!==true)return null;

  const st=__mfPublicAgentState(uid);
  if(!st.config.enabled||st.config.mode==='off'||!__mfPublicAgentAllowed(st,type))return null;

  const mint=String(t?.mint||meta?.position?.mint||'').trim();
  if(!mint)return null;

  const isTest=
    String(mint).startsWith('TEST_PUBLIC_AGENT_') ||
    String(t?.symbol||'').toUpperCase()==='TEST' ||
    meta?.test===true;

  const symbol=__mfPublicAgentLabel(t,{
    mint,
    symbol:meta?.position?.symbol||meta?.symbol,
    name:meta?.position?.name||meta?.name
  });

  const score=Number.isFinite(Number(meta?.decision?.score??meta?.score))
    ? Number(meta?.decision?.score??meta?.score)
    : null;

  const confidence=Number.isFinite(Number(meta?.decision?.confidence??meta?.confidence))
    ? Number(meta?.decision?.confidence??meta?.confidence)
    : null;

  /*
   * One mint + one event type = one active draft.
   *
   * PENDING:
   *   live score/confidence/text are refreshed in-place instead of creating spam.
   *
   * READY:
   *   frozen after owner approval. New matching events are ignored until archived.
   *
   * TEST and real drafts never coalesce with one another.
   */
  const active=st.queue.find(item=>
    item?.mint===mint &&
    item?.eventType===type &&
    ['PENDING','READY'].includes(String(item?.status||'')) &&
    __mfPublicAgentIsTestItem(item)===isTest
  );

  if(active){
    if(active.status==='PENDING'){
      const nextText=__mfPublicAgentDraft(type,t,meta);
      const changed=
        active.symbol!==symbol ||
        active.score!==score ||
        active.confidence!==confidence ||
        active.text!==nextText;

      if(changed){
        active.symbol=symbol;
        active.score=score;
        active.confidence=confidence;
        active.text=nextText;
        active.updatedAt=new Date().toISOString();
        active.test=isTest;
        store.save();
      }
    }
    return active;
  }

  const runtime=__mfPublicAgentRuntime(uid);

  /*
   * Cooldown stops a token from immediately re-creating the same event
   * after archive/review churn. State changes still pass because eventType
   * is part of the key (WATCH -> BUY READY is a new event).
   */
  const positionKey=meta?.position?.id||'';
  const cooldownKey=[type,mint,positionKey,isTest?'TEST':'LIVE'].join(':');
  const now=Date.now();
  const last=Number(runtime.recent.get(cooldownKey)||0);
  const cooldownMs=(type==='OPEN POSITION'||type==='EXIT') ? 60000 : 600000;

  if(last&&now-last<cooldownMs)return null;

  runtime.recent.set(cooldownKey,now);

  if(runtime.recent.size>500){
    for(const [k,at] of runtime.recent){
      if(now-Number(at)>3600000)runtime.recent.delete(k);
      if(runtime.recent.size<=300)break;
    }
  }

  const item={
    id:crypto.randomUUID(),
    createdAt:new Date(now).toISOString(),
    status:st.config.mode==='autonomous'?'READY':'PENDING',
    eventType:type,
    mint,
    symbol,
    score,
    confidence,
    reasonClass:(type==='RISK'||type==='REJECT')
      ? __mfPublicAgentRiskClass(meta?.reason)
      : null,
    text:__mfPublicAgentDraft(type,t,meta),
    test:isTest
  };

  st.queue.unshift(item);
  st.queue=st.queue.slice(0,100);

  st.audit.unshift({
    at:item.createdAt,
    type:'DRAFT_CREATED',
    id:item.id,
    eventType:type,
    status:item.status,
    test:isTest
  });
  st.audit=st.audit.slice(0,200);

  store.save();
  return item;
}
"""

s = s[:queue_start] + new_queue + s[decision_start:]

f.write_text(s)

# Cache-bust frontend even though this patch is backend-only, so a refresh
# clearly belongs to V2.3 while testing.
hfile = app / "settings.html"
h = hfile.read_text()
h = re.sub(
    r"settings-page\.js\?v=[^\"']+",
    "settings-page.js?v=public-agent-v23-dedupe-20260902",
    h,
    count=1
)
hfile.write_text(h)
PY

cd "$APP"

echo "Checking syntax..."
node --check app-server.mjs
node --check settings-page.js

echo "Checking whitespace..."
git diff --check

echo
echo "OK — Public Agent V2.3 dedupe installed."
echo "Behavior:"
echo "  - one active draft per mint + event type"
echo "  - PENDING drafts update in place"
echo "  - READY drafts freeze after approval"
echo "  - WATCH -> BUY READY still creates a new event"
echo "  - same event has cooldown after archive"
echo "  - missing symbols fall back to short mint"
echo "  - TEST and real drafts never merge"
echo "X publishing remains physically DISABLED."
echo "Backup: $BACKUP"
echo
echo "Do not commit yet."
