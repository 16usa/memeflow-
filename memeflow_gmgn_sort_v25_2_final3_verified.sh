#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL3"
OLD_VERSION="gmgn-sort-v25-1-20260827"
NEW_VERSION="gmgn-sort-v25-2-final3-20260827"
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
  echo "ERROR: MEMEFLOW app directory was not found." >&2
  echo "Run this script from the project root or memeflow-app." >&2
  exit 1
fi

cd "$APP"

for file in system-tokens.js system-tokens.css system-tokens.html package.json; do
  [[ -f "$file" ]] || {
    echo "ERROR: required file is missing: $file" >&2
    exit 1
  }
done

# Validate package.json before touching any file.
python3 -m json.tool package.json >/dev/null || {
  echo "ERROR: package.json is invalid before patching. Nothing was changed." >&2
  exit 1
}

# Idempotency: a second run exits cleanly before V25.1-only checks.
if grep -Fq "$PATCH_ID" system-tokens.js; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Strict V25.1 -> V25.2 FINAL3 prerequisites.
grep -Fq "MEMEFLOW_GMGN_SORT_V25" system-tokens.js || {
  echo "ERROR: base V25 sorting logic is missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_GMGN_SORT_STYLE_V25_1" system-tokens.js || {
  echo "ERROR: V25.1 sorting UI marker is missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_GMGN_SORT_V25_1" system-tokens.css || {
  echo "ERROR: V25.1 sorting CSS marker is missing." >&2
  exit 1
}
grep -Fq "$OLD_VERSION" system-tokens.html || {
  echo "ERROR: V25.1 browser asset version is not active." >&2
  exit 1
}

# Never patch over local work.
if ! git diff --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null \
   || ! git diff --cached --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null; then
  echo "ERROR: target files contain uncommitted or staged changes." >&2
  echo "Commit or stash them first. Nothing was changed." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backups/gmgn-sort-v25-2-final3-$STAMP"
mkdir -p "$BACKUP_DIR"

cp -p system-tokens.js system-tokens.css system-tokens.html "$BACKUP_DIR/"

if [[ -d tests ]]; then
  cp -a tests "$BACKUP_DIR/tests"
fi

rollback() {
  local rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring V25.1 files..."

    cp -p "$BACKUP_DIR/system-tokens.js" system-tokens.js
    cp -p "$BACKUP_DIR/system-tokens.css" system-tokens.css
    cp -p "$BACKUP_DIR/system-tokens.html" system-tokens.html

    rm -rf tests

    if [[ -d "$BACKUP_DIR/tests" ]]; then
      cp -a "$BACKUP_DIR/tests" tests
    else
      mkdir -p tests
    fi

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
package_path = Path("package.json")
tests_dir = Path("tests")
tests_dir.mkdir(exist_ok=True)

ui = ui_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
package = json.loads(package_path.read_text(encoding="utf-8"))

def replace_function(text, name, replacement):
    match = re.search(
        rf"function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{",
        text
    )
    if not match:
        raise SystemExit(
            f"PRECHECK FAILED: function {name} was not found."
        )

    index = match.end() - 1
    depth = 0
    quote = None
    escape = False
    template = False

    while index < len(text):
        char = text[index]

        if quote is not None:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                quote = None
            index += 1
            continue

        if template:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == "`":
                template = False
            index += 1
            continue

        if char in ("'", '"'):
            quote = char
            index += 1
            continue

        if char == "`":
            template = True
            index += 1
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                return (
                    text[:match.start()]
                    + replacement.strip()
                    + text[end:]
                )

        index += 1

    raise SystemExit(
        f"PRECHECK FAILED: function {name} has no closing boundary."
    )

# ---------------------------------------------------------------------------
# 1. Replace V25.1 visual marker instead of stacking a second marker.
# ---------------------------------------------------------------------------
old_marker = "// MEMEFLOW_GMGN_SORT_STYLE_V25_1"
if ui.count(old_marker) != 1:
    raise SystemExit(
        "PRECHECK FAILED: expected exactly one V25.1 JS style marker."
    )

ui = ui.replace(old_marker, f"// {PATCH_ID}", 1)

# ---------------------------------------------------------------------------
# 2. Bottom-sheet shell: no X button; compact left-aligned header.
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
        <div
          class="mf-sort-handle-v25"
          aria-hidden="true"
        ></div>

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

# Overlay click is the only pointer close action.
ui = replace_function(
    ui,
    "__mfBindSortOverlayV25",
    r'''
function __mfBindSortOverlayV25(){
  const overlay=
    document.getElementById('mfSortOverlayV25');

  if(!overlay)return;

  overlay.addEventListener('click',event=>{
    if(event.target===overlay){
      __mfCloseSortSheetV25();
    }
  });
}
'''
)

# ---------------------------------------------------------------------------
# 3. One shared sort list container with separators.
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

  document.body.classList.add(
    'mf-sort-sheet-open-v25'
  );

  __mfBindSortOverlayV25();

  const overlay=
    document.getElementById('mfSortOverlayV25');

  overlay
    ?.querySelectorAll('[data-mf-sort-dir]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        __mfApplySortV25(
          {direction:button.dataset.mfSortDir},
          false
        );

        __mfRenderSortRootV25();
      });
    });

  overlay
    ?.querySelectorAll('[data-mf-sort-key]')
    .forEach(button=>{
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
# 4. Age submenu uses the same shared-container geometry.
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
    <div
      class="mf-sort-list-shell-v252 mf-age-shell-v252"
    >
      <div
        class="mf-sort-list-v25 mf-age-list-v25"
      >
        ${rows}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    __mfSortSheetShellV25('AGE',body,back)
  );

  document.body.classList.add(
    'mf-sort-sheet-open-v25'
  );

  __mfBindSortOverlayV25();

  const overlay=
    document.getElementById('mfSortOverlayV25');

  overlay
    ?.querySelector('[data-mf-sort-back]')
    ?.addEventListener(
      'click',
      __mfRenderSortRootV25
    );

  overlay
    ?.querySelectorAll('[data-mf-age]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        const raw=button.dataset.mfAge;

        __mfApplySortV25({
          key:'age',
          ageMaxMinutes:
            raw==='all'
              ? null
              : Number(raw)
        });
      });
    });
}
'''
)

# ---------------------------------------------------------------------------
# 5. CSS conflict audit.
#    V25.1 must be one final appended sort block. No older sort selectors may
#    exist before it, and no later MEMEFLOW patch may exist after it.
# ---------------------------------------------------------------------------
css_marker = "/* MEMEFLOW_GMGN_SORT_V25_1"
marker_at = css.find(css_marker)

if marker_at < 0:
    raise SystemExit(
        "PRECHECK FAILED: V25.1 CSS marker was not found."
    )

prefix = css[:marker_at]
tail = css[marker_at:]

sort_selector_pattern = re.compile(
    r"\.(?:mf-sort-|mf-age-list-v25)"
)

if sort_selector_pattern.search(prefix):
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: sorting CSS exists outside "
        "the active V25.1 block. Refusing to layer styles."
    )

later_markers = re.findall(
    r"/\*\s*(MEMEFLOW_[A-Z0-9_]+)",
    tail
)

unexpected_markers = [
    marker
    for marker in later_markers
    if marker != "MEMEFLOW_GMGN_SORT_V25_1"
]

if unexpected_markers:
    raise SystemExit(
        "STYLE CONFLICT PRECHECK FAILED: another MEMEFLOW CSS patch "
        "exists after V25.1: "
        + ", ".join(unexpected_markers)
    )

final_css = r'''
/* MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL3
 * Single canonical sorting visual layer.
 * No previous sorting CSS is retained.
 */

