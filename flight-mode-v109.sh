#!/usr/bin/env bash

# MEMEFLOW — Cinematic Flight Mode V10.9
# Safe Replit installer.
# Upload this file to the Replit project root and run:
#   bash flight-mode-v109.sh
#
# This patch is non-destructive:
# - keeps the normal Game layout
# - keeps AUTO, settings, wallet, history and game logic
# - adds only a fullscreen HUD/Flight Mode layer
# - creates a backup before changing game-settings-v107.js

set -u

say() {
  printf '\n%s\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  printf 'Nothing else will be changed.\n' >&2
  exit 1
}

say "=== MEMEFLOW FLIGHT MODE V10.9 INSTALLER ==="

ROOT=""

candidates=(
  "$PWD"
  "$HOME/workspace"
  "/home/runner/workspace"
  "/workspace"
)

for base in "${candidates[@]}"; do
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

[ -n "$ROOT" ] || fail "Could not find memeflow-app/game-settings-v107.js"

cd "$ROOT" || fail "Could not enter project root: $ROOT"

APP="memeflow-app"
SETTINGS="$APP/game-settings-v107.js"
CSS="$APP/game-flight-mode-v109.css"
JS="$APP/game-flight-mode-v109.js"
BACKUP="$APP/_backup/v10.9-flight-mode"

say "Project root: $ROOT"

mkdir -p "$BACKUP" || fail "Could not create backup folder"

if [ ! -f "$BACKUP/game-settings-v107.js" ]; then
  cp "$SETTINGS" "$BACKUP/game-settings-v107.js" || fail "Could not back up game-settings-v107.js"
fi

say "Backup ready: $BACKUP"

cat > "$CSS" <<'EOF'
/* ==========================================================
   MEMEFLOW GAME — CINEMATIC FLIGHT MODE V10.9
   ========================================================== */

body.mf-flight-mode{
  overflow:hidden!important;
  background:#010408!important;
}

body.mf-flight-mode .mf-flight-stage{
  position:fixed!important;
  inset:0!important;
  z-index:100!important;
  width:100vw!important;
  max-width:none!important;
  height:100dvh!important;
  min-height:100dvh!important;
  max-height:none!important;
  margin:0!important;
  border:0!important;
  border-radius:0!important;
  overflow:hidden!important;
  background:#020812!important;
  box-shadow:none!important;
  box-sizing:border-box!important;
}

body.mf-flight-mode .mf-flight-stage canvas,
body.mf-flight-mode .mf-flight-stage .stage,
body.mf-flight-mode .mf-flight-stage .stage-canvas,
body.mf-flight-mode .mf-flight-stage .flight-stage,
body.mf-flight-mode .mf-flight-stage .chart-stage,
body.mf-flight-mode .mf-flight-stage .space-stage{
  max-width:none!important;
}

body.mf-flight-mode .mf-flight-hud{
  position:fixed!important;
  z-index:160!important;
  margin:0!important;
  overflow:hidden;
  background:linear-gradient(180deg,rgba(7,13,18,.84),rgba(4,8,12,.76))!important;
  border:1px solid rgba(132,177,196,.23)!important;
  box-shadow:0 12px 40px rgba(0,0,0,.30)!important;
  backdrop-filter:blur(15px) saturate(1.15);
  -webkit-backdrop-filter:blur(15px) saturate(1.15);
  pointer-events:auto!important;
}

body.mf-flight-mode .mf-hud-launch{
  left:max(10px,env(safe-area-inset-left))!important;
  bottom:max(12px,env(safe-area-inset-bottom))!important;
  width:min(39vw,390px)!important;
  max-height:calc(100dvh - 90px)!important;
  border-radius:18px!important;
}

body.mf-flight-mode .mf-hud-selected{
  right:max(10px,env(safe-area-inset-right))!important;
  top:max(72px,calc(env(safe-area-inset-top) + 52px))!important;
  width:min(35vw,330px)!important;
  max-height:40dvh!important;
  border-radius:17px!important;
}

body.mf-flight-mode .mf-hud-record{
  right:max(10px,env(safe-area-inset-right))!important;
  top:48dvh!important;
  width:min(35vw,330px)!important;
  border-radius:17px!important;
}

