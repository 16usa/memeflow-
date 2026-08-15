#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW GAME FULLSCREEN V11 INSTALLER ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/game-settings-v107.js" ]; then
    ROOT="$base"
    break
  fi
done

if [ -z "$ROOT" ]; then
  found="$(find "$PWD" "$HOME" -maxdepth 4 -type f -path '*/memeflow-app/game-settings-v107.js' 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    ROOT="${found%/memeflow-app/game-settings-v107.js}"
  fi
fi

[ -n "$ROOT" ] || {
  echo "ERROR: memeflow-app/game-settings-v107.js not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
SETTINGS="$APP/game-settings-v107.js"
HTML="$APP/game-fullscreen-v11.html"
CSS="$APP/game-fullscreen-v11.css"
JS="$APP/game-fullscreen-v11.js"
LAUNCHER="$APP/game-fullscreen-v11-launcher.js"
BACKUP="$APP/_backup/v11-fullscreen-page"

mkdir -p "$BACKUP"

cp -f "$SETTINGS" "$BACKUP/game-settings-v107.js.before-v11"
cp -f "$APP/game-flight-mode-v109.js" "$BACKUP/game-flight-mode-v109.js.before-v11" 2>/dev/null || true
cp -f "$APP/game-flight-mode-v109.css" "$BACKUP/game-flight-mode-v109.css.before-v11" 2>/dev/null || true

echo "Backup ready: $BACKUP"

cat > "$HTML" <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"
  >
  <meta name="theme-color" content="#010408">
  <title>MEMEFLOW · Flight View</title>
  <link rel="stylesheet" href="/game-fullscreen-v11.css?v=11001">
</head>
<body>
  <main id="mfV11Root">
    <iframe
      id="mfV11Frame"
      title="MEMEFLOW Game Fullscreen"
      allow="fullscreen"
    ></iframe>

    <div id="mfV11Loading" class="mf-v11-loading" role="status">
      <span class="mf-v11-dot"></span>
      <div>
        <strong>MEMEFLOW FLIGHT VIEW</strong>
        <small>Connecting to the current Game…</small>
      </div>
    </div>

    <div id="mfV11Toast" class="mf-v11-toast" hidden></div>

    <nav class="mf-v11-top-actions" aria-label="Flight view controls">
      <button
        id="mfV11NativeFullscreen"
        type="button"
        title="Browser fullscreen"
      >
        <span aria-hidden="true">⛶</span>
        <span>FULL SCREEN</span>
      </button>

      <button
        id="mfV11Exit"
        type="button"
        title="Return to Game"
      >
        <span aria-hidden="true">×</span>
        <span>EXIT</span>
      </button>
    </nav>
  </main>

  <script src="/game-fullscreen-v11.js?v=11001" defer></script>
</body>
</html>
EOF

cat > "$CSS" <<'EOF'
:root{
  color-scheme:dark;
  background:#010408;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Display",
    sans-serif;
}

*{
  box-sizing:border-box;
}

html,
body{
  width:100%;
  height:100%;
  margin:0;
  padding:0;
  overflow:hidden;
  background:#010408;
}

body{
  min-height:100dvh;
}

#mfV11Root{
  position:fixed;
  inset:0;
  width:100vw;
  height:100dvh;
  overflow:hidden;
  background:#010408;
}

#mfV11Frame{
  position:absolute;
  inset:0;
  display:block;
  width:100%;
  height:100%;
  border:0;
  background:#010408;
}

.mf-v11-top-actions{
  position:fixed;
  z-index:100000;
  top:max(10px,env(safe-area-inset-top));
  right:max(10px,env(safe-area-inset-right));
  display:flex;
  align-items:center;
  gap:7px;
  pointer-events:none;
}

.mf-v11-top-actions button{
  pointer-events:auto;
  min-height:38px;
  padding:0 12px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  border:1px solid rgba(103,218,255,.30);
  border-radius:13px;
  background:rgba(4,11,16,.74);
  color:#e9fbff;
  box-shadow:0 8px 24px rgba(0,0,0,.20);
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
  font:800 9px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.10em;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

#mfV11Exit{
  border-color:rgba(255,255,255,.18);
}

