#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Blockchain-fact card updates v16"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

PATCH_FILES=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/tests/realtime-update-path.mjs"
)

for f in "${PATCH_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v16-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true

  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v16 made no commit/push."
    echo "[FAILED] existing Replit M / D / ?? files were not touched."
  fi

  exit "$code"
}
trap cleanup EXIT

echo "[worktree] clean origin/main -> $TMP"
git worktree add --detach "$TMP" origin/main >/dev/null
cd "$TMP"

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

def load(rel):
    return (APP / rel).read_text()

def save(rel, text):
    (APP / rel).write_text(text)

def replace_once(text, old, new, marker, label):
    if marker and marker in text:
        print(f"[skip] {label}: already installed")
        return text

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"[error] {label}: expected exactly 1 source match, found {count}"
        )

    print(f"[apply] {label}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, replacement, marker, label):
    if marker and marker in text:
        print(f"[skip] {label}: already installed")
        return text

    i = text.find(start)
    if i < 0:
        raise SystemExit(f"[error] {label}: start anchor not found")

    j = text.find(end, i + len(start))
    if j < 0:
        raise SystemExit(f"[error] {label}: end anchor not found")

    print(f"[apply] {label}")
    return text[:i] + replacement + text[j:]


# ===========================================================================
# BACKEND
# ===========================================================================
app = load("app-server.mjs")


# ---------------------------------------------------------------------------
# 1) Decision completion: fact -> event immediately.
# Remove the artificial 25 ms decision refresh timer. Keep the existing V14
# function names so every existing caller/regression remains compatible.
# ---------------------------------------------------------------------------
decision_start = "// MEMEFLOW_DECISION_REVISION_EVENT_V14"
decision_end = "function candidateView(d){"

decision_block = r"""// MEMEFLOW_DECISION_REVISION_EVENT_V14
// MEMEFLOW_DECISION_MICROTASK_EVENT_V16
// Token market mutation and per-user decision completion are separate facts.
// A decision event is emitted immediately after the current JS turn completes;
// there is NO wall-clock refresh delay.
const __mfDecisionRefreshTimersV14=new Set();

function __mfEmitDecisionRefreshV14(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const revision=++__mfLiveTokenRevision;

  try{
    __systemViewEmitV31(
      'decision',
      {
        mint,
        revision,
        updatedAt:Date.now()
      }
    );
  }catch{}
}

function __mfQueueDecisionRefreshV14(mint){
  mint=String(mint||'').trim();
  if(!mint||__mfDecisionRefreshTimersV14.has(mint))return;

  __mfDecisionRefreshTimersV14.add(mint);

  queueMicrotask(()=>{
    __mfDecisionRefreshTimersV14.delete(mint);
    __mfEmitDecisionRefreshV14(mint);
  });
}

"""

app = replace_between(
    app,
    decision_start,
    decision_end,
    decision_block,
    "MEMEFLOW_DECISION_MICROTASK_EVENT_V16",
    "remove 25ms decision timer"
)


# ---------------------------------------------------------------------------
# 2) CREATE event must be emitted AFTER the mint actually exists in store.
# V15/V14 emitted CREATE before direct ingestion, allowing the browser to race
# a one-mint GET against a token that was not stored yet.
# ---------------------------------------------------------------------------
discovery_start = app.find("function startDiscovery(i=0){")
discovery_end = app.find("function shadowValidateSettings", discovery_start)

if discovery_start < 0 or discovery_end < 0:
    raise SystemExit("[error] discovery block boundaries not found")

discovery = app[discovery_start:discovery_end]

if "MEMEFLOW_CREATE_EVENT_MINT_AFTER_INGEST_V16" not in discovery:
    old_emit = """          try{
            __systemViewEmitV31(
              'create',
              {signature:String(sig||''),ts:Date.now()}
            )
          }catch{}

"""
    if old_emit not in discovery:
        raise SystemExit("[error] old pre-ingest CREATE event block not found")

    discovery = discovery.replace(old_emit, "", 1)

    coverage_anchor = """          // MEMEFLOW_CREATE_DECODE_COVERAGE_V1
"""
    if coverage_anchor not in discovery:
        raise SystemExit("[error] create decode coverage anchor not found")

    post_ingest_emit = """          // MEMEFLOW_CREATE_EVENT_MINT_AFTER_INGEST_V16
          // The UI receives CREATE only after the canonical mint exists.
          if(directToken?.mint){
            const createRevision=++__mfLiveTokenRevision;
            try{
              __systemViewEmitV31(
                'create',
                {
                  mint:String(directToken.mint),
                  revision:createRevision,
                  signature:String(sig||''),
                  updatedAt:Number(directToken?.updatedAt||Date.now())
                }
              );
            }catch{}
          }

"""
    discovery = discovery.replace(
        coverage_anchor,
        post_ingest_emit + coverage_anchor,
        1
    )

    app = app[:discovery_start] + discovery + app[discovery_end:]
    print("[apply] CREATE event after canonical mint ingest")
else:
    print("[skip] CREATE event after canonical mint ingest: already installed")


# ---------------------------------------------------------------------------
# 3) System SSE heartbeat must be a real SSE event, not only a comment.
# This lets the browser detect a half-open/stalled Replit/Safari connection and
# reconnect without polling token data.
# ---------------------------------------------------------------------------
route_marker = "// MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4_ROUTE"
route_i = app.find(route_marker)

if route_i < 0:
    raise SystemExit("[error] system SSE route marker not found")

if "MEMEFLOW_SYSTEM_SSE_HEARTBEAT_EVENT_V16" not in app[route_i:route_i+5000]:
    hb_i = app.find("const heartbeat=setInterval(()=>{", route_i)
    hb_end_marker = "heartbeat.unref?.();"
    hb_j = app.find(hb_end_marker, hb_i)

    if hb_i < 0 or hb_j < 0:
        raise SystemExit("[error] system SSE heartbeat block not found")

    hb_j += len(hb_end_marker)

    old_hb = app[hb_i:hb_j]

    if ": v31 " not in old_hb:
        raise SystemExit(
            "[error] found heartbeat block is not the system v31 heartbeat"
        )

    new_hb = r"""// MEMEFLOW_SYSTEM_SSE_HEARTBEAT_EVENT_V16
  const heartbeat=setInterval(()=>{
   try{
    res.write(
     `event: heartbeat\n`+
     `data: ${JSON.stringify({
       type:'heartbeat',
       seq:__systemViewSeqV31,
       ts:Date.now(),
       revision:__mfLiveTokenRevision
     })}\n\n`
    );
   }catch{}
  },15000);
  heartbeat.unref?.();"""

    app = app[:hb_i] + new_hb + app[hb_j:]
    print("[apply] browser-visible SSE heartbeat")
else:
    print("[skip] browser-visible SSE heartbeat: already installed")

save("app-server.mjs", app)


# ===========================================================================
# FRONTEND
# ===========================================================================
ui = load("system-tokens.js")


# ---------------------------------------------------------------------------
# 4) No 3-second display timer. Remove the now-unused REFRESH_MS constant.
# ---------------------------------------------------------------------------
ui = replace_once(
    ui,
    "const PAGE_SIZE = 20;\nconst REFRESH_MS = 3000;\nconst EMPTY_CONFIRMATIONS = 5;",
    "const PAGE_SIZE = 20;\nconst EMPTY_CONFIRMATIONS = 5;\n// MEMEFLOW_NO_DATA_POLL_TIMER_V16",
    "MEMEFLOW_NO_DATA_POLL_TIMER_V16",
    "remove fixed 3-second data timer constant"
)


# ---------------------------------------------------------------------------
# 5) Static identity lock: name/image are immutable after they are resolved once.
# Dynamic chain events must never rewrite them.
# ---------------------------------------------------------------------------
static_anchor = "function tokenTemplate(row, index) {"

static_helpers = r"""// MEMEFLOW_STATIC_TOKEN_IDENTITY_V16
// Token name/image are identity fields, not realtime market fields.
// Resolve each field once per mint, cache it, and never mutate it afterwards.
const TOKEN_STATIC_IDENTITY_V16=new Map();

function __mfLooksFinalTokenNameV16(value,mint=''){
  const name=String(value||'').trim();
  if(!name)return false;

  if(name==='TOKEN')return false;
  if(name===shortMint(mint))return false;
  if(/^COPY\s+[1-9A-HJ-NP-Za-km-z]{4,12}$/i.test(name))return false;

  return true;
}

function __mfLockStaticIdentityV16(
  mint,
  {
    name=null,
    image=null
  }={}
){
  mint=String(mint||'').trim();

  if(!mint){
    return {
      entry:{name:null,image:null},
      nameAdded:false,
      imageAdded:false
    };
  }

  const entry=
    TOKEN_STATIC_IDENTITY_V16.get(mint)||
    {name:null,image:null};

  let nameAdded=false;
  let imageAdded=false;

  if(
    !entry.name &&
    __mfLooksFinalTokenNameV16(name,mint)
  ){
    entry.name=String(name).trim();
    nameAdded=true;
  }

  if(
    !entry.image &&
    typeof image==='string' &&
    image.trim()
  ){
    entry.image=image.trim();
    imageAdded=true;
  }

  TOKEN_STATIC_IDENTITY_V16.set(mint,entry);

  return {
    entry,
    nameAdded,
    imageAdded
  };
}

function __mfStaticIdentityForRowV16(row){
  const mint=String(row?.mint||'').trim();

  const currentName=
    row?.name ||
    row?.metadataName ||
    row?.symbol ||
    row?.metadataSymbol ||
    '';

  const currentImage=imageUrl(row);

  const locked=__mfLockStaticIdentityV16(
    mint,
    {
      name:currentName,
      image:currentImage
    }
  ).entry;

  return {
    name:
      locked.name ||
      currentName ||
      shortMint(mint),
    image:
      locked.image ||
      currentImage ||
      ''
  };
}


"""

if "MEMEFLOW_STATIC_TOKEN_IDENTITY_V16" not in ui:
    i = ui.find(static_anchor)
    if i < 0:
        raise SystemExit("[error] tokenTemplate anchor not found")

    ui = ui[:i] + static_helpers + ui[i:]
    print("[apply] immutable token name/image identity cache")
else:
    print("[skip] immutable token name/image identity cache: already installed")


old_avatar = """  const avatar =
    imageUrl(row);

  const pnl =
"""

new_avatar = """  const staticIdentity =
    __mfStaticIdentityForRowV16(row);

  const avatar =
    staticIdentity.image;

  const staticName =
    staticIdentity.name;

  const pnl =
"""

ui = replace_once(
    ui,
    old_avatar,
    new_avatar,
    "const staticName =",
    "token template uses locked static identity"
)

old_name_expr = """                ${escapeHtml(row?.name || row?.metadataName || row?.symbol || row?.metadataSymbol || shortMint(row?.mint))}
"""

new_name_expr = """                ${escapeHtml(staticName)}
"""

ui = replace_once(
    ui,
    old_name_expr,
    new_name_expr,
    "${escapeHtml(staticName)}",
    "token template locks displayed name"
)


# ---------------------------------------------------------------------------
# 6) Metadata hydrator may fill a missing static name/image ONCE, never refresh it.
# ---------------------------------------------------------------------------
meta_apply_start = "function applyTokenMetaV16(card,meta){"
meta_apply_end = "async function hydrateTokenCardsV16(){"

meta_apply = r"""function applyTokenMetaV16(card,meta){
  if(!card||!meta){
    return;
  }

  const mint=
    String(card.dataset.mint||'').trim();

  if(!mint){
    return;
  }

  const displayName=
    String(
      meta.name||
      meta.metadataName||
      meta.symbol||
      meta.metadataSymbol||
      ''
    ).trim();

  const image=
    String(meta.image||'').trim();

  const locked=
    __mfLockStaticIdentityV16(
      mint,
      {
        name:displayName,
        image
      }
    );

  if(locked.nameAdded){
    const nameEl=
      card.querySelector('.token-name');

    if(nameEl){
      nameEl.textContent=
        locked.entry.name;
    }
  }

  const link=
    card.querySelector('.token-pump-link');

  if(link&&mint){
    link.href=
      'https://pump.fun/coin/'+
      encodeURIComponent(mint);
  }

  if(!locked.imageAdded){
    return;
  }

  const avatar=
    card.querySelector('.token-avatar');

  if(!avatar){
    return;
  }

  let img=
    avatar.querySelector('img');

  if(!img){
    img=document.createElement('img');
    img.alt='';
    img.loading='lazy';
    img.decoding='async';

    img.addEventListener(
      'error',
      ()=>{
        avatar.classList.add('is-broken');
      }
    );

    avatar.prepend(img);
  }

  avatar.classList.remove('is-broken');
  img.src=locked.entry.image;
  avatar.classList.add('has-image');
  avatar.classList.remove('fallback-only');
}

"""

ui = replace_between(
    ui,
    meta_apply_start,
    meta_apply_end,
    meta_apply,
    "locked.nameAdded",
    "one-time metadata identity hydration"
)


media_apply_start = "function applyTokenMediaV25(card, meta) {"
media_apply_end = "function visibleCardsV25() {"

media_apply = r"""function applyTokenMediaV25(card, meta) {
  if (!card || !meta) {
    return;
  }

  const mint=String(
    card.dataset.mint||''
  ).trim();

  if(!mint){
    return;
  }

  const locked=
    __mfLockStaticIdentityV16(
      mint,
      {
        name:meta.name||null,
        image:meta.image||null
      }
    );

  if(locked.nameAdded){
    const name=
      card.querySelector(
        '.token-name, .token-mint'
      );

    if(name){
      name.textContent=locked.entry.name;
    }
  }

  if(!locked.imageAdded){
    return;
  }

  const avatar=
    card.querySelector('.token-avatar');

  if(!avatar){
    return;
  }

  let image=
    avatar.querySelector('img');

  if(!image){
    image=document.createElement('img');
    image.alt='';
    image.loading='lazy';
    image.decoding='async';
    image.referrerPolicy='no-referrer';
    avatar.prepend(image);
  }

  image.onload=()=>{
    avatar.classList.add('has-image');
    avatar.classList.remove(
      'is-broken',
      'fallback-only'
    );
  };

  image.onerror=()=>{
    avatar.classList.remove('has-image');
    avatar.classList.add('is-broken');
  };

  image.src=locked.entry.image;
}

"""

ui = replace_between(
    ui,
    media_apply_start,
    media_apply_end,
    media_apply,
    "locked.entry.image",
    "one-time fallback media identity hydration"
)


# ---------------------------------------------------------------------------
# 7) Metadata/media work only when card structure changes. Remove all repeating
# metadata intervals, body-wide mutation observer and scroll-triggered hydration.
# ---------------------------------------------------------------------------
old_v16_observer = """  const observerV16=
    new MutationObserver(
      ()=>{
        queueMicrotask(
          hydrateTokenCardsV16
        );
      }
    );
"""

new_v16_observer = """  const observerV16=
    new MutationObserver(
      ()=>{
        queueMicrotask(
          ()=>{
            void hydrateTokenCardsV16();
            void hydrateTokenMediaV25();
          }
        );
      }
    );
"""

ui = replace_once(
    ui,
    old_v16_observer,
    new_v16_observer,
    "void hydrateTokenMediaV25();",
    "metadata only on token-list structural mutation"
)

old_meta_timers = """setTimeout(
  hydrateTokenCardsV16,
  250
);

setInterval(
  hydrateTokenCardsV16,
  1800
);


"""

ui = replace_once(
    ui,
    old_meta_timers,
    """// MEMEFLOW_NO_METADATA_POLLING_V16
// Initial/new-card hydration is driven by tokenList structural mutation only.


""",
    "MEMEFLOW_NO_METADATA_POLLING_V16",
    "remove 1.8s metadata polling"
)

ui = replace_once(
    ui,
    "  await loadTokenRowsV25();",
    "  await loadTokenRowsV25(true);",
    "await loadTokenRowsV25(true);",
    "media fallback loads only for structural card changes"
)

media_sched_start = "let tokenMediaTimerV25 = 0;"
media_sched_end = "// MEMEFLOW_DEX_TOKEN_FLOW_V26"

media_sched = r"""// MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16
// No body-wide observer, scroll refresh, or 6-second media timer.
// TOKEN_STATIC_IDENTITY_V16 is hydrated by the tokenList observer only.

"""

ui = replace_between(
    ui,
    media_sched_start,
    media_sched_end,
    media_sched,
    "MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16",
    "remove repeating token-media work"
)


# ---------------------------------------------------------------------------
# 8) Replace V15 position loader with safe request helpers + event-driven
# Open Position refresh. Timeouts are ONLY request-failure safety, not refresh
# cadence.
# ---------------------------------------------------------------------------
position_start = "// MEMEFLOW_OPEN_POSITION_FIXED_POLL_V15"
position_end = "async function loadTokens() {"

position_block = r"""// MEMEFLOW_EVENT_FETCH_SAFETY_V16
let __mfLastRealtimeRevision=0;

async function __mfFetchJsonV16(
  url,
  {
    timeoutMs=8000
  }={}
){
  const controller=new AbortController();

  const timeout=setTimeout(
    ()=>controller.abort(),
    timeoutMs
  );

  try{
    const response=await fetch(
      url,
      {
        cache:'no-store',
        credentials:'same-origin',
        signal:controller.signal
      }
    );

    if(!response.ok){
      const error=new Error(
        `HTTP ${response.status}`
      );
      error.status=response.status;
      throw error;
    }

    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16
let __mfPositionRequestActiveV16=false;
let __mfPositionRequestPendingV16=false;

async function __mfRefreshOpenPositionsV16({
  patchDom=true
}={}){
  if(__mfPositionRequestActiveV16){
    __mfPositionRequestPendingV16=true;
    return;
  }

  __mfPositionRequestActiveV16=true;

  try{
    do{
      __mfPositionRequestPendingV16=false;

      const beforeOpen=new Set(
        state.positions
          .filter(
            position=>
              String(position?.status||'').toUpperCase()==='OPEN'
          )
          .map(position=>String(position?.mint||''))
          .filter(Boolean)
      );

      const payload=
        await __mfFetchJsonV16(
          '/api/paper/positions?_='+
          Date.now()
        );

      state.positions=
        (
          Array.isArray(payload?.positions)
            ? payload.positions
            : []
        ).filter(
          position=>
            position?.mint &&
            String(position?.status||'').toUpperCase()==='OPEN'
        );

      const afterOpen=new Set(
        state.positions
          .map(position=>String(position?.mint||''))
          .filter(Boolean)
      );

      const membershipChanged=
        beforeOpen.size!==afterOpen.size ||
        [...beforeOpen].some(
          mint=>!afterOpen.has(mint)
        );

      if(membershipChanged){
        // Opening/closing a position is a structural fact.
        render();
      }else if(patchDom){
        for(const mint of afterOpen){
          __mfPatchMutableCardV16(mint);
        }
      }
    }while(__mfPositionRequestPendingV16);
  }catch(error){
    console.warn(
      '[token-flow] event-driven position refresh failed',
      error
    );
  }finally{
    __mfPositionRequestActiveV16=false;
  }
}


"""

ui = replace_between(
    ui,
    position_start,
    position_end,
    position_block,
    "MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16",
    "replace 3s Open Position poll with event-driven refresh"
)


# ---------------------------------------------------------------------------
# 9) Full feed fetch is structural/reconciliation only. Give it an abort timeout
# so one hung Replit request can never leave state.loading=true forever.
# ---------------------------------------------------------------------------
old_feed_fetch = """    const response = await fetch(
      '/api/system/live-token-states?limit=200&_=' + Date.now(),
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
"""

new_feed_fetch = """    const payload =
      await __mfFetchJsonV16(
        '/api/system/live-token-states?limit=200&_=' +
        Date.now()
      );
"""

ui = replace_once(
    ui,
    old_feed_fetch,
    new_feed_fetch,
    "await __mfFetchJsonV16(\n        '/api/system/live-token-states",
    "protect structural feed request from permanent hang"
)


# ---------------------------------------------------------------------------
# 10) Manual button no longer references V15 polling. Initial load is performed
# after event-stream state is initialized below.
# ---------------------------------------------------------------------------
old_manual = """$('refreshButton')
  .addEventListener(
    'click',
    __mfPollAllV15
  );

__mfPollAllV15();

"""

new_manual = """$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfStructuralRefreshV16();
    }
  );

// Initial reconciliation starts after the V16 stream state is initialized.

"""

ui = replace_once(
    ui,
    old_manual,
    new_manual,
    "void __mfStructuralRefreshV16();",
    "manual refresh becomes one structural reconciliation"
)


# ---------------------------------------------------------------------------
# 11) Event-by-fact card engine. No data polling interval.
# ---------------------------------------------------------------------------
rt_start = "/* MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15"
rt_end = "/* ===== LIVE TOKEN METADATA V16 ===== */"

rt_block = r"""/* MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16
 * DISPLAY CONTRACT
 *
 * Blockchain fact arrives -> update that mint.
 * Decision write completes -> update that mint.
 * Open-position mint trades -> refresh positions immediately.
 * CREATE -> fetch/insert that new mint.
 * REMOVE -> remove that mint.
 *
 * There is NO 3-second/30-second data polling loop.
 *
 * A 35-second timer exists ONLY as an SSE transport watchdog. It does not
 * refresh token data. The server emits a heartbeat every 15 seconds; missing
 * heartbeats force a stream reconnect and one reconciliation.
 */
const __MF_STREAM_WATCHDOG_MS_V16=35000;

let __mfTokenStateStreamV16=null;
let __mfStreamWatchdogV16=null;
let __mfStructuralRefreshActiveV16=false;
let __mfStructuralRefreshPendingV16=false;

const __mfMintRefreshStateV16=new Map();

function __mfTouchStreamV16(){
  if(__mfStreamWatchdogV16!==null){
    clearTimeout(__mfStreamWatchdogV16);
  }

  __mfStreamWatchdogV16=setTimeout(
    ()=>{
      console.warn(
        '[token-flow] SSE heartbeat stale; reconnecting'
      );

      try{
        __mfTokenStateStreamV16?.close?.();
      }catch{}

      __mfTokenStateStreamV16=null;
      __mfConnectTokenStateStreamV16();
    },
    __MF_STREAM_WATCHDOG_MS_V16
  );
}

function __mfEventPayloadV16(event){
  if(!event?.data){
    return {};
  }

  try{
    return JSON.parse(event.data)||{};
  }catch{
    return {};
  }
}

function __mfKnownScannerMintV16(mint){
  mint=String(mint||'');

  return state.rows.some(
    row=>String(row?.mint||'')===mint
  );
}

function __mfKnownOpenMintV16(mint){
  mint=String(mint||'');

  return state.positions.some(
    position=>
      String(position?.mint||'')===mint &&
      String(position?.status||'').toUpperCase()==='OPEN'
  );
}

function __mfPreserveIdentityV16(previous,next){
  if(!next||typeof next!=='object'){
    return next;
  }

  if(!previous||typeof previous!=='object'){
    return next;
  }

  const staticFields=[
    'name',
    'metadataName',
    'symbol',
    'metadataSymbol',
    'image',
    'imageUrl',
    'logo',
    'logoUrl',
    'logoURI'
  ];

  const out={...next};

  for(const key of staticFields){
    if(
      previous[key]!==null &&
      previous[key]!==undefined &&
      previous[key]!==''
    ){
      out[key]=previous[key];
    }
  }

  return out;
}

function __mfMutableRowForMintV16(mint){
  mint=String(mint||'');

  return mergedRows().find(
    row=>String(row?.mint||'')===mint
  )||null;
}

function __mfSetStrongByLabelV16(
  card,
  selector,
  label,
  value,
  className=null
){
  for(const node of card.querySelectorAll(selector)){
    const labelNode=node.querySelector('span');
    const strong=node.querySelector('strong');

    if(
      !labelNode ||
      !strong ||
      labelNode.textContent.trim()!==label
    ){
      continue;
    }

    strong.textContent=String(value);

    if(className!==null){
      strong.className=className;
    }

    return true;
  }

  return false;
}

function __mfSetDetailByLabelV16(
  card,
  label,
  value
){
  for(const block of card.querySelectorAll('.detail-block')){
    const labelNode=block.querySelector('span');
    const body=block.querySelector('p');

    if(
      labelNode?.textContent.trim()===label &&
      body
    ){
      body.textContent=String(value);
      return true;
    }
  }

  return false;
}

// MEMEFLOW_MUTABLE_DOM_ONLY_V16
function __mfPatchMutableCardV16(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const row=__mfMutableRowForMintV16(mint);
  if(!row)return;

  const card=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].find(
    node=>String(node.dataset.mint||'')===mint
  );

  if(!card){
    // Non-visible pages still get updated in state.rows/state.positions.
    return;
  }

  const key=stateKey(row?.decision?.state);
  const label=stateLabel(row?.decision?.state);

  // Update state/border, but NEVER token-name/token-avatar/source links.
  for(const stateClass of [
    'open',
    'ready',
    'watch',
    'waiting',
    'blocked'
  ]){
    card.classList.remove(stateClass);
  }
  card.classList.add(key);

  const stateNode=card.querySelector('.token-state');
  if(stateNode){
    stateNode.textContent=label;
    stateNode.className=`token-state ${key}`;
  }

  const score=tokenScore(row);
  const pnl=
    key==='open'
      ? openPositionPnlPct(row?.__openPosition)
      : null;

  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    key==='open'?'P&L':'Score',
    key==='open'
      ? formatSignedPnlPct(pnl)
      : (finite(score)?fmt(score,0):'—'),
    key==='open'
      ? openPositionPnlClass(pnl)
      : ''
  );

  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Holders',
    holderCount(row)
  );

  const top=top10(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Top 10',
    finite(top)?`${fmt(top,1)}%`:'—'
  );

  const pressure=buyPressure(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Buy pressure',
    finite(pressure)?`${fmt(pressure,2)}×`:'—'
  );

  const age=tokenAge(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Age',
    finite(age)?`${fmt(age,1)}m`:'—'
  );

  const price=priceSol(row);
  __mfSetStrongByLabelV16(
    card,
    '.token-metric',
    'Price SOL',
    finite(price)?fmt(price,9):'—'
  );

  const metrics=
    key==='open'
      ? openPositionMetrics(row)
      : regularMarketMetrics(row);

  const stripSelector=
    key==='open'
      ? '.mf-open-market-stat'
      : '.mf-regular-market-stat';

  const stripAge=
    key==='open'
      ? (
          metrics?.ageMinutes ??
          tokenAge(row)
        )
      : metrics?.ageMinutes;

  const stripHolders=
    key==='open'
      ? (
          metrics?.holderCount ??
          holderCount(row)
        )
      : metrics?.holderCount;

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Age',
    compactTokenAge(stripAge)
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Holders',
    stripHolders??'—'
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Vol 5m',
    key==='open'
      ? openVolumeLabel(metrics)
      : regularVolumeLabel(metrics)
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'Tx 5m',
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m,0)
      : '—'
  );

  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    'MC',
    key==='open'
      ? openMarketCapLabel(metrics)
      : regularMarketCapLabel(metrics)
  );

  const move=metrics?.priceChange5mPct;
  __mfSetStrongByLabelV16(
    card,
    stripSelector,
    '5m%',
    signedPercent(move),
    marketMoveClass(move)
  );

  __mfSetDetailByLabelV16(
    card,
    'Primary signal',
    tokenReason(row)
  );

  __mfSetDetailByLabelV16(
    card,
    'Risk gates',
    tokenGateSummary(row)
  );

  const dev=developer(row);
  __mfSetDetailByLabelV16(
    card,
    'Developer',
    finite(dev)?`${fmt(dev,2)}%`:'—'
  );

  renderCounts();

  $('lastUpdate').textContent=
    `Live ${new Date().toLocaleTimeString(
      [],
      {
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
      }
    )}`;
}

async function __mfStructuralRefreshV16(){
  if(__mfStructuralRefreshActiveV16){
    __mfStructuralRefreshPendingV16=true;
    return;
  }

  __mfStructuralRefreshActiveV16=true;

  try{
    do{
      __mfStructuralRefreshPendingV16=false;

      // Positions first so one render of the feed already knows OPEN state.
      await __mfRefreshOpenPositionsV16({
        patchDom:false
      });

      await loadTokens();
    }while(__mfStructuralRefreshPendingV16);
  }finally{
    __mfStructuralRefreshActiveV16=false;
  }
}

async function __mfRefreshMintNowV16(
  mint,
  {
    allowInsert=false
  }={}
){
  mint=String(mint||'').trim();
  if(!mint)return;

  let slot=__mfMintRefreshStateV16.get(mint);

  if(!slot){
    slot={
      inflight:false,
      pending:false,
      allowInsert:false
    };

    __mfMintRefreshStateV16.set(mint,slot);
  }

  slot.allowInsert=
    slot.allowInsert||allowInsert;

  if(slot.inflight){
    slot.pending=true;
    return;
  }

  slot.inflight=true;

  try{
    do{
      slot.pending=false;

      let payload=null;

      try{
        payload=
          await __mfFetchJsonV16(
            '/api/system/live-token-state?mint='+
            encodeURIComponent(mint)+
            '&_='+
            Date.now()
          );
      }catch(error){
        if(error?.status===404){
          const before=state.rows.length;

          state.rows=state.rows.filter(
            row=>String(row?.mint||'')!==mint
          );

          if(state.rows.length!==before){
            render();
          }

          return;
        }

        throw error;
      }

      const revision=
        Number(payload?.liveRevision||0);

      if(
        Number.isFinite(revision) &&
        revision>__mfLastRealtimeRevision
      ){
        __mfLastRealtimeRevision=revision;
      }

      const incoming=
        payload?.row
          ? canonicalDecisionRow(payload.row)
          : null;

      if(!incoming?.mint){
        continue;
      }

      const index=state.rows.findIndex(
        row=>String(row?.mint||'')===mint
      );

      if(index>=0){
        const previous=state.rows[index];

        state.rows[index]=
          canonicalDecisionRow(
            __mfPreserveIdentityV16(
              previous,
              incoming
            )
          );

        __mfPatchMutableCardV16(mint);
      }else if(slot.allowInsert){
        state.rows.push(incoming);

        // Keep the browser feed bounded. This is display-only; scanner/trading
        // inventory remains unchanged.
        state.rows=
          sortRows(state.rows).slice(0,200);

        render();
      }
    }while(slot.pending);
  }catch(error){
    console.warn(
      '[token-flow] fact refresh failed',
      mint,
      error
    );
  }finally{
    slot.inflight=false;
    slot.allowInsert=false;

    if(!slot.pending){
      __mfMintRefreshStateV16.delete(mint);
    }
  }
}

function __mfRefreshMintV16(
  mint,
  options={}
){
  // No delay/coalesce timer. The only coalescing is in-flight backpressure:
  // if another fact arrives while the GET is active, exactly one follow-up GET
  // runs immediately after it finishes.
  void __mfRefreshMintNowV16(
    mint,
    options
  );
}

function __mfHandleTokenFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint)return;

  if(__mfKnownScannerMintV16(mint)){
    __mfRefreshMintV16(mint);
  }

  if(__mfKnownOpenMintV16(mint)){
    void __mfRefreshOpenPositionsV16();
  }
}

function __mfHandleDecisionFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint){
    void __mfStructuralRefreshV16();
    return;
  }

  __mfRefreshMintV16(
    mint,
    {allowInsert:true}
  );

  if(__mfKnownOpenMintV16(mint)){
    void __mfRefreshOpenPositionsV16();
  }
}

function __mfHandleCreateFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint){
    void __mfStructuralRefreshV16();
    return;
  }

  // Server V16 emits CREATE only after canonical ingest, so this GET cannot
  // race a not-yet-created store row.
  __mfRefreshMintV16(
    mint,
    {allowInsert:true}
  );
}

function __mfHandleRemovedFactV16(event){
  __mfTouchStreamV16();

  const payload=__mfEventPayloadV16(event);
  const mint=String(payload?.mint||'').trim();

  if(!mint)return;

  const rowsBefore=state.rows.length;
  const positionsBefore=state.positions.length;

  state.rows=state.rows.filter(
    row=>String(row?.mint||'')!==mint
  );

  state.positions=state.positions.filter(
    position=>String(position?.mint||'')!==mint
  );

  if(
    state.rows.length!==rowsBefore ||
    state.positions.length!==positionsBefore
  ){
    render();
  }
}

function __mfConnectTokenStateStreamV16(){
  if(typeof EventSource==='undefined'){
    console.warn(
      '[token-flow] EventSource unavailable'
    );
    return;
  }

  try{
    __mfTokenStateStreamV16?.close?.();
  }catch{}

  const source=
    new EventSource('/api/system/stream');

  __mfTokenStateStreamV16=source;

  source.addEventListener(
    'heartbeat',
    ()=>{
      __mfTouchStreamV16();
    }
  );

  source.addEventListener(
    'hello',
    ()=>{
      __mfTouchStreamV16();

      // One reconciliation after (re)connect recovers any facts missed while
      // the transport was unavailable. It is NOT periodic polling.
      void __mfStructuralRefreshV16();
    }
  );

  source.addEventListener(
    'token',
    __mfHandleTokenFactV16
  );

  source.addEventListener(
    'decision',
    __mfHandleDecisionFactV16
  );

  source.addEventListener(
    'create',
    __mfHandleCreateFactV16
  );

  source.addEventListener(
    'token_removed',
    __mfHandleRemovedFactV16
  );

  source.onopen=()=>{
    __mfTouchStreamV16();
  };

  source.onerror=()=>{
    // Native EventSource automatically retries. The heartbeat watchdog handles
    // half-open connections where no error event is delivered.
    console.warn(
      '[token-flow] SSE reconnecting'
    );
  };

  __mfTouchStreamV16();
}

__mfConnectTokenStateStreamV16();

// First page snapshot. After this, data changes are fact/event-driven.
void __mfStructuralRefreshV16();

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(document.hidden){
      return;
    }

    // iOS may suspend sockets while the app is backgrounded. Reconcile once
    // when returning, then continue by events.
    if(
      !__mfTokenStateStreamV16 ||
      __mfTokenStateStreamV16.readyState===EventSource.CLOSED
    ){
      __mfConnectTokenStateStreamV16();
    }

    void __mfStructuralRefreshV16();
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfStreamWatchdogV16!==null){
      clearTimeout(__mfStreamWatchdogV16);
    }

    try{
      __mfTokenStateStreamV16?.close?.();
    }catch{}
  },
  {once:true}
);



"""

ui = replace_between(
    ui,
    rt_start,
    rt_end,
    rt_block,
    "MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16",
    "replace fixed polling with blockchain-fact event stream"
)

save("system-tokens.js", ui)


# ===========================================================================
# CACHE BUSTER
# ===========================================================================
html = load("system-tokens.html")

if "event-fact-v16-20260827" not in html:
    html2, count = re.subn(
        r'(/system-tokens\.js\?v=)[^"\']+',
        r'\1event-fact-v16-20260827',
        html,
        count=1
    )

    if count != 1:
        raise SystemExit(
            f"[error] cache-buster: expected one system-tokens.js URL, found {count}"
        )

    html = html2
    print("[apply] v16 frontend cache-buster")
else:
    print("[skip] v16 frontend cache-buster")

save("system-tokens.html", html)


# ===========================================================================
# REGRESSION TEST
# ===========================================================================
test = load("tests/realtime-update-path.mjs")

test_start = "// MEMEFLOW_STABLE_3S_UI_REFRESH_TEST_V15"
test_end = "// MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1"

new_test = r"""// MEMEFLOW_BLOCKCHAIN_FACT_UI_TEST_V16
// Browser cards update from actual backend facts. There is no token-data polling
// cadence. The only timer is a transport/request safety mechanism.
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');

assert.match(app,/let __mfLiveTokenRevision=0;/);
assert.match(app,/const __liveRevision=\+\+__mfLiveTokenRevision;/);
assert.match(app,/revision:__liveRevision/);
assert.match(app,/MEMEFLOW_DECISION_MICROTASK_EVENT_V16/);
assert.match(app,/queueMicrotask\(\(\)=>\{/);
assert.match(app,/MEMEFLOW_CREATE_EVENT_MINT_AFTER_INGEST_V16/);
assert.match(app,/mint:String\(directToken\.mint\)/);
assert.match(app,/MEMEFLOW_SYSTEM_SSE_HEARTBEAT_EVENT_V16/);
assert.match(app,/event: heartbeat/);
assert.match(app,/MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14/);

assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16/);
assert.match(tokenUi,/new EventSource\('\/api\/system\/stream'\)/);
assert.match(tokenUi,/source\.addEventListener\([\s\S]*?'heartbeat'/);
assert.match(tokenUi,/source\.addEventListener\([\s\S]*?'token'/);
assert.match(tokenUi,/source\.addEventListener\([\s\S]*?'decision'/);
assert.match(tokenUi,/source\.addEventListener\([\s\S]*?'create'/);
assert.match(tokenUi,/\/api\/system\/live-token-state\?mint=/);
assert.match(tokenUi,/MEMEFLOW_MUTABLE_DOM_ONLY_V16/);
assert.match(tokenUi,/MEMEFLOW_STATIC_TOKEN_IDENTITY_V16/);
assert.match(tokenUi,/MEMEFLOW_NO_METADATA_POLLING_V16/);
assert.match(tokenUi,/MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16/);
assert.match(tokenUi,/MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16/);
assert.match(tokenUi,/__mfKnownOpenMintV16/);
assert.match(tokenUi,/void __mfRefreshOpenPositionsV16\(\)/);

assert.doesNotMatch(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15/);
assert.doesNotMatch(tokenUi,/setInterval\([\s\S]*?loadTokens/);
assert.doesNotMatch(tokenUi,/setInterval\([\s\S]*?hydrateTokenCardsV16/);
assert.doesNotMatch(tokenUi,/setInterval\([\s\S]*?hydrateTokenMediaV25/);
assert.doesNotMatch(tokenUi,/MINT_REFRESH_COALESCE_MS_V14/);
assert.doesNotMatch(tokenUi,/LIVE_RECONCILE_MS_V14/);

"""

test = replace_between(
    test,
    test_start,
    test_end,
    new_test,
    "MEMEFLOW_BLOCKCHAIN_FACT_UI_TEST_V16",
    "event-by-fact realtime regression contract"
)

old_cache = r"""assert.match(tokenHtml,/system-tokens\.js\?v=stable-poll-v15-20260827/);"""
new_cache = r"""assert.match(tokenHtml,/system-tokens\.js\?v=event-fact-v16-20260827/);"""

if old_cache in test:
    test = test.replace(old_cache, new_cache, 1)
    print("[apply] test cache-buster -> v16")
elif new_cache in test:
    print("[skip] test cache-buster -> v16")
else:
    raise SystemExit("[error] V15 cache-buster assertion not found")

old_marker = r"""assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15/);"""
if old_marker in test:
    test = test.replace(
        old_marker,
        r"""assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16/);""",
        1
    )
    print("[apply] replace residual V15 test marker")
elif "MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16" in test:
    print("[skip] residual V15 test marker")

save("tests/realtime-update-path.mjs", test)


# ===========================================================================
# INSTALL-TIME INVARIANTS
# ===========================================================================
app = load("app-server.mjs")
ui = load("system-tokens.js")
html = load("system-tokens.html")

for needle in [
    "MEMEFLOW_DECISION_MICROTASK_EVENT_V16",
    "MEMEFLOW_CREATE_EVENT_MINT_AFTER_INGEST_V16",
    "mint:String(directToken.mint)",
    "MEMEFLOW_SYSTEM_SSE_HEARTBEAT_EVENT_V16",
    "MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14",
    "MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13",
]:
    if needle not in app:
        raise SystemExit(f"[verify] backend invariant missing: {needle}")

for forbidden in [
    "const timer=setTimeout(()=>{\n    __mfDecisionRefreshTimersV14.delete(mint);",
]:
    if forbidden in app:
        raise SystemExit(f"[verify] obsolete decision delay remains: {forbidden}")

for needle in [
    "MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16",
    "MEMEFLOW_MUTABLE_DOM_ONLY_V16",
    "MEMEFLOW_STATIC_TOKEN_IDENTITY_V16",
    "MEMEFLOW_NO_METADATA_POLLING_V16",
    "MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16",
    "MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16",
    "new EventSource('/api/system/stream')",
    "/api/system/live-token-state?mint=",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] frontend invariant missing: {needle}")

for forbidden in [
    "MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15",
    "MINT_REFRESH_COALESCE_MS_V14",
    "LIVE_RECONCILE_MS_V14",
    "setInterval(\n  hydrateTokenCardsV16",
    "setInterval(\n  hydrateTokenMediaV25",
]:
    if forbidden in ui:
        raise SystemExit(f"[verify] obsolete polling path remains: {forbidden}")

if "event-fact-v16-20260827" not in html:
    raise SystemExit("[verify] v16 cache-buster missing")

# CREATE must still establish the mint before same-tx TradeEvent ingestion.
disc = app[
    app.find("function startDiscovery(i=0){"):
    app.find("function shadowValidateSettings")
]
create_at = disc.find("__ingestPumpCreateEventDirect(")
trade_at = disc.find("__pumpLiveTradeFeed?.ingestLogs?.(")
emit_at = disc.find("MEMEFLOW_CREATE_EVENT_MINT_AFTER_INGEST_V16")

if not (create_at >= 0 and emit_at > create_at and trade_at > emit_at):
    raise SystemExit(
        "[verify] CREATE ordering must be ingest -> UI create event -> trade ingest"
    )

print("[verify] fact-driven cards + immutable identity + continuous SSE OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js

echo "[check] exact realtime regression FIRST"
node tests/realtime-update-path.mjs

echo "[check] scanner/feed/trading regressions"
node tests/fresh-session-scanner.mjs
node tests/live-market-truth.mjs
node tests/feed-ranking.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/strict-entry-admission.mjs

echo "[check] FULL npm test"
npm test

echo "[check] benchmark"
npm run benchmark

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v16 is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: update token cards only on blockchain facts"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

# ===========================================================================
# Sync verified files into active Replit workspace.
# ===========================================================================
cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v16-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for f in "${PATCH_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

LOCAL_HEAD="$(git rev-parse HEAD)"

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  git restore --staged --worktree -- "${PATCH_FILES[@]}" 2>/dev/null || true

  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified v16"
  else
    echo "[local] fast-forward blocked; syncing only v16 files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only v16 files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- no 3-second/30-second token-data polling"
echo "- blockchain token event updates only that mint"
echo "- decision completion updates only that mint"
echo "- OPEN POSITION refresh runs only when its mint receives a fact"
echo "- name/image resolve once and are then immutable"
echo "- no 1.8s/6s metadata/media refresh loops"
echo "- SSE has a real 15s heartbeat + stale-transport reconnect watchdog"
echo "- reconnect/background resume performs one reconciliation, not polling"
echo "- full npm test AND benchmark passed before push"
echo
echo "IMPORTANT: app-server.mjs changed. After DONE do one Replit Stop -> Run,"
echo "then refresh the browser page once."