body.mf-flight-mode .mf-hud-history{
  right:max(10px,env(safe-area-inset-right))!important;
  bottom:max(12px,env(safe-area-inset-bottom))!important;
  width:min(35vw,330px)!important;
  max-height:31dvh!important;
  border-radius:17px!important;
}

body.mf-flight-mode .mf-hud-history .history,
body.mf-flight-mode .mf-hud-history [class*="history-list"]{
  overflow-y:auto!important;
  overflow-x:hidden!important;
  max-height:25dvh!important;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
}

body.mf-flight-mode .mf-flight-stage{
  pointer-events:none!important;
}

body.mf-flight-mode .mf-flight-stage button,
body.mf-flight-mode .mf-flight-stage input,
body.mf-flight-mode .mf-flight-stage select,
body.mf-flight-mode .mf-flight-stage a{
  pointer-events:auto!important;
}

#mfFlightModeExit{
  position:fixed;
  z-index:220;
  top:max(10px,env(safe-area-inset-top));
  right:max(10px,env(safe-area-inset-right));
  min-width:42px;
  height:38px;
  padding:0 12px;
  display:none;
  align-items:center;
  justify-content:center;
  gap:7px;
  border:1px solid rgba(109,220,255,.36);
  border-radius:12px;
  background:rgba(5,13,18,.74);
  color:#dffaff;
  font:800 9px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  letter-spacing:.08em;
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

body.mf-flight-mode #mfFlightModeExit{
  display:flex;
}

.mf-game-settings-overlay,
.mf-game-wallet-overlay{
  z-index:10000!important;
}

@media (max-width:700px) and (orientation:portrait){
  body.mf-flight-mode .mf-hud-launch{
    left:7px!important;
    bottom:max(8px,env(safe-area-inset-bottom))!important;
    width:53vw!important;
    max-height:58dvh!important;
  }

  body.mf-flight-mode .mf-hud-selected{
    right:7px!important;
    top:max(82px,calc(env(safe-area-inset-top) + 65px))!important;
    width:42vw!important;
    max-height:34dvh!important;
  }

  body.mf-flight-mode .mf-hud-record{
    right:7px!important;
    top:48dvh!important;
    width:42vw!important;
  }

  body.mf-flight-mode .mf-hud-history{
    right:7px!important;
    bottom:max(8px,env(safe-area-inset-bottom))!important;
    width:42vw!important;
    max-height:31dvh!important;
  }

  body.mf-flight-mode .mf-hud-history .history,
  body.mf-flight-mode .mf-hud-history [class*="history-list"]{
    max-height:23dvh!important;
  }

  body.mf-flight-mode .mf-flight-hud{
    font-size:.90em;
  }
}

@media (orientation:landscape){
  body.mf-flight-mode .mf-hud-launch{
    left:max(12px,env(safe-area-inset-left))!important;
    top:max(12px,env(safe-area-inset-top))!important;
    bottom:max(12px,env(safe-area-inset-bottom))!important;
    width:min(27vw,390px)!important;
    max-height:none!important;
  }

  body.mf-flight-mode .mf-hud-selected{
    right:max(12px,env(safe-area-inset-right))!important;
    top:max(12px,env(safe-area-inset-top))!important;
    width:min(23vw,330px)!important;
    max-height:39dvh!important;
  }

  body.mf-flight-mode .mf-hud-record{
    right:max(12px,env(safe-area-inset-right))!important;
    top:43dvh!important;
    width:min(23vw,330px)!important;
  }

  body.mf-flight-mode .mf-hud-history{
    right:max(12px,env(safe-area-inset-right))!important;
    bottom:max(12px,env(safe-area-inset-bottom))!important;
    width:min(23vw,330px)!important;
    max-height:34dvh!important;
  }

  body.mf-flight-mode .mf-flight-stage{
    padding-left:min(27vw,390px)!important;
    padding-right:min(23vw,330px)!important;
  }

  #mfFlightModeExit{
    right:calc(max(12px,env(safe-area-inset-right)) + min(23vw,330px) + 10px);
  }
}