.mf-v11-loading{
  position:fixed;
  z-index:90000;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  min-width:min(320px,78vw);
  padding:16px 18px;
  display:flex;
  align-items:center;
  gap:12px;
  border:1px solid rgba(104,220,255,.20);
  border-radius:16px;
  background:rgba(5,13,18,.84);
  color:#edfaff;
  box-shadow:0 18px 50px rgba(0,0,0,.32);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
  transition:opacity .2s ease,visibility .2s ease;
}

.mf-v11-loading.is-ready{
  opacity:0;
  visibility:hidden;
  pointer-events:none;
}

.mf-v11-loading strong{
  display:block;
  margin-bottom:5px;
  color:#7cecff;
  font-size:11px;
  letter-spacing:.16em;
}

.mf-v11-loading small{
  display:block;
  color:#95a5b2;
  font-size:11px;
}

.mf-v11-dot{
  flex:0 0 auto;
  width:10px;
  height:10px;
  border-radius:50%;
  background:#58e7b1;
  box-shadow:0 0 16px rgba(88,231,177,.75);
}

.mf-v11-toast{
  position:fixed;
  z-index:95000;
  left:50%;
  top:max(58px,calc(env(safe-area-inset-top) + 46px));
  transform:translateX(-50%);
  max-width:min(520px,86vw);
  padding:9px 13px;
  border:1px solid rgba(255,194,107,.25);
  border-radius:12px;
  background:rgba(27,20,10,.82);
  color:#ffd99d;
  font:700 10px/1.35 system-ui,-apple-system,sans-serif;
  text-align:center;
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
}

@media (max-width:700px){
  .mf-v11-top-actions button{
    min-height:34px;
    padding:0 10px;
    font-size:8px;
  }

  .mf-v11-top-actions button span:last-child{
    display:none;
  }

  .mf-v11-top-actions button span:first-child{
    font-size:16px;
  }
}
EOF

