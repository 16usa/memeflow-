#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW FLIGHT V12.2 — COMPACT PORTRAIT HUD ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/flight-v12.css" ] && \
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
  echo "ERROR: memeflow-app/flight-v12.css not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
CSS="$APP/flight-v12.css"
HTML="$APP/flight-v12.html"
BACKUP="$APP/_backup/flight-v12.2-compact-portrait"

mkdir -p "$BACKUP"
cp -f "$CSS" "$BACKUP/flight-v12.css.before-v122"
cp -f "$HTML" "$BACKUP/flight-v12.html.before-v122"

python - <<'PY'
from pathlib import Path
import re
import time

css_path=Path("memeflow-app/flight-v12.css")
html_path=Path("memeflow-app/flight-v12.html")

css=css_path.read_text()

START="/* === MEMEFLOW FLIGHT V12.2 COMPACT PORTRAIT START === */"
END="/* === MEMEFLOW FLIGHT V12.2 COMPACT PORTRAIT END === */"

while START in css and END in css:
    a=css.index(START)
    b=css.index(END,a)+len(END)
    css=css[:a]+css[b:]

block=r'''
/* === MEMEFLOW FLIGHT V12.2 COMPACT PORTRAIT START === */

/*
  Portrait-only visual tuning.
  #rocket is animated by the existing Game JavaScript.
  The independent CSS scale property keeps the Game's own
  transform / translate / rotate animation untouched.
*/
@media (orientation:portrait){

  body.flight-v12 #rocket{
    scale:.70!important;
    transform-origin:50% 50%!important;
  }

  body.flight-v12 #world.world{
    overflow:hidden!important;
  }

  body.flight-v12 .launch-panel,
  body.flight-v12 .token-panel,
  body.flight-v12 .stats-panel,
  body.flight-v12 .history-panel{
    border-radius:15px!important;
    border-color:rgba(126,185,205,.18)!important;

    background:
      linear-gradient(
        180deg,
        rgba(6,14,20,.74),
        rgba(3,8,13,.67)
      )!important;

    box-shadow:
      0 14px 38px
      rgba(0,0,0,.24)!important;

    backdrop-filter:
      blur(13px)
      saturate(1.06)!important;

    -webkit-backdrop-filter:
      blur(13px)
      saturate(1.06)!important;
  }

  body.flight-v12 .launch-panel{
    left:max(6px,var(--v12-left))!important;
    bottom:max(6px,var(--v12-bottom))!important;

    width:min(43vw,320px)!important;
    max-width:min(43vw,320px)!important;

    max-height:51dvh!important;

    padding:4px!important;

    font-size:.82em!important;
  }

  body.flight-v12 .token-panel,
  body.flight-v12 .stats-panel,
  body.flight-v12 .history-panel{
    right:max(6px,var(--v12-right))!important;

    width:min(37vw,285px)!important;
    max-width:min(37vw,285px)!important;

    font-size:.82em!important;
  }

  body.flight-v12 .token-panel{
    top:calc(var(--v12-top) + 48px)!important;

    max-height:23dvh!important;

    padding:4px!important;
  }

  body.flight-v12 .stats-panel{
    top:39dvh!important;

    max-height:12dvh!important;

    padding:4px!important;
  }

  body.flight-v12 .history-panel{
    bottom:max(6px,var(--v12-bottom))!important;

    height:24dvh!important;
    max-height:24dvh!important;

    grid-template-rows:
      22px
      17px
      minmax(0,1fr)!important;
  }

  body.flight-v12 .launch-panel .panel-title{
    min-height:22px!important;
    align-items:center!important;
  }

  body.flight-v12 .launch-panel .panel-title h1,
  body.flight-v12 .launch-panel .lead{
    display:none!important;
  }

  body.flight-v12 .launch-panel .panel-title small{
    font-size:7px!important;
  }

  body.flight-v12 .launch-panel .paper-badge{
    padding:4px 6px!important;
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel .game-utility{
    margin-top:5px!important;
    padding:5px 6px!important;
    gap:5px!important;
    border-radius:10px!important;
  }

  body.flight-v12 .launch-panel .game-balance{
    min-width:74px!important;
  }

  body.flight-v12 .launch-panel .game-balance small{
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .game-balance b{
    margin-top:1px!important;
    font-size:11px!important;
  }

  body.flight-v12 .launch-panel .stream-utility{
    gap:4px!important;
  }

  body.flight-v12 .launch-panel .stream-utility b{
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .stream-utility small{
    display:none!important;
  }

  body.flight-v12 .launch-panel .sound,
  body.flight-v12 .launch-panel .fullscreen-btn,
  body.flight-v12 .launch-panel .utility-actions>a,
  body.flight-v12 .launch-panel .utility-actions>button{
    height:31px!important;
    min-height:31px!important;
    padding:0 7px!important;
    border-radius:9px!important;
  }

  body.flight-v12 .launch-panel .field-title{
    margin:5px 0 3px!important;
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel .stake-input{
    height:42px!important;
    padding:0 9px!important;
    border-radius:11px!important;
  }

  body.flight-v12 .launch-panel .stake-input>span{
    font-size:14px!important;
  }

  body.flight-v12 .launch-panel .stake-input input{
    font-size:23px!important;
    padding:0 6px!important;
  }

  body.flight-v12 .launch-panel .quick-bets{
    gap:4px!important;
    margin-top:4px!important;
  }

  body.flight-v12 .launch-panel .quick-bets button{
    height:26px!important;
    border-radius:7px!important;
    font-size:7px!important;
  }

  body.flight-v12 .launch-panel .select-grid{
    gap:5px!important;
    margin-top:7px!important;
  }

  body.flight-v12 .launch-panel .select-grid label{
    gap:3px!important;
  }

  body.flight-v12 .launch-panel .select-grid span{
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel .select-grid select{
    height:33px!important;
    padding:0 6px!important;
    border-radius:8px!important;
    font-size:9px!important;
  }

  body.flight-v12 .launch-panel .target-presets{
    margin-top:6px!important;
    gap:3px!important;
  }

  body.flight-v12 .launch-panel .target-presets button{
    min-height:40px!important;
    padding:4px 2px!important;
    border-radius:10px!important;
  }

  body.flight-v12 .launch-panel .target-presets b{
    font-size:7px!important;
  }

  body.flight-v12 .launch-panel .target-presets small{
    font-size:5px!important;
  }

  body.flight-v12 .launch-panel .risk-deck{
    margin-top:6px!important;
    border-radius:10px!important;
  }

  body.flight-v12 .launch-panel .risk-head{
    min-height:20px!important;
    padding:0 7px!important;
  }

  body.flight-v12 .launch-panel .risk-head span,
  body.flight-v12 .launch-panel .risk-head b{
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel .risk-metrics>div{
    padding:5px 7px!important;
  }

  body.flight-v12 .launch-panel .risk-metrics small{
    font-size:5.5px!important;
  }

  body.flight-v12 .launch-panel .risk-metrics b{
    margin-top:2px!important;
    font-size:8px!important;
  }

  body.flight-v12 .launch-panel .risk-track{
    margin:5px 6px!important;
  }

  body.flight-v12 .launch-panel .risk-deck p{
    display:none!important;
  }

  body.flight-v12 .launch-panel .start-button,
  body.flight-v12 .launch-panel .cash-button{
    min-height:48px!important;
    margin-top:6px!important;
    border-radius:11px!important;
    gap:8px!important;
  }

  body.flight-v12 .launch-panel .start-button>span,
  body.flight-v12 .launch-panel .cash-button>span{
    font-size:11px!important;
  }

  body.flight-v12 .launch-panel .start-button b,
  body.flight-v12 .launch-panel .cash-button b{
    font-size:11px!important;
  }

  body.flight-v12 .launch-panel .start-button small,
  body.flight-v12 .launch-panel .cash-button small{
    font-size:6px!important;
  }

  body.flight-v12 .launch-panel [id*="auto"][role="button"],
  body.flight-v12 .launch-panel button[id*="auto"],
  body.flight-v12 .launch-panel .auto-button,
  body.flight-v12 .launch-panel [class*="auto-mode"]{
    min-height:44px!important;
    margin-top:6px!important;
    border-radius:11px!important;
  }

  body.flight-v12 .token-panel .panel-row{
    font-size:6.5px!important;
  }

  body.flight-v12 .token-panel .token-head{
    gap:6px!important;
    margin-top:6px!important;
  }

  body.flight-v12 .token-panel .token-avatar{
    width:32px!important;
    height:32px!important;
    border-radius:9px!important;
    font-size:13px!important;
  }

  body.flight-v12 .token-panel .token-head b{
    font-size:10px!important;
  }

  body.flight-v12 .token-panel .token-head small{
    margin-top:2px!important;
    font-size:6px!important;
  }

  body.flight-v12 .token-panel .quality-line{
    gap:5px!important;
    margin-top:5px!important;
    font-size:6px!important;
  }

  body.flight-v12 .token-panel .token-metrics{
    margin-top:6px!important;
    border-radius:9px!important;
  }

  body.flight-v12 .token-panel .token-metrics>div{
    padding:5px 6px!important;
  }

  body.flight-v12 .token-panel .token-metrics small{
    font-size:5.5px!important;
  }

  body.flight-v12 .token-panel .token-metrics b{
    margin-top:2px!important;
    font-size:8.5px!important;
  }

  body.flight-v12 .token-panel .telemetry{
    gap:4px 7px!important;
    margin-top:5px!important;
    padding-top:5px!important;
    font-size:5.5px!important;
  }

  body.flight-v12 .stats-panel .panel-row{
    font-size:6.5px!important;
  }

  body.flight-v12 .stats-panel .stats-grid{
    margin-top:5px!important;
    border-radius:9px!important;
  }

  body.flight-v12 .stats-panel .stats-grid>div{
    padding:5px 6px!important;
  }

  body.flight-v12 .stats-panel .stats-grid small{
    font-size:5.5px!important;
  }

  body.flight-v12 .stats-panel .stats-grid b{
    margin-top:2px!important;
    font-size:8.5px!important;
  }

  body.flight-v12 .history-panel>summary{
    min-height:22px!important;
    height:22px!important;
    padding:0 8px!important;
    font-size:7px!important;
  }

  body.flight-v12 .history-panel>summary b{
    width:20px!important;
    min-width:20px!important;
    height:20px!important;
    font-size:7px!important;
  }

  body.flight-v12 .history-toolbar{
    min-height:17px!important;
    height:17px!important;
    padding:2px 7px!important;
    font-size:6px!important;
  }

  body.flight-v12 .history-toolbar button{
    font-size:6px!important;
  }

  body.flight-v12 .history-panel .history{
    padding:1px!important;
  }

  body.flight-v12 .history-panel .history-row{
    min-height:30px!important;
    margin-bottom:1px!important;
    font-size:.88em!important;
  }

  body.flight-v12 .stage-card>.stage-head{
    min-height:calc(27px + var(--v12-top))!important;
    height:calc(27px + var(--v12-top))!important;
  }

  body.flight-v12 .stage-card{
    grid-template-rows:
      calc(27px + var(--v12-top))
      minmax(0,1fr)
      calc(27px + var(--v12-bottom))!important;
  }

  body.flight-v12 .stage-card>.position-strip{
    min-height:calc(27px + var(--v12-bottom))!important;
    height:calc(27px + var(--v12-bottom))!important;
  }

  body.flight-v12 .stage-card>.position-strip>div{
    min-height:27px!important;
    height:27px!important;
    padding:4px 7px!important;
  }

  body.flight-v12 .stage-card>.position-strip small{
    font-size:5.5px!important;
  }

  body.flight-v12 .stage-card>.position-strip b{
    margin-top:2px!important;
    font-size:8px!important;
  }

  body.flight-v12 .multiplier-hud,
  body.flight-v12 .game[data-state="live"] .multiplier-hud,
  body.flight-v12 .game[data-state="settling"] .multiplier-hud{
    top:calc(var(--v12-top) + 31px)!important;
  }

  body.flight-v12 .multiplier{
    font-size:clamp(48px,13vw,72px)!important;
  }

  body.flight-v12 #v12Exit{
    top:calc(var(--v12-top) + 5px)!important;
    right:max(5px,var(--v12-right))!important;

    width:34px!important;
    height:34px!important;

    border-radius:11px!important;

    font-size:17px!important;
  }
}

@media (orientation:landscape){
  body.flight-v12 #rocket{
    scale:.84!important;
    transform-origin:50% 50%!important;
  }
}

/* === MEMEFLOW FLIGHT V12.2 COMPACT PORTRAIT END === */
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

html_path.write_text(html.rstrip()+"\n")

print("V12.2 visual cache:",v)
PY

git diff --check -- "$CSS" "$HTML"

echo
echo "=== V12.2 VISUAL CHECK PASS ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$CSS" "$HTML"

  if ! git diff --cached --quiet; then
    git commit \
      -m "Compact Flight V12 portrait HUD and rocket V12.2" \
      || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: Git push failed."
        echo "The V12.2 visual patch is still installed locally."
      }
    fi
  else
    echo "No new changes — V12.2 already appears installed."
  fi
fi

echo
echo "=================================================="
echo " MEMEFLOW FLIGHT V12.2 INSTALLED"
echo "=================================================="
echo
echo "CHANGED ONLY:"
echo "  portrait HUD sizing / spacing / transparency"
echo "  #rocket visual scale"
echo "  compact scene header / bottom metrics"
echo
echo "NOT CHANGED:"
echo "  AUTO"
echo "  START / CASH OUT"
echo "  Game API"
echo "  server state"
echo "  settings"
echo "  wallet"
echo "  round/history logic"
echo
echo "NEXT:"
echo "  Stop -> Run"
echo "  Close old Flight tab"
echo "  Open Flight V12 again"
echo
