#!/usr/bin/env bash
set -euo pipefail

echo "[patch] MEMEFLOW OWNER ACCESS UI FIX"

if [ -f "/home/runner/workspace/memeflow-app/owner-intelligence.js" ]; then
  APP="/home/runner/workspace/memeflow-app"
elif [ -f "./memeflow-app/owner-intelligence.js" ]; then
  APP="$(cd ./memeflow-app && pwd)"
else
  echo "[patch] ERROR: owner-intelligence files not found"
  exit 1
fi

HTML="$APP/owner-intelligence.html"
JS="$APP/owner-intelligence.js"
CSS="$APP/owner-intelligence.css"

STAMP="$(date +%Y%m%d-%H%M%S)"

cp "$HTML" "$HTML.owner-access-$STAMP.bak"
cp "$JS" "$JS.owner-access-$STAMP.bak"
cp "$CSS" "$CSS.owner-access-$STAMP.bak"

# ------------------------------------------------------------
# HTML: replace simple access error with secure claim panel
# ------------------------------------------------------------
python3 - "$HTML" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

MARKER="MEMEFLOW_OWNER_ACCESS_UI_V1"

if MARKER in text:
    print("[patch] HTML already patched")
    raise SystemExit(0)

old='''    <div
      id="accessError"
      class="oi-access"
      hidden
    >
      OWNER ACCESS REQUIRED
    </div>'''

new='''    <!-- MEMEFLOW_OWNER_ACCESS_UI_V1 -->
    <section
      id="accessError"
      class="oi-access oi-owner-login"
      hidden
    >
      <div class="oi-owner-lock">OWNER ONLY</div>

      <h2>OWNER ACCESS REQUIRED</h2>

      <p>
        This dashboard contains platform-wide trading analytics
        and owner controls.
      </p>

      <div class="oi-owner-key-wrap">
        <input
          id="ownerAccessKey"
          type="password"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Owner Access Key"
        >

        <button
          id="ownerUnlockBtn"
          class="oi-btn primary"
          type="button"
        >
          UNLOCK OWNER
        </button>
      </div>

      <div
        id="ownerAccessMessage"
        class="oi-owner-access-message"
      ></div>

      <small>
        The key is sent only to MEMEFLOW's existing
        /api/owner/claim endpoint and is not stored in this page.
      </small>
    </section>'''

if old not in text:
    raise SystemExit(
        "[patch] ERROR: existing access panel not found"
    )

text=text.replace(old,new,1)
path.write_text(text,encoding="utf-8")
print("[patch] HTML updated")
PY

# ------------------------------------------------------------
# JS: use existing /api/owner/claim backend
# ------------------------------------------------------------
cat >> "$JS" <<'JS'

/* =========================================================
   MEMEFLOW_OWNER_ACCESS_UI_V1
   Uses existing protected /api/owner/claim.
   Does not weaken owner authorization.
   ========================================================= */

async function mfClaimOwnerAccess(){
  const input=document.getElementById('ownerAccessKey');
  const button=document.getElementById('ownerUnlockBtn');
  const message=document.getElementById('ownerAccessMessage');

  const accessKey=String(input?.value||'').trim();

  if(!accessKey){
    if(message){
      message.textContent='Enter the Owner Access Key.';
      message.dataset.state='error';
    }
    return;
  }

  if(button){
    button.disabled=true;
    button.textContent='VERIFYING…';
  }

  if(message){
    message.textContent='Verifying owner access…';
    message.dataset.state='working';
  }

  try{
    const response=await fetch(
      '/api/owner/claim',
      {
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{
          'content-type':'application/json',
          'accept':'application/json'
        },
        body:JSON.stringify({
          accessKey
        })
      }
    );

    let payload={};

    try{
      payload=await response.json();
    }catch{}

    if(
      !response.ok ||
      payload?.isOwner!==true
    ){
      throw new Error(
        payload?.message ||
        payload?.error ||
        'Owner access was not accepted.'
      );
    }

    // Never retain the owner key in the DOM longer than necessary.
    if(input){
      input.value='';
    }

    if(message){
      message.textContent='OWNER VERIFIED · opening dashboard…';
      message.dataset.state='success';
    }

    // Same session cookie now owns the grant.
    setTimeout(
      ()=>window.location.reload(),
      250
    );

  }catch(error){
    if(input){
      input.value='';
      input.focus();
    }

    if(message){
      message.textContent=
        'Owner verification failed. Check the Owner Access Key.';
      message.dataset.state='error';
    }

  }finally{
    if(button){
      button.disabled=false;
      button.textContent='UNLOCK OWNER';
    }
  }
}

function mfBindOwnerAccess(){
  const button=
    document.getElementById('ownerUnlockBtn');

  const input=
    document.getElementById('ownerAccessKey');

  if(button && !button.dataset.bound){
    button.dataset.bound='1';

    button.addEventListener(
      'click',
      mfClaimOwnerAccess
    );
  }

  if(input && !input.dataset.bound){
    input.dataset.bound='1';

    input.addEventListener(
      'keydown',
      event=>{
        if(
          event.key==='Enter' &&
          !event.isComposing
        ){
          event.preventDefault();
          mfClaimOwnerAccess();
        }
      }
    );
  }
}

