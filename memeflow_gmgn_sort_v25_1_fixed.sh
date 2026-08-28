#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GMGN_SORT_STYLE_V25_1"
OLD_VERSION="gmgn-sort-v25-20260827"
NEW_VERSION="gmgn-sort-v25-1-20260827"
DO_PUSH=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

if [[ -f "system-tokens.js" && -f "system-tokens.css" && -f "system-tokens.html" ]]; then
  APP="$PWD"
elif [[ -f "memeflow-app/system-tokens.js" && -f "memeflow-app/system-tokens.css" && -f "memeflow-app/system-tokens.html" ]]; then
  APP="$PWD/memeflow-app"
else
  echo "ERROR: MEMEFLOW app not found." >&2
  echo "Run this script from the project root or memeflow-app directory." >&2
  exit 1
fi

cd "$APP"

for file in system-tokens.js system-tokens.css system-tokens.html package.json; do
  [[ -f "$file" ]] || { echo "ERROR: missing $file" >&2; exit 1; }
done

# This patch is intentionally V25 -> V25.1. Do not guess over a different tree.
grep -Fq "MEMEFLOW_GMGN_SORT_V25" system-tokens.js || {
  echo "ERROR: V25 sorting logic is not installed." >&2
  exit 1
}
grep -Fq "MEMEFLOW_GMGN_SORT_UI_V25" system-tokens.js || {
  echo "ERROR: V25 sorting UI is not installed." >&2
  exit 1
}
grep -Fq "MEMEFLOW_GMGN_SORT_V25" system-tokens.css || {
  echo "ERROR: V25 sorting CSS is not installed." >&2
  exit 1
}
grep -Fq "$OLD_VERSION" system-tokens.html || {
  echo "ERROR: expected V25 cache version is not active." >&2
  echo "Current system-tokens.html does not contain: $OLD_VERSION" >&2
  exit 1
}

if grep -Fq "$PATCH_ID" system-tokens.js; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Do not overwrite unrelated local work.
if ! git diff --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null \
   || ! git diff --cached --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null; then
  echo "ERROR: target UI/test files have uncommitted or staged changes." >&2
  echo "Commit/stash them first. Nothing was modified." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backups/gmgn-sort-v25-1-$STAMP"
mkdir -p "$BACKUP_DIR/tests"

