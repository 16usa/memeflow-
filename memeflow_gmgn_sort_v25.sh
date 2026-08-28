#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_GMGN_SORT_V25"
JS_VERSION="gmgn-sort-v25-20260827"
CSS_VERSION="gmgn-sort-v25-20260827"
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

if ! git diff --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null \
   || ! git diff --cached --quiet -- system-tokens.js system-tokens.css system-tokens.html package.json tests 2>/dev/null; then
  echo "ERROR: target UI/test files have uncommitted or staged changes." >&2
  echo "Commit/stash them first. Nothing was modified." >&2
  exit 1
fi

grep -Fq "MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22" system-tokens.js || {
  echo "ERROR: V22 WATCH/WAITING ranking prerequisite missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" system-tokens.js || {
  echo "ERROR: V23 instant ranking prerequisite missing." >&2
  exit 1
}
grep -Fq "MEMEFLOW_KEYED_CARD_RECONCILE_V18_3" system-tokens.js || {
  echo "ERROR: keyed card reconciler prerequisite missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" system-tokens.js; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".patch-backups/gmgn-sort-v25-$STAMP"
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
    echo "Patch failed; restoring backup..."
    cp -p "$BACKUP_DIR/system-tokens.js" system-tokens.js
    cp -p "$BACKUP_DIR/system-tokens.css" system-tokens.css
    cp -p "$BACKUP_DIR/system-tokens.html" system-tokens.html
    cp -p "$BACKUP_DIR/package.json" package.json
    if [[ -d "$BACKUP_DIR/tests" ]]; then
      for f in "$BACKUP_DIR"/tests/*; do
        [[ -f "$f" ]] && cp -p "$f" "tests/$(basename "$f")"
      done
    fi
    rm -f tests/token-sort-ui-v25.mjs
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap rollback EXIT

export MF_PATCH_ID="$PATCH_ID"
export MF_JS_VERSION="$JS_VERSION"
export MF_CSS_VERSION="$CSS_VERSION"

python3 <<'PY'
from pathlib import Path
import json
import os
import re

PATCH_ID = os.environ["MF_PATCH_ID"]
JS_VERSION = os.environ["MF_JS_VERSION"]
CSS_VERSION = os.environ["MF_CSS_VERSION"]

ui_path = Path("system-tokens.js")
css_path = Path("system-tokens.css")
html_path = Path("system-tokens.html")
package_path = Path("package.json")
tests_dir = Path("tests")
tests_dir.mkdir(exist_ok=True)

ui = ui_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

sort_match = re.search(r"function\s+sortRows\s*\(\s*rows\s*\)\s*\{", ui)
if not sort_match:
    raise SystemExit("PRECHECK FAILED: function sortRows(rows) not found.")

ui = (
    ui[:sort_match.start()]
    + sort_match.group(0).replace("sortRows", "__mfSmartSortRowsV25", 1)
    + ui[sort_match.end():]
)

sort_helpers = r'''
/* MEMEFLOW_GMGN_SORT_V25
 * Extra user sorting for Real-Time Pipeline.
 * SMART preserves the existing MEMEFLOW ranking exactly.
 */
const __MF_SORT_STORAGE_KEY_V25='memeflow:token-sort-v25';
const __MF_SORT_DEFAULT_V25={
  key:'smart',
  direction:'desc',
  ageMaxMinutes:null
};

function __mfLoadSortConfigV25(){
  try{
    const stored=JSON.parse(
      localStorage.getItem(__MF_SORT_STORAGE_KEY_V25)||'null'
    );
    const allowed=new Set([
      'smart','mc','holders','transactions','volume','age'
    ]);
    return {
      key:allowed.has(stored?.key)?stored.key:'smart',
      direction:stored?.direction==='asc'?'asc':'desc',
      ageMaxMinutes:
        finite(stored?.ageMaxMinutes)&&Number(stored.ageMaxMinutes)>0
          ? Number(stored.ageMaxMinutes)
          : null
    };
  }catch{
    return {...__MF_SORT_DEFAULT_V25};
  }
}

let __mfSortConfigV25=__mfLoadSortConfigV25();

function __mfSaveSortConfigV25(){
  try{
    localStorage.setItem(
      __MF_SORT_STORAGE_KEY_V25,
      JSON.stringify(__mfSortConfigV25)
    );
  }catch{}
}

function __mfSortMetricsV25(row){
  const key=stateKey(row?.decision?.state);

  if(key==='open'){
    const metrics=openPositionMetrics(row)||{};
    return {
      mc:
        finite(metrics?.marketCapUsd)
          ? Number(metrics.marketCapUsd)
          : finite(metrics?.marketCapSol)
            ? Number(metrics.marketCapSol)
            : null,
      holders:
        finite(metrics?.holderCount)
          ? Number(metrics.holderCount)
          : finite(holderCount(row))
            ? Number(holderCount(row))
            : null,
      transactions:
        finite(metrics?.transactions5m)
          ? Number(metrics.transactions5m)
          : null,
      volume:
        finite(metrics?.volume5mUsd)
          ? Number(metrics.volume5mUsd)
          : finite(metrics?.volume5mSol)
            ? Number(metrics.volume5mSol)
            : null,
      age:
        finite(metrics?.ageMinutes)
          ? Number(metrics.ageMinutes)
          : finite(tokenAge(row))
            ? Number(tokenAge(row))
            : null
    };
  }

  const metrics=regularMarketMetrics(row)||{};
  return {
    mc:
      finite(metrics?.marketCapUsd)
        ? Number(metrics.marketCapUsd)
        : finite(metrics?.marketCapSol)
          ? Number(metrics.marketCapSol)
          : null,
    holders:
      finite(metrics?.holderCount)
        ? Number(metrics.holderCount)
        : finite(holderCount(row))
          ? Number(holderCount(row))
          : null,
    transactions:
      finite(metrics?.transactions5m)
        ? Number(metrics.transactions5m)
        : null,
    volume:
      finite(metrics?.volume5mUsd)
        ? Number(metrics.volume5mUsd)
        : finite(metrics?.volume5mSol)
          ? Number(metrics.volume5mSol)
          : null,
    age:
      finite(metrics?.ageMinutes)
        ? Number(metrics.ageMinutes)
        : finite(tokenAge(row))
          ? Number(tokenAge(row))
          : null
  };
}

function __mfManualSortValueV25(row,key){
  const value=__mfSortMetricsV25(row)?.[key];
  return finite(value)?Number(value):null;
}

function sortRows(rows){
  const smart=__mfSmartSortRowsV25(rows);

  if(__mfSortConfigV25.key==='smart'){
    return smart;
  }

  const key=__mfSortConfigV25.key;
  const direction=__mfSortConfigV25.direction;
  const smartRank=new Map(
    smart.map((row,index)=>[row,index])
  );

  return [...smart].sort((a,b)=>{
    const laneDiff=priority(a)-priority(b);
    if(laneDiff!==0)return laneDiff;

    const valueA=__mfManualSortValueV25(a,key);
    const valueB=__mfManualSortValueV25(b,key);

    if(valueA===null&&valueB===null){
      return (smartRank.get(a)??0)-(smartRank.get(b)??0);
    }
    if(valueA===null)return 1;
    if(valueB===null)return -1;

    if(valueA!==valueB){
      return direction==='asc'
        ? valueA-valueB
        : valueB-valueA;
    }

    return (smartRank.get(a)??0)-(smartRank.get(b)??0);
  });
}

'''

smart_sig = re.search(
    r"function\s+__mfSmartSortRowsV25\s*\(\s*rows\s*\)\s*\{",
    ui
)
if not smart_sig:
    raise SystemExit("POSTCHECK FAILED: Smart sort rename missing.")

ui = ui[:smart_sig.start()] + sort_helpers + ui[smart_sig.start():]

filtered_match = re.search(r"function\s+filteredRows\s*\(\s*\)\s*\{", ui)
if not filtered_match:
    raise SystemExit("PRECHECK FAILED: function filteredRows() not found.")

ui = (
    ui[:filtered_match.start()]
    + filtered_match.group(0).replace("filteredRows", "__mfBaseFilteredRowsV25", 1)
    + ui[filtered_match.end():]
)

age_wrapper = r'''
function filteredRows(){
  const rows=__mfBaseFilteredRowsV25();
  const maxAge=__mfSortConfigV25.ageMaxMinutes;

  if(!finite(maxAge)||Number(maxAge)<=0){
    return rows;
  }

  return rows.filter(row=>{
    if(stateKey(row?.decision?.state)==='open'){
      return true;
    }

    const age=__mfManualSortValueV25(row,'age');

    return (
      age!==null &&
      age<=Number(maxAge)
    );
  });
}

'''

render_counts_match = re.search(r"function\s+renderCounts\s*\(\s*\)\s*\{", ui)
if not render_counts_match:
    raise SystemExit("PRECHECK FAILED: function renderCounts() not found.")

ui = ui[:render_counts_match.start()] + age_wrapper + ui[render_counts_match.start():]

sort_ui = r'''
// MEMEFLOW_GMGN_SORT_UI_V25
const __MF_SORT_LABELS_V25={
  smart:'SMART',
  mc:'MC',
  holders:'HOLDERS',
  transactions:'TX 5M',
  volume:'VOL 5M',
  age:'AGE'
};

function __mfAgeLabelV25(minutes){
  const value=Number(minutes);
  if(value===1)return '1M';
  if(value===5)return '5M';
  if(value===60)return '1H';
  if(value===360)return '6H';
  if(value===1440)return '24H';
  return 'ALL';
}

function __mfSortTriggerTextV25(){
  if(__mfSortConfigV25.key==='smart'){
    return 'SORT · SMART';
  }

  const label=__MF_SORT_LABELS_V25[__mfSortConfigV25.key]||'SMART';
  const arrow=__mfSortConfigV25.direction==='asc'?'↑':'↓';
  const ageWindow=
    finite(__mfSortConfigV25.ageMaxMinutes)
      ? ` · ${__mfAgeLabelV25(__mfSortConfigV25.ageMaxMinutes)}`
      : '';

  return `SORT · ${label} ${arrow}${ageWindow}`;
}

function __mfUpdateSortTriggerV25(){
  const button=document.getElementById('mfSortTriggerV25');
  if(!button)return;

  button.textContent=__mfSortTriggerTextV25();
  button.classList.toggle(
    'is-active',
    __mfSortConfigV25.key!=='smart' ||
    finite(__mfSortConfigV25.ageMaxMinutes)
  );
}

function __mfCloseSortSheetV25(){
  document.getElementById('mfSortOverlayV25')?.remove();
  document.body.classList.remove('mf-sort-sheet-open-v25');
}

function __mfApplySortV25(next,close=true){
  __mfSortConfigV25={...__mfSortConfigV25,...next};
  __mfSaveSortConfigV25();
  __mfUpdateSortTriggerV25();

  state.page=1;
  render();

  if(typeof __mfKickCardClockV19==='function'){
    __mfKickCardClockV19();
  }

  if(close)__mfCloseSortSheetV25();
}

function __mfSortRadioV25(active){
  return `
    <span
      class="mf-sort-radio-v25 ${active?'is-active':''}"
      aria-hidden="true"
    ></span>
  `;
}

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
          <button
            class="mf-sort-close-v25"
            type="button"
            aria-label="Close sorting"
            data-mf-sort-close
          >×</button>
        </header>
        ${body}
      </section>
    </div>
  `;
}

function __mfBindSortOverlayV25(){
  const overlay=document.getElementById('mfSortOverlayV25');
  if(!overlay)return;

  overlay.addEventListener('click',event=>{
    if(
      event.target===overlay ||
      event.target.closest('[data-mf-sort-close]')
    ){
      __mfCloseSortSheetV25();
    }
  });
}

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

  const rows=criteria.map(([key,label])=>`
    <button
      class="mf-sort-row-v25"
      type="button"
      data-mf-sort-key="${key}"
    >
      <span>${label}</span>
      ${__mfSortRadioV25(config.key===key)}
    </button>
  `).join('');

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
        class="mf-sort-row-v25"
        type="button"
        data-mf-age="${minutes===null?'all':minutes}"
      >
        <span>${label}</span>
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
    >←</button>
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

function __mfEnsureSortUiV25(){
  if(document.getElementById('mfSortTriggerV25')){
    __mfUpdateSortTriggerV25();
    return;
  }

  const refresh=document.getElementById('refreshButton');
  const searchRow=refresh?.parentElement;
  if(!searchRow)return;

  const toolbar=document.createElement('div');
  toolbar.className='mf-sort-toolbar-v25';
  toolbar.innerHTML=`
    <button
      id="mfSortTriggerV25"
      class="mf-sort-trigger-v25"
      type="button"
      aria-haspopup="dialog"
    ></button>
  `;

  searchRow.insertAdjacentElement('afterend',toolbar);

  toolbar
    .querySelector('#mfSortTriggerV25')
    .addEventListener('click',__mfRenderSortRootV25);

  __mfUpdateSortTriggerV25();
}

document.addEventListener('keydown',event=>{
  if(
    event.key==='Escape' &&
    document.getElementById('mfSortOverlayV25')
  ){
    __mfCloseSortSheetV25();
  }
});

if(document.readyState==='loading'){
  document.addEventListener(
    'DOMContentLoaded',
    __mfEnsureSortUiV25,
    {once:true}
  );
}else{
  __mfEnsureSortUiV25();
}

'''

refresh_anchor = re.search(
    r"\$\(\s*['\"]refreshButton['\"]\s*\)\s*\.addEventListener",
    ui
)

if refresh_anchor:
    ui = ui[:refresh_anchor.start()] + sort_ui + "\n" + ui[refresh_anchor.start():]
else:
    fallback = ui.find("void __mfPollOneSecondV17")
    if fallback < 0:
        fallback = ui.find("void __mfLoadStructureV18")
    if fallback < 0:
        raise SystemExit("PRECHECK FAILED: runtime initialization anchor not found.")
    ui = ui[:fallback] + sort_ui + "\n" + ui[fallback:]

css_patch = r'''
/* MEMEFLOW_GMGN_SORT_V25 */
.mf-sort-toolbar-v25 {
  display:flex;
  width:100%;
  margin:8px 0 10px;
}

.mf-sort-trigger-v25 {
  width:100%;
  min-height:42px;
  padding:0 14px;
  border:1px solid rgba(117,151,171,.20);
  border-radius:13px;
  background:rgba(9,17,23,.72);
  color:#93a8b4;
  font:inherit;
  font-size:10px;
  font-weight:800;
  letter-spacing:.12em;
  text-align:left;
  text-transform:uppercase;
  cursor:pointer;
}

.mf-sort-trigger-v25.is-active {
  border-color:rgba(56,224,190,.48);
  background:rgba(25,73,67,.20);
  color:#65efc8;
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
  background:rgba(0,5,9,.72);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
}

.mf-sort-sheet-v25 {
  width:min(100%,540px);
  max-height:min(82dvh,720px);
  overflow:auto;
  padding:8px 14px max(18px,env(safe-area-inset-bottom));
  border:1px solid rgba(98,135,157,.22);
  border-bottom:0;
  border-radius:24px 24px 0 0;
  background:#091219;
  box-shadow:0 -22px 80px rgba(0,0,0,.42);
  color:#edf4f7;
}

.mf-sort-handle-v25 {
  width:42px;
  height:4px;
  margin:1px auto 10px;
  border-radius:999px;
  background:rgba(170,194,207,.30);
}

.mf-sort-sheet-head-v25 {
  display:grid;
  grid-template-columns:40px 1fr 40px;
  align-items:center;
  min-height:54px;
  border-bottom:1px solid rgba(132,163,181,.10);
}

.mf-sort-sheet-head-v25 h2 {
  grid-column:2;
  margin:0;
  font-size:17px;
  font-weight:800;
  letter-spacing:.02em;
  text-align:center;
}

.mf-sort-close-v25,
.mf-sort-back-v25 {
  display:grid;
  place-items:center;
  width:36px;
  height:36px;
  border:1px solid rgba(126,158,178,.14);
  border-radius:11px;
  background:rgba(20,31,39,.68);
  color:#9eb1bc;
  font:inherit;
  cursor:pointer;
}

.mf-sort-close-v25 {
  grid-column:3;
  font-size:22px;
}

.mf-sort-back-v25 {
  grid-column:1;
  font-size:16px;
}

.mf-sort-direction-v25 {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:4px;
  margin:14px 0 12px;
  padding:4px;
  border:1px solid rgba(121,153,172,.15);
  border-radius:14px;
  background:rgba(3,10,15,.75);
}

.mf-sort-direction-v25 button {
  min-height:38px;
  border:0;
  border-radius:10px;
  background:transparent;
  color:#718995;
  font:inherit;
  font-size:9px;
  font-weight:800;
  letter-spacing:.08em;
  cursor:pointer;
}

.mf-sort-direction-v25 button.is-active {
  background:#14232b;
  color:#e8f2f5;
  box-shadow:inset 0 0 0 1px rgba(99,143,165,.18);
}

.mf-sort-list-v25 {
  display:grid;
  gap:8px;
}

.mf-sort-row-v25 {
  display:grid;
  grid-template-columns:1fr 28px;
  align-items:center;
  width:100%;
  min-height:58px;
  padding:0 15px;
  border:1px solid rgba(121,153,172,.14);
  border-radius:14px;
  background:rgba(13,24,31,.88);
  color:#e8f0f4;
  font:inherit;
  font-size:13px;
  font-weight:750;
  text-align:left;
  cursor:pointer;
}

.mf-sort-radio-v25 {
  justify-self:end;
  width:20px;
  height:20px;
  border:2px solid #6d838f;
  border-radius:50%;
  box-sizing:border-box;
}

.mf-sort-radio-v25.is-active {
  border:6px solid #62eec7;
  background:#07120f;
}

@media (min-width:761px) {
  .mf-sort-overlay-v25 { padding-bottom:24px; }
  .mf-sort-sheet-v25 {
    border-bottom:1px solid rgba(98,135,157,.22);
    border-radius:24px;
  }
  .mf-sort-trigger-v25 {
    width:auto;
    min-width:190px;
  }
}

@media (max-width:760px) {
  .mf-sort-toolbar-v25 { margin-top:7px; }
  .mf-sort-trigger-v25 {
    min-height:40px;
    font-size:8.5px;
  }
  .mf-sort-sheet-v25 {
    padding-left:12px;
    padding-right:12px;
  }
  .mf-sort-row-v25 {
    min-height:56px;
    font-size:12px;
  }
}
'''

if PATCH_ID in css:
    raise SystemExit("PRECHECK FAILED: CSS marker already exists unexpectedly.")

css = css.rstrip() + "\n\n" + css_patch.strip() + "\n"

js_asset = re.search(r'src="/system-tokens\.js\?v=([^"]+)"', html)
if not js_asset:
    raise SystemExit("PRECHECK FAILED: system-tokens.js asset URL not found.")
old_js_version = js_asset.group(1)

css_asset = re.search(r'href="/system-tokens\.css\?v=([^"]+)"', html)
old_css_version = css_asset.group(1) if css_asset else None

html, n = re.subn(
    r'src="/system-tokens\.js\?v=[^"]+"',
    f'src="/system-tokens.js?v={JS_VERSION}"',
    html,
    count=1
)
if n != 1:
    raise SystemExit("POSTCHECK FAILED: JS cache bust.")

if css_asset:
    html, n = re.subn(
        r'href="/system-tokens\.css\?v=[^"]+"',
        f'href="/system-tokens.css?v={CSS_VERSION}"',
        html,
        count=1
    )
else:
    html, n = re.subn(
        r'href="/system-tokens\.css"',
        f'href="/system-tokens.css?v={CSS_VERSION}"',
        html,
        count=1
    )
if n != 1:
    raise SystemExit("POSTCHECK FAILED: CSS cache bust.")

for path in sorted(tests_dir.rglob("*")):
    if not path.is_file() or path.suffix not in {".mjs", ".js", ".cjs"}:
        continue
    text = path.read_text(encoding="utf-8")
    changed = text.replace(old_js_version, JS_VERSION)
    if old_css_version:
        changed = changed.replace(old_css_version, CSS_VERSION)
    if changed != text:
        path.write_text(changed, encoding="utf-8")

test_path = tests_dir / "token-sort-ui-v25.mjs"
test_path.write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../system-tokens.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(ui,/MEMEFLOW_GMGN_SORT_UI_V25/);
assert.match(ui,/function\s+__mfSmartSortRowsV25\s*\(\s*rows\s*\)/);
assert.match(ui,/function\s+sortRows\s*\(\s*rows\s*\)/);
assert.match(ui,/MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22/);
assert.match(ui,/watch:\s*2,\s*waiting:\s*2,/s);
assert.match(ui,/open:\s*0,\s*ready:\s*1,/s);
assert.match(ui,/const laneDiff=priority\(a\)-priority\(b\)/);
assert.match(ui,/if\(valueA===null\)return 1;/);
assert.match(ui,/if\(valueB===null\)return -1;/);
assert.match(ui,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);
assert.match(ui,/__mfReconcileVisibleCardsV183\(\)/);

for(const text of [
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
  assert.ok(ui.includes(text),`missing UI label: ${text}`);
}

assert.match(css,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(css,/\.mf-sort-sheet-v25/);
assert.match(css,/\.mf-sort-trigger-v25/);
assert.match(html,/system-tokens\.js\?v=gmgn-sort-v25-20260827/);
assert.match(html,/system-tokens\.css\?v=gmgn-sort-v25-20260827/);

console.log('token sort ui v25 ok');
''', encoding="utf-8")

package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
command = "node tests/token-sort-ui-v25.mjs"
current = scripts.get("test", "")

if command not in current:
    scripts["test"] = f"{command} && {current}" if current else command

package_path.write_text(
    json.dumps(package, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8"
)

ui_path.write_text(ui, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "==> [1/7] JavaScript syntax"
node --check system-tokens.js
node --check tests/token-sort-ui-v25.mjs

echo "==> [2/7] Focused sort regression"
node tests/token-sort-ui-v25.mjs

echo "==> [3/7] Existing ranking regression"
if [[ -f tests/live-ranking-reorder-v23.mjs ]]; then
  node tests/live-ranking-reorder-v23.mjs
fi

echo "==> [4/7] Existing market truth regressions"
if [[ -f tests/live-market-truth.mjs ]]; then
  node tests/live-market-truth.mjs
fi
if [[ -f tests/open-position-live-mc-v20.mjs ]]; then
  node tests/open-position-live-mc-v20.mjs
fi

echo "==> [5/7] Full project test suite"
npm test

echo "==> [6/7] Git whitespace/conflict check"
git diff --check

echo "==> [7/7] Patch invariants"
python3 - <<'PY'
from pathlib import Path
ui=Path("system-tokens.js").read_text(encoding="utf-8")
css=Path("system-tokens.css").read_text(encoding="utf-8")
html=Path("system-tokens.html").read_text(encoding="utf-8")

checks={
  "sort patch":"MEMEFLOW_GMGN_SORT_V25" in ui,
  "sort UI":"MEMEFLOW_GMGN_SORT_UI_V25" in ui,
  "smart ranking preserved":"function __mfSmartSortRowsV25" in ui,
  "WATCH+WAITING same lane":"waiting: 2" in ui and "watch: 2" in ui,
  "instant V23 reorder remains":"MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23" in ui,
  "keyed reconciler remains":"MEMEFLOW_KEYED_CARD_RECONCILE_V18_3" in ui,
  "scoped CSS":"MEMEFLOW_GMGN_SORT_V25" in css,
  "JS cache":"gmgn-sort-v25-20260827" in html,
}
failed=[name for name,ok in checks.items() if not ok]
if failed:
  raise SystemExit("Invariant failure: "+", ".join(failed))
print("PASS:", ", ".join(checks))
PY

trap - EXIT

echo
echo "Patch validated successfully."
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
  git commit -m "feat(token-flow): add manual GMGN-style sorting"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated commit..."
  git push
else
  echo
  echo "Not pushed (default). To push now: git push"
fi

echo
echo "DONE:"
echo "  - SMART keeps the existing MEMEFLOW ranking exactly."
echo "  - Manual: Market Cap / Holders / Transactions / Volume / Age."
echo "  - Direction: HIGH→LOW or LOW→HIGH."
echo "  - Age window: All / 1m / 5m / 1h / 6h / 24h."
echo "  - Missing metrics always sort last."
echo "  - OPEN POSITION remains pinned/visible."
echo "  - No new backend endpoint or polling loop."
