#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW FLIGHT V12.1 — REAL GAME STRUCTURE ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/game.html" ] && \
     [ -f "$base/memeflow-app/game.js" ] && \
     [ -f "$base/memeflow-app/flight-v12.html" ]; then
    ROOT="$base"
    break
  fi
done

[ -n "$ROOT" ] || {
  echo "ERROR: MEMEFLOW workspace not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
BACKUP="$APP/_backup/flight-v12.1-real-structure"
mkdir -p "$BACKUP"

for f in \
  game.html \
  game.js \
  game.webmanifest \
  flight-v12.html \
  flight-v12.css \
  flight-v12.js \
  flight-v12-launcher.js \
  flight-v12-manifest.json
do
  [ -f "$APP/$f" ] && cp -f "$APP/$f" "$BACKUP/$f"
done

echo "Backup ready: $BACKUP"

cat > "$APP/flight-v12.css" <<'EOF'
/* ==========================================================
   MEMEFLOW FLIGHT V12.1
   REAL CURRENT GAME STRUCTURE
   stage-card = full scene
   world      = rocket / space
   launch-panel / token-panel / stats-panel / history-panel = HUD
   ========================================================== */

:root{
  --v12-top:env(safe-area-inset-top,0px);
  --v12-right:env(safe-area-inset-right,0px);
  --v12-bottom:env(safe-area-inset-bottom,0px);
  --v12-left:env(safe-area-inset-left,0px);
}

html,
body.flight-v12,
body.flight-v12 .game{
  width:100vw!important;
  height:100dvh!important;
  min-height:100dvh!important;
  max-width:none!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#02060b!important;
}

body.flight-v12 .layout{
  position:fixed!important;
  inset:0!important;
  z-index:1!important;

  display:block!important;

  width:100vw!important;
  max-width:none!important;
  height:100dvh!important;
  min-height:0!important;

  margin:0!important;
  padding:0!important;
  gap:0!important;

  overflow:hidden!important;
}

/* ===== REAL ROCKET SCENE ===== */

body.flight-v12 .stage-card{
  position:fixed!important;
  inset:0!important;
  z-index:2!important;

  display:grid!important;
  grid-template-columns:1fr!important;
  grid-template-rows:
    calc(30px + var(--v12-top))
    minmax(0,1fr)
    calc(30px + var(--v12-bottom))!important;

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
  box-shadow:none!important;

  background:#06152a!important;
}

body.flight-v12 .stage-card>.stage-head{
  grid-row:1!important;

  width:100%!important;
  height:calc(30px + var(--v12-top))!important;
  min-height:calc(30px + var(--v12-top))!important;

  padding:
    var(--v12-top)
    max(7px,var(--v12-right))
    0
    max(7px,var(--v12-left))!important;

  border-radius:0!important;

  background:
    linear-gradient(
      180deg,
      rgba(2,7,12,.90),
      rgba(2,7,12,.48)
    )!important;

  position:relative!important;
  z-index:20!important;
}

/*
  THIS is the real current rocket/space container.
*/
body.flight-v12 .stage-card>#world,
body.flight-v12 .stage-card>.world{
  grid-row:2!important;

  position:relative!important;

  width:100%!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;

  align-self:stretch!important;

  margin:0!important;

  overflow:hidden!important;

  border-radius:0!important;
}

/* Current rocket renderer is allowed to use the whole world. */
body.flight-v12 #world canvas,
body.flight-v12 #world video{
  max-width:none!important;
}

/* Bottom live metrics remain part of the scene. */
body.flight-v12 .stage-card>.position-strip{
  grid-row:3!important;

  position:relative!important;
  z-index:20!important;

  width:100%!important;
  height:calc(30px + var(--v12-bottom))!important;
  min-height:calc(30px + var(--v12-bottom))!important;

  padding-bottom:var(--v12-bottom)!important;

  background:rgba(2,7,12,.82)!important;

  backdrop-filter:blur(12px)!important;
  -webkit-backdrop-filter:blur(12px)!important;
}

body.flight-v12 .stage-card>.position-strip>div{
  height:30px!important;
  min-height:30px!important;
}

/* Existing multiplier / telemetry stays above the actual world. */
body.flight-v12 .multiplier-hud,
body.flight-v12 .flight-assist,
body.flight-v12 .cashout-telemetry{
  z-index:28!important;
}

body.flight-v12 .multiplier-hud,
body.flight-v12 .game[data-state="live"] .multiplier-hud,
body.flight-v12 .game[data-state="settling"] .multiplier-hud{
  top:calc(var(--v12-top) + 36px)!important;
}

