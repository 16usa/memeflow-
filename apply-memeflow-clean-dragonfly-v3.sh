#!/usr/bin/env bash
set -euo pipefail

echo "[MEMEFLOW] Clean Dragonfly Brand v3"

ROOT="$(pwd)"
if [ -d "$ROOT/memeflow-app" ]; then
  APP="$ROOT/memeflow-app"
elif [ "$(basename "$ROOT")" = "memeflow-app" ]; then
  APP="$ROOT"
  ROOT="$(dirname "$ROOT")"
else
  echo "ERROR: memeflow-app not found. Run this script from ~/workspace or ~/workspace/memeflow-app"
  exit 1
fi

export APP
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.memeflow-brand-backup-$STAMP"
mkdir -p "$BACKUP"

for f in index.html trading.html trading.css system.html system.css system-tokens.html system-tokens.css; do
  if [ -f "$APP/$f" ]; then
    cp -p "$APP/$f" "$BACKUP/$f"
  fi
done

echo "[MEMEFLOW] Backup: $BACKUP"

python3 <<'PY'
import os, re
from pathlib import Path

app = Path(os.environ["APP"])

SVG = r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="MEMEFLOW dragonfly">
  <defs>
    <linearGradient id="g" x1="18" y1="18" x2="78" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#57E7FF"/>
      <stop offset=".52" stop-color="#45D9D0"/>
      <stop offset="1" stop-color="#63F2A8"/>
    </linearGradient>
    <linearGradient id="w" x1="10" y1="20" x2="86" y2="66" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#57E7FF" stop-opacity=".18"/>
      <stop offset="1" stop-color="#63F2A8" stop-opacity=".42"/>
    </linearGradient>
  </defs>
  <path d="M45 43C35 24 21 14 11 18c-7 3-4 13 4 20 9 8 19 10 30 9Z"
        fill="url(#w)" stroke="url(#g)" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M51 43c10-19 24-29 34-25 7 3 4 13-4 20-9 8-19 10-30 9Z"
        fill="url(#w)" stroke="url(#g)" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M44 50c-13 0-26 6-31 15-4 8 5 12 14 8 10-5 15-12 20-20Z"
        fill="url(#w)" stroke="url(#g)" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M52 50c13 0 26 6 31 15 4 8-5 12-14 8-10-5-15-12-20-20Z"
        fill="url(#w)" stroke="url(#g)" stroke-width="3.4" stroke-linejoin="round"/>
  <circle cx="48" cy="31" r="7.4" fill="url(#g)"/>
  <ellipse cx="48" cy="44" rx="8.5" ry="10.5" fill="#071218" stroke="url(#g)" stroke-width="4"/>
  <path d="M48 54v26" stroke="url(#g)" stroke-width="6" stroke-linecap="round"/>
  <path d="M48 58v2M48 66v2M48 74v2" stroke="#071218" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="48" cy="82" r="3.6" fill="#63F2A8"/>
  <circle cx="48" cy="44" r="3" fill="#E8FFFF"/>
</svg>'''

CSS = r'''/* MEMEFLOW_BRAND_CANONICAL_V3
   Single source of truth for the MEMEFLOW dragonfly.
   Do not add page-specific logo patches on top of this file.
*/
:root{--mf-logo-url:url("/memeflow-dragonfly.svg?v=clean-v3-20260822");}

.logo{
  width:38px!important;height:38px!important;min-width:38px!important;flex:0 0 38px!important;
  display:inline-block!important;position:relative!important;border:0!important;border-radius:0!important;
  background:var(--mf-logo-url) center/contain no-repeat!important;box-shadow:none!important;
  filter:drop-shadow(0 5px 12px rgba(84,221,255,.24))!important;
}
.logo::before,.logo::after{content:none!important;display:none!important;}

.brand-mark{
  width:54px!important;height:44px!important;min-width:54px!important;flex:0 0 54px!important;
  padding:0!important;margin:0!important;display:inline-flex!important;align-items:center!important;
  justify-content:center!important;border:0!important;border-radius:0!important;background:none!important;
  box-shadow:none!important;color:transparent!important;font-size:0!important;line-height:0!important;overflow:visible!important;
}
.brand-mark>span,.brand-mark>i{display:none!important;}
.brand-mark::before,.brand-mark::after{content:none!important;display:none!important;}
.brand-mark .mf-logo{
  display:block!important;width:52px!important;height:42px!important;max-width:none!important;max-height:none!important;
  object-fit:contain!important;filter:drop-shadow(0 5px 12px rgba(84,221,255,.24))!important;
}

