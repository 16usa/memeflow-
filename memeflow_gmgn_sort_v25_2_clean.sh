#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN"
OLD_VERSION="gmgn-sort-v25-1-20260827"
NEW_VERSION="gmgn-sort-v25-2-clean-20260827"
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

# This is a strict V25.1 -> V25.2 visual patch.
grep -Fq "MEMEFLOW_GMGN_SORT_V25" system-tokens.js || {
  echo "ERROR: base V25 sorting logic is missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_GMGN_SORT_STYLE_V25_1" system-tokens.js || {
  echo "ERROR: V25.1 sort style JS is missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_GMGN_SORT_V25_1" system-tokens.css || {
  echo "ERROR: V25.1 sort CSS is missing." >&2
  exit 1
}
grep -Fq "$OLD_VERSION" system-tokens.html || {
  echo "ERROR: expected V25.1 cache version is not active." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" system-tokens.js; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

if ! git diff --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null \
   || ! git diff --cached --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null; then
  echo "ERROR: target UI/test files have uncommitted or staged changes." >&2
  echo "Commit/stash them first. Nothing was modified." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backups/gmgn-sort-v25-2-$STAMP"
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
    echo "V25.2 failed; restoring V25.1 backup..."
    cp -p "$BACKUP_DIR/system-tokens.js" system-tokens.js
    cp -p "$BACKUP_DIR/system-tokens.css" system-tokens.css
    cp -p "$BACKUP_DIR/system-tokens.html" system-tokens.html
    cp -p "$BACKUP_DIR/package.json" package.json

    if [[ -d "$BACKUP_DIR/tests" ]]; then
      for f in "$BACKUP_DIR"/tests/*; do
        [[ -f "$f" ]] && cp -p "$f" "tests/$(basename "$f")"
      done
    fi

    rm -f tests/token-sort-style-v25-2.mjs
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
# 1) Main sheet shell: remove X entirely. Title is left aligned like mockup.
#    Overlay click still closes the sheet; Esc still works.
# ---------------------------------------------------------------------------
ui = replace_function(
    ui,
    "__mfSortSheetShellV25",
    r'''
function __mfSortSheetShellV25(title,body,backButton=''){
  return `
    <div
      class="mf-sort-overlay-v25"
      id="mfSortOverlayV25"
      role="presentation"
    >
      <section
        class="mf-sort-sheet-v25"
        role="dialog"
        aria-modal="true"
        aria-label="${title}"
      >
        <div class="mf-sort-handle-v25" aria-hidden="true"></div>

        <header class="mf-sort-sheet-head-v25">
          ${backButton}
          <h2>${title}</h2>
        </header>

        ${body}
      </section>
    </div>
  `;
}
'''
)


# No dead close-button code remains in V25.2 CLEAN.
ui = replace_function(
    ui,
    "__mfBindSortOverlayV25",
    r"""
function __mfBindSortOverlayV25(){
  const overlay=document.getElementById('mfSortOverlayV25');
  if(!overlay)return;

  overlay.addEventListener('click',event=>{
    if(event.target===overlay){
      __mfCloseSortSheetV25();
    }
  });
}
"""
)

# ---------------------------------------------------------------------------
# 2) Main sort list: one shared container, thin separators, no card-per-row.
# ---------------------------------------------------------------------------
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

        <span class="mf-sort-option-label-v251">
          ${label}
        </span>

        ${
          isAge
            ? '<span class="mf-sort-row-chevron-v251" aria-hidden="true">›</span>'
            : __mfSortRadioV25(config.key===key)
        }
      </button>
    `;
  }).join('');

  const body=`
    <div
      class="mf-sort-direction-v25"
      aria-label="Sort direction"
    >
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

    <div class="mf-sort-list-shell-v252">
      <div class="mf-sort-list-v25">
        ${rows}
      </div>
    </div>
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

# ---------------------------------------------------------------------------
# 3) Age submenu follows the same one-container geometry.
# ---------------------------------------------------------------------------
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
        <span class="mf-sort-option-label-v251">
          ${label}
        </span>

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

  const body=`
    <div class="mf-sort-list-shell-v252 mf-age-shell-v252">
      <div class="mf-sort-list-v25 mf-age-list-v25">
        ${rows}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    __mfSortSheetShellV25('AGE',body,back)
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

# Supersede the V25.1 visual marker instead of stacking markers.
marker_anchor = "// MEMEFLOW_GMGN_SORT_STYLE_V25_1"
if marker_anchor not in ui:
    raise SystemExit("PRECHECK FAILED: V25.1 JS style marker missing.")
ui = ui.replace(
    marker_anchor,
    f"// {PATCH_ID}",
    1
)

# ---------------------------------------------------------------------------
# 4) Replace the entire V25.1 style block. No CSS layering.
# ---------------------------------------------------------------------------
css_marker = "/* MEMEFLOW_GMGN_SORT_V25_1"
marker_at = css.find(css_marker)
if marker_at < 0:
    raise SystemExit("PRECHECK FAILED: V25.1 CSS marker missing.")

tail = css[marker_at:]

# CLEAN audit: there must be no older sorting selectors outside the one V25.1
# block we are about to replace. This catches CSS layering/conflicts.
prefix = css[:marker_at]
conflict_pattern = re.compile(
    r"\\.(?:mf-sort-(?:toolbar|trigger|overlay|sheet|handle|direction|list|row|radio|option)|mf-age-list-v25)"
)
if conflict_pattern.search(prefix):
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: sorting selectors already exist "
        "outside the active V25.1 style block. Refusing to layer CSS."
    )

# V25.1 was designed as the final appended style block. Refuse to erase a later patch.
later = re.findall(r"/\*\s*(MEMEFLOW_[A-Z0-9_]+)", tail)
unexpected = [
    x for x in later
    if x not in {"MEMEFLOW_GMGN_SORT_V25_1"}
]
if unexpected:
    raise SystemExit(
        "PRECHECK FAILED: another MEMEFLOW CSS patch exists after V25.1: "
        + ", ".join(unexpected)
    )

exact_css = r'''
/* MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN
 * Exact mockup geometry:
 * - compact bottom sheet
 * - left title
 * - no X button
 * - one shared list surface
 * - separator rows
 * - small radio controls
 * - restrained overlay / blur
 */

/* ---------- trigger ---------- */
.mf-sort-toolbar-v25 {
  display:block;
  width:100%;
  margin:7px 0 0;
}

.mf-sort-trigger-v25 {
  position:relative;
  display:grid;
  grid-template-columns:22px auto 22px;
  align-items:center;
  justify-content:center;
  column-gap:8px;

  width:100% !important;
  min-width:0 !important;
  min-height:40px;
  padding:0 12px;

  border:1px solid var(--line-strong,rgba(147,178,202,.095));
  border-radius:11px;

  background:rgba(7,17,23,.48);
  color:var(--muted,#91a3af);

  font:inherit;
  font-size:8.5px;
  font-weight:800;
  letter-spacing:.13em;
  text-align:center;
  text-transform:uppercase;

  box-shadow:none;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

.mf-sort-trigger-v25.is-active {
  border-color:rgba(77,230,161,.20);
  background:rgba(77,230,161,.028);
  color:#b9c8d0;
}

.mf-sort-trigger-icon-v251,
.mf-sort-trigger-chevron-v251 {
  display:grid;
  place-items:center;
  color:#7f939e;
}

.mf-sort-trigger-icon-v251 svg {
  width:14px;
  height:14px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.65;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-trigger-chevron-v251 {
  font-size:17px;
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

/* ---------- overlay ---------- */
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

  padding:0;

  background:rgba(0,5,9,.33);

  backdrop-filter:blur(1.5px);
  -webkit-backdrop-filter:blur(1.5px);

  -webkit-tap-highlight-color:transparent;
}

/* ---------- sheet ---------- */
.mf-sort-sheet-v25 {
  width:min(100%,520px);

  /* Keep the sheet in the lower part of the screen like the mockup. */
  max-height:min(53dvh,470px);

  overflow:auto;
  overscroll-behavior:contain;

  padding:
    7px
    13px
    max(12px,env(safe-area-inset-bottom));

  border:
    1px solid
    var(--line-strong,rgba(147,178,202,.095));

  border-bottom:0;
  border-radius:20px 20px 0 0;

  background:
    linear-gradient(
      180deg,
      rgba(18,29,36,.985),
      rgba(10,19,25,.995)
    );

  color:#edf4f7;

  box-shadow:
    0 -12px 38px rgba(0,0,0,.24);
}

.mf-sort-handle-v25 {
  width:35px;
  height:3px;

  margin:2px auto 7px;

  border-radius:999px;

  background:rgba(145,166,190,.30);
}

/* ---------- header ---------- */
.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:auto 1fr;
  align-items:center;
  column-gap:6px;

  min-height:40px;

  border-bottom:0;
}

.mf-sort-sheet-head-v25 h2 {
  grid-column:auto;

  margin:0;

  color:#f3f7f9;

  font-size:14px;
  font-weight:780;
  letter-spacing:.025em;
  text-align:left;
}

.mf-sort-back-v25 {
  display:grid;
  place-items:center;

  width:27px;
  height:27px;
  padding:0;

  border:0;
  border-radius:8px;

  background:transparent;
  color:#8da0ab;

  font:inherit;
  font-size:23px;
  font-weight:400;
  line-height:1;

  cursor:pointer;
}

/* ---------- direction segmented control ---------- */
.mf-sort-direction-v25 {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:2px;

  margin:7px 0 10px;
  padding:3px;

  border:
    1px solid
    var(--line,rgba(147,178,202,.055));

  border-radius:11px;

  background:rgba(3,10,15,.38);
}

.mf-sort-direction-v25 button {
  min-height:31px;
  padding:0 7px;

  border:1px solid transparent;
  border-radius:8px;

  background:transparent;
  color:#71848f;

  font:inherit;
  font-size:7.8px;
  font-weight:800;
  letter-spacing:.09em;

  box-shadow:none;
  cursor:pointer;
}

.mf-sort-direction-v25 button.is-active {
  border-color:rgba(87,219,214,.48);

  background:rgba(87,219,214,.025);
  color:#e8f1f4;

  box-shadow:none;
}

/* ---------- one shared list container ---------- */
.mf-sort-list-shell-v252 {
  overflow:hidden;

  border:
    1px solid
    var(--line-strong,rgba(147,178,202,.095));

  border-radius:12px;

  background:
    linear-gradient(
      180deg,
      rgba(20,31,38,.68),
      rgba(13,23,29,.62)
    );
}

.mf-sort-list-v25 {
  display:block;
}

.mf-sort-row-v25 {
  position:relative;

  display:grid;
  grid-template-columns:22px minmax(0,1fr) 20px;
  align-items:center;
  column-gap:9px;

  width:100%;
  min-height:43px;

  padding:0 11px;

  border:0;
  border-radius:0;

  background:transparent;
  color:#e7eef2;

  font:inherit;
  font-size:10.5px;
  font-weight:650;
  text-align:left;

  box-shadow:none;
  cursor:pointer;
}

.mf-sort-row-v25 + .mf-sort-row-v25::before {
  content:"";

  position:absolute;
  top:0;
  right:0;
  left:42px;

  height:1px;

  background:
    var(--line,rgba(147,178,202,.055));
}

.mf-sort-row-v25:active {
  background:rgba(255,255,255,.018);
}

.mf-sort-option-icon-v251 {
  display:grid;
  place-items:center;

  width:22px;
  height:22px;

  color:#8fa1ad;
}

.mf-sort-option-icon-v251 svg {
  width:15px;
  height:15px;

  fill:none;
  stroke:currentColor;
  stroke-width:1.5;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.mf-sort-option-label-v251 {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

/* ---------- radio ---------- */
.mf-sort-radio-v25 {
  justify-self:end;

  width:15px;
  height:15px;

  border:1.5px solid #758994;
  border-radius:50%;

  background:transparent;
  box-sizing:border-box;
}

.mf-sort-radio-v25.is-active {
  border:4px solid var(--green,#4de6a1);

  background:#07120f;

  box-shadow:none;
}

/* ---------- age drill-in ---------- */
.mf-sort-row-chevron-v251 {
  justify-self:end;

  color:#8fa1ad;

  font-size:19px;
  font-weight:300;
  line-height:1;
}

.mf-sort-age-row-v251 {
  grid-template-columns:minmax(0,1fr) 20px;
}

.mf-age-list-v25 {
  display:block;
}

.mf-age-shell-v252 {
  margin-top:7px;
}

/* ---------- mobile ---------- */
@media (max-width:760px) {
  .mf-sort-sheet-v25 {
    width:100%;
    max-height:53dvh;

    border-left:0;
    border-right:0;
  }

  .mf-sort-row-v25 {
    min-height:42px;
    font-size:10px;
  }
}

/* ---------- desktop ---------- */
@media (min-width:761px) {
  .mf-sort-sheet-v25 {
    margin-bottom:14px;

    border-bottom:
      1px solid
      var(--line-strong,rgba(147,178,202,.095));

    border-radius:20px;
  }
}

/* ---------- motion ---------- */
@media (prefers-reduced-motion:reduce) {
  .mf-sort-overlay-v25 *,
  .mf-sort-trigger-v25 {
    transition:none !important;
  }
}
'''

css = css[:marker_at].rstrip() + "\n\n" + exact_css.strip() + "\n"

# ---------------------------------------------------------------------------
# 5) Cache-bust this page's own JS/CSS.
# ---------------------------------------------------------------------------
for asset in ("system-tokens.js", "system-tokens.css"):
    old = f'/{asset}?v={OLD_VERSION}'
    new = f'/{asset}?v={NEW_VERSION}'

    if old not in html:
        raise SystemExit(f"PRECHECK FAILED: old cache URL missing: {old}")

    html = html.replace(old, new, 1)

# Update unrelated hard-coded cache assertions first.
for path in sorted(tests_dir.rglob("*")):
    if not path.is_file() or path.suffix not in {".mjs", ".js", ".cjs"}:
        continue

    body = path.read_text(encoding="utf-8")
    changed = body.replace(OLD_VERSION, NEW_VERSION)
    if changed != body:
        path.write_text(changed, encoding="utf-8")

# Remove obsolete sort-visual tests. V25.2 CLEAN becomes the one canonical
# regression so old CSS expectations cannot fight the new design.
obsolete_tests = [
    tests_dir / "token-sort-ui-v25.mjs",
    tests_dir / "token-sort-style-v25-1.mjs",
    tests_dir / "token-sort-style-v25-2.mjs",
]
for path in obsolete_tests:
    if path.exists():
        path.unlink()

test_path = tests_dir / "token-sort-v25-2-clean.mjs"
test_path.write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../system-tokens.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN/);
assert.doesNotMatch(ui,/MEMEFLOW_GMGN_SORT_STYLE_V25_1/);
assert.match(css,/MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN/);
assert.doesNotMatch(css,/MEMEFLOW_GMGN_SORT_V25_1/);
assert.doesNotMatch(css,/\/\* MEMEFLOW_GMGN_SORT_V25 \*\//);

assert.match(ui,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(ui,/function\s+__mfSmartSortRowsV25/);
assert.match(ui,/const laneDiff=priority\(a\)-priority\(b\)/);
assert.match(ui,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);
assert.match(ui,/MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/);

for(const name of [
  '__mfSortSheetShellV25',
  '__mfBindSortOverlayV25',
  '__mfRenderSortRootV25',
  '__mfRenderAgeSheetV25',
  '__mfEnsureSortUiV25'
]){
  const matches=ui.match(new RegExp(`function\\s+${name}\\s*\\(`,'g'))||[];
  assert.equal(matches.length,1,`${name} must have exactly one definition`);
}

assert.doesNotMatch(ui,/data-mf-sort-close/);
assert.doesNotMatch(css,/\.mf-sort-close-v25/);
assert.match(ui,/mf-sort-list-shell-v252/);

assert.match(css,/max-height:min\(53dvh,470px\)/);
assert.match(css,/background:rgba\(0,5,9,.33\)/);
assert.match(css,/backdrop-filter:blur\(1\.5px\)/);
assert.match(css,/\.mf-sort-list-shell-v252/);
assert.match(css,/\.mf-sort-row-v25 \+ \.mf-sort-row-v25::before/);
assert.match(css,/left:42px/);
assert.match(css,/width:15px/);
assert.match(css,/border:1\.5px solid #758994/);

assert.match(css,/var\(--line/);
assert.match(css,/var\(--line-strong/);
assert.match(css,/var\(--muted/);
assert.match(css,/var\(--green/);

for(const label of [
  'Smart / Default',
  'Market Cap',
  'Holders',
  'Transactions',
  'Volume',
  'Age',
  'HIGH → LOW',
  'LOW → HIGH',
  '1m',
  '5m',
  '1h',
  '6h',
  '24h'
]){
  assert.ok(ui.includes(label),`missing sort control: ${label}`);
}

assert.match(html,/system-tokens\.js\?v=gmgn-sort-v25-2-clean-20260827/);
assert.match(html,/system-tokens\.css\?v=gmgn-sort-v25-2-clean-20260827/);
assert.doesNotMatch(html,/gmgn-sort-v25-1-20260827/);

console.log('token sort v25.2 clean ok');
''', encoding="utf-8")

pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
scripts = pkg.setdefault("scripts", {})
current = scripts.get("test", "")

obsolete_commands = {
    "node tests/token-sort-ui-v25.mjs",
    "node tests/token-sort-style-v25-1.mjs",
    "node tests/token-sort-style-v25-2.mjs",
    "node tests/token-sort-v25-2-clean.mjs",
}

parts = [
    part.strip()
    for part in current.split("&&")
    if part.strip() and part.strip() not in obsolete_commands
]

scripts["test"] = " && ".join(
    ["node tests/token-sort-v25-2-clean.mjs", *parts]
)

pkg_path.write_text(
    json.dumps(pkg, indent=2, ensure_ascii=False) + "\\n",
    encoding="utf-8"
)

# Final pre-write checks: one visual layer only.
for marker in [
    PATCH_ID,
    "mf-sort-list-shell-v252",
    "MEMEFLOW_GMGN_SORT_V25",
    "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23"
]:
    if marker not in ui:
        raise SystemExit(f"POSTCHECK FAILED [ui]: missing {marker}")

if "MEMEFLOW_GMGN_SORT_STYLE_V25_1" in ui:
    raise SystemExit("POSTCHECK FAILED: stale V25.1 JS visual marker remains.")

for stale in [
    "/* MEMEFLOW_GMGN_SORT_V25 */",
    "MEMEFLOW_GMGN_SORT_V25_1",
]:
    if stale in css:
        raise SystemExit(f"POSTCHECK FAILED: stale CSS remains: {stale}")

if css.count("MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN") != 1:
    raise SystemExit("POSTCHECK FAILED: CLEAN CSS layer must exist exactly once.")

if "data-mf-sort-close" in ui or ".mf-sort-close-v25" in css:
    raise SystemExit("POSTCHECK FAILED: dead close/X styling or markup remains.")

ui_path.write_text(ui, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

print("V25.2 CLEAN exact-mockup visual patch installed.")
PY

echo
echo "==> [1/6] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-v25-2-clean.mjs

echo "==> [2/6] Canonical V25.2 CLEAN regression"
node tests/token-sort-v25-2-clean.mjs

echo "==> [3/6] Existing live ranking regression"
if [[ -f tests/live-ranking-reorder-v23.mjs ]]; then
  node tests/live-ranking-reorder-v23.mjs
fi

echo "==> [4/6] Full MEMEFLOW test suite"
npm test

echo "==> [5/6] Git whitespace/conflict check"
git diff --check

echo "==> [6/6] Style-conflict audit"
python3 <<'PY'
from pathlib import Path
import re

ui=Path("system-tokens.js").read_text(encoding="utf-8")
css=Path("system-tokens.css").read_text(encoding="utf-8")
html=Path("system-tokens.html").read_text(encoding="utf-8")

assert css.count("MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN") == 1
assert "MEMEFLOW_GMGN_SORT_V25_1" not in css
assert "/* MEMEFLOW_GMGN_SORT_V25 */" not in css
assert "MEMEFLOW_GMGN_SORT_STYLE_V25_1" not in ui
assert "data-mf-sort-close" not in ui
assert ".mf-sort-close-v25" not in css

for name in [
    "__mfSortSheetShellV25",
    "__mfBindSortOverlayV25",
    "__mfRenderSortRootV25",
    "__mfRenderAgeSheetV25",
    "__mfEnsureSortUiV25",
]:
    count=len(re.findall(rf"function\\s+{re.escape(name)}\\s*\\(",ui))
    if count != 1:
        raise SystemExit(f"duplicate JS function {name}: {count}")

if html.count("gmgn-sort-v25-2-clean-20260827") != 2:
    raise SystemExit("expected exactly JS + CSS CLEAN cache URLs")

print("style-conflict audit ok")
PY

trap - EXIT

echo
echo "V25.2 CLEAN validated successfully."
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
  git commit -m "fix(token-flow): match sorting modal geometry to mockup"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated V25.2 CLEAN commit..."
  git push
else
  echo
  echo "Not pushed. To push now: git push"
fi

echo
echo "DONE V25.2 CLEAN:"
echo "  - sort logic is unchanged"
echo "  - no X button in main bottom sheet"
echo "  - SORT BY is left aligned"
echo "  - one shared option container with thin separators"
echo "  - smaller radio controls"
echo "  - thin outlined segmented direction control"
echo "  - weaker overlay + almost no blur"
echo "  - shorter sheet that stays in the lower part of the viewport"
echo "  - V25.1 sort CSS is replaced, not layered"
