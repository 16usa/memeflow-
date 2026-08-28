#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-memeflow-app}"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p ".realtime-fix-backup-$STAMP"
cp app-server.mjs system-tokens.js system-tokens.html tests/realtime-update-path.mjs ".realtime-fix-backup-$STAMP/"

python3 - <<'PY'
from pathlib import Path

def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if new in s:
        print(f"[skip] {label}: already patched")
        return
    if old not in s:
        raise SystemExit(f"[fail] {label}: anchor not found in {path}")
    p.write_text(s.replace(old, new, 1))
    print(f"[ok] {label}")

# 1) Backend: monotonic live revision invalidates per-user response caches
# immediately when canonical token state changes.
replace_once(
    "app-server.mjs",
    "const __mfLiveStatesResponseCache=new Map();\nconst __mfYieldToEventLoop=()=>new Promise(resolve=>setImmediate(resolve));",
    "const __mfLiveStatesResponseCache=new Map();\n"
    "// MEMEFLOW_LIVE_TOKEN_REVISION_V1 — every canonical token mutation advances\n"
    "// the revision so the event-driven UI can never receive a cached pre-event snapshot.\n"
    "let __mfLiveTokenRevision=0;\n"
    "const __mfYieldToEventLoop=()=>new Promise(resolve=>setImmediate(resolve));",
    "backend live revision declaration"
)

replace_once(
    "app-server.mjs",
    "function publish(mint){\n  // V4 System View: actual backend publish cadence drives the 3D/token-flow impulse.",
    "function publish(mint){\n"
    "  // MEMEFLOW_LIVE_TOKEN_REVISION_V1\n"
    "  // publish() is called only after canonical token state is updated. Advancing\n"
    "  // this revision makes every following per-user snapshot cache-aware.\n"
    "  const __liveRevision=++__mfLiveTokenRevision;\n"
    "  // V4 System View: actual backend publish cadence drives the 3D/token-flow impulse.",
    "backend revision increment"
)

replace_once(
    "app-server.mjs",
    "     mint:String(mint||''),\n     updatedAt:Number(__v31t?.updatedAt||Date.now())",
    "     mint:String(mint||''),\n"
    "     revision:__liveRevision,\n"
    "     updatedAt:Number(__v31t?.updatedAt||Date.now())",
    "SSE token revision payload"
)

replace_once(
    "app-server.mjs",
    "    Date.now()-Number(_cached.at||0)<=__mfLiveStatesResponseCacheMs &&\n"
    "    Number(_cached.settingsVersion||0)===_settingsVersion",
    "    Date.now()-Number(_cached.at||0)<=__mfLiveStatesResponseCacheMs &&\n"
    "    Number(_cached.settingsVersion||0)===_settingsVersion &&\n"
    "    Number(_cached.liveRevision||0)===__mfLiveTokenRevision",
    "live-state cache revision guard"
)

replace_once(
    "app-server.mjs",
    "  __mfLiveStatesResponseCache.set(_cacheKey,{\n"
    "    at:Date.now(),\n"
    "    settingsVersion:_settingsVersion,\n"
    "    payload:_payload\n"
    "  });",
    "  __mfLiveStatesResponseCache.set(_cacheKey,{\n"
    "    at:Date.now(),\n"
    "    settingsVersion:_settingsVersion,\n"
    "    liveRevision:__mfLiveTokenRevision,\n"
    "    payload:_payload\n"
    "  });",
    "live-state cache stores revision"
)

# 2) Frontend: never lose an event that arrives while a full snapshot is loading.
replace_once(
    "system-tokens.js",
    "  loading: false,\n  emptyResponses: 0\n};",
    "  loading: false,\n"
    "  emptyResponses: 0,\n"
    "  refreshPending: false\n"
    "};",
    "frontend pending-refresh state"
)

replace_once(
    "system-tokens.js",
    "  if (state.loading) {\n"
    "    return;\n"
    "  }\n\n"
    "  state.loading = true;",
    "  if (state.loading) {\n"
    "    state.refreshPending = true;\n"
    "    return;\n"
    "  }\n\n"
    "  state.loading = true;\n"
    "  state.refreshPending = false;",
    "frontend coalesced refresh while loading"
)

replace_once(
    "system-tokens.js",
    "  } finally {\n"
    "    state.loading = false;\n"
    "  }\n"
    "}",
    "  } finally {\n"
    "    state.loading = false;\n"
    "    if (state.refreshPending) {\n"
    "      state.refreshPending = false;\n"
    "      queueMicrotask(loadTokens);\n"
    "    }\n"
    "  }\n"
    "}",
    "frontend replay pending refresh"
)

old_poll = """loadTokens();

setInterval(
  loadTokens,
  REFRESH_MS
);
"""

