#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW FLIGHT V12.3 — CINEMATIC PORTRAIT HUD ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/flight-v12.css" ] && \
     [ -f "$base/memeflow-app/flight-v12.js" ] && \
     [ -f "$base/memeflow-app/flight-v12.html" ]; then
    ROOT="$base"
    break
  fi
done

if [ -z "$ROOT" ]; then
  found="$(find "$PWD" "$HOME" -maxdepth 4 -type f -path '*/memeflow-app/flight-v12.css' 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    ROOT="${found%/memeflow-app/flight-v12.css}"
  fi
fi

[ -n "$ROOT" ] || {
  echo "ERROR: Flight V12 files not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
CSS="$APP/flight-v12.css"
JS="$APP/flight-v12.js"
HTML="$APP/flight-v12.html"
BACKUP="$APP/_backup/flight-v12.3-cinematic-portrait"

mkdir -p "$BACKUP"
cp -f "$CSS" "$BACKUP/flight-v12.css.before-v123"
cp -f "$JS" "$BACKUP/flight-v12.js.before-v123"
cp -f "$HTML" "$BACKUP/flight-v12.html.before-v123"

echo "Backup ready: $BACKUP"

# ============================================================
# Replace V12.2 tuning with ONE clean V12.3 tuning layer.
# ============================================================

python - <<'PY'
from pathlib import Path
import re
import time

css_path=Path("memeflow-app/flight-v12.css")
html_path=Path("memeflow-app/flight-v12.html")

css=css_path.read_text()

markers=[
    (
        "/* === MEMEFLOW FLIGHT V12.2 COMPACT PORTRAIT START === */",
        "/* === MEMEFLOW FLIGHT V12.2 COMPACT PORTRAIT END === */"
    ),
    (
        "/* === MEMEFLOW FLIGHT V12.3 CINEMATIC PORTRAIT START === */",
        "/* === MEMEFLOW FLIGHT V12.3 CINEMATIC PORTRAIT END === */"
    )
]

for start,end in markers:
    while start in css and end in css:
        a=css.index(start)
        b=css.index(end,a)+len(end)
        css=css[:a]+css[b:]

block=r'''
/* === MEMEFLOW FLIGHT V12.3 CINEMATIC PORTRAIT START === */

/*
  V12.3 goals:
  - leave a real open corridor through the center of the rocket scene
  - shrink the LIVE rocket without overwriting game.js transform
  - keep every Launch Control function
  - keep START / CASH OUT / AUTO always reachable in a sticky dock
  - make the right side one coherent compact column
*/

@media (orientation:portrait){

  /* ---------------------------------------------------------
     ROCKET / SCENE
     game.js owns transform. We only use independent scale and
     translate properties, so JS translate/rotate remains intact.
     --------------------------------------------------------- */

  body.flight-v12 #rocket{
    scale:.46!important;
    translate:2vw -1.5vh!important;
    transform-origin:50% 50%!important;
  }

  body.flight-v12 #world.world{
    overflow:hidden!important;
  }

  body.flight-v12 .multiplier-hud,
  body.flight-v12 .game[data-state="live"] .multiplier-hud,
  body.flight-v12 .game[data-state="settling"] .multiplier-hud{
    top:calc(var(--v12-top) + 29px)!important;
  }

  body.flight-v12 .multiplier{
    font-size:clamp(44px,11.5vw,64px)!important;
  }

  body.flight-v12 .flight-assist,
  body.flight-v12 .cashout-telemetry{
    max-width:33vw!important;
    font-size:.78em!important;
  }

  /* ---------------------------------------------------------
     SHARED HUD GLASS
     --------------------------------------------------------- */

  body.flight-v12 .launch-panel,
  body.flight-v12 .token-panel,
  body.flight-v12 .stats-panel,
  body.flight-v12 .history-panel{
    border-radius:14px!important;

    border:
      1px solid
      rgba(126,185,205,.16)!important;

    background:
      linear-gradient(
        180deg,
        rgba(5,13,19,.72),
        rgba(2,8,12,.63)
      )!important;

    box-shadow:
      0 12px 34px
      rgba(0,0,0,.22)!important;

    backdrop-filter:
      blur(12px)
      saturate(1.05)!important;

    -webkit-backdrop-filter:
      blur(12px)
      saturate(1.05)!important;
  }

  /* ---------------------------------------------------------
     LEFT COCKPIT
     38vw leaves substantially more open scene than V12.2 43vw.
     --------------------------------------------------------- */

  body.flight-v12 .launch-panel{
    left:max(6px,var(--v12-left))!important;
    bottom:max(6px,var(--v12-bottom))!important;

    width:min(38vw,292px)!important;
    max-width:min(38vw,292px)!important;

    height:auto!important;
    max-height:47dvh!important;

    padding:4px!important;

    overflow-x:hidden!important;
    overflow-y:auto!important;

    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;

    font-size:.76em!important;
  }

  body.flight-v12 .launch-panel .panel-title{
    min-height:20px!important;
    height:20px!important;
    padding:0 2px!important;
    align-items:center!important;
  }

  body.flight-v12 .launch-panel .panel-title h1,
  body.flight-v12 .launch-panel .lead{
    display:none!important;
  }

  body.flight-v12 .launch-panel .panel-title small{
    font-size:6.5px!important;
  }

  body.flight-v12 .launch-panel .paper-badge{
    padding:3px 5px!important;
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .game-utility{
    margin-top:4px!important;
    padding:4px 5px!important;
    gap:4px!important;
    border-radius:9px!important;
  }

  body.flight-v12 .launch-panel .game-balance{
    min-width:68px!important;
  }

  body.flight-v12 .launch-panel .game-balance small{
    font-size:5px!important;
  }

  body.flight-v12 .launch-panel .game-balance b{
    margin-top:1px!important;
    font-size:10px!important;
  }

  body.flight-v12 .launch-panel .stream-utility{
    gap:3px!important;
  }

  body.flight-v12 .launch-panel .stream-utility b{
    font-size:5px!important;
  }

  body.flight-v12 .launch-panel .stream-utility small{
    display:none!important;
  }

  body.flight-v12 .launch-panel .utility-actions{
    gap:3px!important;
  }

  body.flight-v12 .launch-panel .utility-actions>a,
  body.flight-v12 .launch-panel .utility-actions>button,
  body.flight-v12 .launch-panel .sound,
  body.flight-v12 .launch-panel .fullscreen-btn{
    width:28px!important;
    min-width:28px!important;
    height:28px!important;
    min-height:28px!important;
    padding:0!important;
    border-radius:8px!important;
  }

  body.flight-v12 .launch-panel .field-title{
    margin:4px 0 2px!important;
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .stake-input{
    height:36px!important;
    padding:0 7px!important;
    border-radius:9px!important;
  }

  body.flight-v12 .launch-panel .stake-input>span{
    font-size:12px!important;
  }

  body.flight-v12 .launch-panel .stake-input input{
    font-size:19px!important;
    padding:0 5px!important;
  }

  body.flight-v12 .launch-panel .quick-bets{
    gap:3px!important;
    margin-top:3px!important;
  }

  body.flight-v12 .launch-panel .quick-bets button{
    height:22px!important;
    min-height:22px!important;
    border-radius:6px!important;
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel .select-grid{
    gap:4px!important;
    margin-top:5px!important;
  }

  body.flight-v12 .launch-panel .select-grid label{
    gap:2px!important;
  }

  body.flight-v12 .launch-panel .select-grid span{
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .select-grid select{
    height:29px!important;
    padding:0 5px!important;
    border-radius:7px!important;
    font-size:8px!important;
  }

  body.flight-v12 .launch-panel .target-presets{
    margin-top:5px!important;
    gap:2px!important;
  }

  body.flight-v12 .launch-panel .target-presets button{
    min-height:34px!important;
    padding:3px 1px!important;
    border-radius:8px!important;
  }

  body.flight-v12 .launch-panel .target-presets b{
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel .target-presets small{
    font-size:4.5px!important;
  }

  body.flight-v12 .launch-panel .risk-deck{
    margin-top:5px!important;
    border-radius:9px!important;
  }

  body.flight-v12 .launch-panel .risk-head{
    min-height:18px!important;
    padding:0 6px!important;
  }

  body.flight-v12 .launch-panel .risk-head span,
  body.flight-v12 .launch-panel .risk-head b{
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .risk-metrics>div{
    padding:4px 6px!important;
  }

  body.flight-v12 .launch-panel .risk-metrics small{
    font-size:5px!important;
  }

  body.flight-v12 .launch-panel .risk-metrics b{
    margin-top:1px!important;
    font-size:7px!important;
  }

  body.flight-v12 .launch-panel .risk-track{
    margin:4px 5px!important;
  }

  /*
    The explanatory paragraph remains in the DOM and accessible when
    scrolling/desktop, but it does not consume the tiny portrait cockpit.
    No setting, value, or control is removed.
  */
  body.flight-v12 .launch-panel .risk-deck p{
    display:none!important;
  }

  body.flight-v12 .launch-panel #selectorStatus{
    margin-top:4px!important;
    min-height:0!important;
    font-size:.82em!important;
  }

  /* ---------------------------------------------------------
     STICKY ACTION DOCK
     Actual existing nodes are moved here by flight-v12.js.
     Their original click handlers/state are preserved.
     --------------------------------------------------------- */

  body.flight-v12 .launch-panel #v12ActionDock{
    position:sticky!important;
    left:0!important;
    right:0!important;
    bottom:-4px!important;
    z-index:40!important;

    display:grid!important;
    grid-template-columns:1fr!important;
    gap:4px!important;

    margin:5px -1px -1px!important;
    padding:8px 1px 1px!important;

    background:
      linear-gradient(
        180deg,
        rgba(3,9,14,0),
        rgba(3,9,14,.96) 32%,
        rgba(3,9,14,.99)
      )!important;
  }

  body.flight-v12 .launch-panel #v12ActionDock>#startBtn,
  body.flight-v12 .launch-panel #v12ActionDock>#cashoutBtn,
  body.flight-v12 .launch-panel #v12ActionDock>#mfAutoLoopBtn{
    width:100%!important;
    min-width:0!important;

    min-height:38px!important;
    height:38px!important;
    flex:0 0 38px!important;

    margin:0!important;

    border-radius:9px!important;
  }

  body.flight-v12 .launch-panel #v12ActionDock>#startBtn>span,
  body.flight-v12 .launch-panel #v12ActionDock>#cashoutBtn>span,
  body.flight-v12 .launch-panel #v12ActionDock>#mfAutoLoopBtn>span{
    font-size:12px!important;
  }

  body.flight-v12 .launch-panel #v12ActionDock b{
    font-size:8px!important;
  }

  body.flight-v12 .launch-panel #v12ActionDock small{
    margin-top:1px!important;
    font-size:5.5px!important;
  }

  /*
    Existing game state decides which START/CASH OUT button is visible.
    V12 does not override hidden/disabled/state selectors.
  */

  /* ---------------------------------------------------------
     RIGHT COLUMN
     One narrow lane, leaving the center visible.
     --------------------------------------------------------- */

  body.flight-v12 .token-panel,
  body.flight-v12 .stats-panel,
  body.flight-v12 .history-panel{
    right:max(6px,var(--v12-right))!important;

    width:min(32vw,246px)!important;
    max-width:min(32vw,246px)!important;

    font-size:.75em!important;
  }

  body.flight-v12 .token-panel{
    top:calc(var(--v12-top) + 45px)!important;

    height:auto!important;
    max-height:20dvh!important;

    padding:4px!important;

    overflow:auto!important;
  }

  body.flight-v12 .stats-panel{
    top:31.5dvh!important;

    height:auto!important;
    max-height:10.5dvh!important;

    padding:4px!important;

    overflow:auto!important;
  }

  body.flight-v12 .history-panel{
    bottom:max(6px,var(--v12-bottom))!important;

    height:21dvh!important;
    min-height:0!important;
    max-height:21dvh!important;

    padding:0!important;

    grid-template-rows:
      20px
      16px
      minmax(0,1fr)!important;

    overflow:hidden!important;
  }

  /* Selected Launch compact */
  body.flight-v12 .token-panel .panel-row{
    min-height:16px!important;
    font-size:5.8px!important;
  }

  body.flight-v12 .token-panel .token-head{
    gap:5px!important;
    margin-top:4px!important;
  }

  body.flight-v12 .token-panel .token-avatar{
    width:28px!important;
    height:28px!important;
    border-radius:8px!important;
    font-size:11px!important;
  }

  body.flight-v12 .token-panel .token-head b{
    font-size:8.5px!important;
  }

  body.flight-v12 .token-panel .token-head small{
    margin-top:1px!important;
    font-size:5px!important;
  }

  body.flight-v12 .token-panel .quality-line{
    gap:4px!important;
    margin-top:4px!important;
    font-size:5px!important;
  }

  body.flight-v12 .token-panel .token-metrics{
    margin-top:4px!important;
    border-radius:8px!important;
  }

  body.flight-v12 .token-panel .token-metrics>div{
    padding:4px 5px!important;
  }

  body.flight-v12 .token-panel .token-metrics small{
    font-size:4.8px!important;
  }

  body.flight-v12 .token-panel .token-metrics b{
    margin-top:1px!important;
    font-size:7.5px!important;
  }

  body.flight-v12 .token-panel .telemetry{
    gap:3px 6px!important;
    margin-top:4px!important;
    padding-top:4px!important;
    font-size:4.8px!important;
  }

  /* Flight Record compact */
  body.flight-v12 .stats-panel .panel-row{
    min-height:15px!important;
    font-size:5.8px!important;
  }

  body.flight-v12 .stats-panel .stats-grid{
    margin-top:3px!important;
    border-radius:8px!important;
  }

  body.flight-v12 .stats-panel .stats-grid>div{
    padding:4px 5px!important;
  }

  body.flight-v12 .stats-panel .stats-grid small{
    font-size:4.8px!important;
  }

  body.flight-v12 .stats-panel .stats-grid b{
    margin-top:1px!important;
    font-size:7.5px!important;
  }

  /*
    Keep safety information in the DOM. The panel itself scrolls if
    the user needs content below the metrics.
  */

  /* Round History compact + fully scrollable */
  body.flight-v12 .history-panel>summary{
    min-height:20px!important;
    height:20px!important;
    padding:0 7px!important;
    font-size:6px!important;
  }

  body.flight-v12 .history-panel>summary b{
    width:18px!important;
    min-width:18px!important;
    height:18px!important;
    font-size:6px!important;
  }

  body.flight-v12 .history-toolbar{
    min-height:16px!important;
    height:16px!important;
    padding:1px 6px!important;
    font-size:5px!important;
  }

  body.flight-v12 .history-toolbar button{
    font-size:5px!important;
  }

  body.flight-v12 .history-panel .history{
    min-height:0!important;
    height:100%!important;
    max-height:none!important;

    padding:1px!important;

    overflow-y:auto!important;
    overflow-x:hidden!important;

    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
  }

  body.flight-v12 .history-panel .history-row{
    display:grid!important;

    min-height:27px!important;

    margin:0 0 1px!important;

    font-size:.80em!important;
  }

  body.flight-v12 .history-panel .history-row:nth-child(n){
    display:grid!important;
  }

  /* ---------------------------------------------------------
     SCENE HEADER / BOTTOM STRIP
     --------------------------------------------------------- */

  body.flight-v12 .stage-card{
    grid-template-rows:
      calc(25px + var(--v12-top))
      minmax(0,1fr)
      calc(25px + var(--v12-bottom))!important;
  }

  body.flight-v12 .stage-card>.stage-head{
    min-height:calc(25px + var(--v12-top))!important;
    height:calc(25px + var(--v12-top))!important;

    padding:
      var(--v12-top)
      max(5px,var(--v12-right))
      0
      max(5px,var(--v12-left))!important;
  }

  body.flight-v12 .stage-card>.position-strip{
    min-height:calc(25px + var(--v12-bottom))!important;
    height:calc(25px + var(--v12-bottom))!important;
  }

  body.flight-v12 .stage-card>.position-strip>div{
    min-height:25px!important;
    height:25px!important;

    padding:3px 6px!important;
  }

  body.flight-v12 .stage-card>.position-strip small{
    font-size:5px!important;
  }

  body.flight-v12 .stage-card>.position-strip b{
    margin-top:1px!important;
    font-size:7px!important;
  }

  /* Back button: small and out of the Selected Launch box. */
  body.flight-v12 #v12Exit{
    top:calc(var(--v12-top) + 4px)!important;
    right:max(4px,var(--v12-right))!important;

    width:31px!important;
    height:31px!important;

    border-radius:10px!important;

    font-size:15px!important;
  }
}

/*
  Landscape keeps the proven V12.1 three-column layout.
  Only reduce the rocket moderately there.
*/
@media (orientation:landscape){
  body.flight-v12 #rocket{
    scale:.78!important;
    translate:0 0!important;
    transform-origin:50% 50%!important;
  }
}

/* === MEMEFLOW FLIGHT V12.3 CINEMATIC PORTRAIT END === */
'''

css=css.rstrip()+"\n\n"+block.strip()+"\n"
css_path.write_text(css)

html=html_path.read_text()
v=str(int(time.time()))

html=re.sub(
    r'/flight-v12\.css(?:\?v=\d+)?',
    f'/flight-v12.css?v={v}',
    html
)

html=re.sub(
    r'/flight-v12\.js(?:\?v=\d+)?',
    f'/flight-v12.js?v={v}',
    html
)

html_path.write_text(html.rstrip()+"\n")

print("V12.3 cache:",v)
PY

# ============================================================
# Rewrite ONLY Flight-layout JS.
# Same current Game / AUTO / API code remains untouched.
# ============================================================

cat > "$JS" <<'EOF'
(()=>{
  'use strict';

  const VERSION='12.3';

  const $=(s,root=document)=>
    root.querySelector(s);

  function removeOldGuide(){
    $('#iosFullscreenGuide')?.remove();
  }

  function ensureActionDock(launch){
    if(!launch)return null;

    let dock=
      $('#v12ActionDock',launch);

    if(!dock){
      dock=
        document.createElement('div');

      dock.id='v12ActionDock';
      dock.setAttribute(
        'aria-label',
        'Flight actions'
      );

      launch.appendChild(dock);
    }

    /*
      Move the REAL current buttons.
      Moving DOM nodes preserves all click handlers, disabled/hidden
      state, and references already held by game.js / game-auto-v102.js.
    */
    const ids=[
      'startBtn',
      'cashoutBtn',
      'mfAutoLoopBtn'
    ];

    for(const id of ids){
      const button=
        document.getElementById(id);

      if(
        button &&
        button.parentElement!==dock
      ){
        dock.appendChild(button);
      }
    }

    return dock;
  }

  function installExit(){
    if($('#v12Exit'))return;

    const exit=
      document.createElement('a');

    exit.id='v12Exit';
    exit.href='/game';
    exit.textContent='←';

    exit.setAttribute(
      'aria-label',
      'Back to normal Game'
    );

    document.body.appendChild(exit);
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
        '[MEMEFLOW FLIGHT V12.3]',
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

    stage.dataset.v12Scene='true';
    world.dataset.v12World='true';

    history.open=true;

    $('#fullscreenBtn')
      ?.setAttribute(
        'aria-hidden',
        'true'
      );

    removeOldGuide();
    ensureActionDock(launch);
    installExit();

    /*
      AUTO is injected by game-auto-v102.js. It may exist before or
      after this module runs, so the observer re-checks the dock.
    */
    const observer=
      new MutationObserver(()=>{
        removeOldGuide();
        ensureActionDock(launch);
      });

    observer.observe(
      launch,
      {
        childList:true,
        subtree:true
      }
    );

    /*
      The result/session overlays may also change body children.
      Keep only the retired iPhone helper out of Flight mode.
    */
    const bodyObserver=
      new MutationObserver(
        removeOldGuide
      );

    bodyObserver.observe(
      document.body,
      {
        childList:true
      }
    );

    const resize=()=>{
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          window.dispatchEvent(
            new Event('resize')
          );
        });
      });
    };

    resize();

    window.addEventListener(
      'orientationchange',
      ()=>{
        setTimeout(
          resize,
          180
        );
      }
    );

    console.info(
      '[MEMEFLOW FLIGHT V12.3]',
      VERSION,
      'READY · CINEMATIC HUD · REAL ACTION DOCK'
    );
  }

  if(
    document.readyState==='loading'
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

node --check "$JS"

git diff --check -- \
  "$CSS" \
  "$JS" \
  "$HTML"

echo
echo "=== V12.3 CHECKS PASS ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$CSS" "$JS" "$HTML"

  if ! git diff --cached --quiet; then
    git commit \
      -m "Refine cinematic Flight HUD V12.3" \
      || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: Git push failed."
        echo "V12.3 is still installed locally in Replit."
      }
    fi
  else
    echo "No new changes — V12.3 already appears installed."
  fi
fi

echo
echo "=================================================="
echo " MEMEFLOW FLIGHT V12.3 INSTALLED"
echo "=================================================="
echo
echo "PORTRAIT:"
echo "  rocket scale: 0.46"
echo "  launch HUD: 38vw / max 47dvh"
echo "  right HUD lane: 32vw"
echo "  history: 21dvh + touch scroll"
echo "  center scene corridor enlarged"
echo
echo "ACTION DOCK:"
echo "  #startBtn"
echo "  #cashoutBtn"
echo "  #mfAutoLoopBtn"
echo "  same real nodes / same handlers"
echo
echo "NOT CHANGED:"
echo "  game.js"
echo "  game-auto-v102.js"
echo "  AUTO logic"
echo "  START / CASH OUT logic"
echo "  API / server state"
echo "  settings / wallet"
echo "  settlement / history logic"
echo
echo "NEXT:"
echo "  Stop -> Run"
echo "  Close old Flight tab"
echo "  Open Flight V12 again"
echo
