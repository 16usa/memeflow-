#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW CLEAN FLIGHT V12 INSTALLER ==="

ROOT=""
for base in "$PWD" "$HOME/workspace" "/home/runner/workspace" "/workspace"; do
  if [ -f "$base/memeflow-app/game.html" ] && \
     [ -f "$base/memeflow-app/game.js" ] && \
     [ -f "$base/memeflow-app/game.css" ]; then
    ROOT="$base"
    break
  fi
done

if [ -z "$ROOT" ]; then
  found="$(find "$PWD" "$HOME" -maxdepth 4 -type f -path '*/memeflow-app/game.html' 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    candidate="${found%/memeflow-app/game.html}"
    if [ -f "$candidate/memeflow-app/game.js" ] && \
       [ -f "$candidate/memeflow-app/game.css" ]; then
      ROOT="$candidate"
    fi
  fi
fi

[ -n "$ROOT" ] || {
  echo "ERROR: current memeflow-app/game.html + game.js + game.css not found"
  exit 1
}

cd "$ROOT"

APP="memeflow-app"
GAME_HTML="$APP/game.html"
SETTINGS="$APP/game-settings-v107.js"
FLIGHT_HTML="$APP/flight-v12.html"
FLIGHT_CSS="$APP/flight-v12.css"
FLIGHT_JS="$APP/flight-v12.js"
LAUNCHER="$APP/flight-v12-launcher.js"
MANIFEST="$APP/flight-v12-manifest.json"
BACKUP="$APP/_backup/flight-v12-clean"

mkdir -p "$BACKUP"

cp -f "$GAME_HTML" "$BACKUP/game.html.before-v12"
[ -f "$SETTINGS" ] && cp -f "$SETTINGS" "$BACKUP/game-settings-v107.js.before-v12" || true
[ -f "$APP/game-flight-mode-v109.js" ] && cp -f "$APP/game-flight-mode-v109.js" "$BACKUP/game-flight-mode-v109.js.before-v12" || true
[ -f "$APP/game-fullscreen-v11-launcher.js" ] && cp -f "$APP/game-fullscreen-v11-launcher.js" "$BACKUP/game-fullscreen-v11-launcher.js.before-v12" || true

echo "Project root: $ROOT"
echo "Backup ready: $BACKUP"

# ============================================================
# V12 CSS
# Only /flight-v12.html receives these layout rules.
# ============================================================

cat > "$FLIGHT_CSS" <<'EOF'
:root{
  --v12-safe-top:env(safe-area-inset-top,0px);
  --v12-safe-right:env(safe-area-inset-right,0px);
  --v12-safe-bottom:env(safe-area-inset-bottom,0px);
  --v12-safe-left:env(safe-area-inset-left,0px);
}

body.flight-v12{
  background:#01050a;
}

/*
  Fail-safe: the cinematic layout starts only after V12 has found
  the real scene and Launch Control. Until then the normal cloned
  Game remains visible and usable.
*/
body.flight-v12.v12-ready{
  width:100vw!important;
  height:100dvh!important;
  min-height:100dvh!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  overscroll-behavior:none!important;
  background:#01050a!important;
}

body.flight-v12.v12-ready .game-topbar,
body.flight-v12.v12-ready .game-footer{
  display:none!important;
}

body.flight-v12.v12-ready .game-shell{
  position:fixed!important;
  inset:0!important;
  width:100vw!important;
  max-width:none!important;
  height:100dvh!important;
  min-height:100dvh!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#01050a!important;
}

body.flight-v12.v12-ready .game-layout{
  position:static!important;
  display:block!important;
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  min-height:0!important;
  margin:0!important;
  padding:0!important;
  gap:0!important;
}

/* ==========================================================
   FULL-VIEWPORT ROCKET SCENE
   ========================================================== */

body.flight-v12.v12-ready .v12-stage{
  position:fixed!important;
  inset:0!important;
  z-index:10!important;
  display:block!important;
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
  background:#06152a!important;
  box-shadow:none!important;
  box-sizing:border-box!important;
  isolation:isolate!important;
}

/*
  The visual layer fills the entire stage. Existing rocket animation
  and Three.js/CSS renderer remain untouched.
*/
body.flight-v12.v12-ready .v12-stage .v12-visual{
  position:absolute!important;
  inset:0!important;
  z-index:0!important;
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  min-height:100%!important;
  max-height:none!important;
  margin:0!important;
  border-radius:0!important;
  overflow:hidden!important;
}

body.flight-v12.v12-ready .v12-stage .v12-visual canvas,
body.flight-v12.v12-ready .v12-stage .v12-visual video,
body.flight-v12.v12-ready .v12-stage canvas,
body.flight-v12.v12-ready .v12-stage video{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  max-height:none!important;
}

body.flight-v12.v12-ready .v12-stage #threeStage,
body.flight-v12.v12-ready .v12-stage .three-stage,
body.flight-v12.v12-ready .v12-stage #sky,
body.flight-v12.v12-ready .v12-stage .sky,
body.flight-v12.v12-ready .v12-stage [class*="rocket-scene"],
body.flight-v12.v12-ready .v12-stage [class*="space-scene"],
body.flight-v12.v12-ready .v12-stage [class*="game-scene"],
body.flight-v12.v12-ready .v12-stage [class*="flight-scene"]{
  border-radius:0!important;
}