cp -p system-tokens.js system-tokens.css system-tokens.html package.json "$BACKUP_DIR/"
if [[ -d tests ]]; then
  cp -p tests/*.mjs "$BACKUP_DIR/tests/" 2>/dev/null || true
  cp -p tests/*.js  "$BACKUP_DIR/tests/" 2>/dev/null || true
  cp -p tests/*.cjs "$BACKUP_DIR/tests/" 2>/dev/null || true
fi

rollback() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "V25.1 failed; restoring V25 backup..."
    cp -p "$BACKUP_DIR/system-tokens.js" system-tokens.js
    cp -p "$BACKUP_DIR/system-tokens.css" system-tokens.css
    cp -p "$BACKUP_DIR/system-tokens.html" system-tokens.html
    cp -p "$BACKUP_DIR/package.json" package.json

    if [[ -d "$BACKUP_DIR/tests" ]]; then
      for f in "$BACKUP_DIR"/tests/*; do
        [[ -f "$f" ]] && cp -p "$f" "tests/$(basename "$f")"
      done
    fi

    rm -f tests/token-sort-style-v25-1.mjs
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap rollback EXIT

export MF_PATCH_ID="$PATCH_ID"
export MF_OLD_VERSION="$OLD_VERSION"
export MF_NEW_VERSION="$NEW_VERSION"

python3 <<'PY'
from pathlib import Path
import json
import os
import re

PATCH_ID = os.environ["MF_PATCH_ID"]
OLD_VERSION = os.environ["MF_OLD_VERSION"]
NEW_VERSION = os.environ["MF_NEW_VERSION"]

ui_path = Path("system-tokens.js")
css_path = Path("system-tokens.css")
html_path = Path("system-tokens.html")
pkg_path = Path("package.json")
tests_dir = Path("tests")
tests_dir.mkdir(exist_ok=True)

ui = ui_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

def replace_function(text, name, replacement):
    sig = re.search(rf"function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", text)
    if not sig:
        raise SystemExit(f"PRECHECK FAILED: function {name} not found.")

    i = sig.end() - 1
    depth = 0
    quote = None
    escape = False
    template = False

    while i < len(text):
        ch = text[i]

        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if template:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == "`":
                template = False
            i += 1
            continue

        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue

        if ch == "`":
            template = True
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                return text[:sig.start()] + replacement.strip() + text[end:]

        i += 1

    raise SystemExit(f"PRECHECK FAILED: could not find end of {name}.")

# ---------------------------------------------------------------------------
# 1) Make the trigger match the mockup:
#    centered, full-width, tiny up/down icon, text, right chevron.
# ---------------------------------------------------------------------------
trigger_helper = r'''
// MEMEFLOW_GMGN_SORT_STYLE_V25_1
function __mfSortTriggerMarkupV251(){
  const active=
    __mfSortConfigV25.key!=='smart' ||
    finite(__mfSortConfigV25.ageMaxMinutes);

  return `
    <span class="mf-sort-trigger-icon-v251" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"></path>
      </svg>
    </span>
    <span class="mf-sort-trigger-label-v251">
      ${__mfSortTriggerTextV25()}
    </span>
    <span
      class="mf-sort-trigger-chevron-v251 ${active?'is-active':''}"
      aria-hidden="true"
    >⌄</span>
  `;
}
'''

anchor = "function __mfUpdateSortTriggerV25(){"
if anchor not in ui:
    raise SystemExit("PRECHECK FAILED: V25 trigger update function missing.")
ui = ui.replace(anchor, trigger_helper + "\n" + anchor, 1)

ui = replace_function(
    ui,
    "__mfUpdateSortTriggerV25",
    r'''
function __mfUpdateSortTriggerV25(){
  const button=document.getElementById('mfSortTriggerV25');
  if(!button)return;

  const active=
    __mfSortConfigV25.key!=='smart' ||
    finite(__mfSortConfigV25.ageMaxMinutes);

  button.innerHTML=__mfSortTriggerMarkupV251();
  button.classList.toggle('is-active',active);
}
'''
)

# ---------------------------------------------------------------------------
# 2) Primary sort list: add restrained icons and make Age a drill-in row with
#    a chevron instead of a misleading radio control.
# ---------------------------------------------------------------------------
icon_helper = r'''
function __mfSortIconV251(key){
  const icons={
    smart:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3z"></path>
        <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"></path>
      </svg>`,
    mc:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18M16 7.2c-.9-1.1-2.2-1.7-4-1.7-2.3 0-4 1.2-4 3s1.3 2.7 4 3.3c2.7.6 4 1.5 4 3.4 0 2-1.7 3.3-4.2 3.3-2 0-3.6-.7-4.8-2"></path>
      </svg>`,
    holders:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3"></circle>
        <circle cx="17" cy="9" r="2.5"></circle>
        <path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M14 14.5c3.5-.5 5.7 1 6.3 4.5"></path>
      </svg>`,
    transactions:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h14M15 5l3 3-3 3M20 16H6M9 13l-3 3 3 3"></path>
      </svg>`,
    volume:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19v-5M10 19V9M15 19V5M20 19v-8"></path>
      </svg>`,
    age:`
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M12 7v5l3 2"></path>
      </svg>`
  };

  return `
    <span class="mf-sort-option-icon-v251">
      ${icons[key]||''}
    </span>
  `;
}
'''

root_anchor = "function __mfRenderSortRootV25(){"
if root_anchor not in ui:
    raise SystemExit("PRECHECK FAILED: V25 root sheet function missing.")
ui = ui.replace(root_anchor, icon_helper + "\n" + root_anchor, 1)

ui = replace_function(
    ui,
    "__mfRenderSortRootV25",
    r'''
function __mfRenderSortRootV25(){
  __mfCloseSortSheetV25();

  const config=__mfSortConfigV25;
  const criteria=[
    ['smart','Smart / Default'],
    ['mc','Market Cap'],
    ['holders','Holders'],
    ['transactions','Transactions'],
    ['volume','Volume'],
    ['age','Age']
  ];

  const rows=criteria.map(([key,label])=>{
    const isAge=key==='age';

    return `
      <button
        class="mf-sort-row-v25 ${isAge?'is-drill-in-v251':''}"
        type="button"
        data-mf-sort-key="${key}"
      >
        ${__mfSortIconV251(key)}
        <span class="mf-sort-option-label-v251">${label}</span>
        ${
          isAge
            ? '<span class="mf-sort-row-chevron-v251" aria-hidden="true">›</span>'
            : __mfSortRadioV25(config.key===key)
        }
      </button>
    `;
  }).join('');

  const body=`
    <div class="mf-sort-direction-v25" aria-label="Sort direction">
      <button
        type="button"
        class="${config.direction==='desc'?'is-active':''}"
        data-mf-sort-dir="desc"
      >HIGH → LOW</button>

      <button
        type="button"
        class="${config.direction==='asc'?'is-active':''}"
        data-mf-sort-dir="asc"
      >LOW → HIGH</button>
    </div>

    <div class="mf-sort-list-v25">${rows}</div>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    __mfSortSheetShellV25('SORT BY',body)
  );

  document.body.classList.add('mf-sort-sheet-open-v25');
  __mfBindSortOverlayV25();

  const overlay=document.getElementById('mfSortOverlayV25');

  overlay?.querySelectorAll('[data-mf-sort-dir]').forEach(button=>{
    button.addEventListener('click',()=>{
      __mfApplySortV25(
        {direction:button.dataset.mfSortDir},
        false
      );
      __mfRenderSortRootV25();
    });
  });

  overlay?.querySelectorAll('[data-mf-sort-key]').forEach(button=>{
    button.addEventListener('click',()=>{
      const key=button.dataset.mfSortKey;

      if(key==='age'){
        __mfRenderAgeSheetV25();
        return;
      }

      if(key==='smart'){
        __mfApplySortV25({
          key:'smart',
          ageMaxMinutes:null
        });
        return;
      }

      __mfApplySortV25({key});
    });
  });
}
'''
)

# Age sheet also gets the compact/natural option-row structure.
ui = replace_function(
    ui,
    "__mfRenderAgeSheetV25",
    r'''
function __mfRenderAgeSheetV25(){
  __mfCloseSortSheetV25();

  const options=[
    [null,'All'],
    [1,'1m'],
    [5,'5m'],
    [60,'1h'],
    [360,'6h'],
    [1440,'24h']
  ];

  const current=
    finite(__mfSortConfigV25.ageMaxMinutes)
      ? Number(__mfSortConfigV25.ageMaxMinutes)
      : null;

  const rows=options.map(([minutes,label])=>{
    const active=
      minutes===null
        ? current===null
        : current===minutes;

    return `
      <button
        class="mf-sort-row-v25 mf-sort-age-row-v251"
        type="button"
        data-mf-age="${minutes===null?'all':minutes}"
      >
        <span class="mf-sort-option-label-v251">${label}</span>
        ${__mfSortRadioV25(active)}
      </button>
    `;
  }).join('');

  const back=`
    <button
      class="mf-sort-back-v25"
      type="button"
      aria-label="Back to sorting"
      data-mf-sort-back
    >‹</button>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    __mfSortSheetShellV25(
      'AGE',
      `<div class="mf-sort-list-v25 mf-age-list-v25">${rows}</div>`,
      back
    )
  );

  document.body.classList.add('mf-sort-sheet-open-v25');
  __mfBindSortOverlayV25();

  const overlay=document.getElementById('mfSortOverlayV25');

  overlay
    ?.querySelector('[data-mf-sort-back]')
    ?.addEventListener('click',__mfRenderSortRootV25);

  overlay?.querySelectorAll('[data-mf-age]').forEach(button=>{
    button.addEventListener('click',()=>{
      const raw=button.dataset.mfAge;

      __mfApplySortV25({
        key:'age',
        ageMaxMinutes:raw==='all'?null:Number(raw)
      });
    });
  });
}
'''
)

# ---------------------------------------------------------------------------
# 3) Replace—not layer—the whole V25 stylesheet block.
#    It was appended by V25 and is expected to be the final CSS block.
# ---------------------------------------------------------------------------
css_marker = "/* MEMEFLOW_GMGN_SORT_V25 */"
marker_at = css.find(css_marker)
if marker_at < 0:
    raise SystemExit("PRECHECK FAILED: V25 CSS marker missing.")