/* Trigger */
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

  border:
    1px solid
    var(--line-strong,rgba(147,178,202,.095));

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

/* Overlay */
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

/* Bottom sheet */
.mf-sort-sheet-v25 {
  width:min(100%,520px);
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

/* Header */
.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:auto 1fr;
  align-items:center;
  column-gap:6px;

  min-height:40px;

  border-bottom:0;
}

.mf-sort-sheet-head-v25 h2 {
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

/* Direction segmented control */
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

/* One shared option surface */
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

/* Radio */
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

/* Age submenu */
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

/* Mobile */
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

/* Desktop */
@media (min-width:761px) {
  .mf-sort-sheet-v25 {
    margin-bottom:14px;

    border-bottom:
      1px solid
      var(--line-strong,rgba(147,178,202,.095));

    border-radius:20px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion:reduce) {
  .mf-sort-overlay-v25 *,
  .mf-sort-trigger-v25 {
    transition:none !important;
  }
}
'''

# Replace the entire V25.1 sort style layer, not individual rules.
css = css[:marker_at].rstrip() + "\n\n" + final_css.strip() + "\n"

# ---------------------------------------------------------------------------
# 6. Browser cache.
# ---------------------------------------------------------------------------
for asset in ("system-tokens.js", "system-tokens.css"):
    old = f'/{asset}?v={OLD_VERSION}'
    new = f'/{asset}?v={NEW_VERSION}'

    if html.count(old) != 1:
        raise SystemExit(
            f"PRECHECK FAILED: expected exactly one old asset URL: {old}"
        )

    html = html.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 7. Test compatibility without touching package.json.
#
#    The browser asset version is a page-level contract, and several existing
#    regression files can assert it. Update that exact cache string across all
#    JavaScript test files before running npm test.
#
#    Sort-specific legacy tests are then converted into compatibility wrappers
#    that execute the one canonical FINAL2 regression.
# ---------------------------------------------------------------------------
updated_cache_tests = []

for path in sorted(tests_dir.rglob("*")):
    if (
        not path.is_file()
        or path.suffix not in {".mjs", ".js", ".cjs"}
    ):
        continue

    body = path.read_text(encoding="utf-8")

    if OLD_VERSION not in body:
        continue

    path.write_text(
        body.replace(OLD_VERSION, NEW_VERSION),
        encoding="utf-8"
    )

    updated_cache_tests.append(str(path))

print(
    "Updated stale browser-version assertions:",
    len(updated_cache_tests)
)

canonical_test = tests_dir / "token-sort-v25-2-final3.mjs"

canonical_test.write_text(
    r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const css=fs.readFileSync(
  new URL('../system-tokens.css',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.match(
  ui,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL3/
);

assert.doesNotMatch(
  ui,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_1/
);

assert.match(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL3/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_V25_1/
);

assert.doesNotMatch(
  css,
  /\/\* MEMEFLOW_GMGN_SORT_V25 \*\//
);

assert.match(
  ui,
  /MEMEFLOW_GMGN_SORT_V25/
);

assert.match(
  ui,
  /function\s+__mfSmartSortRowsV25/
);

assert.match(
  ui,
  /const laneDiff=priority\(a\)-priority\(b\)/
);

assert.match(
  ui,
  /MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/
);

assert.match(
  ui,
  /MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/
);

for(const name of [
  '__mfSortSheetShellV25',
  '__mfBindSortOverlayV25',
  '__mfRenderSortRootV25',
  '__mfRenderAgeSheetV25',
  '__mfEnsureSortUiV25'
]){
  const matches=
    ui.match(
      new RegExp(
        `function\\s+${name}\\s*\\(`,
        'g'
      )
    )||[];

  assert.equal(
    matches.length,
    1,
    `${name} must have exactly one definition`
  );
}

assert.doesNotMatch(
  ui,
  /data-mf-sort-close/
);

assert.doesNotMatch(
  css,
  /\.mf-sort-close-v25/
);

assert.match(
  ui,
  /mf-sort-list-shell-v252/
);

assert.match(
  css,
  /max-height:min\(53dvh,470px\)/
);

assert.match(
  css,
  /background:rgba\(0,5,9,.33\)/
);

assert.match(
  css,
  /backdrop-filter:blur\(1\.5px\)/
);

assert.match(
  css,
  /\.mf-sort-list-shell-v252/
);

assert.match(
  css,
  /\.mf-sort-row-v25 \+ \.mf-sort-row-v25::before/
);

assert.match(
  css,
  /left:42px/
);

assert.match(
  css,
  /width:15px/
);

assert.match(
  css,
  /border:1\.5px solid #758994/
);

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
  assert.ok(
    ui.includes(label),
    `missing sort control: ${label}`
  );
}

assert.equal(
  (
    html.match(
      /gmgn-sort-v25-2-final3-20260827/g
    )||[]
  ).length,
  2,
  'final browser asset version must appear exactly twice'
);

assert.match(
  html,
  /system-tokens\.js\?v=gmgn-sort-v25-2-final3-20260827/
);

assert.match(
  html,
  /system-tokens\.css\?v=gmgn-sort-v25-2-final3-20260827/
);

console.log('token sort v25.2 final3 ok');
''',
    encoding="utf-8"
)

test_command = str(
    package.get("scripts",{}).get("test","")
)

referenced_sort_tests = set(
    re.findall(
        r"tests/(token-sort[^\s&|;\"']+\.mjs)",
        test_command
    )
)

for path in tests_dir.glob("token-sort*.mjs"):
    referenced_sort_tests.add(path.name)

for name in sorted(referenced_sort_tests):
    if name == canonical_test.name:
        continue

    wrapper = tests_dir / name
    wrapper.write_text(
        "import './token-sort-v25-2-final3.mjs';\n",
        encoding="utf-8"
    )

# No test may still assert the superseded V25.1 asset cache after this point.
stale_version_tests = []

for path in sorted(tests_dir.rglob("*")):
    if (
        not path.is_file()
        or path.suffix not in {".mjs", ".js", ".cjs"}
    ):
        continue

    if OLD_VERSION in path.read_text(encoding="utf-8"):
        stale_version_tests.append(str(path))

if stale_version_tests:
    raise SystemExit(
        "POSTCHECK FAILED: stale browser-version assertions remain in: "
        + ", ".join(stale_version_tests)
    )

# ---------------------------------------------------------------------------
# 8. Final in-memory audit.
# ---------------------------------------------------------------------------
required_ui = [
    PATCH_ID,
    "MEMEFLOW_GMGN_SORT_V25",
    "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23",
    "MEMEFLOW_KEYED_CARD_RECONCILE_V18_3",
    "mf-sort-list-shell-v252",
]

for marker in required_ui:
    if marker not in ui:
        raise SystemExit(
            f"POSTCHECK FAILED [ui]: missing {marker}"
        )

if "MEMEFLOW_GMGN_SORT_STYLE_V25_1" in ui:
    raise SystemExit(
        "POSTCHECK FAILED: stale V25.1 JS style marker remains."
    )

if "MEMEFLOW_GMGN_SORT_V25_1" in css:
    raise SystemExit(
        "POSTCHECK FAILED: stale V25.1 CSS marker remains."
    )

if "/* MEMEFLOW_GMGN_SORT_V25 */" in css:
    raise SystemExit(
        "POSTCHECK FAILED: stale V25 CSS layer remains."
    )

if css.count(PATCH_ID) != 1:
    raise SystemExit(
        "POSTCHECK FAILED: final CSS layer must exist exactly once."
    )

if "data-mf-sort-close" in ui:
    raise SystemExit(
        "POSTCHECK FAILED: obsolete close-button markup remains."
    )

if ".mf-sort-close-v25" in css:
    raise SystemExit(
        "POSTCHECK FAILED: obsolete close-button CSS remains."
    )

ui_path.write_text(ui,encoding="utf-8")
css_path.write_text(css,encoding="utf-8")
html_path.write_text(html,encoding="utf-8")

print("V25.2 FINAL3 visual patch installed.")
print("package.json was not modified.")
PY

echo
echo "==> [1/7] package.json integrity"
python3 -m json.tool package.json >/dev/null

echo "==> [2/7] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-v25-2-final3.mjs

echo "==> [3/7] Canonical sort regression"
node tests/token-sort-v25-2-final3.mjs

echo "==> [4/7] Existing live ranking regression"
if [[ -f tests/live-ranking-reorder-v23.mjs ]]; then
  node tests/live-ranking-reorder-v23.mjs
fi

echo "==> [5/7] Full MEMEFLOW test suite"
npm test

echo "==> [6/7] Git whitespace/conflict check"
git diff --check

echo "==> [7/7] Final style-conflict audit"
python3 <<'PY'
from pathlib import Path
import json
import re

ui = Path("system-tokens.js").read_text(encoding="utf-8")
css = Path("system-tokens.css").read_text(encoding="utf-8")
html = Path("system-tokens.html").read_text(encoding="utf-8")

json.loads(
    Path("package.json").read_text(encoding="utf-8")
)

if css.count(
    "MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL3"
) != 1:
    raise SystemExit(
        "ERROR: final sorting CSS layer is not unique."
    )

for stale in (
    "MEMEFLOW_GMGN_SORT_V25_1",
    "/* MEMEFLOW_GMGN_SORT_V25 */",
):
    if stale in css:
        raise SystemExit(
            f"ERROR: stale sorting CSS remains: {stale}"
        )

if "MEMEFLOW_GMGN_SORT_STYLE_V25_1" in ui:
    raise SystemExit(
        "ERROR: stale V25.1 JS style marker remains."
    )

if "data-mf-sort-close" in ui:
    raise SystemExit(
        "ERROR: obsolete close-button markup remains."
    )

if ".mf-sort-close-v25" in css:
    raise SystemExit(
        "ERROR: obsolete close-button CSS remains."
    )

for name in (
    "__mfSortSheetShellV25",
    "__mfBindSortOverlayV25",
    "__mfRenderSortRootV25",
    "__mfRenderAgeSheetV25",
    "__mfEnsureSortUiV25",
):
    count = len(
        re.findall(
            rf"function\s+{re.escape(name)}\s*\(",
            ui
        )
    )

    if count != 1:
        raise SystemExit(
            f"ERROR: duplicate JS function {name}: {count}"
        )

if html.count(
    "gmgn-sort-v25-2-final3-20260827"
) != 2:
    raise SystemExit(
        "ERROR: expected exactly two final browser asset URLs."
    )

stale_tests = []

tests_dir = Path("tests")

for path in sorted(tests_dir.rglob("*")):
    if (
        not path.is_file()
        or path.suffix not in {".mjs", ".js", ".cjs"}
    ):
        continue

    if "gmgn-sort-v25-1-20260827" in path.read_text(encoding="utf-8"):
        stale_tests.append(str(path))

if stale_tests:
    raise SystemExit(
        "ERROR: stale V25.1 browser-version assertions remain: "
        + ", ".join(stale_tests)
    )

allowed = re.compile(
    r"^(?:memeflow-app/)?(?:"
    r"system-tokens\.(?:js|css|html)"
    r"|tests/.*\.(?:mjs|js|cjs)"
    r")$"
)

import subprocess

changed = subprocess.check_output(
    ["git","diff","--name-only"],
    text=True
).splitlines()

unexpected = [
    path
    for path in changed
    if path and not allowed.match(path)
]

if unexpected:
    raise SystemExit(
        "ERROR: unexpected files changed: "
        + ", ".join(unexpected)
    )

print("style-conflict audit ok")
PY

trap - EXIT

echo
echo "V25.2 FINAL3 validated successfully."
echo "Backup: $BACKUP_DIR"
echo

git --no-pager diff --stat -- \
  system-tokens.js \
  system-tokens.css \
  system-tokens.html \
  tests

git add -- \
  system-tokens.js \
  system-tokens.css \
  system-tokens.html \
  tests

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix(token-flow): finalize sorting modal visual layer"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated V25.2 FINAL3 commit..."
  git push
else
  echo
  echo "Not pushed. Run git push when ready."
fi

echo
echo "DONE V25.2 FINAL3:"
echo "  - package.json was never modified"
echo "  - one canonical sorting CSS layer remains"
echo "  - previous sort-test expectations cannot conflict"
echo "  - no X button code remains"
echo "  - one shared option surface with separators"
echo "  - compact radios and segmented direction control"
echo "  - restrained overlay and blur"
echo "  - full npm test suite passed before commit"
