#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] No-rerender live cards v18.3"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

FILES=(
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/tests/realtime-update-path.mjs"
  "memeflow-app/tests/per-mint-card-refresh-v18.mjs"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v18-3-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true

  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v18.3 made no commit/push."
    echo "[FAILED] existing Replit M / D / ?? files were not touched."
  fi

  exit "$code"
}
trap cleanup EXIT

git worktree add --detach "$TMP" origin/main >/dev/null
cd "$TMP"

python3 - <<'PY'
from pathlib import Path
import re

APP=Path.cwd()/"memeflow-app"

def load(rel):
    return (APP/rel).read_text()

def save(rel,text):
    (APP/rel).write_text(text)

ui=load("system-tokens.js")

if "MEMEFLOW_KEYED_CARD_RECONCILE_V18_3" not in ui:
    anchor="""async function loadDiscoveryStatus() {
"""
    if anchor not in ui:
        raise SystemExit("[error] reconcile insertion anchor missing")

    helper=r"""// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3
// Background structure sync is keyed by mint. Existing cards are MOVED/PATCHED,
// never destroyed/recreated. New DOM is created only for genuinely new cards.
function __mfBindDetailsButtonV183(card){
  const button=card?.querySelector('.details-button');
  if(!button||button.dataset.mfBoundV183==='1'){
    return;
  }

  button.dataset.mfBoundV183='1';

  button.addEventListener(
    'click',
    ()=>{
      const expanded=
        card.classList.toggle('expanded');

      button.textContent=
        expanded
          ? 'Close'
          : 'Details';
    }
  );
}

function __mfCreateCardNodeV183(row,index){
  const template=document.createElement('template');

  template.innerHTML=
    tokenTemplate(row,index).trim();

  const card=template.content.firstElementChild;

  if(card){
    __mfBindDetailsButtonV183(card);
  }

  return card;
}

function __mfReconcileVisibleCardsV183(){
  renderCounts();

  const rows=filteredRows();

  const pageTotal=Math.max(
    1,
    Math.ceil(rows.length/PAGE_SIZE)
  );

  state.page=Math.min(
    state.page,
    pageTotal
  );

  const start=
    (state.page-1)*PAGE_SIZE;

  const pageRows=
    rows.slice(
      start,
      start+PAGE_SIZE
    );

  $('visibleCount').textContent=rows.length;
  $('pageNumber').textContent=state.page;
  $('pageTotal').textContent=pageTotal;
  $('prevPage').disabled=state.page<=1;
  $('nextPage').disabled=state.page>=pageTotal;
  $('emptyState').hidden=pageRows.length!==0;

  const list=$('tokenList');

  const existing=new Map(
    [...list.querySelectorAll('.flow-token[data-mint]')]
      .map(card=>[
        String(card.dataset.mint||''),
        card
      ])
      .filter(([mint])=>mint)
  );

  const wanted=new Set();
  const ordered=[];

  for(let localIndex=0;localIndex<pageRows.length;localIndex++){
    const row=pageRows[localIndex];
    const mint=String(row?.mint||'').trim();

    if(!mint)continue;

    wanted.add(mint);

    let card=existing.get(mint)||null;

    if(!card){
      card=__mfCreateCardNodeV183(
        row,
        start+localIndex
      );
    }

    if(!card)continue;

    card.dataset.index=String(
      start+localIndex
    );

    ordered.push(card);
  }

  for(const [mint,card] of existing){
    if(!wanted.has(mint)){
      card.remove();
    }
  }

  // append() MOVES an existing node. It does not recreate it.
  for(const card of ordered){
    list.append(card);

    const mint=String(
      card.dataset.mint||''
    );

    if(mint){
      __mfPatchMutableCardV17(mint);
    }
  }
}


"""
    ui=ui.replace(anchor,helper+anchor,1)
    print("[apply] keyed mint DOM reconciler")
else:
    print("[skip] keyed mint DOM reconciler already present")