@media (max-height:500px) and (orientation:landscape){
  body.mf-flight-mode .mf-hud-launch{
    width:25vw!important;
    font-size:.76em!important;
    overflow-y:auto!important;
    -webkit-overflow-scrolling:touch;
  }

  body.mf-flight-mode .mf-hud-selected,
  body.mf-flight-mode .mf-hud-record,
  body.mf-flight-mode .mf-hud-history{
    width:21vw!important;
    font-size:.74em!important;
  }

  body.mf-flight-mode .mf-flight-stage{
    padding-left:25vw!important;
    padding-right:21vw!important;
  }

  body.mf-flight-mode .mf-hud-history{
    max-height:38dvh!important;
  }

  body.mf-flight-mode .mf-hud-history .history,
  body.mf-flight-mode .mf-hud-history [class*="history-list"]{
    max-height:29dvh!important;
  }

  #mfFlightModeExit{
    height:30px;
    padding:0 8px;
    font-size:7px;
  }
}
EOF

[ -s "$CSS" ] || fail "CSS file was not created"

cat > "$JS" <<'EOF'
(()=>{
  'use strict';

  const VERSION='10.9';

  let active=false;
  let stage=null;
  let launch=null;
  let selected=null;
  let record=null;
  let history=null;
  let exitBtn=null;

  function text(el){
    return String(el?.innerText || el?.textContent || '')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function candidates(){
    return [...document.querySelectorAll('section,article,div')]
      .filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>170 && r.height>60;
      });
  }

  function smallestPanelContaining(words){
    const wanted=words.map(s=>s.toUpperCase());

    const matches=candidates()
      .filter(el=>{
        const t=text(el);
        return wanted.every(word=>t.includes(word));
      })
      .sort((a,b)=>
        (
          a.getBoundingClientRect().width *
          a.getBoundingClientRect().height
        )
        -
        (
          b.getBoundingClientRect().width *
          b.getBoundingClientRect().height
        )
      );

    return matches[0]||null;
  }

  function findPanels(){
    stage=smallestPanelContaining([
      'STAKE',
      'PAPER VALUE',
      'P&L',
      'STAGE',
      'PRICE AGE'
    ]);

    launch=
      document.querySelector('.launch-panel') ||
      smallestPanelContaining([
        'LAUNCH CONTROL',
        'PAPER BALANCE'
      ]);

    selected=smallestPanelContaining([
      'SELECTED LAUNCH',
      'AI SCORE',
      'BUY PRESSURE'
    ]);

    record=smallestPanelContaining([
      'FLIGHT RECORD',
      'NET P&L'
    ]);

    history=smallestPanelContaining([
      'ROUND HISTORY'
    ]);

    return !!stage;
  }

  function mark(){
    if(!findPanels())return false;

    stage.classList.add('mf-flight-stage');

    [launch,selected,record,history]
      .filter(Boolean)
      .forEach(el=>el.classList.add('mf-flight-hud'));

    launch?.classList.add('mf-hud-launch');
    selected?.classList.add('mf-hud-selected');
    record?.classList.add('mf-hud-record');
    history?.classList.add('mf-hud-history');

    return true;
  }

  function createExit(){
    if(exitBtn)return;

    exitBtn=document.createElement('button');
    exitBtn.id='mfFlightModeExit';
    exitBtn.type='button';
    exitBtn.innerHTML='✕ <span>HUD</span>';
    exitBtn.setAttribute('aria-label','Exit Flight Mode');
    exitBtn.addEventListener('click',disable);

    document.body.appendChild(exitBtn);
  }

  function enable(){
    if(active)return;

    if(!mark()){
      console.warn('[FLIGHT MODE] stage not found yet');
      return;
    }

    document.body.dataset.mfFlightScrollY=
      String(window.scrollY||0);

    active=true;
    document.body.classList.add('mf-flight-mode');
    createExit();
    window.scrollTo(0,0);

    console.info('[MEMEFLOW FLIGHT MODE]',VERSION,'ON');
  }

  function disable(){
    if(!active)return;

    active=false;
    document.body.classList.remove('mf-flight-mode');

    const y=
      Number(document.body.dataset.mfFlightScrollY||0);

    requestAnimationFrame(()=>{
      window.scrollTo(0,y);
    });

    console.info('[MEMEFLOW FLIGHT MODE]',VERSION,'OFF');
  }

  function toggle(){
    active ? disable() : enable();
  }

  function isFullscreenControl(el){
    if(!el)return false;

    const s=(
      String(el.innerText||'')+' '+
      String(el.getAttribute('aria-label')||'')+' '+
      String(el.getAttribute('title')||'')
    ).toUpperCase();

    return s.includes('FULL SCREEN') || s.includes('FULLSCREEN');
  }

  document.addEventListener(
    'click',
    event=>{
      const button=
        event.target.closest('button,[role="button"]');

      if(button && isFullscreenControl(button)){
        setTimeout(toggle,60);
      }
    },
    true
  );

  document.addEventListener(
    'fullscreenchange',
    ()=>{
      if(!document.fullscreenElement && active){
        disable();
      }
    }
  );

  globalThis.MEMEFLOW_FLIGHT_MODE={
    version:VERSION,
    enable,
    disable,
    toggle,

    get active(){
      return active;
    },

    refresh(){
      mark();
    }
  };

  console.info('[MEMEFLOW FLIGHT MODE]',VERSION,'READY');
})();
EOF