tail = css[marker_at:]
if "/* MEMEFLOW_GMGN_SORT_V25_1 */" in tail:
    raise SystemExit("PRECHECK FAILED: V25.1 CSS already present.")

# Guard against deleting an unrelated patch that was appended after V25.
later_patch_markers = re.findall(r"/\*\s*(MEMEFLOW_[A-Z0-9_]+)\s*\*/", tail)
unexpected = [
    marker for marker in later_patch_markers
    if marker not in {"MEMEFLOW_GMGN_SORT_V25"}
]
if unexpected:
    raise SystemExit(
        "PRECHECK FAILED: another CSS patch exists after V25: "
        + ", ".join(unexpected)
        + ". Refusing to delete it."
    )

native_css = r'''
/* MEMEFLOW_GMGN_SORT_V25_1
 * Visual-only refinement of V25 sorting.
 * Uses the page's existing MEMEFLOW variables instead of a parallel palette.
 */
.mf-sort-toolbar-v25 {
  display:block;
  width:100%;
  margin:7px 0 0;
}

.mf-sort-trigger-v25 {
  position:relative;
  display:grid;
  grid-template-columns:24px auto 24px;
  align-items:center;
  justify-content:center;
  column-gap:8px;
  width:100% !important;
  min-width:0 !important;
  min-height:42px;
  padding:0 13px;
  border:1px solid var(--line-strong,rgba(147,178,202,.095));
  border-radius:12px;
  background:rgba(7,17,23,.52);
  color:var(--muted,#91a3af);
  font:inherit;
  font-size:9px;
  font-weight:800;
  letter-spacing:.13em;
  text-align:center;
  text-transform:uppercase;
  box-shadow:none;
  -webkit-tap-highlight-color:transparent;
  cursor:pointer;
}

.mf-sort-trigger-v25:hover {
  background:rgba(255,255,255,.018);
}

.mf-sort-trigger-v25.is-active {
  border-color:rgba(77,230,161,.22);
  background:rgba(77,230,161,.035);
  color:#b8c8d1;
}

.mf-sort-trigger-icon-v251,
.mf-sort-trigger-chevron-v251 {
  display:grid;
  place-items:center;
  color:#7f939e;
}

.mf-sort-trigger-icon-v251 svg {
  width:15px;
  height:15px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.7;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-trigger-chevron-v251 {
  font-size:18px;
  line-height:1;
  transform:translateY(-2px);
}

.mf-sort-trigger-chevron-v251.is-active {
  color:var(--green,#4de6a1);
}

.mf-sort-trigger-label-v251 {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

body.mf-sort-sheet-open-v25 {
  overflow:hidden;
}

.mf-sort-overlay-v25 {
  position:fixed;
  inset:0;
  z-index:2147483000;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  padding:0 8px;
  background:rgba(0,5,9,.46);
  backdrop-filter:blur(3px);
  -webkit-backdrop-filter:blur(3px);
  -webkit-tap-highlight-color:transparent;
}

.mf-sort-sheet-v25 {
  width:min(100%,520px);
  max-height:min(68dvh,590px);
  overflow:auto;
  overscroll-behavior:contain;
  padding:7px 11px max(12px,env(safe-area-inset-bottom));
  border:1px solid var(--line-strong,rgba(147,178,202,.095));
  border-bottom:0;
  border-radius:20px 20px 0 0;
  background:
    linear-gradient(
      180deg,
      rgba(13,24,31,.985),
      rgba(8,17,23,.995)
    );
  color:#edf4f7;
  box-shadow:
    0 -14px 48px rgba(0,0,0,.28);
}

.mf-sort-handle-v25 {
  width:36px;
  height:3px;
  margin:2px auto 6px;
  border-radius:999px;
  background:rgba(145,166,190,.30);
}

.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:34px 1fr 34px;
  align-items:center;
  min-height:42px;
  border-bottom:1px solid var(--line,rgba(147,178,202,.055));
}

.mf-sort-sheet-head-v25 h2 {
  grid-column:2;
  margin:0;
  color:#f3f7f9;
  font-size:14px;
  font-weight:800;
  letter-spacing:.03em;
  text-align:center;
}

.mf-sort-close-v25,
.mf-sort-back-v25 {
  display:grid;
  place-items:center;
  width:30px;
  height:30px;
  padding:0;
  border:1px solid var(--line,rgba(147,178,202,.055));
  border-radius:9px;
  background:rgba(255,255,255,.018);
  color:#8295a1;
  font:inherit;
  line-height:1;
  box-shadow:none;
  cursor:pointer;
}

.mf-sort-close-v25 {
  grid-column:3;
  justify-self:end;
  font-size:18px;
  font-weight:500;
}

.mf-sort-back-v25 {
  grid-column:1;
  justify-self:start;
  font-size:24px;
  font-weight:400;
}

.mf-sort-direction-v25 {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:3px;
  margin:10px 0 9px;
  padding:3px;
  border:1px solid var(--line,rgba(147,178,202,.055));
  border-radius:11px;
  background:rgba(3,10,15,.44);
}

.mf-sort-direction-v25 button {
  min-height:32px;
  padding:0 8px;
  border:0;
  border-radius:8px;
  background:transparent;
  color:#70838f;
  font:inherit;
  font-size:8px;
  font-weight:800;
  letter-spacing:.09em;
  box-shadow:none;
  cursor:pointer;
}

.mf-sort-direction-v25 button.is-active {
  background:rgba(145,166,190,.095);
  color:#e6eef2;
  box-shadow:
    inset 0 0 0 1px rgba(145,166,190,.045);
}

.mf-sort-list-v25 {
  display:grid;
  gap:5px;
}

.mf-sort-row-v25 {
  display:grid;
  grid-template-columns:24px minmax(0,1fr) 24px;
  align-items:center;
  column-gap:8px;
  width:100%;
  min-height:46px;
  padding:0 11px;
  border:1px solid var(--line,rgba(147,178,202,.055));
  border-radius:11px;
  background:rgba(255,255,255,.012);
  color:#e7eef2;
  font:inherit;
  font-size:11px;
  font-weight:720;
  text-align:left;
  box-shadow:none;
  cursor:pointer;
}

.mf-sort-row-v25:active {
  background:rgba(255,255,255,.025);
}

.mf-sort-option-icon-v251 {
  display:grid;
  place-items:center;
  width:24px;
  height:24px;
  color:#8fa1ad;
}

.mf-sort-option-icon-v251 svg {
  width:17px;
  height:17px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.55;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-option-label-v251 {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.mf-sort-radio-v25 {
  justify-self:end;
  width:17px;
  height:17px;
  border:2px solid #70838f;
  border-radius:50%;
  background:transparent;
  box-sizing:border-box;
}

.mf-sort-radio-v25.is-active {
  border:5px solid var(--green,#4de6a1);
  background:#07120f;
  box-shadow:none;
}

.mf-sort-row-chevron-v251 {
  justify-self:end;
  color:#8fa1ad;
  font-size:23px;
  font-weight:300;
  line-height:1;
}

.mf-sort-age-row-v251 {
  grid-template-columns:minmax(0,1fr) 24px;
}

.mf-age-list-v25 {
  padding-top:9px;
}

@media (max-width:760px) {
  .mf-sort-overlay-v25 {
    padding-left:0;
    padding-right:0;
  }

  .mf-sort-sheet-v25 {
    width:100%;
    max-height:64dvh;
    border-left:0;
    border-right:0;
  }

  .mf-sort-trigger-v25 {
    min-height:40px;
    font-size:8px;
  }

  .mf-sort-row-v25 {
    min-height:44px;
    font-size:10.5px;
  }
}

@media (min-width:761px) {
  .mf-sort-trigger-v25 {
    width:100% !important;
  }

  .mf-sort-sheet-v25 {
    margin-bottom:14px;
    border-bottom:1px solid var(--line-strong,rgba(147,178,202,.095));
    border-radius:20px;
  }
}

@media (prefers-reduced-motion:reduce) {
  .mf-sort-overlay-v25 *,
  .mf-sort-trigger-v25 {
    transition:none !important;
  }
}
'''