cat > "$JS" <<'EOF'
(()=>{
  'use strict';

  const VERSION='11.0';

  const frame=document.getElementById('mfV11Frame');
  const loading=document.getElementById('mfV11Loading');
  const toast=document.getElementById('mfV11Toast');
  const exitBtn=document.getElementById('mfV11Exit');
  const fsBtn=document.getElementById('mfV11NativeFullscreen');

  const params=new URLSearchParams(location.search);

  function safeGameSource(){
    let raw=params.get('src') ||
      sessionStorage.getItem('mfGameFullscreenReturn') ||
      '/game.html';

    try{
      const u=new URL(raw,location.origin);

      if(u.origin!==location.origin){
        return '/game.html';
      }

      if(u.pathname.includes('game-fullscreen-v11')){
        return '/game.html';
      }

      u.searchParams.set('mf_embedded','1');
      u.searchParams.delete('mf_v11');

      return u.pathname+u.search+u.hash;
    }catch(_){
      return '/game.html?mf_embedded=1';
    }
  }

  function returnSource(){
    const raw=params.get('src') ||
      sessionStorage.getItem('mfGameFullscreenReturn') ||
      '/game.html';

    try{
      const u=new URL(raw,location.origin);
      u.searchParams.delete('mf_embedded');
      u.searchParams.delete('mf_v11');
      return u.pathname+u.search+u.hash;
    }catch(_){
      return '/game.html';
    }
  }

  const source=safeGameSource();
  const back=returnSource();

  function showToast(message,ms=4200){
    toast.textContent=message;
    toast.hidden=false;

    clearTimeout(showToast.timer);

    if(ms>0){
      showToast.timer=setTimeout(()=>{
        toast.hidden=true;
      },ms);
    }
  }

  function txt(el){
    return String(el?.innerText || el?.textContent || '')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function smallest(doc,words,scope){
    const root=scope || doc;
    const wanted=words.map(v=>v.toUpperCase());

    return [...root.querySelectorAll('section,article,div')]
      .filter(el=>{
        const r=el.getBoundingClientRect();
        if(r.width<120 || r.height<30)return false;

        const t=txt(el);
        return wanted.every(word=>t.includes(word));
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return ar.width*ar.height - br.width*br.height;
      })[0] || null;
  }

  function findStage(doc){
    const metric=smallest(
      doc,
      ['STAKE','PAPER VALUE','P&L','STAGE','PRICE AGE']
    );

    if(!metric)return null;

    const metricRect=metric.getBoundingClientRect();
    let el=metric.parentElement;
    let candidate=null;

    while(el && el!==doc.body && el!==doc.documentElement){
      const r=el.getBoundingClientRect();
      const t=txt(el);

      if(
        t.includes('LAUNCH CONTROL') ||
        t.includes('SELECTED LAUNCH') ||
        t.includes('ROUND HISTORY')
      ){
        break;
      }

      if(
        r.width>=Math.min(300,innerWidth*.70) &&
        r.height>=Math.max(240,metricRect.height*3)
      ){
        candidate=el;
        break;
      }

      el=el.parentElement;
    }

    return candidate || metric.parentElement || null;
  }

  function tag(doc){
    const stage=findStage(doc);

    const launch=
      doc.querySelector('.launch-panel') ||
      smallest(doc,['LAUNCH CONTROL','PAPER BALANCE']);

    const selected=
      smallest(doc,['SELECTED LAUNCH','AI SCORE','BUY PRESSURE']);

    const record=
      smallest(doc,['FLIGHT RECORD','NET P&L']);

    const history=
      smallest(doc,['ROUND HISTORY']);

    const header=
      stage
        ? smallest(doc,['FEED','TIME'],stage)
        : null;

    const metrics=
      stage
        ? smallest(doc,['STAKE','PAPER VALUE','P&L','STAGE','PRICE AGE'],stage)
        : null;

    if(!stage){
      return {
        ok:false,
        reason:'Rocket scene was not detected'
      };
    }

    stage.classList.add('mf-v11-stage');

    if(header && header!==stage){
      header.classList.add('mf-v11-stage-header');
    }

    if(metrics && metrics!==stage){
      metrics.classList.add('mf-v11-stage-metrics');
    }

    [
      [launch,'mf-v11-launch'],
      [selected,'mf-v11-selected'],
      [record,'mf-v11-record'],
      [history,'mf-v11-history']
    ].forEach(([el,cls])=>{
      if(!el)return;
      el.classList.add('mf-v11-hud',cls);
    });

    const utility=
      doc.querySelector('.launch-panel .utility-actions');

    if(utility){
      const buttons=[...utility.querySelectorAll('button,[role="button"]')];
      const nonApp=buttons.filter(button=>
        button.id!=='gameSettingsBtn' &&
        button.id!=='gameWalletBtn'
      );

      if(nonApp.length){
        const oldFs=nonApp[nonApp.length-1];

        if(oldFs){
          oldFs.classList.add('mf-v11-hide-old-fullscreen');
        }
      }
    }

    return {
      ok:true,
      stage,
      launch,
      selected,
      record,
      history
    };
  }

  function installStyle(doc){
    if(doc.getElementById('mfV11InjectedStyle')){
      return;
    }

    const style=doc.createElement('style');
    style.id='mfV11InjectedStyle';

    style.textContent=`
      :root{
        color-scheme:dark!important;
        background:#010408!important;
      }

      html,
      body{
        width:100%!important;
        height:100%!important;
        min-height:100dvh!important;
        margin:0!important;
        overflow:hidden!important;
        background:#010408!important;
      }

      body{
        position:relative!important;
      }

      .mf-v11-stage{
        position:fixed!important;
        inset:0!important;
        z-index:1000!important;

        width:100vw!important;
        max-width:none!important;

        height:100dvh!important;
        min-height:100dvh!important;
        max-height:none!important;

        margin:0!important;
        padding:0!important;

        border:0!important;
        border-radius:0!important;

        overflow:hidden!important;
        box-sizing:border-box!important;

        background:#06162b!important;
        box-shadow:none!important;
      }

      .mf-v11-stage canvas,
      .mf-v11-stage video{
        max-width:none!important;
      }

      .mf-v11-stage-header{
        position:absolute!important;
        z-index:8!important;
        top:0!important;
        left:0!important;
        right:0!important;
      }

      .mf-v11-stage-metrics{
        position:absolute!important;
        z-index:8!important;
        left:0!important;
        right:0!important;
        bottom:0!important;
      }

      .mf-v11-hud{
        position:fixed!important;
        z-index:1400!important;

        min-width:0!important;

        margin:0!important;

        overflow:hidden!important;

        border:1px solid rgba(135,182,199,.20)!important;
        border-radius:17px!important;

        background:
          linear-gradient(
            180deg,
            rgba(6,13,18,.82),
            rgba(3,8,12,.73)
          )!important;

        box-shadow:
          0 16px 44px
          rgba(0,0,0,.28)!important;

        backdrop-filter:
          blur(14px)
          saturate(1.10)!important;

        -webkit-backdrop-filter:
          blur(14px)
          saturate(1.10)!important;

        box-sizing:border-box!important;
        pointer-events:auto!important;
      }

      .mf-v11-hud,
      .mf-v11-hud *{
        box-sizing:border-box!important;
      }

      .mf-v11-hud > *,
      .mf-v11-hud input,
      .mf-v11-hud select,
      .mf-v11-hud button{
        min-width:0!important;
        max-width:100%;
      }

      .mf-v11-launch{
        left:max(8px,env(safe-area-inset-left))!important;
        bottom:max(8px,env(safe-area-inset-bottom))!important;

        width:min(51vw,390px)!important;
        max-width:min(51vw,390px)!important;

        max-height:60dvh!important;

        overflow:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
      }

      .mf-v11-selected{
        right:max(7px,env(safe-area-inset-right))!important;
        top:max(56px,calc(env(safe-area-inset-top) + 44px))!important;

        width:min(43vw,330px)!important;
        max-width:min(43vw,330px)!important;

        max-height:34dvh!important;
      }

      .mf-v11-record{
        right:max(7px,env(safe-area-inset-right))!important;
        top:47dvh!important;

        width:min(43vw,330px)!important;
        max-width:min(43vw,330px)!important;

        max-height:16dvh!important;
      }

      .mf-v11-history{
        right:max(7px,env(safe-area-inset-right))!important;
        bottom:max(8px,env(safe-area-inset-bottom))!important;

        width:min(43vw,330px)!important;
        max-width:min(43vw,330px)!important;

        max-height:30dvh!important;

        overflow:auto!important;
        overscroll-behavior:contain!important;
        -webkit-overflow-scrolling:touch!important;
      }

      .mf-v11-hide-old-fullscreen{
        display:none!important;
      }

      .mf-game-settings-overlay,
      .mf-game-wallet-overlay{
        z-index:100000!important;
      }

      @media (orientation:landscape){
        .mf-v11-launch{
          left:max(10px,env(safe-area-inset-left))!important;
          top:max(10px,env(safe-area-inset-top))!important;
          bottom:max(10px,env(safe-area-inset-bottom))!important;

          width:min(27vw,390px)!important;
          max-width:min(27vw,390px)!important;

          max-height:none!important;
        }

        .mf-v11-selected{
          right:max(10px,env(safe-area-inset-right))!important;
          top:max(10px,env(safe-area-inset-top))!important;

          width:min(23vw,330px)!important;
          max-width:min(23vw,330px)!important;

          max-height:39dvh!important;
        }

        .mf-v11-record{
          right:max(10px,env(safe-area-inset-right))!important;
          top:43dvh!important;

          width:min(23vw,330px)!important;
          max-width:min(23vw,330px)!important;

          max-height:19dvh!important;
        }

        .mf-v11-history{
          right:max(10px,env(safe-area-inset-right))!important;
          bottom:max(10px,env(safe-area-inset-bottom))!important;

          width:min(23vw,330px)!important;
          max-width:min(23vw,330px)!important;

          max-height:34dvh!important;
        }
      }

      @media (max-height:500px) and (orientation:landscape){
        .mf-v11-hud{
          font-size:.76em!important;
        }

        .mf-v11-launch{
          width:25vw!important;
          max-width:25vw!important;
        }

        .mf-v11-selected,
        .mf-v11-record,
        .mf-v11-history{
          width:21vw!important;
          max-width:21vw!important;
        }
      }
    `;

    doc.head.appendChild(style);
  }

  function applyV11(){
    let doc;

    try{
      doc=frame.contentDocument;
    }catch(error){
      console.error('[V11]',error);
      showToast('Same-origin access failed. Showing the normal Game view.');
      loading.classList.add('is-ready');
      return;
    }

    if(!doc || !doc.body){
      setTimeout(applyV11,160);
      return;
    }

    installStyle(doc);

    const result=tag(doc);

    if(!result.ok){
      console.warn('[MEMEFLOW FULLSCREEN V11] HUD fallback:',result.reason);
      showToast(
        'Flight HUD could not identify the Rocket Scene. Normal Game remains available.',
        5500
      );
    }else{
      console.info(
        '[MEMEFLOW FULLSCREEN V11]',
        VERSION,
        'HUD READY',
        result
      );

      try{
        frame.contentWindow.dispatchEvent(new Event('resize'));
      }catch(_){}
    }

    loading.classList.add('is-ready');
  }

  frame.addEventListener('load',()=>{
    setTimeout(applyV11,120);
    setTimeout(applyV11,650);
  });

  frame.src=source;

  exitBtn.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement){
        await document.exitFullscreen();
      }
    }catch(_){}

    location.href=back;
  });

  fsBtn.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement){
        await document.exitFullscreen();
        return;
      }

      const target=document.documentElement;

      if(target.requestFullscreen){
        await target.requestFullscreen({navigationUI:'hide'});
      }else if(target.webkitRequestFullscreen){
        target.webkitRequestFullscreen();
      }else{
        showToast(
          'Browser fullscreen is not available here. Flight View still fills the page.',
          4200
        );
      }
    }catch(error){
      console.warn('[MEMEFLOW FULLSCREEN V11] requestFullscreen:',error);
      showToast(
        'Safari did not enter native fullscreen. Flight View is still active.',
        4200
      );
    }
  });

  document.addEventListener('fullscreenchange',()=>{
    fsBtn.classList.toggle(
      'is-active',
      !!document.fullscreenElement
    );
  });

  console.info(
    '[MEMEFLOW FULLSCREEN V11]',
    VERSION,
    'SOURCE',
    source
  );
})();
EOF