/*
  Keep the current scene HUD — READY/LIVE, multiplier, telemetry,
  feed/time and existing flight-position overlays — above the sky.
*/
body.flight-v12.v12-ready .v12-stage > *:not(.v12-visual){
  position:relative;
  z-index:8;
}

body.flight-v12.v12-ready .v12-stage .flight-head,
body.flight-v12.v12-ready .v12-stage [class*="flight-head"],
body.flight-v12.v12-ready .v12-stage [class*="scene-head"],
body.flight-v12.v12-ready .v12-stage [class*="status-head"]{
  z-index:30!important;
}

body.flight-v12.v12-ready .v12-stage .position-bar,
body.flight-v12.v12-ready .v12-stage [class*="position-bar"],
body.flight-v12.v12-ready .v12-stage .v12-metrics{
  position:absolute!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  z-index:35!important;
  margin:0!important;
  background:rgba(2,7,12,.72)!important;
  backdrop-filter:blur(12px)!important;
  -webkit-backdrop-filter:blur(12px)!important;
}

/* ==========================================================
   GLASS HUD PANELS
   ========================================================== */

body.flight-v12.v12-ready .v12-hud{
  position:fixed!important;
  z-index:60!important;
  min-width:0!important;
  margin:0!important;
  border:1px solid rgba(123,183,204,.22)!important;
  border-radius:18px!important;
  background:
    linear-gradient(
      180deg,
      rgba(6,14,20,.84),
      rgba(3,8,13,.75)
    )!important;
  box-shadow:0 18px 54px rgba(0,0,0,.28)!important;
  backdrop-filter:blur(16px) saturate(1.10)!important;
  -webkit-backdrop-filter:blur(16px) saturate(1.10)!important;
  box-sizing:border-box!important;
}

body.flight-v12.v12-ready .v12-hud,
body.flight-v12.v12-ready .v12-hud *{
  box-sizing:border-box!important;
}

body.flight-v12.v12-ready .v12-hud > *,
body.flight-v12.v12-ready .v12-hud input,
body.flight-v12.v12-ready .v12-hud select,
body.flight-v12.v12-ready .v12-hud button,
body.flight-v12.v12-ready .v12-hud a{
  min-width:0!important;
  max-width:100%;
}

/* Portrait iPhone */
body.flight-v12.v12-ready .v12-launch{
  left:max(7px,var(--v12-safe-left))!important;
  bottom:max(9px,var(--v12-safe-bottom))!important;
  width:min(52vw,410px)!important;
  max-width:min(52vw,410px)!important;
  max-height:56dvh!important;
  overflow:auto!important;
  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

body.flight-v12.v12-ready .v12-selected{
  right:max(7px,var(--v12-safe-right))!important;
  top:max(74px,calc(var(--v12-safe-top) + 58px))!important;
  width:min(43vw,350px)!important;
  max-width:min(43vw,350px)!important;
  max-height:29dvh!important;
  overflow:auto!important;
  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

body.flight-v12.v12-ready .v12-record{
  right:max(7px,var(--v12-safe-right))!important;
  top:43dvh!important;
  width:min(43vw,350px)!important;
  max-width:min(43vw,350px)!important;
  max-height:16dvh!important;
  overflow:auto!important;
}

body.flight-v12.v12-ready .v12-history{
  right:max(7px,var(--v12-safe-right))!important;
  bottom:max(9px,var(--v12-safe-bottom))!important;
  width:min(43vw,350px)!important;
  max-width:min(43vw,350px)!important;
  max-height:29dvh!important;
  overflow:auto!important;
  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

body.flight-v12.v12-ready .v12-history .history-list,
body.flight-v12.v12-ready .v12-history [class*="history-list"]{
  overflow-y:auto!important;
  overflow-x:hidden!important;
  overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch!important;
}

/* Settings / Wallet must open over everything. */
body.flight-v12 .mf-game-settings-overlay,
body.flight-v12 .mf-game-wallet-overlay,
body.flight-v12 [class*="settings-overlay"],
body.flight-v12 [class*="wallet-overlay"]{
  z-index:100000!important;
}

/* Existing fullscreen button is unnecessary inside Flight V12. */
body.flight-v12 .v12-old-fullscreen{
  display:none!important;
}

/* ==========================================================
   V12 EXIT
   ========================================================== */

#v12Exit{
  position:fixed;
  z-index:90000;
  top:max(9px,var(--v12-safe-top));
  right:max(9px,var(--v12-safe-right));
  min-width:42px;
  height:38px;
  padding:0 12px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  border:1px solid rgba(132,191,213,.28);
  border-radius:13px;
  background:rgba(4,11,16,.66);
  color:#e8f9ff;
  box-shadow:0 10px 30px rgba(0,0,0,.22);
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
  text-decoration:none;
  font:800 9px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  letter-spacing:.10em;
  -webkit-tap-highlight-color:transparent;
}

#v12Exit::before{
  content:"←";
  font-size:15px;
  line-height:1;
}

@media (max-width:430px){
  body.flight-v12.v12-ready .v12-hud{
    font-size:.90em!important;
  }

  #v12Exit{
    width:38px;
    min-width:38px;
    padding:0;
    font-size:0;
  }
}