new_stream = """loadTokens();

/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V1
 * /api/system/stream is the single live change trigger.
 * Every CREATE/TOKEN/REMOVE event immediately reloads one canonical per-user
 * snapshot, so price, MC, holders, volume, tx count, 5m move, decision state,
 * score/reasons and open-position telemetry move together. The old 3s timer is
 * retained ONLY as a disconnected-stream safety net.
 */
let __mfTokenStateStream = null;
let __mfRealtimeRefreshTimer = null;
let __mfLastRealtimeRevision = 0;

function __mfScheduleRealtimeRefresh(event = null) {
  if (event?.data) {
    try {
      const payload = JSON.parse(event.data);
      const revision = Number(payload?.revision || 0);
      if (revision > 0) {
        if (revision <= __mfLastRealtimeRevision) return;
        __mfLastRealtimeRevision = revision;
      }
    } catch {}
  }

  if (__mfRealtimeRefreshTimer !== null) return;

  __mfRealtimeRefreshTimer = setTimeout(() => {
    __mfRealtimeRefreshTimer = null;
    void loadTokens();
  }, 80);
}

function __mfConnectTokenStateStream() {
  if (typeof EventSource === 'undefined') return;

  try { __mfTokenStateStream?.close?.(); } catch {}

  const source = new EventSource('/api/system/stream');
  __mfTokenStateStream = source;

  source.addEventListener('hello', __mfScheduleRealtimeRefresh);
  source.addEventListener('create', __mfScheduleRealtimeRefresh);
  source.addEventListener('token', __mfScheduleRealtimeRefresh);
  source.addEventListener('token_removed', __mfScheduleRealtimeRefresh);

  source.onopen = () => {
    __mfScheduleRealtimeRefresh();
  };
}

__mfConnectTokenStateStream();

setInterval(() => {
  if (
    !__mfTokenStateStream ||
    typeof EventSource === 'undefined' ||
    __mfTokenStateStream.readyState !== EventSource.OPEN
  ) {
    void loadTokens();
  }
}, REFRESH_MS);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    __mfScheduleRealtimeRefresh();
  }
});

window.addEventListener('beforeunload', () => {
  if (__mfRealtimeRefreshTimer !== null) {
    clearTimeout(__mfRealtimeRefreshTimer);
  }
  try { __mfTokenStateStream?.close?.(); } catch {}
}, { once: true });
"""

replace_once(
    "system-tokens.js",
    old_poll,
    new_stream,
    "replace unconditional 3s polling with SSE-driven full snapshot refresh"
)

# 3) Cache-bust browser asset.
replace_once(
    "system-tokens.html",
    'src="/system-tokens.js?v=dex-paid-entry-v1"',
    'src="/system-tokens.js?v=realtime-all-fields-v1-20260826"',
    "system-tokens.js cache buster"
)

# 4) Guardrail tests: realtime trigger + cache revision + no lost in-flight event.
p = Path("tests/realtime-update-path.mjs")
s = p.read_text()
marker = "console.log('realtime update path v1 ok');"
test_block = r"""
// Live Token States must be event-driven, and a token mutation must invalidate
// any per-user response cached before that mutation.
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
assert.match(app,/let __mfLiveTokenRevision=0;/);
assert.match(app,/const __liveRevision=\+\+__mfLiveTokenRevision;/);
assert.match(app,/revision:__liveRevision/);
assert.match(app,/Number\(_cached\.liveRevision\|\|0\)===__mfLiveTokenRevision/);
assert.match(app,/liveRevision:__mfLiveTokenRevision/);
assert.match(tokenUi,/new EventSource\('\/api\/system\/stream'\)/);
assert.match(tokenUi,/source\.addEventListener\('token', __mfScheduleRealtimeRefresh\)/);
assert.match(tokenUi,/state\.refreshPending = true;/);
assert.match(tokenUi,/queueMicrotask\(loadTokens\)/);
assert.match(tokenUi,/readyState !== EventSource\.OPEN/);

"""
if "let __mfLiveTokenRevision=0;" not in s:
    if marker not in s:
        raise SystemExit("[fail] test marker not found")
    p.write_text(s.replace(marker, test_block + marker, 1))
    print("[ok] realtime regression assertions")
else:
    print("[skip] realtime regression assertions: already patched")
PY

echo
echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js

echo
echo "[check] focused regression test"
node tests/realtime-update-path.mjs

echo
echo "[check] live-market truth"
node tests/live-market-truth.mjs

echo
echo "[git] diff"
git diff -- app-server.mjs system-tokens.js system-tokens.html tests/realtime-update-path.mjs

echo
echo "[git] commit + push"
git add app-server.mjs system-tokens.js system-tokens.html tests/realtime-update-path.mjs
if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: realtime live token states update all fields"
  git push
fi

echo
echo "DONE: realtime token state updates are event-driven; 3s polling is fallback only."