cat > "$LAUNCHER" <<'EOF'
(()=>{
  'use strict';

  const VERSION='11.0';

  const params=new URLSearchParams(location.search);

  if(params.get('mf_embedded')==='1'){
    console.info(
      '[MEMEFLOW FULLSCREEN V11 LAUNCHER]',
      VERSION,
      'EMBEDDED — DISABLED'
    );
    return;
  }

  function findUtility(){
    return document.querySelector(
      '.launch-panel .utility-actions'
    );
  }

  function candidateButton(){
    const utility=findUtility();
    if(!utility)return null;

    const buttons=[
      ...utility.querySelectorAll(
        'button,[role="button"]'
      )
    ];

    if(!buttons.length)return null;

    const labeled=buttons.find(button=>{
      const s=(
        String(button.innerText||'')+' '+
        String(button.getAttribute('aria-label')||'')+' '+
        String(button.getAttribute('title')||'')
      ).toUpperCase();

      return (
        s.includes('FULL SCREEN') ||
        s.includes('FULLSCREEN')
      );
    });

    if(labeled)return labeled;

    return buttons[buttons.length-1] || null;
  }

  function openV11(){
    const current=
      location.pathname+
      location.search+
      location.hash;

    sessionStorage.setItem(
      'mfGameFullscreenReturn',
      current
    );

    location.href=
      '/game-fullscreen-v11.html?src='+
      encodeURIComponent(current);
  }

  function ownButton(){
    const old=candidateButton();

    if(!old)return false;

    if(old.dataset.mfV11Launcher==='true'){
      return true;
    }

    const button=old.cloneNode(true);

    button.dataset.mfV11Launcher='true';

    button.setAttribute(
      'aria-label',
      'Open Full Screen Flight View'
    );

    button.setAttribute(
      'title',
      'Open Full Screen Flight View'
    );

    button.addEventListener(
      'click',
      event=>{
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openV11();
      },
      true
    );

    old.replaceWith(button);

    console.info(
      '[MEMEFLOW FULLSCREEN V11 LAUNCHER]',
      VERSION,
      'READY'
    );

    return true;
  }

  let attempts=0;

  const boot=setInterval(()=>{
    attempts+=1;

    if(ownButton() || attempts>60){
      clearInterval(boot);
    }
  },120);

  const observer=new MutationObserver(()=>{
    ownButton();
  });

  observer.observe(
    document.documentElement,
    {
      childList:true,
      subtree:true
    }
  );
})();
EOF