if(document.readyState==='loading'){
  document.addEventListener(
    'DOMContentLoaded',
    mfBindOwnerAccess,
    {once:true}
  );
}else{
  mfBindOwnerAccess();
}
JS

# ------------------------------------------------------------
# Existing load() hides/shows panel — bind controls after 403
# ------------------------------------------------------------
python3 - "$JS" <<'PY'
from pathlib import Path
import sys

path=Path(sys.argv[1])
text=path.read_text(encoding="utf-8")

old="""      $('ownerApp').hidden=true;
      $('accessError').hidden=false;
      return;
"""

new="""      $('ownerApp').hidden=true;
      $('accessError').hidden=false;

      // MEMEFLOW_OWNER_ACCESS_UI_V1
      queueMicrotask(()=>{
        try{mfBindOwnerAccess()}catch{}
      });

      return;
"""

if old in text:
    text=text.replace(old,new,1)
else:
    print("[patch] load() access hook already changed or not required")

path.write_text(text,encoding="utf-8")
print("[patch] JS access flow updated")
PY

# ------------------------------------------------------------
# CSS
# ------------------------------------------------------------
cat >> "$CSS" <<'CSS'

/* =========================================================
   MEMEFLOW_OWNER_ACCESS_UI_V1
   ========================================================= */

.oi-owner-login{
  max-width:620px;
  margin:42px auto 0;
  padding:34px 28px;
  text-align:center;
}

.oi-owner-lock{
  color:var(--cyan);
  font-size:9px;
  font-weight:900;
  letter-spacing:.18em;
}

.oi-owner-login h2{
  margin:10px 0 8px;
  font-size:21px;
  color:#f2f7f9;
}

.oi-owner-login p{
  max-width:470px;
  margin:0 auto;
  color:var(--muted);
  font-size:10px;
  line-height:1.55;
}

.oi-owner-key-wrap{
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  margin-top:22px;
}

#ownerAccessKey{
  min-width:0;
  min-height:44px;
  padding:10px 12px;

  border:
    1px solid
    var(--line2);

  border-radius:10px;

  outline:none;

  background:#090f14;
  color:var(--text);

  font-size:14px;
}

#ownerAccessKey:focus{
  border-color:
    rgba(87,220,255,.55);
}

.oi-owner-access-message{
  min-height:18px;
  margin-top:10px;

  color:var(--muted);

  font-size:9px;
  font-weight:750;
}

.oi-owner-access-message[data-state="success"]{
  color:var(--green);
}

.oi-owner-access-message[data-state="error"]{
  color:#ff8f9c;
}

.oi-owner-access-message[data-state="working"]{
  color:var(--cyan);
}

.oi-owner-login small{
  display:block;

  margin-top:13px;

  color:#566570;

  font-size:7px;
  line-height:1.5;
}

@media(max-width:650px){
  .oi-owner-login{
    margin-top:32px;
    padding:28px 18px;
  }

  .oi-owner-key-wrap{
    grid-template-columns:1fr;
  }

  #ownerUnlockBtn{
    width:100%;
  }

  #ownerAccessKey{
    font-size:16px;
  }
}
CSS

# ------------------------------------------------------------
# Cache bust
# ------------------------------------------------------------
python3 - "$HTML" "$STAMP" <<'PY'
from pathlib import Path
import re,sys

path=Path(sys.argv[1])
stamp=sys.argv[2]
text=path.read_text(encoding="utf-8")

text=re.sub(
    r'/owner-intelligence\.css\?v=[^"\']+',
    f'/owner-intelligence.css?v=owner-access-{stamp}',
    text
)

text=re.sub(
    r'/owner-intelligence\.js\?v=[^"\']+',
    f'/owner-intelligence.js?v=owner-access-{stamp}',
    text
)

path.write_text(text,encoding="utf-8")
PY

node --check "$JS"

grep -q "MEMEFLOW_OWNER_ACCESS_UI_V1" "$HTML"
grep -q "mfClaimOwnerAccess" "$JS"

echo
echo "============================================================"
echo "[patch] SUCCESS — OWNER ACCESS UI FIX INSTALLED"
echo "============================================================"
echo
echo "Security:"
echo "  Existing /api/owner/claim is reused"
echo "  OWNER_REQUIRED protection remains active"
echo "  Owner key is NOT stored in browser storage"
echo "  Platform Learning remains OWNER ONLY"
echo
echo "Backups:"
echo "  $HTML.owner-access-$STAMP.bak"
echo "  $JS.owner-access-$STAMP.bak"
echo "  $CSS.owner-access-$STAMP.bak"
echo
echo "NEXT:"
echo "  1. Restart Replit"
echo "  2. Open /owner-intelligence.html"
echo "  3. Enter your OWNER_ACCESS_KEY"
echo "  4. Press UNLOCK OWNER"
echo "============================================================"