.boot-mark{
  width:78px!important;height:78px!important;min-width:78px!important;display:flex!important;align-items:center!important;
  justify-content:center!important;border:0!important;border-radius:0!important;background:none!important;
  box-shadow:none!important;overflow:visible!important;
}
.boot-mark>i,.boot-mark::before,.boot-mark::after{content:none!important;display:none!important;}
.boot-mark .mf-logo-loader{
  display:block!important;width:76px!important;height:76px!important;object-fit:contain!important;transform-origin:50% 50%;
  animation:mfDragonflyLoader 1.15s cubic-bezier(.45,.05,.55,.95) infinite!important;
  filter:drop-shadow(0 9px 22px rgba(84,221,255,.38))!important;
}
@keyframes mfDragonflyLoader{
  0%,100%{transform:translateY(2px) scale(.94);opacity:.78}
  50%{transform:translateY(-7px) scale(1.06);opacity:1}
}
@media (prefers-reduced-motion:reduce){.boot-mark .mf-logo-loader{animation:none!important;}}
@media (max-width:820px){
  .brand-mark{width:50px!important;height:40px!important;min-width:50px!important;flex-basis:50px!important;}
  .brand-mark .mf-logo{width:48px!important;height:38px!important;}
}
'''

(app / "memeflow-dragonfly.svg").write_text(SVG, encoding="utf-8")
(app / "memeflow-brand.css").write_text(CSS, encoding="utf-8")

index = app / "index.html"
if index.exists():
    text = index.read_text(encoding="utf-8")
    text = re.sub(r'\s*<style id="memeflow-dragonfly-brand-v1">.*?</style>\s*', '\n', text, flags=re.S)
    text = re.sub(r'\s*<link[^>]+href=["\']/memeflow-brand\.css[^"\']*["\'][^>]*>\s*', '\n', text, flags=re.I)
    link = '<link rel="stylesheet" href="/memeflow-brand.css?v=clean-v3-20260822">'
    text = text.replace("</head>", f"{link}\n</head>", 1)
    index.write_text(text, encoding="utf-8")

for name in ("trading.css", "system.css", "system-tokens.css"):
    p = app / name
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    marker = "/* MF_DRAGONFLY_GLOBAL_V2 */"
    if marker in text:
        text = text.split(marker, 1)[0].rstrip() + "\n"
    p.write_text(text, encoding="utf-8")

def add_brand_link(text: str) -> str:
    text = re.sub(r'\s*<link[^>]+href=["\']/memeflow-brand\.css[^"\']*["\'][^>]*>\s*', '\n', text, flags=re.I)
    link = '<link rel="stylesheet" href="/memeflow-brand.css?v=clean-v3-20260822">'
    return text.replace("</head>", f"{link}\n</head>", 1)

p = app / "trading.html"
if p.exists():
    text = p.read_text(encoding="utf-8")
    text = re.sub(
        r'<a\s+class="brand-mark"\s+href="/system\.html"\s+aria-label="Back to MEMEFLOW system"\s*>\s*.*?\s*</a>',
        '<a class="brand-mark" href="/system.html" aria-label="Back to MEMEFLOW system"><img class="mf-logo" src="/memeflow-dragonfly.svg?v=clean-v3-20260822" alt=""></a>',
        text, flags=re.S
    )
    text = add_brand_link(text)
    p.write_text(text, encoding="utf-8")

p = app / "system.html"
if p.exists():
    text = p.read_text(encoding="utf-8")
    text = re.sub(
        r'<div\s+class="brand-mark"[^>]*>\s*(?:<span[^>]*></span>\s*){3}</div>',
        '<div class="brand-mark" aria-hidden="true"><img class="mf-logo" src="/memeflow-dragonfly.svg?v=clean-v3-20260822" alt=""></div>',
        text, flags=re.S
    )
    text = re.sub(
        r'<div\s+class="boot-mark"[^>]*>\s*(?:<i[^>]*></i>\s*){3}</div>',
        '<div class="boot-mark"><img class="mf-logo-loader" src="/memeflow-dragonfly.svg?v=clean-v3-20260822" alt=""></div>',
        text, flags=re.S
    )
    text = add_brand_link(text)
    p.write_text(text, encoding="utf-8")

p = app / "system-tokens.html"
if p.exists():
    text = p.read_text(encoding="utf-8")
    text = re.sub(
        r'<div\s+class="brand-mark"[^>]*>\s*(?:<span[^>]*></span>\s*){3}</div>',
        '<div class="brand-mark" aria-hidden="true"><img class="mf-logo" src="/memeflow-dragonfly.svg?v=clean-v3-20260822" alt=""></div>',
        text, flags=re.S
    )
    text = add_brand_link(text)
    p.write_text(text, encoding="utf-8")
PY

echo
echo "[MEMEFLOW] Verifying clean brand layer..."
if grep -R "MF_DRAGONFLY_GLOBAL_V2" "$APP"/*.css "$APP"/*.html 2>/dev/null; then
  echo "ERROR: old V2 logo layer still exists"
  exit 2
fi

test -s "$APP/memeflow-dragonfly.svg"
test -s "$APP/memeflow-brand.css"

echo "  OK memeflow-dragonfly.svg"
echo "  OK memeflow-brand.css"
for f in index.html trading.html system.html system-tokens.html; do
  [ -f "$APP/$f" ] && echo "  OK $f"
done

echo
echo "✅ CLEAN DRAGONFLY V3 INSTALLED LOCALLY"
echo "No commit and no push were performed."
echo
echo "Test:"
echo "  /system.html?v=cleanv3"
echo "  /trading.html?v=cleanv3"
echo "  /system-tokens.html?v=cleanv3"