# Background structural refresh must not call the destructive full render().
structure_start=ui.find("async function __mfLoadStructureV18(){")
structure_end=ui.find("\nasync function loadTokens(){",structure_start)

if structure_start<0 or structure_end<0:
    raise SystemExit("[error] __mfLoadStructureV18 boundaries missing")

structure=ui[structure_start:structure_end]

if "MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3" not in structure:
    old="""    render();

    if(statusParts.length){
"""
    new="""    // MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3
    // Keep every existing mint card alive; only reconcile membership/order.
    __mfReconcileVisibleCardsV183();

    if(statusParts.length){
"""
    if old not in structure:
        raise SystemExit("[error] destructive structure render anchor missing")
    structure=structure.replace(old,new,1)
    ui=ui[:structure_start]+structure+ui[structure_end:]
    print("[apply] structure refresh no longer destroys cards")
else:
    print("[skip] structure no-full-render already present")


# Ensure cards created by an intentional user render (page/filter/search) have
# the same one-time details binding marker. This changes no live-data behavior.
render_start=ui.find("function render() {")
render_end=ui.find("\n\n// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3",render_start)

if render_start<0 or render_end<0:
    raise SystemExit("[error] render boundaries missing after helper insertion")

render_block=ui[render_start:render_end]

# Keep the existing render() exactly for explicit navigation/filter/search.
# Background timers never call it after this patch.
if "MEMEFLOW_USER_ACTION_FULL_RENDER_ONLY_V18_3" not in render_block:
    render_block=render_block.replace(
        "function render() {",
        """function render() {
  // MEMEFLOW_USER_ACTION_FULL_RENDER_ONLY_V18_3
  // Full HTML render is reserved for explicit page/filter/search actions.
""",
        1
    )
    ui=ui[:render_start]+render_block+ui[render_end:]
    print("[apply] document full-render contract")
else:
    print("[skip] full-render contract already present")


# Cache bust.
html=load("system-tokens.html")
html,count=re.subn(
    r'(/system-tokens\.js\?v=)[^"\']+',
    r'\1no-rerender-v18-3-20260827',
    html,
    count=1
)
if count!=1:
    raise SystemExit("[error] system-tokens.js cache-buster not found")


# Update existing cache assertion.
rt=load("tests/realtime-update-path.mjs")
rt=rt.replace(
    r"assert.match(tokenHtml,/system-tokens\.js\?v=per-mint-batch-v18-20260827/);",
    r"assert.match(tokenHtml,/system-tokens\.js\?v=no-rerender-v18-3-20260827/);"
)

if "MEMEFLOW_KEYED_CARD_RECONCILE_TEST_V18_3" not in rt:
    marker="""assert.match(tokenUi,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);
"""
    extra="""assert.match(tokenUi,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);

// MEMEFLOW_KEYED_CARD_RECONCILE_TEST_V18_3
assert.match(tokenUi,/MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/);
assert.match(tokenUi,/MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3/);
assert.match(tokenUi,/list\\.append\\(card\\)/);

const structureV183=tokenUi.slice(
  tokenUi.indexOf('async function __mfLoadStructureV18(){'),
  tokenUi.indexOf('async function loadTokens(){')
);

assert.doesNotMatch(
  structureV183,
  /\\brender\\(\\);/
);

const oneSecondV183=tokenUi.slice(
  tokenUi.indexOf('async function loadTokens(){'),
  tokenUi.indexOf("document\\n  .querySelectorAll(\\n    '.summary-card'")
);

assert.doesNotMatch(
  oneSecondV183,
  /tokenList['"]?\\)?\\.innerHTML/
);
assert.doesNotMatch(
  oneSecondV183,
  /\\brender\\(\\);/
);
"""
    if marker not in rt:
        raise SystemExit("[error] realtime test insertion anchor missing")
    rt=rt.replace(marker,extra,1)


v18=load("tests/per-mint-card-refresh-v18.mjs")
v18=v18.replace(
    r"/system-tokens\.js\?v=per-mint-batch-v18-20260827/",
    r"/system-tokens\.js\?v=no-rerender-v18-3-20260827/"
)

