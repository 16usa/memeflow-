#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW FULLSCREEN V11.1 — CUT OFF OLD HUD ==="

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
LAUNCHER="$APP/game-fullscreen-v11-launcher.js"
V11HTML="$APP/game-fullscreen-v11.html"
V11JS="$APP/game-fullscreen-v11.js"
BACKUP="$APP/_backup/v11.1-cut-old-hud"

mkdir -p "$BACKUP"
cp -f "$SETTINGS" "$BACKUP/game-settings-v107.js.before-v111"
cp -f "$LAUNCHER" "$BACKUP/game-fullscreen-v11-launcher.js.before-v111" 2>/dev/null || true
cp -f "$V11JS" "$BACKUP/game-fullscreen-v11.js.before-v111" 2>/dev/null || true

cat > "$LAUNCHER" <<'EOF'
(()=>{
  'use strict';

  const VERSION='11.1';
  const params=new URLSearchParams(location.search);

  if(params.get('mf_embedded')==='1'){
    console.info('[MEMEFLOW FULLSCREEN V11.1] embedded Game — launcher disabled');
    return;
  }

  let opening=false;

  function cleanupOldFlight(){
    try{
      globalThis.MEMEFLOW_FLIGHT_MODE?.disable?.();
    }catch(_){}

    document.body?.classList.remove('mf-flight-mode');
    document.getElementById('mfFlightModeExit')?.remove();

    document
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

  function utility(){
    return document.querySelector('.launch-panel .utility-actions');
  }

  function existingFullscreenButton(){
    const row=utility();
    if(!row)return null;

    const buttons=[...row.querySelectorAll('button,[role="button"]')];
    if(!buttons.length)return null;

    const already=buttons.find(b=>b.dataset.mfV11Launcher==='true');
    if(already)return already;

    const labeled=buttons.find(button=>{
      const s=(
        String(button.innerText||'')+' '+
        String(button.getAttribute('aria-label')||'')+' '+
        String(button.getAttribute('title')||'')
      ).toUpperCase();

      return (
        s.includes('FULL SCREEN') ||
        s.includes('FULLSCREEN') ||
        s.includes('FLIGHT VIEW')
      );
    });

    return labeled || buttons[buttons.length-1] || null;
  }

  function targetUrl(){
    const current=location.pathname+location.search+location.hash;

    sessionStorage.setItem('mfGameFullscreenReturn',current);

    return (
      '/game-fullscreen-v11.html?mf_v11=1&src='+
      encodeURIComponent(current)
    );
  }

  function openV11(){
    if(opening)return;
    opening=true;

    cleanupOldFlight();
    location.assign(targetUrl());
  }

  function ownButton(){
    cleanupOldFlight();

    const old=existingFullscreenButton();
    if(!old)return false;

    if(old.dataset.mfV11Launcher==='true')return true;

    const button=old.cloneNode(true);

    button.dataset.mfV11Launcher='true';
    button.setAttribute('aria-label','Open Flight View');
    button.setAttribute('title','Open Flight View');

    old.replaceWith(button);

    console.info('[MEMEFLOW FULLSCREEN V11.1] four-corners button owned by V11');
    return true;
  }

  function isOurButton(target){
    return !!target?.closest?.('[data-mf-v11-launcher="true"]');
  }

  /* Window capture fires before the old V10.9 document click listener. */
  function capture(event){
    if(!isOurButton(event.target))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openV11();
  }

  window.addEventListener('pointerdown',capture,true);
  window.addEventListener('touchstart',capture,{capture:true,passive:false});
  window.addEventListener('click',capture,true);

  cleanupOldFlight();

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(ownButton() || attempts>80)clearInterval(timer);
  },100);

  const observer=new MutationObserver(()=>ownButton());
  observer.observe(document.documentElement,{childList:true,subtree:true});

  console.info('[MEMEFLOW FULLSCREEN V11.1]',VERSION,'READY');
})();
EOF

python - <<'PY'
from pathlib import Path

p=Path("memeflow-app/game-settings-v107.js")
s=p.read_text()

START="/* === GAME FLIGHT MODE V10.9 BOOTSTRAP START === */"
END="/* === GAME FLIGHT MODE V10.9 BOOTSTRAP END === */"

removed=0
while START in s and END in s:
    a=s.index(START)
    b=s.index(END,a)+len(END)
    s=s[:a]+s[b:]
    removed+=1

p.write_text(s.rstrip()+"\n")
print("Old V10.9 bootstrap blocks removed:",removed)
PY

python - <<'PY'
from pathlib import Path
import re, time

app=Path("memeflow-app")
v=str(int(time.time()))

START="<!-- === MEMEFLOW FULLSCREEN V11.1 DIRECT START === -->"
END="<!-- === MEMEFLOW FULLSCREEN V11.1 DIRECT END === -->"