/* ==========================================================
   LANDSCAPE / TABLET / DESKTOP
   ========================================================== */

@media (orientation:landscape){
  body.flight-v12.v12-ready .v12-launch{
    left:max(10px,var(--v12-safe-left))!important;
    top:max(10px,var(--v12-safe-top))!important;
    bottom:max(10px,var(--v12-safe-bottom))!important;
    width:min(27vw,410px)!important;
    max-width:min(27vw,410px)!important;
    max-height:none!important;
  }

  body.flight-v12.v12-ready .v12-selected{
    right:max(10px,var(--v12-safe-right))!important;
    top:max(10px,var(--v12-safe-top))!important;
    width:min(23vw,350px)!important;
    max-width:min(23vw,350px)!important;
    max-height:38dvh!important;
  }

  body.flight-v12.v12-ready .v12-record{
    right:max(10px,var(--v12-safe-right))!important;
    top:42dvh!important;
    width:min(23vw,350px)!important;
    max-width:min(23vw,350px)!important;
    max-height:18dvh!important;
  }

  body.flight-v12.v12-ready .v12-history{
    right:max(10px,var(--v12-safe-right))!important;
    bottom:max(10px,var(--v12-safe-bottom))!important;
    width:min(23vw,350px)!important;
    max-width:min(23vw,350px)!important;
    max-height:35dvh!important;
  }

  #v12Exit{
    right:
      calc(
        max(10px,var(--v12-safe-right))
        + min(23vw,350px)
        + 10px
      );
  }
}

@media (max-height:520px) and (orientation:landscape){
  body.flight-v12.v12-ready .v12-hud{
    font-size:.75em!important;
  }

  body.flight-v12.v12-ready .v12-launch{
    width:25vw!important;
    max-width:25vw!important;
  }

  body.flight-v12.v12-ready .v12-selected,
  body.flight-v12.v12-ready .v12-record,
  body.flight-v12.v12-ready .v12-history{
    width:21vw!important;
    max-width:21vw!important;
  }

  #v12Exit{
    right:
      calc(
        max(8px,var(--v12-safe-right))
        + 21vw
        + 8px
      );
    height:30px;
  }
}

/*
  Round result / final AUTO-session summary remains above the HUD
  when the existing current Game logic chooses to show it.
*/
body.flight-v12 .result-overlay,
body.flight-v12 [class*="result-overlay"],
body.flight-v12 [class*="session-summary"]{
  z-index:120000!important;
}
EOF

# ============================================================
# V12 layout JS
# No new game engine here. It only tags current Game DOM.
# ============================================================

