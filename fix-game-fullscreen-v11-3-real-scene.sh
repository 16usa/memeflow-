#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW FULLSCREEN V11.3 — REAL FLIGHT CARD LAYOUT ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/game-fullscreen-v11.js" ]; then
    ROOT="$base"
    break
  fi
done

if [ -z "$ROOT" ]; then
  found="$(find "$PWD" "$HOME" -maxdepth 4 -type f -path '*/memeflow-app/game-fullscreen-v11.js' 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    ROOT="${found%/memeflow-app/game-fullscreen-v11.js}"
  fi
fi

[ -n "$ROOT" ] || {
  echo "ERROR: memeflow-app/game-fullscreen-v11.js not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
HTML="$APP/game-fullscreen-v11.html"
JS="$APP/game-fullscreen-v11.js"
BACKUP="$APP/_backup/v11.3-real-flight-card"

mkdir -p "$BACKUP"
cp -f "$JS" "$BACKUP/game-fullscreen-v11.js.before-v113"
cp -f "$HTML" "$BACKUP/game-fullscreen-v11.html.before-v113"

cat > "$JS" <<'EOF'
(()=>{
  'use strict';

  const VERSION='11.3';

  const frame=document.getElementById('mfV11Frame');
  const loading=document.getElementById('mfV11Loading');
  const toast=document.getElementById('mfV11Toast');
  const exitBtn=document.getElementById('mfV11Exit');
  const fsBtn=document.getElementById('mfV11NativeFullscreen');

  const params=new URLSearchParams(location.search);

  function safeGameSource(){
    let raw=
      params.get('src') ||
      sessionStorage.getItem('mfGameFullscreenReturn') ||
      '/game.html';

    try{
      const u=new URL(raw,location.origin);

      if(u.origin!==location.origin){
        return '/game.html?mf_embedded=1';
      }

      if(u.pathname.includes('game-fullscreen-v11')){
        return '/game.html?mf_embedded=1';
      }

      u.searchParams.set('mf_embedded','1');
      u.searchParams.delete('mf_v11');

      return u.pathname+u.search+u.hash;
    }catch(_){
      return '/game.html?mf_embedded=1';
    }
  }

  function returnSource(){
    const raw=
      params.get('src') ||
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

  function showToast(message,ms=4500){
    toast.textContent=message;
    toast.hidden=false;

    clearTimeout(showToast.timer);

    if(ms>0){
      showToast.timer=setTimeout(()=>{
        toast.hidden=true;
      },ms);
    }
  }

  function text(el){
    return String(
      el?.innerText ||
      el?.textContent ||
      ''
    )
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();
  }

  function smallest(doc,words){
    const wanted=
      words.map(v=>v.toUpperCase());

    return [
      ...doc.querySelectorAll(
        'section,article,aside,div'
      )
    ]
    .filter(el=>{
      const r=
        el.getBoundingClientRect();

      if(
        r.width<110 ||
        r.height<28
      ){
        return false;
      }

      const value=text(el);

      return wanted.every(
        word=>value.includes(word)
      );
    })
    .sort((a,b)=>{
      const ar=
        a.getBoundingClientRect();

      const br=
        b.getBoundingClientRect();

      return (
        ar.width*ar.height -
        br.width*br.height
      );
    })[0] || null;
  }

  function clearLegacy(doc){
    try{
      frame
        .contentWindow
        .MEMEFLOW_FLIGHT_MODE
        ?.disable?.();
    }catch(_){}

    doc.body
      ?.classList
      .remove('mf-flight-mode');

    doc
      .getElementById(
        'mfFlightModeExit'
      )
      ?.remove();

    doc
      .querySelectorAll(
        '.mf-flight-stage,'+
        '.mf-flight-hud,'+
        '.mf-hud-launch,'+
        '.mf-hud-selected,'+
        '.mf-hud-record,'+
        '.mf-hud-history'
      )
      .forEach(el=>{
        el.classList.remove(
          'mf-flight-stage',
          'mf-flight-hud',
          'mf-hud-launch',
          'mf-hud-selected',
          'mf-hud-record',
          'mf-hud-history'
        );
      });
  }

  function clearV11Marks(doc){
    doc
      .querySelectorAll(
        '.mf-v11-stage,'+
        '.mf-v11-hud,'+
        '.mf-v11-launch,'+
        '.mf-v11-selected,'+
        '.mf-v11-record,'+
        '.mf-v11-history'
      )
      .forEach(el=>{
        el.classList.remove(
          'mf-v11-stage',
          'mf-v11-hud',
          'mf-v11-launch',
          'mf-v11-selected',
          'mf-v11-record',
          'mf-v11-history'
        );
      });
  }

  function detect(doc){
    /*
      IMPORTANT V11.3:
      Game already exposes a stable semantic scene:
        .flight-card = complete rocket card
        .sky         = actual space/rocket layer

      No more guessing by STAKE/P&L text.
    */

    const stage=
      doc.querySelector(
        '.flight-card'
      ) ||
      doc.getElementById('sky')
        ?.closest(
          '.flight-card,section,article,div'
        ) ||
      doc.querySelector(
        '[class*="flight-card"]'
      );

    const sky=
      stage?.querySelector(
        '#sky,.sky'
      ) ||
      doc.querySelector(
        '#sky,.sky'
      );

    const launch=
      doc.querySelector(
        '.launch-panel,.control-panel'
      ) ||
      smallest(
        doc,
        [
          'LAUNCH CONTROL',
          'PAPER BALANCE'
        ]
      );

    const selected=
      doc.querySelector(
        '.selected-launch,'+
        '.target-card'
      ) ||
      smallest(
        doc,
        [
          'SELECTED LAUNCH',
          'AI SCORE',
          'BUY PRESSURE'
        ]
      );

    const record=
      doc.querySelector(
        '.flight-record,'+
        '[class*="flight-record"]'
      ) ||
      smallest(
        doc,
        [
          'FLIGHT RECORD',
          'NET P&L'
        ]
      );

    const history=
      doc.querySelector(
        '.history-card,'+
        '[class*="history-card"]'
      ) ||
      smallest(
        doc,
        [
          'ROUND HISTORY'
        ]
      );

    return {
      stage,
      sky,
      launch,
      selected,
      record,
      history
    };
  }

  function installStyle(doc){
    let style=
      doc.getElementById(
        'mfV11InjectedStyle'
      );

    if(!style){
      style=
        doc.createElement(
          'style'
        );

      style.id=
        'mfV11InjectedStyle';

      doc.head.appendChild(
        style
      );
    }

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
        padding:0!important;

        overflow:hidden!important;

        background:#010408!important;
      }

      body{
        position:relative!important;
      }

      /*
        The original responsive page layout is NOT the layout of V11.
      */
      .game-topbar,
      .game-footer{
        display:none!important;
      }

      .game-shell{
        position:fixed!important;
        inset:0!important;

        width:100vw!important;
        height:100dvh!important;
        min-height:100dvh!important;

        margin:0!important;
        padding:0!important;

        overflow:hidden!important;
      }

      .game-layout{
        position:static!important;

        display:block!important;

        width:100%!important;
        max-width:none!important;
        height:100%!important;

        margin:0!important;
        padding:0!important;
      }

      /*
        REAL ROCKET SCENE.
      */
      .mf-v11-stage{
        position:fixed!important;
        inset:0!important;

        z-index:1000!important;

        display:flex!important;
        flex-direction:column!important;

        width:100vw!important;
        max-width:none!important;

        height:100dvh!important;
        min-height:100dvh!important;
        max-height:none!important;

        margin:0!important;
        padding:0!important;

        overflow:hidden!important;

        border:0!important;
        border-radius:0!important;

        background:#06162b!important;

        box-shadow:none!important;

        box-sizing:border-box!important;
      }

      /*
        The sky itself becomes edge-to-edge.
        Header, multiplier and bottom metrics remain above it.
      */
      .mf-v11-stage #sky,
      .mf-v11-stage .sky{
        position:absolute!important;
        inset:0!important;

        width:100%!important;
        height:100%!important;

        min-height:100%!important;

        border-radius:0!important;
      }

      .mf-v11-stage .flight-head{
        position:absolute!important;

        z-index:30!important;

        top:0!important;
        left:0!important;
        right:0!important;

        padding-top:
          max(
            12px,
            env(safe-area-inset-top)
          )!important;

        background:
          linear-gradient(
            180deg,
            rgba(2,6,11,.74),
            transparent
          )!important;

        pointer-events:none!important;
      }

      .mf-v11-stage .multiplier-wrap{
        z-index:31!important;
      }

      .mf-v11-stage .position-bar{
        position:absolute!important;

        z-index:32!important;

        left:0!important;
        right:0!important;
        bottom:0!important;

        margin:0!important;

        background:
          rgba(3,8,12,.78)!important;

        backdrop-filter:
          blur(12px)!important;

        -webkit-backdrop-filter:
          blur(12px)!important;
      }

      /*
        HUD PANELS
      */
      .mf-v11-hud{
        position:fixed!important;

        z-index:1500!important;

        min-width:0!important;

        margin:0!important;

        box-sizing:border-box!important;

        border:
          1px solid
          rgba(130,181,199,.21)!important;

        border-radius:17px!important;

        background:
          linear-gradient(
            180deg,
            rgba(6,13,18,.82),
            rgba(3,8,12,.72)
          )!important;

        box-shadow:
          0 16px 44px
          rgba(0,0,0,.30)!important;

        backdrop-filter:
          blur(14px)
          saturate(1.08)!important;

        -webkit-backdrop-filter:
          blur(14px)
          saturate(1.08)!important;

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

      /*
        PORTRAIT PHONE
      */
      .mf-v11-launch{
        left:
          max(
            7px,
            env(safe-area-inset-left)
          )!important;

        bottom:
          max(
            74px,
            calc(
              env(safe-area-inset-bottom)
              + 62px
            )
          )!important;

        width:min(48vw,390px)!important;
        max-width:min(48vw,390px)!important;

        max-height:55dvh!important;

        overflow:auto!important;

        overscroll-behavior:contain!important;

        -webkit-overflow-scrolling:touch!important;
      }

      .mf-v11-selected{
        right:
          max(
            7px,
            env(safe-area-inset-right)
          )!important;

        top:
          max(
            78px,
            calc(
              env(safe-area-inset-top)
              + 64px
            )
          )!important;

        width:min(45vw,340px)!important;
        max-width:min(45vw,340px)!important;

        max-height:29dvh!important;

        overflow:auto!important;

        -webkit-overflow-scrolling:touch!important;
      }

      .mf-v11-record{
        right:
          max(
            7px,
            env(safe-area-inset-right)
          )!important;

        top:42dvh!important;

        width:min(45vw,340px)!important;
        max-width:min(45vw,340px)!important;

        max-height:16dvh!important;

        overflow:auto!important;
      }

      .mf-v11-history{
        right:
          max(
            7px,
            env(safe-area-inset-right)
          )!important;

        bottom:
          max(
            74px,
            calc(
              env(safe-area-inset-bottom)
              + 62px
            )
          )!important;

        width:min(45vw,340px)!important;
        max-width:min(45vw,340px)!important;

        max-height:28dvh!important;

        overflow:auto!important;

        overscroll-behavior:contain!important;

        -webkit-overflow-scrolling:touch!important;
      }

      /*
        Settings + wallet are allowed to cover everything.
      */
      .mf-game-settings-overlay,
      .mf-game-wallet-overlay{
        z-index:100000!important;
      }

      /*
        LANDSCAPE
      */
      @media (orientation:landscape){
        .mf-v11-launch{
          left:
            max(
              10px,
              env(safe-area-inset-left)
            )!important;

          top:
            max(
              10px,
              env(safe-area-inset-top)
            )!important;

          bottom:
            max(
              10px,
              env(safe-area-inset-bottom)
            )!important;

          width:min(27vw,390px)!important;
          max-width:min(27vw,390px)!important;

          max-height:none!important;
        }

        .mf-v11-selected{
          right:
            max(
              10px,
              env(safe-area-inset-right)
            )!important;

          top:
            max(
              10px,
              env(safe-area-inset-top)
            )!important;

          width:min(23vw,340px)!important;
          max-width:min(23vw,340px)!important;

          max-height:39dvh!important;
        }

        .mf-v11-record{
          right:
            max(
              10px,
              env(safe-area-inset-right)
            )!important;

          top:43dvh!important;

          width:min(23vw,340px)!important;
          max-width:min(23vw,340px)!important;

          max-height:18dvh!important;
        }

        .mf-v11-history{
          right:
            max(
              10px,
              env(safe-area-inset-right)
            )!important;

          bottom:
            max(
              10px,
              env(safe-area-inset-bottom)
            )!important;

          width:min(23vw,340px)!important;
          max-width:min(23vw,340px)!important;

          max-height:34dvh!important;
        }
      }

      @media
      (max-height:500px)
      and
      (orientation:landscape){

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
  }

  function apply(){
    let doc;

    try{
      doc=
        frame.contentDocument;
    }catch(error){
      console.error(
        '[MEMEFLOW FULLSCREEN V11.3]',
        error
      );

      showToast(
        'Could not access the Game frame.'
      );

      loading
        .classList
        .add('is-ready');

      return;
    }

    if(
      !doc ||
      !doc.body
    ){
      setTimeout(
        apply,
        150
      );

      return;
    }

    clearLegacy(doc);
    clearV11Marks(doc);

    const parts=
      detect(doc);

    if(!parts.stage){
      /*
        Safe fallback: do not black out or hide the Game.
      */
      console.warn(
        '[MEMEFLOW FULLSCREEN V11.3]',
        'flight-card not found'
      );

      showToast(
        'Rocket scene is still loading. Retrying…',
        2500
      );

      loading
        .classList
        .add('is-ready');

      return;
    }

    installStyle(doc);

    parts.stage
      .classList
      .add('mf-v11-stage');

    [
      [
        parts.launch,
        'mf-v11-launch'
      ],
      [
        parts.selected,
        'mf-v11-selected'
      ],
      [
        parts.record,
        'mf-v11-record'
      ],
      [
        parts.history,
        'mf-v11-history'
      ]
    ]
    .forEach(
      ([el,cls])=>{
        if(!el)return;

        el.classList.add(
          'mf-v11-hud',
          cls
        );
      }
    );

    /*
      Hide only the old in-frame fullscreen control.
      Settings / wallet / sound remain usable.
    */
    const utility=
      doc.querySelector(
        '.launch-panel .utility-actions,'+
        '.control-panel .utility-actions'
      );

    if(utility){
      const buttons=[
        ...utility.querySelectorAll(
          'button,[role="button"]'
        )
      ];

      if(buttons.length){
        const oldFullscreen=
          buttons[
            buttons.length-1
          ];

        const label=(
          String(
            oldFullscreen
              ?.getAttribute(
                'aria-label'
              )||''
          )+
          ' '+
          String(
            oldFullscreen
              ?.getAttribute(
                'title'
              )||''
          )
        )
        .toUpperCase();

        if(
          oldFullscreen &&
          (
            label.includes('FLIGHT') ||
            label.includes('FULL') ||
            buttons.length>=3
          )
        ){
          oldFullscreen.style.display=
            'none';
        }
      }
    }

    try{
      frame
        .contentWindow
        .dispatchEvent(
          new Event('resize')
        );
    }catch(_){}

    loading
      .classList
      .add('is-ready');

    toast.hidden=true;

    console.info(
      '[MEMEFLOW FULLSCREEN V11.3]',
      'READY',
      parts
    );
  }

  frame.addEventListener(
    'load',
    ()=>{
      setTimeout(apply,120);
      setTimeout(apply,650);
      setTimeout(apply,1400);
    }
  );

  frame.src=source;

  exitBtn.addEventListener(
    'click',
    async()=>{
      try{
        if(
          document.fullscreenElement
        ){
          await document
            .exitFullscreen();
        }
      }catch(_){}

      /*
        This window is separate.
        Close it first; if browser refuses, go back to Game URL.
      */
      window.close();

      setTimeout(()=>{
        if(!window.closed){
          location.href=back;
        }
      },120);
    }
  );

  fsBtn.addEventListener(
    'click',
    async()=>{
      try{
        if(
          document.fullscreenElement
        ){
          await document
            .exitFullscreen();

          return;
        }

        if(
          document
            .documentElement
            .requestFullscreen
        ){
          await document
            .documentElement
            .requestFullscreen({
              navigationUI:'hide'
            });

          return;
        }

        if(
          document
            .documentElement
            .webkitRequestFullscreen
        ){
          document
            .documentElement
            .webkitRequestFullscreen();

          return;
        }

        showToast(
          'Safari browser fullscreen is unavailable here. Flight View already fills this page.'
        );
      }catch(error){
        console.warn(
          '[MEMEFLOW FULLSCREEN V11.3]',
          'native fullscreen:',
          error
        );

        showToast(
          'Safari kept its browser controls visible. Flight View itself is still active.'
        );
      }
    }
  );

  window.addEventListener(
    'orientationchange',
    ()=>{
      setTimeout(
        apply,
        220
      );
    }
  );

  console.info(
    '[MEMEFLOW FULLSCREEN V11.3]',
    'SOURCE',
    source
  );
})();
EOF

python - <<'PY'
from pathlib import Path
import re, time

p=Path(
    "memeflow-app/game-fullscreen-v11.html"
)

s=p.read_text()

v=str(int(time.time()))

s=re.sub(
    r'/game-fullscreen-v11\.js\?v=\d+',
    f'/game-fullscreen-v11.js?v={v}',
    s
)

s=re.sub(
    r'/game-fullscreen-v11\.css\?v=\d+',
    f'/game-fullscreen-v11.css?v={v}',
    s
)

p.write_text(
    s.rstrip()+
    "\n"
)

print(
    "V11.3 cache:",
    v
)
PY

node --check "$JS"

git diff --check -- \
  "$JS" \
  "$HTML"

echo
echo "=== V11.3 CHECKS PASS ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add \
    "$JS" \
    "$HTML"

  if ! git diff --cached --quiet; then
    git commit \
      -m "Use real flight-card scene in Fullscreen V11.3" \
      || true

    BRANCH="$(
      git branch --show-current \
      2>/dev/null ||
      true
    )"

    if [ -n "$BRANCH" ]; then
      git push \
        origin \
        "$BRANCH" \
        || {
          echo "WARNING: Git push failed."
          echo "Local Replit files are still patched."
        }
    fi
  fi
fi

echo
echo "=========================================="
echo " MEMEFLOW FULLSCREEN V11.3 INSTALLED"
echo "=========================================="
echo
echo "Separate Flight View page: PRESERVED"
echo "Normal Game tab: PRESERVED"
echo "Real scene selector: .flight-card"
echo "Real sky selector: #sky / .sky"
echo "Legacy text-based stage guessing: REMOVED"
echo
echo "NEXT:"
echo "  1. Stop"
echo "  2. Run"
echo "  3. Close the broken Flight View tab"
echo "  4. Open normal Game"
echo "  5. Tap the four-corners button"
echo "  6. Allow the new Safari tab if asked"
echo