css = css[:marker_at].rstrip() + "\n\n" + native_css.strip() + "\n"

# ---------------------------------------------------------------------------
# 4) Cache-bust only this page's JS/CSS.
# ---------------------------------------------------------------------------
html = html.replace(
    f'src="/system-tokens.js?v={OLD_VERSION}"',
    f'src="/system-tokens.js?v={NEW_VERSION}"'
)
html = html.replace(
    f'href="/system-tokens.css?v={OLD_VERSION}"',
    f'href="/system-tokens.css?v={NEW_VERSION}"'
)

if NEW_VERSION not in html:
    raise SystemExit("POSTCHECK FAILED: V25.1 cache version missing.")

# Update any existing hard-coded assertions that were created by V25.
for path in sorted(tests_dir.rglob("*")):
    if not path.is_file() or path.suffix not in {".mjs", ".js", ".cjs"}:
        continue

    text = path.read_text(encoding="utf-8")
    changed = text.replace(OLD_VERSION, NEW_VERSION)
    if changed != text:
        path.write_text(changed, encoding="utf-8")

# Dedicated visual/integration regression.
test_path = tests_dir / "token-sort-style-v25-1.mjs"
test_path.write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../system-tokens.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_GMGN_SORT_STYLE_V25_1/);
assert.match(ui,/__mfSortTriggerMarkupV251/);
assert.match(ui,/__mfSortIconV251/);
assert.match(ui,/mf-sort-row-chevron-v251/);