/* ===== REAL GAME PANELS AS HUD ===== */

body.flight-v12 .launch-panel,
body.flight-v12 .token-panel,
body.flight-v12 .stats-panel,
body.flight-v12 .history-panel{
  position:fixed!important;
  z-index:60!important;

  grid-column:auto!important;
  grid-row:auto!important;

  margin:0!important;

  min-width:0!important;

  border:
    1px solid
    rgba(126,185,205,.22)!important;

  background:
    linear-gradient(
      180deg,
      rgba(7,15,21,.84),
      rgba(3,9,14,.76)
    )!important;

  box-shadow:
    0 18px 52px
    rgba(0,0,0,.30)!important;

  backdrop-filter:
    blur(16px)
    saturate(1.08)!important;

  -webkit-backdrop-filter:
    blur(16px)
    saturate(1.08)!important;
}

/* Left cockpit */
body.flight-v12 .launch-panel{
  left:max(7px,var(--v12-left))!important;
  bottom:max(8px,var(--v12-bottom))!important;

  width:min(49vw,390px)!important;
  max-width:min(49vw,390px)!important;

  height:auto!important;
  max-height:59dvh!important;

  padding:5px!important;

  display:flex!important;
  flex-direction:column!important;

  overflow:auto!important;

  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

/* Right upper target */
body.flight-v12 .token-panel{
  right:max(7px,var(--v12-right))!important;
  top:calc(var(--v12-top) + 54px)!important;

  width:min(42vw,330px)!important;
  max-width:min(42vw,330px)!important;

  height:auto!important;
  max-height:30dvh!important;

  padding:5px!important;

  overflow:auto!important;
}

/* Right middle record */
body.flight-v12 .stats-panel{
  right:max(7px,var(--v12-right))!important;
  top:43dvh!important;

  width:min(42vw,330px)!important;
  max-width:min(42vw,330px)!important;

  height:auto!important;
  max-height:15dvh!important;

  padding:5px!important;

  overflow:auto!important;
}

/* Right lower scrollable session history */
body.flight-v12 .history-panel{
  right:max(7px,var(--v12-right))!important;
  bottom:max(8px,var(--v12-bottom))!important;

  width:min(42vw,330px)!important;
  max-width:min(42vw,330px)!important;

  height:28dvh!important;
  min-height:0!important;
  max-height:28dvh!important;

  padding:0!important;

  display:grid!important;
  grid-template-rows:
    24px
    18px
    minmax(0,1fr)!important;

  overflow:hidden!important;
}

body.flight-v12 .history-panel>summary{
  height:24px!important;
  min-height:24px!important;
}

body.flight-v12 .history-toolbar{
  height:18px!important;
  min-height:18px!important;
}

/*
  Previous phone CSS intentionally showed only 3 rows.
  Flight V12 shows the whole current-session history with touch scroll.
*/
body.flight-v12 .history-panel .history{
  position:static!important;

  width:100%!important;
  height:100%!important;
  min-height:0!important;
  max-height:none!important;

  padding:2px!important;

  display:block!important;

  overflow-x:hidden!important;
  overflow-y:auto!important;

  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

body.flight-v12 .history-panel .history-row{
  display:grid!important;
  min-height:34px!important;
  margin:0 0 2px!important;
}

body.flight-v12 .history-panel .history-row:nth-child(n){
  display:grid!important;
}

/* Utility controls stay available, except old fullscreen recursion. */
body.flight-v12 #fullscreenBtn{
  display:none!important;
}

/* Settings + wallet overlays must cover Flight HUD. */
body.flight-v12 .mf-game-settings-overlay,
body.flight-v12 .mf-game-wallet-overlay,
body.flight-v12 [class*="settings-overlay"],
body.flight-v12 [class*="wallet-overlay"]{
  z-index:100000!important;
}

/* Result / final AUTO summary remains above the cockpit. */
body.flight-v12 .result,
body.flight-v12 [class*="session-summary"]{
  z-index:120000!important;
}

/* ===== EXIT BACK TO NORMAL GAME ===== */

#v12Exit{
  position:fixed!important;
  z-index:90000!important;

  top:calc(var(--v12-top) + 7px)!important;
  right:max(7px,var(--v12-right))!important;

  width:40px!important;
  height:40px!important;

  display:grid!important;
  place-items:center!important;

  border:
    1px solid
    rgba(125,185,207,.27)!important;

  border-radius:13px!important;

  background:
    rgba(4,11,16,.68)!important;

  color:#eafaff!important;

  box-shadow:
    0 10px 30px
    rgba(0,0,0,.22)!important;

  backdrop-filter:blur(14px)!important;
  -webkit-backdrop-filter:blur(14px)!important;

  text-decoration:none!important;

  font:
    800 20px/1
    system-ui,
    -apple-system,
    sans-serif!important;

  -webkit-tap-highlight-color:transparent;
}

