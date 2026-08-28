#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Stable 3-second token flow refresh v15"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

PATCH_FILES=(
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/tests/realtime-update-path.mjs"
)

for f in "${PATCH_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v15-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true

  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v15 made no commit/push."
    echo "[FAILED] existing Replit M / D / ?? files were not touched."
  fi

  exit "$code"
}
trap cleanup EXIT

echo "[worktree] clean origin/main -> $TMP"
git worktree add --detach "$TMP" origin/main >/dev/null
cd "$TMP"

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

def load(rel):
    return (APP / rel).read_text()

def save(rel, text):
    (APP / rel).write_text(text)

def replace_once(text, old, new, marker, label):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text

    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"[error] {label}: expected exactly 1 source match, found {count}"
        )

    print(f"[apply] {label}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, replacement, marker, label):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text

    i = text.find(start)
    if i < 0:
        raise SystemExit(f"[error] {label}: start anchor not found")

    j = text.find(end, i + len(start))
    if j < 0:
        raise SystemExit(f"[error] {label}: end anchor not found")

    print(f"[apply] {label}")
    return text[:i] + replacement + text[j:]


# ===========================================================================
# FRONTEND
# ===========================================================================
ui = load("system-tokens.js")


# ---------------------------------------------------------------------------
# 1) Independent position request state.
# Open positions must keep refreshing even if the main token-feed request is
# slow or temporarily fails.
# ---------------------------------------------------------------------------
old_state = """  loading: false,
  emptyResponses: 0,
  refreshPending: false,

  // MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13
"""

new_state = """  loading: false,
  emptyResponses: 0,
  refreshPending: false,

  // MEMEFLOW_STABLE_POLL_POSITION_STATE_V15
  positionLoading: false,

  // MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13
"""

ui = replace_once(
    ui,
    old_state,
    new_state,
    "MEMEFLOW_STABLE_POLL_POSITION_STATE_V15",
    "independent open-position request state"
)


# ---------------------------------------------------------------------------
# 2) Do not queue an immediate second full refresh when one 3s poll overlaps.
# The next fixed 3s tick is enough and prevents bursty back-to-back refreshes.
# ---------------------------------------------------------------------------
old_loading = """  if (state.loading) {
    state.refreshPending = true;
    return;
  }

  state.loading = true;
  state.refreshPending = false;
"""

new_loading = """  // MEMEFLOW_NO_BACK_TO_BACK_REFRESH_V15
  if (state.loading) {
    return;
  }

  state.loading = true;
  state.refreshPending = false;
"""

ui = replace_once(
    ui,
    old_loading,
    new_loading,
    "MEMEFLOW_NO_BACK_TO_BACK_REFRESH_V15",
    "remove back-to-back refresh queue"
)

old_finally = """  } finally {
    state.loading = false;
    if (state.refreshPending) {
      state.refreshPending = false;
      queueMicrotask(loadTokens);
    }
  }
}
"""

new_finally = """  } finally {
    state.loading = false;
    state.refreshPending = false;
  }
}
"""

ui = replace_once(
    ui,
    old_finally,
    new_finally,
    "state.refreshPending = false;\n  }\n}\n",
    "remove immediate queued retry"
)


# ---------------------------------------------------------------------------
# 3) Independent Open Position loader.
# ---------------------------------------------------------------------------
insert_anchor = "async function loadTokens() {"

position_loader = r"""// MEMEFLOW_OPEN_POSITION_FIXED_POLL_V15
let __mfLastRealtimeRevision = 0;

async function loadOpenPositionsV15({
  renderAfter = true
} = {}) {
  if (state.positionLoading) {
    return;
  }

  state.positionLoading = true;

  try {
    const response = await fetch(
      '/api/paper/positions?_=' + Date.now(),
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();

    state.positions =
      (
        Array.isArray(payload?.positions)
          ? payload.positions
          : []
      ).filter(
        position =>
          position?.mint &&
          String(position?.status || '').toUpperCase() === 'OPEN'
      );

    if (renderAfter) {
      render();
    }
  } catch (error) {
    console.warn(
      '[token-flow] open-position 3s refresh failed; keeping last snapshot',
      error
    );
  } finally {
    state.positionLoading = false;
  }
}


"""

if "MEMEFLOW_OPEN_POSITION_FIXED_POLL_V15" not in ui:
    i = ui.find(insert_anchor)
    if i < 0:
        raise SystemExit("[error] open-position loader insert anchor not found")

    ui = ui[:i] + position_loader + ui[i:]
    print("[apply] independent 3s Open Position loader")
else:
    print("[skip] independent 3s Open Position loader: already installed")


# ---------------------------------------------------------------------------
# 4) Remove the duplicate positions fetch from loadTokens().
# Token feed and positions are now fetched independently in parallel.
# ---------------------------------------------------------------------------
positions_start = """    try {
      const positionsResponse = await fetch(
        '/api/paper/positions?_=' + Date.now(),
"""

telemetry_marker = "    // MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9"

if "MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15" not in ui:
    i = ui.find(positions_start)
    if i < 0:
        raise SystemExit("[error] embedded positions fetch start not found")

    j = ui.find(telemetry_marker, i)
    if j < 0:
        raise SystemExit("[error] telemetry marker after positions fetch not found")

    ui = (
        ui[:i] +
        "    // MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15\n"
        "    // Open positions refresh independently on the same fixed 3s cadence.\n\n" +
        ui[j:]
    )
    print("[apply] decouple positions from token-feed request")
else:
    print("[skip] decouple positions from token-feed request: already installed")


# ---------------------------------------------------------------------------
# 5) Manual Refresh and initial load use the same unified fixed-cadence action.
# ---------------------------------------------------------------------------
old_refresh_handler = """$('refreshButton')
  .addEventListener(
    'click',
    loadTokens
  );

loadTokens();
"""

new_refresh_handler = """$('refreshButton')
  .addEventListener(
    'click',
    __mfPollAllV15
  );

__mfPollAllV15();
"""

ui = replace_once(
    ui,
    old_refresh_handler,
    new_refresh_handler,
    "__mfPollAllV15();",
    "unified manual/initial refresh"
)


# ---------------------------------------------------------------------------
# 6) Replace event-burst UI updates with one predictable 3-second cadence.
#
# WHY:
# V14 disabled the 3s poll whenever EventSource was OPEN and relied on very fast
# per-mint events. That explains both observed symptoms:
#   - cards update too rapidly immediately after page load;
#   - after those events stop/miss, cards appear frozen until the 30s reconcile;
#   - Open Position telemetry only refreshed when that mint emitted an event.
#
# V15 deliberately returns the UI to a simple fixed 3s truth refresh.
# ---------------------------------------------------------------------------
rt_start = "/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V14"
rt_end = "/* ===== LIVE TOKEN METADATA V16 ===== */"

new_rt = r"""/* MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15
 * Stable UI contract:
 *
 * - one full token-feed refresh every 3 seconds;
 * - one independent Open Position refresh every 3 seconds;
 * - no event-burst rendering on this page;
 * - no SSE-open condition that can silently disable polling;
 * - no 30-second freeze window.
 *
 * Backend scanning/trading remains event-driven. This changes ONLY the browser
 * presentation cadence, exactly as intended for this page.
 */

let __mfFixedPollTimerV15 = null;

function __mfPollAllV15() {
  if (document.hidden) {
    return;
  }

  // Run independently/in parallel. A token-feed failure cannot freeze OPEN
  // POSITION telemetry, and a positions failure cannot freeze scanner cards.
  void loadTokens();
  void loadOpenPositionsV15();
}

__mfFixedPollTimerV15 =
  setInterval(
    __mfPollAllV15,
    REFRESH_MS
  );

document.addEventListener(
  'visibilitychange',
  () => {
    if (!document.hidden) {
      __mfPollAllV15();
    }
  }
);

window.addEventListener(
  'beforeunload',
  () => {
    if (__mfFixedPollTimerV15 !== null) {
      clearInterval(__mfFixedPollTimerV15);
    }
  },
  { once: true }
);



"""

ui = replace_between(
    ui,
    rt_start,
    rt_end,
    new_rt,
    "MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15",
    "restore stable fixed 3-second card refresh"
)

save("system-tokens.js", ui)


# ===========================================================================
# CACHE BUSTER
# ===========================================================================
html = load("system-tokens.html")

if "stable-poll-v15-20260827" not in html:
    html2, count = re.subn(
        r'(/system-tokens\.js\?v=)[^"\']+',
        r'\1stable-poll-v15-20260827',
        html,
        count=1
    )

    if count != 1:
        raise SystemExit(
            f"[error] cache-buster: expected one system-tokens.js URL, found {count}"
        )

    html = html2
    print("[apply] v15 system-tokens.js cache-buster")
else:
    print("[skip] v15 system-tokens.js cache-buster")

save("system-tokens.html", html)


# ===========================================================================
# REGRESSION TEST
# ===========================================================================
test = load("tests/realtime-update-path.mjs")

section_start = """// Live Token States must be event-driven, and a token mutation must invalidate
// any per-user response cached before that mutation.
"""

section_end = "// MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1"

new_section = r"""// MEMEFLOW_STABLE_3S_UI_REFRESH_TEST_V15
// Backend market/scanner state stays event-driven, but this browser page has a
// deliberate fixed 3-second presentation cadence. EventSource must not disable
// or burst the visible-card refresh loop.
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');

assert.match(app,/let __mfLiveTokenRevision=0;/);
assert.match(app,/const __liveRevision=\+\+__mfLiveTokenRevision;/);
assert.match(app,/revision:__liveRevision/);
assert.match(app,/Number\(_cached\.liveRevision\|\|0\)===__mfLiveTokenRevision/);
assert.match(app,/liveRevision:__mfLiveTokenRevision/);

assert.match(tokenUi,/const REFRESH_MS = 3000;/);
assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15/);
assert.match(tokenUi,/MEMEFLOW_OPEN_POSITION_FIXED_POLL_V15/);
assert.match(tokenUi,/MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15/);
assert.match(tokenUi,/setInterval\([\s\S]*?__mfPollAllV15,[\s\S]*?REFRESH_MS/);
assert.match(tokenUi,/void loadTokens\(\)/);
assert.match(tokenUi,/void loadOpenPositionsV15\(\)/);
assert.match(tokenUi,/\/api\/paper\/positions/);
assert.match(tokenUi,/state\.positionLoading/);
assert.doesNotMatch(tokenUi,/new EventSource\('\/api\/system\/stream'\)/);
assert.doesNotMatch(tokenUi,/MINT_REFRESH_COALESCE_MS_V14/);
assert.doesNotMatch(tokenUi,/LIVE_RECONCILE_MS_V14 = 30000/);
assert.doesNotMatch(tokenUi,/queueMicrotask\(loadTokens\)/);

"""

test = replace_between(
    test,
    section_start,
    section_end,
    new_section,
    "MEMEFLOW_STABLE_3S_UI_REFRESH_TEST_V15",
    "stable 3-second UI regression contract"
)

old_cache = """assert.match(tokenHtml,/system-tokens\\.js\\?v=realtime-card-v14-20260827/);"""
new_cache = """assert.match(tokenHtml,/system-tokens\\.js\\?v=stable-poll-v15-20260827/);"""

if old_cache in test:
    test = test.replace(old_cache, new_cache, 1)
    print("[apply] test cache-buster -> v15")
elif new_cache in test:
    print("[skip] test cache-buster -> v15")
else:
    raise SystemExit("[error] v14 cache-buster assertion not found")

old_coalesce = """assert.match(tokenUi,/MINT_REFRESH_COALESCE_MS_V14 = 80/);"""
if old_coalesce in test:
    test = test.replace(
        old_coalesce,
        """assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15/);""",
        1
    )
    print("[apply] remove obsolete v14 per-mint coalesce assertion")

save("tests/realtime-update-path.mjs", test)


# ===========================================================================
# STATIC INSTALL-TIME INVARIANTS
# ===========================================================================
ui = load("system-tokens.js")
html = load("system-tokens.html")

for needle in [
    "const REFRESH_MS = 3000;",
    "MEMEFLOW_SYSTEM_TOKENS_FIXED_POLL_V15",
    "MEMEFLOW_OPEN_POSITION_FIXED_POLL_V15",
    "MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15",
    "void loadTokens();",
    "void loadOpenPositionsV15();",
    "setInterval(",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] UI invariant missing: {needle}")

for forbidden in [
    "new EventSource('/api/system/stream')",
    "MINT_REFRESH_COALESCE_MS_V14",
    "LIVE_RECONCILE_MS_V14 = 30000",
    "queueMicrotask(loadTokens)",
]:
    if forbidden in ui:
        raise SystemExit(f"[verify] obsolete burst/freeze path remains: {forbidden}")

if "stable-poll-v15-20260827" not in html:
    raise SystemExit("[verify] v15 frontend cache-buster missing")

print("[verify] fixed 3s cards + independent Open Position polling OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check system-tokens.js

echo "[check] exact regression FIRST"
node tests/realtime-update-path.mjs

echo "[check] related regressions"
node tests/live-market-truth.mjs
node tests/feed-ranking.mjs
node tests/fresh-session-scanner.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/strict-entry-admission.mjs

echo "[check] FULL npm test"
npm test

echo "[check] benchmark"
npm run benchmark

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v15 is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: restore stable 3-second token card refresh"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

# ===========================================================================
# Sync verified files into the active Replit workspace.
# ===========================================================================
cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v15-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for f in "${PATCH_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

LOCAL_HEAD="$(git rev-parse HEAD)"

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  git restore --staged --worktree -- "${PATCH_FILES[@]}" 2>/dev/null || true

  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified v15"
  else
    echo "[local] fast-forward blocked; syncing only v15 files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only v15 files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- visible token cards refresh on one fixed 3-second cadence"
echo "- no 80ms/120ms event-burst card rendering"
echo "- SSE-open state can no longer disable the 3-second refresh"
echo "- no 30-second healthy-SSE freeze window"
echo "- Open Position data refreshes independently every 3 seconds"
echo "- token-feed and Open Position requests run independently/in parallel"
echo "- backend scanner/trading event processing is unchanged"
echo "- full npm test AND benchmark passed before push"
echo
echo "This patch changes frontend files only. After DONE, a normal browser refresh"
echo "is enough; a Replit Stop -> Run is not required."
