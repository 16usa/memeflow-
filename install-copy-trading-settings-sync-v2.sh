#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="copy-trading-settings-sync-v2"
APP_DIR="memeflow-app"
SYNC_JS="$APP_DIR/copy-trading-settings-sync-v2.js"
MARKER="MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/memeflow-${PATCH_NAME}-${TS}"

log(){ printf '\n[%s] %s\n' "$PATCH_NAME" "$*"; }
die(){ printf '\n[%s] ERROR: %s\n' "$PATCH_NAME" "$*" >&2; exit 1; }

# Find repository root without requiring a clean working tree.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this from inside the MEMEFLOW git repository."
cd "$ROOT"
[[ -d "$APP_DIR" ]] || die "Cannot find $APP_DIR under $ROOT"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
[[ -n "$BRANCH" ]] || die "Detached HEAD is not supported. Checkout your normal branch first."

log "Repository: $ROOT"
log "Branch: $BRANCH"
log "Unrelated dirty files are allowed. This patch stages ONLY the files it changes."

# Backend contract must already exist. Fail before touching UI if Copy Trading V1 is absent.
grep -q "copyTradingEnabled" "$APP_DIR/src/settings.mjs" || die "Backend Copy Trading settings are not present in src/settings.mjs"
grep -q "copyTradingWallet" "$APP_DIR/src/settings.mjs" || die "copyTradingWallet is missing from src/settings.mjs"
grep -q "copyTradingBuyAmountSol" "$APP_DIR/src/settings.mjs" || die "copyTradingBuyAmountSol is missing from src/settings.mjs"
grep -q "copyTradingMirrorSells" "$APP_DIR/src/settings.mjs" || die "copyTradingMirrorSells is missing from src/settings.mjs"
grep -q "class CopyTradingManager" "$APP_DIR/src/copy-trading.mjs" || die "CopyTradingManager is missing"

mkdir -p "$BACKUP_DIR"

# Remember only the active HTML files we are about to touch. Backups, .patch-backups,
# node_modules and generated *.before-* files are intentionally ignored.
mapfile -t HTML_FILES < <(python3 - <<'PY'
from pathlib import Path
root = Path('memeflow-app')
for p in sorted(root.rglob('*.html')):
    rel = p.as_posix()
    parts = p.parts
    if any(part.startswith('.') for part in parts[1:]):
        continue
    low = rel.lower()
    if 'node_modules/' in low or 'backup' in low or '.before-' in low or '.bak' in low:
        continue
    print(rel)
PY
)