/* ===== LANDSCAPE: the originally requested 3-column cockpit ===== */

@media (orientation:landscape){
  body.flight-v12 .stage-card{
    grid-template-rows:
      calc(26px + var(--v12-top))
      minmax(0,1fr)
      calc(25px + var(--v12-bottom))!important;
  }

  body.flight-v12 .stage-card>.stage-head{
    height:calc(26px + var(--v12-top))!important;
    min-height:calc(26px + var(--v12-top))!important;
  }

  body.flight-v12 .stage-card>.position-strip{
    height:calc(25px + var(--v12-bottom))!important;
    min-height:calc(25px + var(--v12-bottom))!important;
  }

  body.flight-v12 .stage-card>.position-strip>div{
    height:25px!important;
    min-height:25px!important;
  }

  body.flight-v12 .multiplier-hud,
  body.flight-v12 .game[data-state="live"] .multiplier-hud,
  body.flight-v12 .game[data-state="settling"] .multiplier-hud{
    top:calc(var(--v12-top) + 31px)!important;
  }

  body.flight-v12 .launch-panel{
    left:max(9px,var(--v12-left))!important;
    top:max(9px,var(--v12-top))!important;
    bottom:max(9px,var(--v12-bottom))!important;

    width:min(26vw,390px)!important;
    max-width:min(26vw,390px)!important;

    height:auto!important;
    max-height:none!important;
  }

  body.flight-v12 .token-panel{
    right:max(9px,var(--v12-right))!important;
    top:max(9px,var(--v12-top))!important;

    width:min(22vw,330px)!important;
    max-width:min(22vw,330px)!important;

    max-height:37dvh!important;
  }

  body.flight-v12 .stats-panel{
    right:max(9px,var(--v12-right))!important;
    top:41dvh!important;

    width:min(22vw,330px)!important;
    max-width:min(22vw,330px)!important;

    max-height:17dvh!important;
  }

  body.flight-v12 .history-panel{
    right:max(9px,var(--v12-right))!important;
    bottom:max(9px,var(--v12-bottom))!important;

    width:min(22vw,330px)!important;
    max-width:min(22vw,330px)!important;

    height:36dvh!important;
    max-height:36dvh!important;
  }

  #v12Exit{
    right:
      calc(
        max(9px,var(--v12-right))
        + min(22vw,330px)
        + 9px
      )!important;
  }
}

/* Very short landscape iPhones */
@media (max-height:500px) and (orientation:landscape){
  body.flight-v12 .launch-panel{
    width:25vw!important;
    max-width:25vw!important;
    font-size:.82em!important;
  }

  body.flight-v12 .token-panel,
  body.flight-v12 .stats-panel,
  body.flight-v12 .history-panel{
    width:21vw!important;
    max-width:21vw!important;
    font-size:.82em!important;
  }

  #v12Exit{
    width:32px!important;
    height:32px!important;
    right:
      calc(
        max(8px,var(--v12-right))
        + 21vw
        + 8px
      )!important;
  }
}
EOF

cat > "$APP/flight-v12.js" <<'EOF'
(()=>{
  'use strict';

  const VERSION='12.1';

  const $=(s)=>document.querySelector(s);

  function removeOldGuide(){
    $('#iosFullscreenGuide')?.remove();
  }

  function boot(){
    const game=$('#game');
    const stage=$('.stage-card');
    const world=$('#world.world');
    const launch=$('.launch-panel');
    const token=$('.token-panel');
    const stats=$('.stats-panel');
    const history=$('.history-panel');

    if(
      !game ||
      !stage ||
      !world ||
      !launch ||
      !token ||
      !stats ||
      !history
    ){
      console.error(
        '[MEMEFLOW FLIGHT V12.1]',
        'Required current Game structure missing',
        {
          game,
          stage,
          world,
          launch,
          token,
          stats,
          history
        }
      );

      return;
    }

    document.body.classList.add(
      'flight-v12'
    );

    /*
      Explicitly use the real current Game elements.
      No text search, no guessed classes, no iframe.
    */
    stage.dataset.v12Scene='true';
    world.dataset.v12World='true';

    history.open=true;

    $('#fullscreenBtn')
      ?.setAttribute(
        'aria-hidden',
        'true'
      );

    removeOldGuide();

    if(!$('#v12Exit')){
      const exit=
        document.createElement('a');

      exit.id='v12Exit';
      exit.href='/game';
      exit.textContent='←';
      exit.setAttribute(
        'aria-label',
        'Back to normal Game'
      );

      document.body.appendChild(
        exit
      );
    }

    const observer=
      new MutationObserver(
        removeOldGuide
      );

    observer.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        window.dispatchEvent(
          new Event('resize')
        );
      });
    });

    console.info(
      '[MEMEFLOW FLIGHT V12.1]',
      VERSION,
      'READY · REAL STRUCTURE'
    );
  }

  if(
    document.readyState===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {once:true}
    );
  }else{
    boot();
  }
})();
EOF

