#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW FLIGHT V12.4 — APP WINDOW OPEN ONLY ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/flight-v12-launcher.js" ] && \
     [ -f "$base/memeflow-app/game.html" ]; then
    ROOT="$base"
    break
  fi
done

if [ -z "$ROOT" ]; then
  found="$(find "$PWD" "$HOME" -maxdepth 4 -type f -path '*/memeflow-app/flight-v12-launcher.js' 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    ROOT="${found%/memeflow-app/flight-v12-launcher.js}"
  fi
fi

[ -n "$ROOT" ] || {
  echo "ERROR: memeflow-app/flight-v12-launcher.js not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
LAUNCHER="$APP/flight-v12-launcher.js"
GAME_HTML="$APP/game.html"
BACKUP="$APP/_backup/flight-v12.4-app-open"

mkdir -p "$BACKUP"
cp -f "$LAUNCHER" "$BACKUP/flight-v12-launcher.js.before-v124"
cp -f "$GAME_HTML" "$BACKUP/game.html.before-v124"

cat > "$LAUNCHER" <<'EOF'
(()=>{
  'use strict';

  const VERSION='12.4';

  if(location.pathname.includes('flight-v12')){
    return;
  }

  const $=(s)=>document.querySelector(s);

  function standalone(){
    return (
      navigator.standalone===true ||
      window.matchMedia?.('(display-mode: standalone)')?.matches===true ||
      window.matchMedia?.('(display-mode: fullscreen)')?.matches===true
    );
  }

  function removeOldGuide(){
    $('#iosFullscreenGuide')?.remove();
  }

  function install(){
    removeOldGuide();

    const old=$('#fullscreenBtn');

    if(!old){
      return false;
    }

    if(old.dataset.flightV124==='true'){
      return true;
    }

    /*
      Keep the existing visual button exactly as-is.
      Replace only its old fullscreen/new-tab behavior.
    */
    const button=old.cloneNode(true);

    button.dataset.flightV124='true';

    button.setAttribute(
      'aria-label',
      'Open Flight View'
    );

    button.setAttribute(
      'title',
      'Open Flight View'
    );

    old.replaceWith(button);

    button.addEventListener(
      'click',
      (event)=>{
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        /*
          CRITICAL V12.4:
          NEVER _blank
          NEVER window.open()
          NEVER popup

          If MEMEFLOW is already running as an installed iPhone web app,
          this keeps navigation inside that same chrome-free app window.
        */
        location.assign('/flight-v12.html');
      },
      true
    );

    console.info(
      '[MEMEFLOW FLIGHT V12.4]',
      standalone()
        ?'APP WINDOW MODE'
        :'SAME TAB MODE',
      VERSION
    );

    return true;
  }

  let attempts=0;

  const timer=setInterval(()=>{
    attempts+=1;

    if(install() || attempts>=60){
      clearInterval(timer);
    }
  },100);

  const observer=new MutationObserver(()=>{
    removeOldGuide();

    if(!document.querySelector('[data-flight-v124="true"]')){
      install();
    }
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
import re,time

p=Path("memeflow-app/game.html")
s=p.read_text()
v=str(int(time.time()))

s=re.sub(
    r'/flight-v12-launcher\.js(?:\?v=\d+)?',
    f'/flight-v12-launcher.js?v={v}',
    s
)

p.write_text(s.rstrip()+"\n")
print("V12.4 cache:",v)
PY

node --check "$LAUNCHER"
git diff --check -- "$LAUNCHER" "$GAME_HTML"

echo
echo "=== V12.4 CHECK PASS ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$LAUNCHER" "$GAME_HTML"

  if ! git diff --cached --quiet; then
    git commit -m "Keep Flight navigation inside app window V12.4" || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: git push failed; local Replit patch is still installed."
      }
    fi
  fi
fi

echo
echo "=================================================="
echo " MEMEFLOW FLIGHT V12.4 INSTALLED"
echo "=================================================="
echo
echo "CHANGED:"
echo "  fullscreen/Flight button opening behavior only"
echo "  no new Safari tab"
echo "  no window.open"
echo "  no popup"
echo "  same-window navigation to /flight-v12.html"
echo
echo "UNCHANGED:"
echo "  V12.3 visual layout"
echo "  rocket size/position"
echo "  Launch Control"
echo "  Selected Launch"
echo "  Flight Record"
echo "  Round History"
echo "  AUTO / CASH OUT / START"
echo "  settings / wallet"
echo "  all game logic"
echo
echo "IMPORTANT:"
echo "  Launch MEMEFLOW from the iPhone Home Screen icon."
echo "  Then tap Flight. It stays in the same standalone app window."
echo
echo "NEXT:"
echo "  Stop -> Run"
echo "  Launch MEMEFLOW from Home Screen"
echo "  Tap Flight/fullscreen button"
echo