cat > "$FLIGHT_JS" <<'EOF'
(()=>{
  'use strict';

  const VERSION='12.0';

  let ready=false;
  let observer=null;

  const q=(selector,root=document)=>
    root.querySelector(selector);

  function norm(value){
    return String(value||'')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function text(el){
    return norm(
      el?.innerText ||
      el?.textContent ||
      ''
    );
  }

  function visibleBlocks(){
    return [
      ...document.querySelectorAll(
        'section,article,aside,main,div'
      )
    ].filter(el=>{
      if(el===document.body)return false;
      const r=el.getBoundingClientRect();
      return r.width>100 && r.height>24;
    });
  }

  function smallestContaining(words){
    const wanted=words.map(norm);

    return visibleBlocks()
      .filter(el=>{
        const value=text(el);
        return wanted.every(
          word=>value.includes(word)
        );
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return ar.width*ar.height-br.width*br.height;
      })[0] || null;
  }

  function hasVisual(el){
    if(!el)return false;

    return !!el.querySelector([
      'canvas',
      'video',
      '#threeStage',
      '#sky',
      '[data-flight-stage]',
      '[data-game-scene]',
      '[class*="rocket-scene"]',
      '[class*="space-scene"]',
      '[class*="game-scene"]',
      '[class*="flight-scene"]',
      '[class*="visual-stage"]'
    ].join(','));
  }

  function findLaunch(){
    return (
      q('.launch-panel') ||
      q('.control-panel') ||
      q('[data-panel="launch-control"]') ||
      smallestContaining([
        'LAUNCH CONTROL',
        'PAPER BALANCE'
      ])
    );
  }

  function findMetricStrip(){
    return smallestContaining([
      'STAKE',
      'PAPER VALUE',
      'P&L',
      'STAGE',
      'PRICE AGE'
    ]);
  }

  /*
    Stage detection is anchored to stable Game structure.
    It does not depend on the failed V11 iframe layout.
  */
  function findStage(launch,metrics){
    const direct=[
      '[data-flight-stage]',
      '[data-game-scene]',
      '#rocketScene',
      '.rocket-scene',
      '.space-scene',
      '.game-scene',
      '.hero-scene',
      '.flight-scene',
      '.visual-stage',
      '.flight-card'
    ];

    for(const selector of direct){
      const el=q(selector);
      if(!el)continue;

      const r=el.getBoundingClientRect();

      if(
        r.width>=Math.min(280,innerWidth*.65) &&
        r.height>=200
      ){
        return el;
      }
    }

    if(metrics){
      const mr=metrics.getBoundingClientRect();
      let el=metrics.parentElement;
      let fallback=null;

      while(
        el &&
        el!==document.body &&
        el!==document.documentElement
      ){
        const value=text(el);
        const r=el.getBoundingClientRect();

        if(
          value.includes('LAUNCH CONTROL') ||
          value.includes('ROUND HISTORY')
        ){
          break;
        }

        const largeEnough=
          r.width>=Math.min(280,innerWidth*.68) &&
          r.height>=Math.max(220,mr.height*3);

        if(largeEnough && !fallback){
          fallback=el;
        }

        if(largeEnough && hasVisual(el)){
          return el;
        }

        el=el.parentElement;
      }

      if(fallback){
        return fallback;
      }
    }

    if(launch){
      const lr=launch.getBoundingClientRect();

      const candidates=
        visibleBlocks()
        .filter(el=>{
          const r=el.getBoundingClientRect();
          const value=text(el);

          return (
            r.width>=innerWidth*.70 &&
            r.height>=220 &&
            r.top<lr.top &&
            r.bottom<=lr.top+28 &&
            !value.includes('LAUNCH CONTROL') &&
            !value.includes('ROUND HISTORY')
          );
        })
        .sort((a,b)=>{
          const ar=a.getBoundingClientRect();
          const br=b.getBoundingClientRect();
          const av=hasVisual(a)?1:0;
          const bv=hasVisual(b)?1:0;

          if(av!==bv)return bv-av;

          return br.width*br.height-ar.width*ar.height;
        });

      if(candidates[0]){
        return candidates[0];
      }
    }

    return null;
  }

  function findVisual(stage,metrics){
    if(!stage)return null;

    const selectors=[
      '#threeStage',
      '#sky',
      '.three-stage',
      '.sky',
      '[data-scene]',
      '[data-visual]',
      '[class*="rocket-scene"]',
      '[class*="space-scene"]',
      '[class*="game-scene"]',
      '[class*="flight-scene"]',
      '[class*="visual-stage"]',
      'canvas',
      'video'
    ];

    const found=[];

    for(const selector of selectors){
      stage.querySelectorAll(selector).forEach(el=>{
        if(!found.includes(el)){
          found.push(el);
        }
      });
    }

    const usable=
      found
      .map(el=>{
        if(
          el.matches('canvas,video') &&
          el.parentElement &&
          stage.contains(el.parentElement)
        ){
          return el.parentElement;
        }
        return el;
      })
      .filter((el,index,array)=>array.indexOf(el)===index)
      .filter(el=>{
        const r=el.getBoundingClientRect();
        return r.width>120 && r.height>120;
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return br.width*br.height-ar.width*ar.height;
      });

    if(usable[0]){
      return usable[0];
    }

    const children=
      [...stage.children]
      .filter(el=>{
        if(
          metrics &&
          (
            el===metrics ||
            el.contains(metrics)
          )
        ){
          return false;
        }

        const value=text(el);

        if(
          value.includes('STAKE') &&
          value.includes('PRICE AGE')
        ){
          return false;
        }

        const r=el.getBoundingClientRect();
        return r.width>120 && r.height>120;
      })
      .sort((a,b)=>{
        const ar=a.getBoundingClientRect();
        const br=b.getBoundingClientRect();
        return br.width*br.height-ar.width*ar.height;
      });

    return children[0] || null;
  }

  function findSelected(){
    return (
      q('.selected-launch') ||
      q('[class*="selected-launch"]') ||
      q('.target-card') ||
      q('[data-panel="selected-launch"]') ||
      smallestContaining([
        'SELECTED LAUNCH',
        'AI SCORE',
        'BUY PRESSURE'
      ])
    );
  }

  function findRecord(){
    return (
      q('.flight-record') ||
      q('[class*="flight-record"]') ||
      q('[data-panel="flight-record"]') ||
      smallestContaining([
        'FLIGHT RECORD',
        'NET P&L'
      ])
    );
  }

  function findHistory(){
    const list=q('#historyList');

    if(list){
      let el=list;

      while(el && el!==document.body){
        if(text(el).includes('ROUND HISTORY')){
          return el;
        }
        el=el.parentElement;
      }
    }

    return (
      q('.history-card') ||
      q('[class*="round-history"]') ||
      q('[data-panel="round-history"]') ||
      smallestContaining(['ROUND HISTORY'])
    );
  }

  function removeLegacyNag(){
    const phrases=[
      'OPEN MEMEFLOW AS AN APP',
      'IPHONE FULL SCREEN',
      'SAFARI CANNOT HIDE ITS TOP AND BOTTOM BROWSER BARS'
    ];

    const matches=[
      ...document.querySelectorAll(
        'dialog,[role="dialog"],section,div'
      )
    ]
    .filter(el=>{
      const value=text(el);
      return phrases.some(
        phrase=>value.includes(phrase)
      );
    })
    .sort((a,b)=>{
      const ar=a.getBoundingClientRect();
      const br=b.getBoundingClientRect();
      return ar.width*ar.height-br.width*br.height;
    });

    matches[0]?.remove();
  }

  function clearLegacyClasses(){
    document.body.classList.remove('mf-flight-mode');

    q('#mfFlightModeExit')?.remove();

    document.querySelectorAll(
      '.mf-flight-stage,'+
      '.mf-flight-hud,'+
      '.mf-hud-launch,'+
      '.mf-hud-selected,'+
      '.mf-hud-record,'+
      '.mf-hud-history,'+
      '.mf-v11-stage,'+
      '.mf-v11-hud,'+
      '.mf-v11-launch,'+
      '.mf-v11-selected,'+
      '.mf-v11-record,'+
      '.mf-v11-history'
    ).forEach(el=>{
      el.classList.remove(
        'mf-flight-stage',
        'mf-flight-hud',
        'mf-hud-launch',
        'mf-hud-selected',
        'mf-hud-record',
        'mf-hud-history',
        'mf-v11-stage',
        'mf-v11-hud',
        'mf-v11-launch',
        'mf-v11-selected',
        'mf-v11-record',
        'mf-v11-history'
      );
    });
  }

  function markOldFullscreen(launch){
    const row=launch?.querySelector('.utility-actions');
    if(!row)return;

    const controls=[
      ...row.querySelectorAll(
        'button,a,[role="button"]'
      )
    ];

    const labeled=
      controls.find(el=>{
        const label=norm(
          (el.getAttribute('aria-label')||'')+
          ' '+
          (el.getAttribute('title')||'')
        );

        return (
          label.includes('FULL') ||
          label.includes('EXPAND') ||
          label.includes('FLIGHT VIEW')
        );
      });

    const candidate=
      labeled ||
      (
        controls.length>=4
          ?controls[controls.length-1]
          :null
      );

    candidate?.classList.add('v12-old-fullscreen');
  }

  function addExit(){
    if(q('#v12Exit'))return;

    const link=document.createElement('a');
    link.id='v12Exit';
    link.href='/game';
    link.textContent='GAME';
    link.setAttribute(
      'aria-label',
      'Return to normal Game'
    );

    document.body.appendChild(link);
  }

  function tagMetrics(stage,metrics){
    if(!stage || !metrics || !stage.contains(metrics)){
      return;
    }

    metrics.classList.add('v12-metrics');
  }

  function apply(){
    removeLegacyNag();
    clearLegacyClasses();

    const launch=findLaunch();
    const metrics=findMetricStrip();
    const stage=findStage(launch,metrics);

    if(!stage || !launch){
      document.body.classList.remove('v12-ready');
      return false;
    }

    const selected=findSelected();
    const record=findRecord();
    const history=findHistory();
    const visual=findVisual(stage,metrics);

    stage.classList.add('v12-stage');

    if(visual && visual!==stage){
      visual.classList.add('v12-visual');
    }

    launch.classList.add(
      'v12-hud',
      'v12-launch'
    );

    selected?.classList.add(
      'v12-hud',
      'v12-selected'
    );

    record?.classList.add(
      'v12-hud',
      'v12-record'
    );

    history?.classList.add(
      'v12-hud',
      'v12-history'
    );

    tagMetrics(stage,metrics);
    markOldFullscreen(launch);
    addExit();

    document.body.classList.add(
      'flight-v12',
      'v12-ready'
    );

    ready=true;

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        try{
          window.dispatchEvent(new Event('resize'));
        }catch(_){}
      });
    });

    console.info(
      '[MEMEFLOW FLIGHT V12]',
      VERSION,
      {
        stage,
        visual,
        launch,
        selected,
        record,
        history
      }
    );

    return true;
  }

  function boot(){
    document.body.classList.add('flight-v12');
    removeLegacyNag();

    let attempts=0;

    const timer=setInterval(()=>{
      attempts+=1;

      if(apply() || attempts>=30){
        clearInterval(timer);
      }
    },120);

    observer=new MutationObserver(()=>{
      removeLegacyNag();

      if(ready){
        markOldFullscreen(findLaunch());
      }
    });

    observer.observe(
      document.documentElement,
      {
        childList:true,
        subtree:true
      }
    );

    window.addEventListener(
      'orientationchange',
      ()=>{
        setTimeout(()=>{
          ready=false;
          apply();
        },220);
      }
    );

    window.addEventListener(
      'pageshow',
      ()=>{
        setTimeout(apply,80);
      }
    );
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      ()=>{
        setTimeout(boot,100);
      },
      {once:true}
    );
  }else{
    setTimeout(boot,100);
  }
})();
EOF