[ -s "$JS" ] || fail "JavaScript file was not created"

if command -v node >/dev/null 2>&1; then
  node --check "$JS" || fail "game-flight-mode-v109.js failed syntax check"
fi

python - <<'PY'
from pathlib import Path
import time

p = Path("memeflow-app/game-settings-v107.js")

if not p.exists():
    raise SystemExit("game-settings-v107.js not found")

s = p.read_text()

START = "/* === GAME FLIGHT MODE V10.9 BOOTSTRAP START === */"
END   = "/* === GAME FLIGHT MODE V10.9 BOOTSTRAP END === */"

if START in s and END in s:
    a = s.index(START)
    b = s.index(END, a) + len(END)
    s = s[:a] + s[b:]

v = str(int(time.time()))

bootstrap = f'''

{START}
;(()=>{{
  const VERSION='10.9';

  function loadFlightMode(){{

    if(!document.getElementById('mfGameFlightV109Css')){{
      const css=document.createElement('link');
      css.id='mfGameFlightV109Css';
      css.rel='stylesheet';
      css.href='/game-flight-mode-v109.css?v={v}';
      document.head.appendChild(css);
    }}

    if(
      !document.getElementById('mfGameFlightV109Js') &&
      !globalThis.MEMEFLOW_FLIGHT_MODE
    ){{
      const js=document.createElement('script');
      js.id='mfGameFlightV109Js';
      js.src='/game-flight-mode-v109.js?v={v}';
      js.async=false;

      js.onload=()=>{{
        console.info(
          '[FLIGHT MODE BOOTSTRAP]',
          VERSION,
          'LOADED'
        );
      }};

      js.onerror=()=>{{
        console.error(
          '[FLIGHT MODE BOOTSTRAP]',
          VERSION,
          'LOAD FAILED'
        );
      }};

      document.head.appendChild(js);
    }}
  }}

  if(document.readyState==='loading'){{
    document.addEventListener(
      'DOMContentLoaded',
      loadFlightMode,
      {{once:true}}
    );
  }}else{{
    loadFlightMode();
  }}

}})();
{END}
'''

p.write_text(
    s.rstrip() +
    bootstrap +
    '\n'
)

print("Flight Mode bootstrap cache:", v)
PY

if [ $? -ne 0 ]; then
  fail "Could not patch game-settings-v107.js"
fi

if command -v node >/dev/null 2>&1; then
  node --check "$SETTINGS" || fail "game-settings-v107.js failed syntax check"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check -- \
    "$CSS" \
    "$JS" \
    "$SETTINGS" || fail "git diff --check found an error"

  git add \
    "$CSS" \
    "$JS" \
    "$SETTINGS"

  if ! git diff --cached --quiet; then
    git commit -m "Add cinematic fullscreen Flight Mode V10.9" || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        say "Git push failed, but Flight Mode is installed locally in Replit."
      }
    fi
  else
    say "No new Git changes — V10.9 already appears installed."
  fi
else
  say "Git repository not detected. Flight Mode was installed locally only."
fi

say "=========================================="
say " V10.9 CINEMATIC FLIGHT MODE INSTALLED"
say "=========================================="

printf '%s\n' \
  "Normal Game layout: PRESERVED" \
  "Game data: PRESERVED" \
  "AUTO: PRESERVED" \
  "Round History: PRESERVED" \
  "Settings: PRESERVED" \
  "Wallet: PRESERVED" \
  "Fullscreen -> cinematic HUD: ENABLED"

say "NEXT:"
printf '%s\n' \
  "1. Replit: Stop" \
  "2. Replit: Run" \
  "3. Reopen Game" \
  "4. Tap FULL SCREEN"

exit 0