// Logic from V25 must still be present.
assert.match(ui,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(ui,/function\s+__mfSmartSortRowsV25/);
assert.match(ui,/const laneDiff=priority\(a\)-priority\(b\)/);
assert.match(ui,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);

// The old V25 CSS block is replaced, not layered.
assert.match(css,/MEMEFLOW_GMGN_SORT_V25_1/);
assert.equal(
  (css.match(/\/\* MEMEFLOW_GMGN_SORT_V25 \*\//g)||[]).length,
  0
);

// Native page variables are reused.
assert.match(css,/var\(--line/);
assert.match(css,/var\(--line-strong/);
assert.match(css,/var\(--muted/);
assert.match(css,/var\(--green/);

// Fixes visible in the user's screenshot.
assert.match(css,/width:100% !important/);
assert.match(css,/max-height:64dvh/);
assert.match(css,/background:rgba\(0,5,9,.46\)/);
assert.match(css,/min-height:44px/);

assert.match(html,/system-tokens\.js\?v=gmgn-sort-v25-1-20260827/);
assert.match(html,/system-tokens\.css\?v=gmgn-sort-v25-1-20260827/);

console.log('token sort style v25.1 ok');
''', encoding="utf-8")

pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
scripts = pkg.setdefault("scripts", {})
command = "node tests/token-sort-style-v25-1.mjs"
current = scripts.get("test", "")

if command not in current:
    scripts["test"] = f"{command} && {current}" if current else command

pkg_path.write_text(
    json.dumps(pkg, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8"
)

# Final static checks.
required_ui = [
    PATCH_ID,
    "MEMEFLOW_GMGN_SORT_STYLE_V25_1",
    "__mfSortTriggerMarkupV251",
    "__mfSortIconV251",
    "mf-sort-row-chevron-v251",
    "MEMEFLOW_GMGN_SORT_V25",
    "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23"
]
for marker in required_ui:
    if marker not in ui:
        raise SystemExit(f"POSTCHECK FAILED [ui]: missing {marker}")

if "/* MEMEFLOW_GMGN_SORT_V25 */" in css:
    raise SystemExit("POSTCHECK FAILED: old V25 CSS block still exists.")

if "/* MEMEFLOW_GMGN_SORT_V25_1" not in css:
    raise SystemExit("POSTCHECK FAILED: V25.1 CSS block missing.")

ui_path.write_text(ui, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

print("V25.1 visual refinement installed.")
PY

echo
echo "==> [1/6] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-style-v25-1.mjs

echo "==> [2/6] V25.1 visual regression"
node tests/token-sort-style-v25-1.mjs

echo "==> [3/6] Original V25 sort regression"
if [[ -f tests/token-sort-ui-v25.mjs ]]; then
  node tests/token-sort-ui-v25.mjs
fi

echo "==> [4/6] Existing live ranking regression"
if [[ -f tests/live-ranking-reorder-v23.mjs ]]; then
  node tests/live-ranking-reorder-v23.mjs
fi

echo "==> [5/6] Full MEMEFLOW test suite"
npm test

echo "==> [6/6] Git whitespace/conflict check"
git diff --check

trap - EXIT

echo
echo "V25.1 validated successfully."
echo "Backup: $BACKUP_DIR"
echo

git --no-pager diff --stat -- \
  system-tokens.js \
  system-tokens.css \
  system-tokens.html \
  package.json \
  tests

git add -- \
  system-tokens.js \
  system-tokens.css \
  system-tokens.html \
  package.json \
  tests

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix(token-flow): match sorting sheet to native MEMEFLOW style"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated V25.1 commit..."
  git push
else
  echo
  echo "Not pushed. To push now: git push"
fi

echo
echo "DONE V25.1:"
echo "  - sorting logic from V25 is unchanged"
echo "  - SORT · SMART is full-width and centered like the mockup"
echo "  - sheet is shorter/denser and keeps more page context visible"
echo "  - overlay is lighter, not a large black wall"
echo "  - colors/borders reuse native MEMEFLOW CSS variables"
echo "  - rows are compact and use restrained icons"
echo "  - Age now has the drill-in chevron instead of a radio"
echo "  - old V25 sort CSS block was replaced, not layered"