[[ ${#HTML_FILES[@]} -gt 0 ]] || die "No active HTML files found."

for f in "${HTML_FILES[@]}"; do
  mkdir -p "$BACKUP_DIR/$(dirname "$f")"
  cp -p "$f" "$BACKUP_DIR/$f"
done
if [[ -f "$SYNC_JS" ]]; then
  mkdir -p "$BACKUP_DIR/$(dirname "$SYNC_JS")"
  cp -p "$SYNC_JS" "$BACKUP_DIR/$SYNC_JS"
fi

restore_on_error(){
  local code=$?
  if [[ $code -eq 0 ]]; then return 0; fi
  printf '\n[%s] Failure detected. Restoring only files touched by this patch...\n' "$PATCH_NAME" >&2
  for f in "${HTML_FILES[@]}"; do
    [[ -f "$BACKUP_DIR/$f" ]] && cp -p "$BACKUP_DIR/$f" "$f"
  done
  if [[ -f "$BACKUP_DIR/$SYNC_JS" ]]; then
    cp -p "$BACKUP_DIR/$SYNC_JS" "$SYNC_JS"
  else
    rm -f "$SYNC_JS"
  fi
  printf '[%s] Restored. Unrelated local files were never touched.\n' "$PATCH_NAME" >&2
  exit "$code"
}
trap restore_on_error ERR

cat > "$SYNC_JS" <<'JS'
/* MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2
 * One canonical Copy Trading profile, visible from every Settings UI.
 * Backend source of truth: GET/PUT /api/settings.
 * This file deliberately does not create a second settings store.
 */
(()=>{
  'use strict';
  if (window.__MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2__) return;
  window.__MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2__ = true;

  const COPY_KEYS = [
    'copyTradingEnabled',
    'copyTradingWallet',
    'copyTradingBuyAmountSol',
    'copyTradingMirrorSells'
  ];
  const DEFAULTS = {
    copyTradingEnabled:false,
    copyTradingWallet:'',
    copyTradingBuyAmountSol:0.1,
    copyTradingMirrorSells:true
  };
  let canonical = {...DEFAULTS};
  let hydrating = false;
  let refreshTimer = null;
  const nativeFetch = window.fetch.bind(window);

  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const exact=(el,text)=>String(el?.textContent||'').trim().toLowerCase()===text.toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const normalize=s=>({
    copyTradingEnabled:s?.copyTradingEnabled===true,
    copyTradingWallet:String(s?.copyTradingWallet??'').trim(),
    copyTradingBuyAmountSol:Number.isFinite(Number(s?.copyTradingBuyAmountSol))?Number(s.copyTradingBuyAmountSol):0.1,
    copyTradingMirrorSells:s?.copyTradingMirrorSells!==false
  });

  function copyFromAnyVisibleControls(){
    const legacy={
      enabled:document.getElementById('copyTradingEnabled'),
      wallet:document.getElementById('copyTradingWallet'),
      buy:document.getElementById('copyTradingBuyAmountSol'),
      sells:document.getElementById('copyTradingMirrorSells')
    };
    const sync={
      enabled:document.getElementById('mfCopyTradingEnabledV2'),
      wallet:document.getElementById('mfCopyTradingWalletV2'),
      buy:document.getElementById('mfCopyTradingBuyAmountSolV2'),
      sells:document.getElementById('mfCopyTradingMirrorSellsV2')
    };
    const src = sync.enabled ? sync : (legacy.enabled ? legacy : null);
    if(!src) return {...canonical};
    return {
      copyTradingEnabled:!!src.enabled?.checked,
      copyTradingWallet:String(src.wallet?.value??canonical.copyTradingWallet).trim(),
      copyTradingBuyAmountSol:Number(src.buy?.value||canonical.copyTradingBuyAmountSol||0.1),
      copyTradingMirrorSells:src.sells ? !!src.sells.checked : canonical.copyTradingMirrorSells
    };
  }

  function applyToControls(settings){
    canonical={...canonical,...normalize(settings)};
    hydrating=true;
    const maps=[
      ['copyTradingEnabled','mfCopyTradingEnabledV2','checked','copyTradingEnabled'],
      ['copyTradingWallet','mfCopyTradingWalletV2','value','copyTradingWallet'],
      ['copyTradingBuyAmountSol','mfCopyTradingBuyAmountSolV2','value','copyTradingBuyAmountSol'],
      ['copyTradingMirrorSells','mfCopyTradingMirrorSellsV2','checked','copyTradingMirrorSells']
    ];
    for(const [legacyId,syncId,prop,key] of maps){
      for(const id of [legacyId,syncId]){
        const el=document.getElementById(id);
        if(!el) continue;
        if(prop==='checked') el.checked=!!canonical[key];
        else el.value=canonical[key] ?? '';
      }
    }
    const badge=document.querySelector('[data-mf-copy-state-v2]');
    if(badge) badge.textContent=canonical.copyTradingEnabled?'ON':'OFF';
    hydrating=false;
  }

  async function refreshFromServer(){
    try{
      const r=await nativeFetch('/api/settings',{credentials:'same-origin',cache:'no-store'});
      if(!r.ok) return;
      const data=await r.json();
      if(data?.settings) applyToControls(data.settings);
    }catch(_){/* UI remains fail-soft; server is still source of truth. */}
  }

  // Critical compatibility layer: every existing Settings screen still saves through
  // /api/settings. Merge the four canonical Copy Trading fields into every PUT so an
  // older/newer UI cannot accidentally reset them by omission.
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    const method=String(init?.method || (typeof input!=='string'&&input?.method) || 'GET').toUpperCase();
    let nextInit=init;
    if(method==='PUT' && /\/api\/settings(?:\?|$)/.test(url) && init?.body){
      try{
        const payload=JSON.parse(init.body);
        if(payload && typeof payload==='object'){
          payload.settings={...(payload.settings||{}),...copyFromAnyVisibleControls()};
          nextInit={...init,body:JSON.stringify(payload)};
        }
      }catch(_){/* Preserve original request if body is not JSON. */}
    }
    const response=await nativeFetch(input,nextInit);
    if(/\/api\/settings(?:\/defaults)?(?:\?|$)/.test(url)){
      try{
        const clone=response.clone();
        clone.json().then(data=>{if(data?.settings) applyToControls(data.settings)}).catch(()=>{});
      }catch(_){ }
    }
    return response;
  };

  function directTextNode(el){
    return Array.from(el.childNodes||[]).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
  }
  function smallestExact(label){
    const all=qsa('button,summary,h1,h2,h3,h4,strong,b,span,div');
    return all.find(el=>exact(el,label) || directTextNode(el).toLowerCase()===label.toLowerCase()) || null;
  }
  function rowFor(label){
    let el=smallestExact(label);
    if(!el) return null;
    for(let i=0;i<7 && el?.parentElement;i++){
      const p=el.parentElement;
      const childTexts=Array.from(p.children).map(c=>String(c.textContent||'').trim().toLowerCase());
      const hasPeer=childTexts.some(t=>t.startsWith('entry filters')||t.startsWith('risk & exits')||t.startsWith('logic'));
      if(hasPeer) return el;
      el=p;
    }
    return null;
  }
  function accordionItemFor(label){
    const leaf=smallestExact(label);
    if(!leaf) return null;
    let cur=leaf;
    for(let i=0;i<8 && cur?.parentElement;i++){
      const parent=cur.parentElement;
      const siblings=Array.from(parent.children);
      if(siblings.length>=3 && siblings.some(s=>/entry filters/i.test(s.textContent||'')) && siblings.some(s=>/risk\s*&\s*exits/i.test(s.textContent||''))){
        return cur;
      }
      cur=parent;
    }
    return leaf.closest('details,section,[role="button"]') || leaf.parentElement;
  }

  function styleOnce(){
    if(document.getElementById('mf-copy-settings-sync-v2-style')) return;
    const st=document.createElement('style');
    st.id='mf-copy-settings-sync-v2-style';
    st.textContent=`
      .mf-copy-v2{border:1px solid rgba(130,165,185,.13);border-radius:18px;background:rgba(5,11,15,.42);overflow:hidden;color:inherit}
      .mf-copy-v2>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:21px 20px;min-height:72px}
      .mf-copy-v2>summary::-webkit-details-marker{display:none}
      .mf-copy-v2-title{display:flex;flex-direction:column;gap:5px;min-width:0}
      .mf-copy-v2-title b{font-size:17px;line-height:1.2;color:inherit}
      .mf-copy-v2-title small{font-size:12px;line-height:1.35;color:#688092;font-weight:500;letter-spacing:.01em}
      .mf-copy-v2-state{font-size:12px;font-weight:800;letter-spacing:.08em;color:#55dca9;border:1px solid rgba(85,220,169,.35);padding:7px 11px;border-radius:999px;flex:0 0 auto}
      .mf-copy-v2-body{border-top:1px solid rgba(130,165,185,.10);padding:18px 20px 20px;display:grid;gap:16px}
      .mf-copy-v2-row{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center}
      .mf-copy-v2-copy{display:grid;gap:4px}.mf-copy-v2-copy b{font-size:15px}.mf-copy-v2-copy span,.mf-copy-v2-help{font-size:12px;line-height:1.45;color:#7f92a2}
      .mf-copy-v2-field{display:grid;gap:7px}.mf-copy-v2-field label{font-size:12px;font-weight:700;color:#8295a5;letter-spacing:.03em}
      .mf-copy-v2 input[type="text"],.mf-copy-v2 input[type="number"]{width:100%;box-sizing:border-box;border:1px solid rgba(130,165,185,.16);background:rgba(9,15,20,.58);color:inherit;border-radius:14px;padding:13px 14px;font:inherit;outline:none}
      .mf-copy-v2 input:focus{border-color:rgba(82,211,240,.42);box-shadow:0 0 0 3px rgba(82,211,240,.06)}
      .mf-copy-v2-switch{position:relative;width:48px;height:28px;display:inline-block}.mf-copy-v2-switch input{opacity:0;width:0;height:0}
      .mf-copy-v2-switch i{position:absolute;inset:0;border-radius:999px;background:#10202a;border:1px solid rgba(130,165,185,.24);transition:.18s}
      .mf-copy-v2-switch i:after{content:"";position:absolute;width:22px;height:22px;left:2px;top:2px;border-radius:50%;background:#8295a5;transition:.18s}
      .mf-copy-v2-switch input:checked+i{background:rgba(65,216,167,.18);border-color:rgba(65,216,167,.48)}
      .mf-copy-v2-switch input:checked+i:after{transform:translateX(20px);background:#55dca9}
      .mf-copy-v2-note{border-left:2px solid #52d3f0;background:rgba(20,47,57,.26);padding:12px 13px;border-radius:0 12px 12px 0;font-size:12px;line-height:1.5;color:#8197a6}
      @media(max-width:640px){.mf-copy-v2>summary{padding:18px 16px}.mf-copy-v2-body{padding:16px}.mf-copy-v2-row{grid-template-columns:1fr auto}}
    `;
    document.head.appendChild(st);
  }

  function makeSection(){
    const d=document.createElement('details');
    d.className='mf-copy-v2';
    d.dataset.mfCopyTradingSettingsV2='1';
    d.innerHTML=`
      <summary>
        <span class="mf-copy-v2-title"><b>Copy trading</b><small>Mirror a Solana wallet with your own position size</small></span>
        <span class="mf-copy-v2-state" data-mf-copy-state-v2>OFF</span>
      </summary>
      <div class="mf-copy-v2-body">
        <div class="mf-copy-v2-row">
          <span class="mf-copy-v2-copy"><b>Enable copy trading</b><span>Follow one Solana wallet and mirror its Pump.fun trades in PAPER mode.</span></span>
          <label class="mf-copy-v2-switch"><input id="mfCopyTradingEnabledV2" type="checkbox"><i></i></label>
        </div>
        <div class="mf-copy-v2-field">
          <label for="mfCopyTradingWalletV2">Tracked Solana wallet</label>
          <input id="mfCopyTradingWalletV2" type="text" autocomplete="off" spellcheck="false" placeholder="Solana public address">
          <span class="mf-copy-v2-help">Public address only. Never enter a seed phrase or private key.</span>
        </div>
        <div class="mf-copy-v2-field">
          <label for="mfCopyTradingBuyAmountSolV2">Your BUY size · SOL</label>
          <input id="mfCopyTradingBuyAmountSolV2" type="number" min="0.001" step="0.001" inputmode="decimal">
          <span class="mf-copy-v2-help">Every mirrored BUY uses this fixed amount, not the source wallet amount.</span>
        </div>
        <div class="mf-copy-v2-row">
          <span class="mf-copy-v2-copy"><b>Mirror sells proportionally</b><span>If the source sells 25% of its position, MEMEFLOW sells 25% of your copied position.</span></span>
          <label class="mf-copy-v2-switch"><input id="mfCopyTradingMirrorSellsV2" type="checkbox"><i></i></label>
        </div>
        <div class="mf-copy-v2-note">Pump.fun · PAPER. LIVE execution remains locked until the verified production signing adapter is enabled.</div>
      </div>`;
    d.addEventListener('input',()=>{
      if(hydrating) return;
      canonical={...canonical,...copyFromAnyVisibleControls()};
      applyToControls(canonical);
    });
    d.addEventListener('change',()=>{
      if(hydrating) return;
      canonical={...canonical,...copyFromAnyVisibleControls()};
      applyToControls(canonical);
    });
    return d;
  }

  function injectSystemSettings(){
    if(document.querySelector('[data-mf-copy-trading-settings-v2]')) return true;
    const title=smallestExact('System settings');
    if(!title) return false;
    const trading=accordionItemFor('Trading');
    if(!trading?.parentElement) return false;
    styleOnce();
    const section=makeSection();
    trading.insertAdjacentElement('afterend',section);
    applyToControls(canonical);
    return true;
  }

  // Keep the original AI & Trading Settings controls and the new System Settings
  // controls in sync on the same page/session.
  document.addEventListener('input',e=>{
    const id=e.target?.id;
    if(!id || ![
      'copyTradingEnabled','copyTradingWallet','copyTradingBuyAmountSol','copyTradingMirrorSells',
      'mfCopyTradingEnabledV2','mfCopyTradingWalletV2','mfCopyTradingBuyAmountSolV2','mfCopyTradingMirrorSellsV2'
    ].includes(id) || hydrating) return;
    canonical={...canonical,...copyFromAnyVisibleControls()};
    applyToControls(canonical);
  },true);
  document.addEventListener('change',e=>{
    const id=e.target?.id;
    if(!id || !id.includes('CopyTrading') && !id.startsWith('copyTrading') || hydrating) return;
    canonical={...canonical,...copyFromAnyVisibleControls()};
    applyToControls(canonical);
  },true);

  // After server-default restore, fetch the canonical profile again even if the host
  // Settings UI does not expose Copy Trading itself.
  document.addEventListener('click',e=>{
    const t=e.target?.closest?.('button,a');
    const txt=String(t?.textContent||'').trim().toLowerCase();
    if(txt.includes('restore') && txt.includes('default')) setTimeout(refreshFromServer,250);
  },true);

  const scan=()=>{
    injectSystemSettings();
    // Original AI Settings may mount later; hydrate it whenever it appears.
    if(document.getElementById('copyTradingEnabled')) applyToControls(canonical);
  };
  const observer=new MutationObserver(()=>{
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(scan,30);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{scan();refreshFromServer();},{once:true});
  else {scan();refreshFromServer();}
})();
JS

# Inject the synchronizer into every active HTML entry point. The script itself only
# renders inside a real "System settings" UI, so adding the tag globally is safe.
python3 - <<'PY'
from pathlib import Path
marker = 'MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2'
tag = '<script src="/copy-trading-settings-sync-v2.js?v=2" data-patch="MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2"></script>'
root = Path('memeflow-app')
changed=[]
for p in sorted(root.rglob('*.html')):
    rel=p.as_posix(); low=rel.lower()
    if any(part.startswith('.') for part in p.parts[1:]):
        continue
    if 'node_modules/' in low or 'backup' in low or '.before-' in low or '.bak' in low:
        continue
    text=p.read_text(encoding='utf-8')
    if marker in text:
        continue
    if '</body>' in text:
        text=text.replace('</body>', f'{tag}\n</body>', 1)
    else:
        text += '\n' + tag + '\n'
    p.write_text(text, encoding='utf-8')
    changed.append(rel)
print('\n'.join(changed))
PY

log "Running syntax and contract checks..."
node --check "$SYNC_JS"

grep -q "$MARKER" "$SYNC_JS" || die "Synchronizer marker missing"
grep -q "copyTradingEnabled" "$SYNC_JS" || die "UI synchronizer does not bind copyTradingEnabled"
grep -q "copyTradingWallet" "$SYNC_JS" || die "UI synchronizer does not bind copyTradingWallet"
grep -q "copyTradingBuyAmountSol" "$SYNC_JS" || die "UI synchronizer does not bind copyTradingBuyAmountSol"
grep -q "copyTradingMirrorSells" "$SYNC_JS" || die "UI synchronizer does not bind copyTradingMirrorSells"

# At least the main entry point must load the synchronizer.
grep -q "$MARKER" "$APP_DIR/index.html" || die "index.html did not receive the synchronizer tag"

log "Running MEMEFLOW tests..."
(
  cd "$APP_DIR"
  npm test
)

# Stage only this patch's active files. Unrelated dirty data/backups remain untouched.
mapfile -t PATCHED_HTML < <(grep -rl --include='*.html' "$MARKER" "$APP_DIR" \
  | grep -v '/node_modules/' \
  | grep -v '/\.patch-backups/' \
  | grep -v -Ei 'backup|\.before-|\.bak' \
  | sort)

git add -- "$SYNC_JS"
for f in "${PATCHED_HTML[@]}"; do git add -- "$f"; done

if git diff --cached --quiet; then
  log "Nothing new to commit: patch is already installed."
  trap - ERR
  exit 0
fi

log "Staged files:"
git diff --cached --name-status

git commit -m "feat(settings): sync copy trading across settings UIs"

# Push current branch only; never force-push.
log "Pushing $BRANCH..."
git push origin "$BRANCH"

trap - ERR
log "DONE"
printf '%s\n' \
  "Copy Trading is now injected into System settings on active pages." \
  "All Settings PUTs preserve the same four backend Copy Trading fields." \
  "Existing AI & Trading Settings and System settings stay synchronized." \
  "Unrelated local data, backups and old patch files were not staged."