if "MEMEFLOW_KEYED_CARD_RECONCILE_V18_3" not in v18:
    marker="""assert.match(ui,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);
"""
    extra="""assert.match(ui,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);
assert.match(ui,/MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/);
assert.match(ui,/MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3/);

const structureNoReload=ui.slice(
  ui.indexOf('async function __mfLoadStructureV18(){'),
  ui.indexOf('async function loadTokens(){')
);

assert.doesNotMatch(
  structureNoReload,
  /\\brender\\(\\);/
);
"""
    if marker not in v18:
        raise SystemExit("[error] V18 test insertion anchor missing")
    v18=v18.replace(marker,extra,1)


save("system-tokens.js",ui)
save("system-tokens.html",html)
save("tests/realtime-update-path.mjs",rt)
save("tests/per-mint-card-refresh-v18.mjs",v18)


# Install-time static invariants.
ui=load("system-tokens.js")

for needle in [
    "MEMEFLOW_KEYED_CARD_RECONCILE_V18_3",
    "MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3",
    "MEMEFLOW_PER_MINT_BATCH_REFRESH_V18",
    "MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18",
    "__MF_CARD_REFRESH_MS_V17=1000",
    "list.append(card)",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] missing: {needle}")

s=ui[
    ui.find("async function __mfLoadStructureV18(){"):
    ui.find("async function loadTokens(){")
]

if re.search(r"\brender\(\);",s):
    raise SystemExit(
        "[verify] background structural refresh still calls destructive render()"
    )

one=ui[
    ui.find("async function loadTokens(){"):
    ui.find("document\n  .querySelectorAll(\n    '.summary-card'")
]

if re.search(r"\brender\(\);",one):
    raise SystemExit(
        "[verify] one-second card path calls destructive render()"
    )

if "tokenList').innerHTML" in one or 'tokenList").innerHTML' in one:
    raise SystemExit(
        "[verify] one-second card path rewrites tokenList innerHTML"
    )

print("[verify] 1s updates are in-place; background structure sync is keyed")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check system-tokens.js
node --check tests/realtime-update-path.mjs
node --check tests/per-mint-card-refresh-v18.mjs

echo "[check] exact realtime tests"
node tests/realtime-update-path.mjs
node tests/per-mint-card-refresh-v18.mjs

echo "[check] related live tests"
node tests/live-market-truth.mjs
node tests/fresh-session-scanner.mjs
node tests/mayhem-hard-block-v17.mjs

echo "[check] FULL npm test"
npm test

echo "[check] benchmark"
npm run benchmark

cd "$TMP"

git diff --check
git diff --stat -- "${FILES[@]}"

git add -- "${FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v18.3 already present"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: keep live token cards mounted during refresh"
  NEW_SHA="$(git rev-parse HEAD)"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

cd "$ROOT"

BACKUP="$ROOT/.memeflow-v18-3-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done

LOCAL_HEAD="$(git rev-parse HEAD)"

git restore --staged --worktree -- "${FILES[@]}" 2>/dev/null || true

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to v18.3"
  else
    git restore --source="$NEW_SHA" --worktree -- "${FILES[@]}"
    echo "[local] synced only v18.3 files"
  fi
else
  git restore --source="$NEW_SHA" --worktree -- "${FILES[@]}"
  echo "[local] synced only v18.3 files"
fi

echo "[local] recovery backup: $BACKUP"

echo
echo "DONE"
echo "- each mounted card remains the SAME DOM node during automatic refresh"
echo "- 1-second data refresh patches mutable values in-place"
echo "- 10-second membership/ranking sync moves/removes/adds keyed mint nodes"
echo "- existing cards are not destroyed/recreated by background sync"
echo "- token name/avatar/Pump.fun identity stays untouched"
echo "- V17 Mayhem hard block and V18 market truth remain intact"
echo "- full npm test + benchmark passed before push"
echo
echo "Frontend only: after DONE, refresh the browser ONCE to load v18.3."