python - <<'PY'
from pathlib import Path
import time

p=Path("memeflow-app/game-settings-v107.js")
s=p.read_text()

OLD_START="/* === GAME FLIGHT MODE V10.9 BOOTSTRAP START === */"
OLD_END="/* === GAME FLIGHT MODE V10.9 BOOTSTRAP END === */"

if OLD_START in s and OLD_END in s:
    a=s.index(OLD_START)
    b=s.index(OLD_END,a)+len(OLD_END)
    s=s[:a]+s[b:]
    print("Old V10.9 bootstrap: DISABLED")
else:
    print("Old V10.9 bootstrap: not present / already disabled")

START="/* === GAME FULLSCREEN V11 LAUNCHER START === */"
END="/* === GAME FULLSCREEN V11 LAUNCHER END === */"

if START in s and END in s:
    a=s.index(START)
    b=s.index(END,a)+len(END)
    s=s[:a]+s[b:]

v=str(int(time.time()))

block=f'''
{START}
;(()=>{{
  function loadGameFullscreenV11(){{
    if(
      document.getElementById(
        'mfGameFullscreenV11Launcher'
      )
    ){{
      return;
    }}

    const script=
      document.createElement(
        'script'
      );

    script.id=
      'mfGameFullscreenV11Launcher';

    script.src=
      '/game-fullscreen-v11-launcher.js?v={v}';

    script.async=false;

    document.head.appendChild(
      script
    );
  }}

  if(document.readyState==='loading'){{
    document.addEventListener(
      'DOMContentLoaded',
      loadGameFullscreenV11,
      {{once:true}}
    );
  }}else{{
    loadGameFullscreenV11();
  }}
}})();
{END}
'''