cat > "$APP/flight-v12-launcher.js" <<'EOF'
(()=>{
  'use strict';

  const VERSION='12.1';

  if(
    location.pathname.includes(
      'flight-v12'
    )
  ){
    return;
  }

  const $=(s)=>document.querySelector(s);

  function standalone(){
    return (
      navigator.standalone===true ||
      matchMedia?.(
        '(display-mode: standalone)'
      )?.matches===true ||
      matchMedia?.(
        '(display-mode: fullscreen)'
      )?.matches===true
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

    if(
      old.dataset
        .flightV121===
      'true'
    ){
      return true;
    }

    /*
      Replace the old button after game.js has bound it.
      This removes its old toggleFullscreen click listener.
    */
    const link=
      document.createElement('a');

    for(
      const attr of
      [...old.attributes]
    ){
      const name=
        attr.name.toLowerCase();

      if(
        [
          'id',
          'type',
          'role',
          'aria-pressed',
          'aria-label',
          'title'
        ].includes(name)
      ){
        continue;
      }

      link.setAttribute(
        attr.name,
        attr.value
      );
    }

    link.id='fullscreenBtn';
    link.className=
      old.className;

    link.innerHTML=
      old.innerHTML;

    /*
      No window.open() and no popup permission.
      In the installed Home Screen web app this remains
      inside the app window. In Safari it is only a preview;
      Safari itself cannot be programmatically hidden.
    */
    link.href=
      '/flight-v12.html';

    link.target='_self';

    link.dataset.flightV121=
      'true';

    link.setAttribute(
      'aria-label',
      standalone()
        ?'Open Flight App'
        :'Open Flight View'
    );

    link.setAttribute(
      'title',
      standalone()
        ?'Open Flight App'
        :'Open Flight View'
    );

    link.style.textDecoration=
      'none';

    old.replaceWith(link);

    console.info(
      '[MEMEFLOW FLIGHT V12.1 LAUNCHER]',
      VERSION,
      standalone()
        ?'APP MODE'
        :'SAFARI PREVIEW MODE'
    );

    return true;
  }

  let attempts=0;

  const timer=
    setInterval(()=>{
      attempts+=1;

      if(
        install() ||
        attempts>50
      ){
        clearInterval(timer);
      }
    },100);

  const observer=
    new MutationObserver(()=>{
      removeOldGuide();

      if(
        !document.querySelector(
          '[data-flight-v121="true"]'
        )
      ){
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
import json
import re
import time

app=Path("memeflow-app")
v=str(int(time.time()))

# ----------------------------------------------------------
# 1. Make Add to Home Screen from the normal Game install
#    the dedicated Flight app, not the normal dashboard.
# ----------------------------------------------------------

manifest_path=app/"game.webmanifest"

if manifest_path.exists():
    try:
        data=json.loads(
            manifest_path.read_text()
        )
    except Exception:
        data={}

    data.update({
        "id":"/flight-v12.html",
        "name":"MEMEFLOW Flight",
        "short_name":"MEMEFLOW",
        "description":"MEMEFLOW cinematic Flight View",
        "start_url":"/flight-v12.html",
        "scope":"/",
        "display":"standalone",
        "display_override":[
            "fullscreen",
            "standalone"
        ],
        "background_color":"#02060b",
        "theme_color":"#02060b"
    })

    manifest_path.write_text(
        json.dumps(
            data,
            indent=2
        )+
        "\n"
    )

flight_manifest=app/"flight-v12-manifest.json"

flight_manifest.write_text(
    json.dumps(
        {
            "id":"/flight-v12.html",
            "name":"MEMEFLOW Flight",
            "short_name":"MEMEFLOW",
            "description":"MEMEFLOW cinematic Flight View",
            "start_url":"/flight-v12.html",
            "scope":"/",
            "display":"standalone",
            "display_override":[
                "fullscreen",
                "standalone"
            ],
            "orientation":"any",
            "background_color":"#02060b",
            "theme_color":"#02060b"
        },
        indent=2
    )+
    "\n"
)

# ----------------------------------------------------------
# 2. Remove the old custom iPhone install GUIDE fallback.
#    If the V12 launcher somehow has not replaced the button,
#    iPhone Safari goes to the clean Flight preview instead.
# ----------------------------------------------------------

game_js=app/"game.js"
s=game_js.read_text()

old="""    if(isIPhoneBrowser()){
      showIOSFullscreenGuide();
      return;
    }"""

new="""    if(isIPhoneBrowser()){
      location.assign('/flight-v12.html');
      return;
    }"""

if old in s:
    s=s.replace(
        old,
        new,
        1
    )
    print("Old iPhone fullscreen guide call: REMOVED")
else:
    print("Old iPhone fullscreen guide call: already changed / not found")

game_js.write_text(
    s.rstrip()+
    "\n"
)

# ----------------------------------------------------------
# 3. Hard cache-bust current Game and Flight V12 assets.
# ----------------------------------------------------------

def bump(path,replacements):
    if not path.exists():
        return

    s=path.read_text()

    for pattern,repl in replacements:
        s=re.sub(
            pattern,
            repl,
            s
        )

    path.write_text(
        s.rstrip()+
        "\n"
    )

bump(
    app/"game.html",
    [
        (
            r'/game\.webmanifest(?:\?v=\d+)?',
            f'/game.webmanifest?v={v}'
        ),
        (
            r'/game\.js(?:\?v=\d+)?',
            f'/game.js?v={v}'
        ),
        (
            r'/flight-v12-launcher\.js(?:\?v=\d+)?',
            f'/flight-v12-launcher.js?v={v}'
        )
    ]
)

bump(
    app/"flight-v12.html",
    [
        (
            r'/flight-v12-manifest\.json(?:\?v=\d+)?',
            f'/flight-v12-manifest.json?v={v}'
        ),
        (
            r'/flight-v12\.css(?:\?v=\d+)?',
            f'/flight-v12.css?v={v}'
        ),
        (
            r'/flight-v12\.js(?:\?v=\d+)?',
            f'/flight-v12.js?v={v}'
        ),
        (
            r'/game\.js(?:\?v=\d+)?',
            f'/game.js?v={v}'
        )
    ]
)

print("Cache bust:",v)
PY

node --check "$APP/game.js"
node --check "$APP/flight-v12.js"
node --check "$APP/flight-v12-launcher.js"

git diff --check -- \
  "$APP/game.html" \
  "$APP/game.js" \
  "$APP/game.webmanifest" \
  "$APP/flight-v12.html" \
  "$APP/flight-v12.css" \
  "$APP/flight-v12.js" \
  "$APP/flight-v12-launcher.js" \
  "$APP/flight-v12-manifest.json"

echo
echo "=== V12.1 CHECKS PASS ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add \
    "$APP/game.html" \
    "$APP/game.js" \
    "$APP/game.webmanifest" \
    "$APP/flight-v12.html" \
    "$APP/flight-v12.css" \
    "$APP/flight-v12.js" \
    "$APP/flight-v12-launcher.js" \
    "$APP/flight-v12-manifest.json"

  if ! git diff --cached --quiet; then
    git commit \
      -m "Fix Flight V12 with real Game structure V12.1" \
      || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: git push failed; Replit local files are still fixed."
      }
    fi
  fi
fi

echo
echo "================================================"
echo " MEMEFLOW FLIGHT V12.1 INSTALLED"
echo "================================================"
echo
echo "REAL STRUCTURE:"
echo "  .stage-card   -> full viewport"
echo "  #world        -> rocket / space"
echo "  .launch-panel -> left HUD"
echo "  .token-panel  -> right top HUD"
echo "  .stats-panel  -> right middle HUD"
echo "  .history-panel-> right bottom scroll HUD"
echo
echo "OLD IPHONE GUIDE:"
echo "  removed"
echo
echo "APP START URL:"
echo "  /flight-v12.html"
echo
echo "IMPORTANT IPHONE RULE:"
echo "  Safari cannot programmatically hide Safari chrome."
echo "  For real app chrome-free mode:"
echo "  Share -> Add to Home Screen -> Open as Web App"
echo "  Then launch MEMEFLOW from the Home Screen icon."
echo
echo "After patch:"
echo "  Stop -> Run -> close old tabs -> reopen."