changed=[]

for p in app.glob("*.html"):
    if p.name=="game-fullscreen-v11.html":
        continue

    s=p.read_text(errors="ignore")

    looks_game=(
        "game-settings-v107.js" in s or
        "LAUNCH CONTROL" in s or
        "/game.js" in s or
        "game.js?" in s
    )

    if not looks_game:
        continue

    if START in s and END in s:
        a=s.index(START)
        b=s.index(END,a)+len(END)
        s=s[:a]+s[b:]

    # Force Safari to fetch the new Settings file, not the cached V10.9 loader.
    s=re.sub(
        r'''src=(["'])/game-settings-v107\.js(?:\?[^"']*)?\1''',
        lambda m: f'src={m.group(1)}/game-settings-v107.js?v={v}{m.group(1)}',
        s
    )

    direct=(
        "\n"+START+"\n"+
        f'<script src="/game-fullscreen-v11-launcher.js?v={v}"></script>\n'+
        END+"\n"
    )

    if "</body>" in s:
        s=s.replace("</body>",direct+"</body>",1)
    else:
        s=s.rstrip()+direct

    p.write_text(s.rstrip()+"\n")
    changed.append(str(p))

print("Direct V11.1 launcher injected into:")
for item in changed:
    print(" -",item)

if not changed:
    print("WARNING: no top-level Game HTML matched")
PY

python - <<'PY'
from pathlib import Path
import re, time

p=Path("memeflow-app/game-fullscreen-v11.html")
if not p.exists():
    raise SystemExit("ERROR: game-fullscreen-v11.html not found")

s=p.read_text()
v=str(int(time.time()))
s=re.sub(r'/game-fullscreen-v11\.css\?v=\d+',f'/game-fullscreen-v11.css?v={v}',s)
s=re.sub(r'/game-fullscreen-v11\.js\?v=\d+',f'/game-fullscreen-v11.js?v={v}',s)
p.write_text(s.rstrip()+"\n")
print("V11 page assets cache:",v)
PY

python - <<'PY'
from pathlib import Path

p=Path("memeflow-app/game-fullscreen-v11.js")
s=p.read_text()

if "function neutralizeLegacyFlight(doc)" not in s:
    anchor="  function applyV11(){\n    let doc;\n"
    if anchor not in s:
        raise SystemExit("ERROR: applyV11 anchor not found")

    block="""  function neutralizeLegacyFlight(doc){
    try{
      frame.contentWindow.MEMEFLOW_FLIGHT_MODE?.disable?.();
    }catch(_){}

    doc.body?.classList.remove('mf-flight-mode');
    doc.getElementById('mfFlightModeExit')?.remove();

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

  function applyV11(){
    let doc;
"""
    s=s.replace(anchor,block,1)

anchor2="    installStyle(doc);\n\n    const result=tag(doc);\n"
if anchor2 in s and "neutralizeLegacyFlight(doc);\n    installStyle(doc);" not in s:
    s=s.replace(
        anchor2,
        "    neutralizeLegacyFlight(doc);\n    installStyle(doc);\n\n    const result=tag(doc);\n",
        1
    )

s=s.replace("const VERSION='11.0';","const VERSION='11.1';",1)
p.write_text(s.rstrip()+"\n")
print("V11 iframe legacy cleanup: ENABLED")
PY

node --check "$LAUNCHER"
node --check "$V11JS"
node --check "$SETTINGS"

git diff --check -- "$LAUNCHER" "$V11HTML" "$V11JS" "$SETTINGS"

echo
echo "=== V11.1 CHECKS PASS ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$LAUNCHER" "$V11HTML" "$V11JS" "$SETTINGS"

  for f in "$APP"/*.html; do
    [ -f "$f" ] || continue
    if grep -q "MEMEFLOW FULLSCREEN V11.1 DIRECT START" "$f"; then
      git add "$f"
    fi
  done

  if ! git diff --cached --quiet; then
    git commit -m "Make V11 own fullscreen and disable legacy HUD V11.1" || true
    BRANCH="$(git branch --show-current 2>/dev/null || true)"
    if [ -n "$BRANCH" ]; then
      git push origin "$BRANCH" || {
        echo "WARNING: Git push failed; local Replit files are patched."
      }
    fi
  fi
fi

echo
echo "=============================================="
echo " MEMEFLOW FULLSCREEN V11.1 INSTALLED"
echo "=============================================="
echo "OLD × HUD: disabled"
echo "FOUR-CORNERS BUTTON: owned by V11"
echo "SAFARI CACHE: busted for Settings + V11"
echo
echo "NEXT:"
echo "  1. Stop"
echo "  2. Run"
echo "  3. CLOSE the old Safari Game tab"
echo "  4. Open Game again"
echo "  5. Tap the four-corners icon"