p.write_text(
    s.rstrip()+
    "\n\n"+
    block.strip()+
    "\n"
)

print("V11 launcher cache:",v)
PY

node --check "$JS"
node --check "$LAUNCHER"
node --check "$SETTINGS"

git diff --check -- \
  "$HTML" \
  "$CSS" \
  "$JS" \
  "$LAUNCHER" \
  "$SETTINGS"

echo
echo "=== V11 CHECKS PASS ==="
echo "Separate page: $HTML"
echo "Old V10.9 bootstrap: removed from live loader"
echo "Original Game: preserved"
echo "Game engine/API: reused from original Game iframe"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add \
    "$HTML" \
    "$CSS" \
    "$JS" \
    "$LAUNCHER" \
    "$SETTINGS"

  if ! git diff --cached --quiet; then
    git commit \
      -m "Add isolated Game Fullscreen page V11" \
      || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: Git push failed."
        echo "The V11 files are still installed locally in Replit."
      }
    fi
  else
    echo "No new Git changes — V11 already appears installed."
  fi
fi

echo
echo "=========================================="
echo " MEMEFLOW GAME FULLSCREEN V11 INSTALLED"
echo "=========================================="
echo
echo "NORMAL GAME:"
echo "  preserved"
echo
echo "OLD V10.9 FLIGHT PATCH:"
echo "  disabled from live loading"
echo "  files kept for backup"
echo
echo "FULLSCREEN ICON:"
echo "  opens /game-fullscreen-v11.html"
echo
echo "V11:"
echo "  same Game engine / same API / same active round"
echo "  same AUTO / CASH OUT / settings / wallet / history"
echo "  isolated fullscreen HUD page"
echo "  safe fallback to normal Game if scene detection fails"
echo
echo "NEXT:"
echo "  1. Replit Stop"
echo "  2. Replit Run"
echo "  3. Reopen normal Game"
echo "  4. Tap the existing four-corners fullscreen icon"
echo