# ============================================================
# V12 launcher for NORMAL Game.
# Safari uses a genuine anchor target=_blank, NOT window.open().
# Home Screen standalone mode stays inside the app window.
# ============================================================

cat > "$LAUNCHER" <<'EOF'
(()=>{
  'use strict';

  const VERSION='12.0';

  if(location.pathname.includes('flight-v12')){
    return;
  }

  const q=(selector,root=document)=>
    root.querySelector(selector);

  function norm(value){
    return String(value||'')
      .replace(/\s+/g,' ')
      .trim()
      .toUpperCase();
  }

  function removeLegacyNag(){
    const phrases=[
      'OPEN MEMEFLOW AS AN APP',
      'IPHONE FULL SCREEN',
      'SAFARI CANNOT HIDE ITS TOP AND BOTTOM BROWSER BARS'
    ];

    const matches=[
      ...document.querySelectorAll(
        'dialog,[role="dialog"],section,div'
      )
    ]
    .filter(el=>{
      const value=norm(
        el.innerText ||
        el.textContent
      );

      return phrases.some(
        phrase=>value.includes(phrase)
      );
    })
    .sort((a,b)=>{
      const ar=a.getBoundingClientRect();
      const br=b.getBoundingClientRect();
      return ar.width*ar.height-br.width*br.height;
    });

    matches[0]?.remove();
  }

  function utility(){
    return q(
      '.launch-panel .utility-actions,'+
      '.control-panel .utility-actions'
    );
  }

  function findFullscreen(){
    const row=utility();
    if(!row)return null;

    const controls=[
      ...row.querySelectorAll(
        'button,a,[role="button"]'
      )
    ];

    if(!controls.length)return null;

    const owned=
      controls.find(
        el=>
          el.dataset.v12FlightLauncher===
          'true'
      );

    if(owned)return owned;

    const labeled=
      controls.find(el=>{
        const label=norm(
          (el.getAttribute('aria-label')||'')+
          ' '+
          (el.getAttribute('title')||'')
        );

        return (
          label.includes('FULL SCREEN') ||
          label.includes('FULLSCREEN') ||
          label.includes('EXPAND') ||
          label.includes('FLIGHT VIEW')
        );
      });

    if(labeled)return labeled;

    /*
      Current utility row is Settings / Wallet / Sound / Fullscreen.
      Wait until all four are present before using the last one.
    */
    if(controls.length>=4){
      return controls[controls.length-1];
    }

    return null;
  }

  function isStandalone(){
    return (
      window.matchMedia?.(
        '(display-mode: standalone)'
      )?.matches ||
      window.matchMedia?.(
        '(display-mode: fullscreen)'
      )?.matches ||
      navigator.standalone===true
    );
  }

  function copyAppearance(from,to){
    for(const attr of [...from.attributes]){
      const name=attr.name.toLowerCase();

      if(
        name==='type' ||
        name==='role' ||
        name==='href' ||
        name==='target' ||
        name==='rel' ||
        name==='aria-label' ||
        name==='title' ||
        name.startsWith('data-mf-') ||
        name.startsWith('data-v12')
      ){
        continue;
      }

      try{
        to.setAttribute(
          attr.name,
          attr.value
        );
      }catch(_){}
    }
  }

  function install(){
    removeLegacyNag();

    const old=findFullscreen();
    if(!old)return false;

    if(old.dataset.v12FlightLauncher==='true'){
      return true;
    }

    /*
      Replace the old button with an anchor after the Game has bound its
      old handlers. This removes direct button listeners and old delegated
      "button fullscreen" code no longer sees this control.
    */
    const link=document.createElement('a');

    copyAppearance(old,link);

    link.innerHTML=old.innerHTML;
    link.href='/flight-v12.html';
    link.target=isStandalone()?'_self':'_blank';
    link.rel='noopener';
    link.dataset.v12FlightLauncher='true';

    /*
      Deliberately avoid the word FULLSCREEN in the label so retired
      V10 delegated listeners do not recognize it.
    */
    link.setAttribute(
      'aria-label',
      'Open Flight View'
    );

    link.setAttribute(
      'title',
      'Open Flight View'
    );

    link.style.textDecoration='none';

    old.replaceWith(link);

    console.info(
      '[MEMEFLOW FLIGHT V12 LAUNCHER]',
      VERSION,
      'READY'
    );

    return true;
  }

  function boot(){
    removeLegacyNag();

    let attempts=0;

    const timer=setInterval(()=>{
      attempts+=1;

      if(install() || attempts>=60){
        clearInterval(timer);
      }
    },120);

    const observer=new MutationObserver(()=>{
      removeLegacyNag();

      if(
        !q(
          '[data-v12-flight-launcher="true"]'
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
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      ()=>{
        /*
          Let all current Game modules finish binding the original utility
          buttons, then replace the old Fullscreen control once.
        */
        setTimeout(boot,220);
      },
      {once:true}
    );
  }else{
    setTimeout(boot,220);
  }
})();
EOF

# ============================================================
# PWA / Home Screen manifest.
# No custom install modal.
# ============================================================

cat > "$MANIFEST" <<'EOF'
{
  "id": "/flight-v12.html",
  "name": "MEMEFLOW Flight",
  "short_name": "MEMEFLOW",
  "description": "MEMEFLOW cinematic paper-game Flight View",
  "start_url": "/flight-v12.html",
  "scope": "/",
  "display": "standalone",
  "display_override": [
    "fullscreen",
    "standalone"
  ],
  "orientation": "any",
  "background_color": "#01050a",
  "theme_color": "#01050a"
}
EOF

# ============================================================
# Build V12 DIRECTLY FROM CURRENT game.html.
# No iframe and no second game implementation.
# ============================================================

python - <<'PY'
from pathlib import Path
import re
import time

app=Path("memeflow-app")
game_path=app/"game.html"
flight_path=app/"flight-v12.html"
settings_path=app/"game-settings-v107.js"

v=str(int(time.time()))

def remove_between(s,start,end):
    while start in s and end in s:
        a=s.index(start)
        b=s.index(end,a)+len(end)
        s=s[:a]+s[b:]
    return s

def strip_old_html(s):
    s=re.sub(
        r'<!--\s*===\s*MEMEFLOW FULLSCREEN V11\.1 DIRECT START\s*===\s*-->.*?<!--\s*===\s*MEMEFLOW FULLSCREEN V11\.1 DIRECT END\s*===\s*-->',
        '',
        s,
        flags=re.I|re.S
    )

    patterns=[
        r'<script\b[^>]*\bsrc=["\']/game-fullscreen-v11-launcher\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',
        r'<script\b[^>]*\bsrc=["\']/game-flight-mode-v109\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',
        r'<link\b[^>]*\bhref=["\']/game-flight-mode-v109\.css(?:\?[^"\']*)?["\'][^>]*>'
    ]

    for pattern in patterns:
        s=re.sub(
            pattern,
            '',
            s,
            flags=re.I
        )

    return s

original=game_path.read_text()
clean=strip_old_html(original)

# ---------------- NORMAL GAME ----------------

normal=clean

normal=re.sub(
    r'<script\b[^>]*\bsrc=["\']/flight-v12-launcher\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',
    '',
    normal,
    flags=re.I
)

launcher_tag=(
    f'<script src="/flight-v12-launcher.js?v={v}" defer></script>'
)

if '</body>' not in normal:
    raise SystemExit("ERROR: game.html has no </body>")

normal=normal.replace(
    '</body>',
    launcher_tag+'\n</body>',
    1
)

# Force fresh settings loader after retiring old V10/V11 bootstrap.
normal=re.sub(
    r'(/game-settings-v107\.js)(?:\?[^"\']*)?',
    rf'\1?v={v}',
    normal
)

game_path.write_text(
    normal.rstrip()+'\n'
)

# ---------------- FLIGHT V12 ----------------

flight=clean

flight=re.sub(
    r'<script\b[^>]*\bsrc=["\']/flight-v12-launcher\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>',
    '',
    flight,
    flags=re.I
)

# V12 owns its own manifest.
flight=re.sub(
    r'<link\b[^>]*\brel=["\']manifest["\'][^>]*>',
    '',
    flight,
    flags=re.I
)

# Add flight-v12 body class without destroying existing body classes.
body_re=re.compile(
    r'<body\b([^>]*)>',
    re.I
)

m=body_re.search(flight)

if not m:
    raise SystemExit("ERROR: current game.html has no <body>")

attrs=m.group(1)

class_match=re.search(
    r'\bclass=(["\'])(.*?)\1',
    attrs,
    flags=re.I|re.S
)

if class_match:
    classes=class_match.group(2).split()

    if 'flight-v12' not in classes:
        classes.append('flight-v12')

    replacement_class=(
        'class="'+
        ' '.join(classes)+
        '"'
    )

    new_attrs=(
        attrs[:class_match.start()] +
        replacement_class +
        attrs[class_match.end():]
    )
else:
    new_attrs=attrs+' class="flight-v12"'

flight=(
    flight[:m.start()] +
    '<body'+new_attrs+'>' +
    flight[m.end():]
)

head_add=f'''
<meta name="theme-color" content="#01050a">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MEMEFLOW Flight">
<link rel="manifest" href="/flight-v12-manifest.json?v={v}">
<link rel="stylesheet" href="/flight-v12.css?v={v}">
'''

if '</head>' not in flight:
    raise SystemExit("ERROR: current game.html has no </head>")

flight=flight.replace(
    '</head>',
    head_add+'\n</head>',
    1
)

flight=re.sub(
    r'(/game-settings-v107\.js)(?:\?[^"\']*)?',
    rf'\1?v={v}',
    flight
)

v12_tag=(
    f'<script src="/flight-v12.js?v={v}" defer></script>'
)

if '</body>' not in flight:
    raise SystemExit("ERROR: cloned flight page has no </body>")

flight=flight.replace(
    '</body>',
    v12_tag+'\n</body>',
    1
)

flight=re.sub(
    r'<title>.*?</title>',
    '<title>MEMEFLOW Flight V12</title>',
    flight,
    count=1,
    flags=re.I|re.S
)

flight_path.write_text(
    flight.rstrip()+'\n'
)

print("V12 cache:",v)
print("Created:",flight_path)

# ---------------- RETIRE LEGACY SETTINGS BOOTSTRAPS ----------------

if settings_path.exists():
    s=settings_path.read_text()

    pairs=[
        (
            "/* === GAME FLIGHT MODE V10.9 BOOTSTRAP START === */",
            "/* === GAME FLIGHT MODE V10.9 BOOTSTRAP END === */"
        ),
        (
            "/* === GAME FULLSCREEN V11 LAUNCHER START === */",
            "/* === GAME FULLSCREEN V11 LAUNCHER END === */"
        )
    ]

    removed=0

    for start,end in pairs:
        before=s
        s=remove_between(s,start,end)

        if s!=before:
            removed+=1

    settings_path.write_text(
        s.rstrip()+'\n'
    )

    print(
        "Retired legacy settings bootstrap blocks:",
        removed
    )
PY

# ============================================================
# Make stale old loader requests harmless.
# Backups already exist.
# ============================================================

if [ -f "$APP/game-flight-mode-v109.js" ]; then
  cat > "$APP/game-flight-mode-v109.js" <<'EOF'
(()=>{
  'use strict';
  console.info('[MEMEFLOW] Legacy Flight V10.9 retired by clean V12.');
})();
EOF
fi

if [ -f "$APP/game-fullscreen-v11-launcher.js" ]; then
  cat > "$APP/game-fullscreen-v11-launcher.js" <<'EOF'
(()=>{
  'use strict';
  console.info('[MEMEFLOW] Legacy Fullscreen V11 launcher retired by clean V12.');
})();
EOF
fi

# ============================================================
# VERIFY
# ============================================================

node --check "$FLIGHT_JS"
node --check "$LAUNCHER"

if [ -f "$SETTINGS" ]; then
  node --check "$SETTINGS"
fi

python - <<'PY'
from pathlib import Path

app=Path("memeflow-app")
game=(app/"game.html").read_text()
flight=(app/"flight-v12.html").read_text()

checks={
    "V12 page exists": (app/"flight-v12.html").exists(),
    "V12 has no iframe": "<iframe" not in flight.lower(),
    "V12 loads current game.js": "/game.js" in flight,
    "V12 loads flight CSS": "/flight-v12.css" in flight,
    "V12 loads flight JS": "/flight-v12.js" in flight,
    "V12 has standalone manifest": "/flight-v12-manifest.json" in flight,
    "Normal Game has V12 launcher": "/flight-v12-launcher.js" in game,
    "Normal Game no V11 launcher tag": "/game-fullscreen-v11-launcher.js" not in game,
    "Normal Game no V10 flight tag": "/game-flight-mode-v109.js" not in game
}

bad=[]

for label,ok in checks.items():
    print(("PASS" if ok else "FAIL"), "-", label)

    if not ok:
        bad.append(label)

if bad:
    raise SystemExit(
        "V12 VERIFY FAILED: "+
        ", ".join(bad)
    )
PY

FILES=(
  "$GAME_HTML"
  "$FLIGHT_HTML"
  "$FLIGHT_CSS"
  "$FLIGHT_JS"
  "$LAUNCHER"
  "$MANIFEST"
)

[ -f "$SETTINGS" ] && FILES+=("$SETTINGS")
[ -f "$APP/game-flight-mode-v109.js" ] && FILES+=("$APP/game-flight-mode-v109.js")
[ -f "$APP/game-fullscreen-v11-launcher.js" ] && FILES+=("$APP/game-fullscreen-v11-launcher.js")

git diff --check -- "${FILES[@]}"

echo
echo "=== V12 VERIFY PASS ==="

# ============================================================
# GIT
# ============================================================

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "${FILES[@]}"

  if ! git diff --cached --quiet; then
    git commit \
      -m "Add clean standalone Flight View V12" \
      || true

    BRANCH="$(git branch --show-current 2>/dev/null || true)"

    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: Git push failed."
        echo "V12 is still installed locally in Replit."
      }
    fi
  else
    echo "No new Git changes — V12 already appears installed."
  fi
fi

echo
echo "=================================================="
echo " MEMEFLOW CLEAN FLIGHT V12 INSTALLED"
echo "=================================================="
echo
echo "NEW PAGE:"
echo "  /flight-v12.html"
echo
echo "ARCHITECTURE:"
echo "  direct page cloned from CURRENT game.html"
echo "  NO iframe"
echo "  NO second game engine"
echo "  same current game.js"
echo "  same APIs / cookie session / server state"
echo "  AUTO / CASH OUT / settings / wallet preserved"
echo
echo "VISUAL:"
echo "  rocket scene = full viewport"
echo "  Launch Control = glass HUD left"
echo "  Selected Launch = HUD right top"
echo "  Flight Record = HUD right middle"
echo "  Round History = scrollable HUD right bottom"
echo
echo "IPHONE:"
echo "  custom 'Open MEMEFLOW as an app' popup removed/ignored"
echo "  manifest configured for standalone Home Screen app"
echo
echo "NORMAL GAME FLIGHT ICON:"
echo "  Safari -> real link opens V12 in new tab"
echo "  Home Screen app -> opens V12 in same app window"
echo "  NO window.open()"
echo
echo "NEXT:"
echo "  1. Replit Stop"
echo "  2. Replit Run"
echo "  3. Close old Game / V11 Safari tabs"
echo "  4. Open normal /game again"
echo "  5. Tap the four-corners icon"
echo
echo "APP MODE - ONE TIME ON IPHONE:"
echo "  Open /flight-v12.html in Safari"
echo "  Share -> Add to Home Screen -> Open as Web App"
echo "  Then launch MEMEFLOW from the Home Screen icon"
echo
