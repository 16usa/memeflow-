#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Live scanner + cache repair v10 (v9 runtime contract + regression preservation)"

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
  "memeflow-app/app-server.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/system-tokens.css"
  "memeflow-app/tests/ws-first-preopen-rpc.mjs"
  "memeflow-app/tests/realtime-update-path.mjs"
)

for f in "${PATCH_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

# Never patch/test against the dirty Replit worktree.
# All code changes and tests happen in a clean temporary worktree from origin/main.
echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v10-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v10 made no commit/push."
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

def replace_once(text, old, new, label, required=True):
    if new in text:
        print(f"[skip] {label}: already installed")
        return text
    count = text.count(old)
    if count != 1:
        if required:
            raise SystemExit(f"[error] {label}: expected 1 source match, found {count}")
        print(f"[skip] {label}: source match count={count}")
        return text
    print(f"[apply] {label}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, new, marker, label):
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
    return text[:i] + new + text[j:]


# =============================================================================
# 1) BACKEND STATIC CACHE: never allow stale Live Token States JS/CSS.
# =============================================================================
app = load("app-server.mjs")

old_static = """   const isText=mime.startsWith('text/')||mime.includes('javascript')||mime.includes('json')||mime.includes('svg');
   const isHTML=ext==='.html'||ext==='.htm';
   res.setHeader('content-type',mime);res.setHeader('cache-control',isHTML?'no-store, no-cache, must-revalidate':'public, max-age=3600, stale-while-revalidate=86400');
   if(isHTML){res.setHeader('pragma','no-cache');res.setHeader('expires','0')}
"""

new_static = """   const isText=mime.startsWith('text/')||mime.includes('javascript')||mime.includes('json')||mime.includes('svg');
   const isHTML=ext==='.html'||ext==='.htm';

   // MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1
   // Live Token States must never execute an hour/day-old JS bundle after a
   // deploy. Other versioned/static assets keep the existing fast cache.
   const isLiveTokenAsset=
     url.pathname==='/system-tokens.js' ||
     url.pathname==='/system-tokens.css';
   const noStoreAsset=isHTML||isLiveTokenAsset;

   res.setHeader('content-type',mime);
   res.setHeader(
     'cache-control',
     noStoreAsset
       ? 'no-store, no-cache, must-revalidate'
       : 'public, max-age=3600, stale-while-revalidate=86400'
   );
   if(noStoreAsset){
     res.setHeader('pragma','no-cache');
     res.setHeader('expires','0');
   }
"""

app = replace_once(
    app,
    old_static,
    new_static,
    "Live Token States static no-store"
)


# =============================================================================
# 2) DISCOVERY TRANSPORT STATE + SILENT-SOCKET WATCHDOG.
# =============================================================================
old_discovery_decl = """let discovery={connected:false,url:null,lastEventAt:null,reconnects:0,error:null,lastError:null,startedAt:Date.now()},ws=null,wsTimer=null,wsReconnectAttempt=0;"""

new_discovery_decl = """// MEMEFLOW_DISCOVERY_TRANSPORT_HEALTH_V1
let discovery={
  connected:false,
  subscribed:false,
  url:null,
  connectedAt:null,
  lastMessageAt:null,
  lastEventAt:null,
  lastCreateAt:null,
  lastSubscriptionAt:null,
  reconnects:0,
  staleReconnects:0,
  error:null,
  lastError:null,
  startedAt:Date.now()
},ws=null,wsTimer=null,wsReconnectAttempt=0;

const DISCOVERY_WS_STALE_MS=Math.max(
  20000,
  Number(process.env.DISCOVERY_WS_STALE_MS||45000)
);
const DISCOVERY_WS_WATCHDOG_MS=Math.max(
  5000,
  Number(process.env.DISCOVERY_WS_WATCHDOG_MS||10000)
);

// A WebSocket can remain OPEN while the provider has silently stopped sending
// notifications. Pump is busy enough that 45s without any WS message is stale.
const __mfDiscoveryWsWatchdog=setInterval(()=>{
  if(discovery.connected!==true||!ws)return;

  const last=Number(
    discovery.lastMessageAt ||
    discovery.connectedAt ||
    0
  );

  if(!last||Date.now()-last<=DISCOVERY_WS_STALE_MS)return;

  discovery.staleReconnects=
    Number(discovery.staleReconnects||0)+1;
  discovery.lastError={
    message:'Pump WebSocket stale; forcing reconnect',
    at:Date.now()
  };

  try{ws.close()}catch{}
},DISCOVERY_WS_WATCHDOG_MS);
__mfDiscoveryWsWatchdog.unref?.();"""

app = replace_once(
    app,
    old_discovery_decl,
    new_discovery_decl,
    "discovery transport health + watchdog"
)


# =============================================================================
# 3) DISCOVERY CREATE DETECTION.
#    Decode the official CreateEvent discriminator directly. Do NOT depend on
#    provider-formatted "Instruction: CreateV2" text being present.
# =============================================================================
start = "function startDiscovery(i=0){"
end = "function shadowValidateSettings"

new_discovery = r"""function startDiscovery(i=0){
  // MEMEFLOW_CREATE_EVENT_DISCRIMINATOR_FIRST_V1
  if(process.env.DISCOVERY_ENABLED==='false'||!wsUrls.length){
    discovery.connected=false;
    discovery.subscribed=false;
    discovery.error='SOLANA_WS_URLS not configured';
    return;
  }

  const url=wsUrls[i%wsUrls.length];

  try{
    const socket=new WebSocket(url);
    ws=socket;
    discovery.url=url;

    socket.onopen=()=>{
      if(ws!==socket)return;

      const now=Date.now();
      discovery.connected=true;
      discovery.subscribed=false;
      discovery.connectedAt=now;
      discovery.lastMessageAt=now;
      discovery.error=null;
      wsReconnectAttempt=0;

      socket.send(JSON.stringify({
        jsonrpc:'2.0',
        id:1,
        method:'logsSubscribe',
        params:[
          {mentions:[PUMP]},
          {commitment:process.env.SOLANA_COMMITMENT||'confirmed'}
        ]
      }));
    };

    // WS-first discovery:
    // 1) every Pump notification refreshes transport health;
    // 2) official CreateEvent Program data is authoritative;
    // 3) "Instruction: Create/CreateV2" is only a compatibility hint.
    socket.onmessage=ev=>{
      if(ws!==socket)return;

      try{
        const m=JSON.parse(ev.data);
        discovery.lastMessageAt=Date.now();

        // JSON-RPC subscription acknowledgement.
        if(m?.id===1){
          if(m?.error){
            discovery.subscribed=false;
            discovery.lastError={
              message:'Pump logsSubscribe failed: '+
                String(m?.error?.message||m?.error?.code||'unknown'),
              at:Date.now()
            };
            setTimeout(()=>{try{socket.close()}catch{}},50);
            return;
          }

          if(m?.result!==undefined&&m?.result!==null){
            discovery.subscribed=true;
            discovery.lastSubscriptionAt=Date.now();
          }
          return;
        }

        const sig=m.params?.result?.value?.signature;
        if(!sig)return;

        discMetrics.eventsReceived++;
        discovery.lastEventAt=Date.now();

        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){
          discMetrics.eventsWithoutLogs++;
          discMetrics.eventsFiltered++;
          return;
        }

        let directCreateEvent=null;
        for(const log of logs){
          directCreateEvent=decodePumpCreateEventLog(log);
          if(directCreateEvent)break;
        }

        const instructionCreate=logs.some(
          l=>/Instruction:\s*Create(?:V2|\s+V2|\s*$)/i.test(l)
        );

        if(directCreateEvent){
          discMetrics.createEventDiscriminatorHits=
            Number(discMetrics.createEventDiscriminatorHits||0)+1;
        }
        if(instructionCreate){
          discMetrics.createInstructionLogHints=
            Number(discMetrics.createInstructionLogHints||0)+1;
        }

        // Critical repair: a valid CreateEvent is sufficient by itself.
        const isCreate=Boolean(directCreateEvent)||instructionCreate;

        // MEMEFLOW_FRESH_SESSION_SCANNER_V1

        // CREATE establishes the mint before TradeEvents from the same tx are
        // applied. Unknown global Pump trades still cannot create arbitrary rows.
        if(isCreate){
          try{
            __systemViewEmitV31(
              'create',
              {signature:String(sig||''),ts:Date.now()}
            )
          }catch{}

          discMetrics.createEventsAccepted++;
          discovery.lastCreateAt=Date.now();

          const directToken=__ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );

          // MEMEFLOW_CREATE_DECODE_COVERAGE_V1
          // Preserve explicit CREATE decoder coverage diagnostics. This marker
          // is part of the scanner regression contract and the metric below is
          // operationally useful when a provider changes its log shape.
          discMetrics.createDecodeCoveragePct=
            discMetrics.createEventsAccepted>0
              ? Number(
                  (
                    100*
                    Number(discMetrics.directCreateEvents||0)/
                    Number(discMetrics.createEventsAccepted||1)
                  ).toFixed(2)
                )
              : 100;

          if(!directToken){
            discMetrics.lastDirectCreateDecodeFailedAt=Date.now();
          }
        }

        // Canonical TradeEvent ingestion remains unchanged.
        try{
          __pumpLiveTradeFeed?.ingestLogs?.(
            logs,
            {
              signature:String(sig||''),
              source:'discovery-ws',
              slot:m.params?.result?.context?.slot??null
            }
          );
        }catch{}

        if(!isCreate){
          discMetrics.nonCreateEventsIgnored++;
          discMetrics.eventsFiltered++;
        }
      }catch(error){
        discovery.lastError={
          message:'Pump WebSocket message error: '+
            String(error?.message||error).slice(0,180),
          at:Date.now()
        };
      }
    };

    socket.onerror=e=>{
      if(ws!==socket)return;
      discovery.lastError={
        message:'WebSocket error'+
          (e?.message?': '+e.message:''),
        at:Date.now()
      };
      setTimeout(()=>{try{socket.close()}catch{}},250);
    };

    socket.onclose=()=>{
      // Never let a late close from an old socket take down a newer socket.
      if(ws!==socket)return;

      ws=null;
      discovery.connected=false;
      discovery.subscribed=false;
      discovery.reconnects++;
      wsReconnectAttempt++;

      clearTimeout(wsTimer);
      wsTimer=setTimeout(
        ()=>startDiscovery(i+1),
        Math.min(
          30000,
          1000*2**Math.min(wsReconnectAttempt,5)
        )
      );
    };
  }catch(e){
    discovery.connected=false;
    discovery.subscribed=false;
    discovery.error=e.message;
    clearTimeout(wsTimer);
    wsTimer=setTimeout(()=>startDiscovery(i+1),5000);
  }
}

"""

app = replace_between(
    app,
    start,
    end,
    new_discovery,
    "MEMEFLOW_CREATE_EVENT_DISCRIMINATOR_FIRST_V1",
    "discriminator-first Pump CREATE discovery"
)


# =============================================================================
# 4) DISCOVERY STATUS: expose transport truth, not just socket.open.
# =============================================================================
status_old = """    connected:discovery.connected,
    url:wsHostname,
    wsHostname,
    lastEventAt:discovery.lastEventAt,
    reconnects:discovery.reconnects,
    error:discovery.error,
    lastError:discovery.lastError,
    startedAt:discovery.startedAt,
"""

status_new = """    scannerRuntimeVersion:'live-scanner-v9',
    connected:discovery.connected,
    subscribed:discovery.subscribed===true,
    transportFresh:Boolean(
      discovery.connected===true &&
      discovery.lastMessageAt &&
      Date.now()-Number(discovery.lastMessageAt)<DISCOVERY_WS_STALE_MS
    ),
    url:wsHostname,
    wsHostname,
    connectedAt:discovery.connectedAt,
    lastMessageAt:discovery.lastMessageAt,
    lastEventAt:discovery.lastEventAt,
    lastCreateAt:discovery.lastCreateAt,
    lastSubscriptionAt:discovery.lastSubscriptionAt,
    reconnects:discovery.reconnects,
    staleReconnects:discovery.staleReconnects,
    discoveryWsStaleMs:DISCOVERY_WS_STALE_MS,
    error:discovery.error,
    lastError:discovery.lastError,
    startedAt:discovery.startedAt,
"""

app = replace_once(
    app,
    status_old,
    status_new,
    "discovery status transport diagnostics"
)

save("app-server.mjs", app)


# =============================================================================
# 5) FRONTEND: honest LIVE/SYNCING/IDLE state + visible scanner count.
# =============================================================================
ui = load("system-tokens.js")

status_start = "async function loadDiscoveryStatus() {"
status_end = "async function loadTokens() {"

new_status = r"""async function loadDiscoveryStatus() {
  // MEMEFLOW_SCANNER_STATUS_V9
  const label =
    document.getElementById('discoveryLiveLabel');
  const scanner =
    document.getElementById('scannerStatus');

  if (!label && !scanner) return;

  try {
    const response = await fetch(
      '/api/discovery/status?_=' + Date.now(),
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();

    const connected =
      payload?.connected === true;
    const subscribed =
      payload?.subscribed === true;

    const lastTransportAt =
      Number(
        payload?.lastMessageAt ??
        payload?.lastEventAt ??
        0
      );

    const transportFresh =
      payload?.transportFresh === true ||
      (
        connected &&
        lastTransportAt > 0 &&
        Date.now() - lastTransportAt < 60000
      );

    const live =
      connected &&
      subscribed &&
      transportFresh;

    const mode =
      live
        ? 'LIVE'
        : connected
          ? 'SYNCING'
          : 'IDLE';

    if (label) {
      label.textContent = mode;

      const shell =
        label.closest('.live-status');

      shell?.classList.toggle(
        'is-idle',
        mode === 'IDLE'
      );
      shell?.classList.toggle(
        'is-syncing',
        mode === 'SYNCING'
      );

      label.title =
        [
          'Pump.fun discovery',
          `connected=${connected}`,
          `subscribed=${subscribed}`,
          `fresh=${transportFresh}`,
          `lastMessageAt=${payload?.lastMessageAt ?? 'none'}`,
          `lastCreateAt=${payload?.lastCreateAt ?? 'none'}`
        ].join(' · ');
    }

    if (scanner) {
      const scannerCount =
        Number(payload?.freshScannerTokens);
      const accepted =
        Number(payload?.createEventsAccepted);
      const decoded =
        Number(payload?.directCreateEvents);
      const failed =
        Number(payload?.directCreateDecodeFailed);

      const parts = [
        `Scanner ${
          Number.isFinite(scannerCount)
            ? Math.max(0, scannerCount)
            : '—'
        }`,
        live
          ? 'WS live'
          : connected
            ? 'WS syncing'
            : 'WS offline'
      ];

      if (
        Number.isFinite(accepted) ||
        Number.isFinite(decoded)
      ) {
        parts.push(
          `creates ${
            Number.isFinite(decoded)
              ? Math.max(0, decoded)
              : 0
          }/${
            Number.isFinite(accepted)
              ? Math.max(0, accepted)
              : 0
          }`
        );
      }

      if (
        Number.isFinite(failed) &&
        failed > 0
      ) {
        parts.push(`decode fail ${failed}`);
      }

      if (
        payload?.historyBackfill?.authRequired === true
      ) {
        parts.push('gap sync auth');
      }

      // If files were updated but the plain Node process was not restarted,
      // make that visible instead of pretending the backend is current.
      if (
        payload?.scannerRuntimeVersion !== 'live-scanner-v9'
      ) {
        parts.push('backend old');
      }

      scanner.textContent =
        parts.join(' · ');

      scanner.title =
        `runtime=${payload?.scannerRuntimeVersion || 'unknown'} · ` +
        `registry=${payload?.tokenRegistry?.permanentTokens ?? '—'} · ` +
        `reconnects=${payload?.reconnects ?? 0} · ` +
        `stale reconnects=${payload?.staleReconnects ?? 0}`;
    }
  } catch (error) {
    if (label) {
      label.textContent = 'IDLE';
      label
        .closest('.live-status')
        ?.classList.add('is-idle');
    }

    if (scanner) {
      scanner.textContent =
        'Scanner status unavailable';
    }
  }
}

"""

ui = replace_between(
    ui,
    status_start,
    status_end,
    new_status,
    "MEMEFLOW_SCANNER_STATUS_V9",
    "frontend scanner status"
)


# =============================================================================
# 6) FRONTEND TELEMETRY: use the fields the V8/V9 backend actually returns.
# =============================================================================
telemetry_start = "    const persisted = Number(payload?.persistedTokens);"
telemetry_end = "    $('lastUpdate').textContent = parts.join(' · ');"

if "MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9" in ui:
    print("[skip] live token telemetry: already installed")
else:
    i = ui.find(telemetry_start)
    if i < 0:
        raise SystemExit("[error] live token telemetry start anchor not found")
    j = ui.find(telemetry_end, i)
    if j < 0:
        raise SystemExit("[error] live token telemetry end anchor not found")
    j += len(telemetry_end)

    telemetry = r"""    // MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9
    const scanned = Number(payload?.rawScannerTokens);
    const admitted = Number(payload?.preAdmissionAdmitted);
    const pending = Number(payload?.preAdmissionPending);
    const rejected = Number(payload?.preAdmissionRejected);
    const evalErrors = Number(payload?.evaluationErrors);
    const viewErrors = Number(payload?.viewErrors);

    const parts = [
      `Updated ${new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      )}`
    ];

    if (Number.isFinite(scanned)) {
      parts.push(`scanner ${Math.max(0, scanned)}`);
    }

    if (Number.isFinite(admitted)) {
      parts.push(`admitted ${Math.max(0, admitted)}`);
    }

    if (
      Number.isFinite(pending) &&
      pending > 0
    ) {
      parts.push(`waiting ${Math.max(0, pending)}`);
    }

    if (
      Number.isFinite(rejected) &&
      rejected > 0
    ) {
      parts.push(`blocked ${Math.max(0, rejected)}`);
    }

    if (
      (Number.isFinite(evalErrors) && evalErrors > 0) ||
      (Number.isFinite(viewErrors) && viewErrors > 0)
    ) {
      parts.push(
        `errors ${
          Math.max(0, evalErrors || 0) +
          Math.max(0, viewErrors || 0)
        }`
      );
    }

    $('lastUpdate').textContent =
      parts.join(' · ');"""

    ui = ui[:i] + telemetry + ui[j:]
    print("[apply] live token telemetry")


# =============================================================================
# 7) FRONTEND PERFORMANCE: coalesce event storms to 250ms.
# =============================================================================
if "MEMEFLOW_REALTIME_COALESCE_250MS_V1" in ui:
    print("[skip] realtime coalescing: already installed")
else:
    old_timer = """  }, 80);
}

function __mfConnectTokenStateStream() {"""
    new_timer = """  }, 250); // MEMEFLOW_REALTIME_COALESCE_250MS_V1
}

function __mfConnectTokenStateStream() {"""
    ui = replace_once(
        ui,
        old_timer,
        new_timer,
        "250ms realtime coalescing"
    )

save("system-tokens.js", ui)


# =============================================================================
# 8) HTML: cache-bust JS and expose scanner inventory beside Visible.
# =============================================================================
html = load("system-tokens.html")

if 'id="scannerStatus"' not in html:
    html = replace_once(
        html,
        """        <strong id="visibleCount">0</strong>
""",
        """        <strong id="visibleCount">0</strong>
        <span
          id="scannerStatus"
          class="scanner-status"
          title="Live scanner status"
        >Scanner —</span>
""",
        "scanner status element"
    )
else:
    print("[skip] scanner status element: already installed")

version_pattern = re.compile(
    r'(/system-tokens\.js\?v=)[^"\']+'
)
if "live-scanner-cache-v9-20260827" not in html:
    html2, n = version_pattern.subn(
        r'\1live-scanner-cache-v9-20260827',
        html,
        count=1
    )
    if n != 1:
        raise SystemExit(
            f"[error] system-tokens JS cache-buster: expected 1 script URL, found {n}"
        )
    html = html2
    print("[apply] system-tokens JS cache-buster")
else:
    print("[skip] system-tokens JS cache-buster: already installed")

save("system-tokens.html", html)


# =============================================================================
# 9) CSS: status stays visible on mobile and LIVE is no longer misleading.
# =============================================================================
css = load("system-tokens.css")
css_marker = "MEMEFLOW_SCANNER_STATUS_V9"

if css_marker not in css:
    css += r"""

/* MEMEFLOW_SCANNER_STATUS_V9 */
.hero-counter .scanner-status {
  margin-top: 5px;
  max-width: 190px;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: .025em;
  font-size: 6px;
  line-height: 1.25;
}

.live-status.is-syncing {
  color: var(--yellow);
}

.live-status.is-syncing i {
  background: var(--yellow);
  box-shadow: 0 0 12px rgba(239, 198, 106, .42);
}

.live-status.is-idle {
  color: var(--muted);
}

.live-status.is-idle i {
  background: var(--muted);
  box-shadow: none;
}

@media (max-width: 640px) {
  .hero-counter .scanner-status {
    max-width: 150px;
    font-size: 5px;
  }
}
"""
    print("[apply] scanner status CSS")
else:
    print("[skip] scanner status CSS: already installed")

save("system-tokens.css", css)


# =============================================================================
# 10) REGRESSION TESTS.
# =============================================================================
ws_test = load("tests/ws-first-preopen-rpc.mjs")

if "MEMEFLOW_CREATE_EVENT_DISCRIMINATOR_FIRST_V1" not in ws_test:
    anchor = """assert.doesNotMatch(
  discovery,
  /getTransaction/
);
"""
    extra = """assert.doesNotMatch(
  discovery,
  /getTransaction/
);

// MEMEFLOW_CREATE_EVENT_DISCRIMINATOR_FIRST_V1
// Provider-formatted instruction text is not authoritative. A valid official
// CreateEvent Program-data discriminator must independently establish CREATE.
assert.match(
  discovery,
  /MEMEFLOW_CREATE_EVENT_DISCRIMINATOR_FIRST_V1/
);

assert.match(
  discovery,
  /directCreateEvent=decodePumpCreateEventLog\\(log\\)/
);

assert.match(
  discovery,
  /const isCreate=Boolean\\(directCreateEvent\\)\\|\\|instructionCreate/
);

assert.match(
  discovery,
  /discovery\\.subscribed=true/
);

assert.match(
  app,
  /DISCOVERY_WS_STALE_MS/
);

assert.match(
  app,
  /Pump WebSocket stale; forcing reconnect/
);
"""
    ws_test = replace_once(
        ws_test,
        anchor,
        extra,
        "WS discriminator/watchdog regression"
    )
else:
    print("[skip] WS discriminator/watchdog regression: already installed")

save("tests/ws-first-preopen-rpc.mjs", ws_test)


rt_test = load("tests/realtime-update-path.mjs")

if "MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1" not in rt_test:
    old_decl = """const trades=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
"""
    new_decl = """const trades=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const tokenHtml=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');
"""
    rt_test = replace_once(
        rt_test,
        old_decl,
        new_decl,
        "realtime test HTML fixture"
    )

    anchor = """assert.match(tokenUi,/readyState !== EventSource\\.OPEN/);

console.log('realtime update path v1 ok');"""
    extra = """assert.match(tokenUi,/readyState !== EventSource\\.OPEN/);

// MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1
assert.match(app,/MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1/);
assert.match(app,/url\\.pathname==='\\/system-tokens\\.js'/);
assert.match(app,/url\\.pathname==='\\/system-tokens\\.css'/);
assert.match(tokenHtml,/system-tokens\\.js\\?v=live-scanner-cache-v9-20260827/);
assert.match(tokenHtml,/id="scannerStatus"/);
assert.match(tokenUi,/MEMEFLOW_SCANNER_STATUS_V9/);
assert.match(tokenUi,/MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9/);
assert.match(tokenUi,/MEMEFLOW_REALTIME_COALESCE_250MS_V1/);

console.log('realtime update path v1 ok');"""
    rt_test = replace_once(
        rt_test,
        anchor,
        extra,
        "live cache/scanner frontend regression"
    )
else:
    print("[skip] live cache/scanner frontend regression: already installed")

save("tests/realtime-update-path.mjs", rt_test)


# =============================================================================
# 11) INSTALL-TIME STATIC INVARIANTS.
# =============================================================================
app = load("app-server.mjs")
ui = load("system-tokens.js")
html = load("system-tokens.html")

required_app = [
    "MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1",
    "MEMEFLOW_DISCOVERY_TRANSPORT_HEALTH_V1",
    "MEMEFLOW_CREATE_EVENT_DISCRIMINATOR_FIRST_V1",
    "DISCOVERY_WS_STALE_MS",
    "directCreateEvent=decodePumpCreateEventLog(log)",
    "const isCreate=Boolean(directCreateEvent)||instructionCreate",
    "MEMEFLOW_CREATE_DECODE_COVERAGE_V1",
    "createDecodeCoveragePct",
    "scannerRuntimeVersion:'live-scanner-v9'",
]
for needle in required_app:
    if needle not in app:
        raise SystemExit(f"[verify] app invariant missing: {needle}")

# V8 visibility fix must remain intact.
for needle in [
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE",
    "preAdmissionPending:_pending",
    "preAdmissionRejected:_rejected",
    "preAdmissionHidden:0",
]:
    if needle not in app:
        raise SystemExit(f"[verify] V8 visibility invariant missing: {needle}")

# Trading feed must remain strictly admitted-only.
trade_i = app.find("if(url.pathname==='/api/ai/decisions'")
if trade_i < 0:
    raise SystemExit("[verify] /api/ai/decisions route missing")
if "__mfAdmittedScannerTokensForUser(u.id)" not in app[trade_i:trade_i+8000]:
    raise SystemExit("[verify] trading admission gate disappeared")

for needle in [
    "MEMEFLOW_SCANNER_STATUS_V9",
    "MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9",
    "MEMEFLOW_REALTIME_COALESCE_250MS_V1",
    "backend old",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] UI invariant missing: {needle}")

if "live-scanner-cache-v9-20260827" not in html:
    raise SystemExit("[verify] system-tokens cache-buster missing")
if 'id="scannerStatus"' not in html:
    raise SystemExit("[verify] scannerStatus element missing")

print("[verify] v8 visibility + v9 scanner/cache invariants OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js

echo "[check] focused regressions"
# First run the exact regression that stopped V9 on the user's screenshot.
node tests/fresh-session-scanner.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/realtime-update-path.mjs
node tests/strict-entry-admission.mjs
node tests/live-market-truth.mjs

echo "[check] FULL npm test"
npm test

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] scanner/cache repair is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: repair live Pump discovery and disable stale token-flow cache"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

# =============================================================================
# Sync verified files into the active Replit workspace.
# Existing versions are backed up first. Unrelated M / D / ?? files are untouched.
# =============================================================================
cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v10-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for f in "${PATCH_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

LOCAL_HEAD="$(git rev-parse HEAD)"

# Prefer a normal fast-forward so Git status stays sane. Target files were
# backed up, so it is safe to clear old failed-installer residue in those paths.
if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  git restore --staged --worktree -- "${PATCH_FILES[@]}" 2>/dev/null || true

  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified scanner/cache repair"
  else
    echo "[local] fast-forward blocked by unrelated dirty files; syncing only repair files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only repair files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- stale system-tokens.js/system-tokens.css caching disabled"
echo "- JS URL cache-busted"
echo "- CreateEvent discriminator is authoritative; instruction text is fallback only"
echo "- silent/stale Pump WebSockets auto-reconnect"
echo "- LIVE now means subscribed + receiving fresh WS traffic"
echo "- Scanner count/create decode health is visible on the page"
echo "- PENDING/REJECTED visibility from V8 is preserved"
echo "- BUY READY/execution remains strictly Entry-admitted"
echo "- full npm test passed BEFORE push"
echo
echo "IMPORTANT: because app-server.mjs runs under plain 'node app-server.mjs',"
echo "do one Replit Stop -> Run after this script finishes so the running process"
echo "loads the verified v9 backend."
