#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
JS="$APP/memeflow-orbit-v2.js"
CSS="$APP/memeflow-orbit-v2.css"
HTML="$APP/system.html"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW ORBIT V3.1 · REAL THROUGHPUT ==="

test -f "$JS"
test -f "$CSS"
test -f "$HTML"

cp "$JS"   "${JS}.before-v31.${STAMP}.bak"
cp "$CSS"  "${CSS}.before-v31.${STAMP}.bak"
cp "$HTML" "${HTML}.before-v31.${STAMP}.bak"

python3 - "$JS" <<'PY'
from pathlib import Path
import re, sys

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

# ---------------------------------------------------------
# 1. Add real-rate state
# ---------------------------------------------------------
old = """    ambient: []
  };"""

new = """    ambient: [],
    tokenSignature: '',
    flow: {
      lastEvents: null,
      lastTrades: null,
      lastSampleAt: 0,
      lastLiveAt: 0,
      eventsPerSec: 0,
      tradesPerSec: 0,
      rawEventsPerSec: 0,
      rawTradesPerSec: 0,
      calibrated: false
    }
  };"""

if old not in s:
    raise SystemExit("V3 state block not found — nothing changed")

s = s.replace(old, new, 1)

# ---------------------------------------------------------
# 2. Replace V3 API polling with existing live DOM telemetry.
# system.js already updates these counters every 4 seconds.
# ---------------------------------------------------------
pattern = r"""  async function fetchLiveData\(host\)\{.*?\n  \}\n\n  function rebuildParticles\(rows\)\{"""

replacement = r"""  function readCounter(id){
    const el = document.getElementById(id);
    if (!el) return null;
    const raw = String(el.textContent || '').replace(/[^0-9.-]/g,'');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function flowSpeed(){
    const rate = Math.max(
      state.flow.eventsPerSec,
      state.flow.tradesPerSec * 2.4
    );

    if (!state.flow.calibrated) return .42;

    // 10 events/s ≈ normal speed.
    // Log scaling prevents 100+ events/s from becoming visually ridiculous.
    return clamp(
      .38 + Math.log1p(rate) / Math.log(81) * 1.72,
      .38,
      2.35
    );
  }

  function flowIntensity(){
    const rate = Math.max(
      state.flow.eventsPerSec,
      state.flow.tradesPerSec * 1.8
    );

    if (!state.flow.calibrated) return .18;

    return clamp(
      Math.log1p(rate) / Math.log(101),
      .10,
      1
    );
  }

  function parseLiveTokens(){
    const rows = [];

    document.querySelectorAll('#tokenRail .token-card[data-mint]').forEach(card => {
      const mint = String(card.dataset.mint || '').trim();
      if (!mint) return;

      const stateText =
        card.querySelector('.token-state')?.textContent ||
        'WAITING';

      rows.push({
        mint,
        state: stateText
      });
    });

    const signature = rows
      .map(x => `${x.mint}:${normalizeState(x.state)}`)
      .join('|');

    if (signature !== state.tokenSignature){
      state.tokenSignature = signature;
      rebuildParticles(rows);
    }

    return rows;
  }

  function updateRateHUD(host){
    let hud = host.querySelector('.mf-orbit-ratehud');

    if (!hud){
      hud = document.createElement('div');
      hud.className = 'mf-orbit-ratehud';
      hud.innerHTML = `
        <div><span>INGEST</span><b data-mf-rate-events>—</b><small>events/s</small></div>
        <div><span>DECODE</span><b data-mf-rate-trades>—</b><small>trades/s</small></div>
      `;
      host.appendChild(hud);
    }

    const e = hud.querySelector('[data-mf-rate-events]');
    const t = hud.querySelector('[data-mf-rate-trades]');

    if (!state.flow.calibrated){
      e.textContent = '…';
      t.textContent = '…';
      return;
    }

    e.textContent = state.flow.eventsPerSec.toFixed(
      state.flow.eventsPerSec >= 100 ? 0 : 1
    );

    t.textContent = state.flow.tradesPerSec.toFixed(
      state.flow.tradesPerSec >= 100 ? 0 : 1
    );
  }

  function updateBadge(host){
    const badge = host.querySelector('.mf-orbit-v2-badge');
    if (!badge) return;

    const now = performance.now();
    const live =
      state.flow.calibrated &&
      now - state.flow.lastLiveAt < 9000;

    badge.classList.toggle('waiting', !live);

    if (!state.flow.calibrated){
      badge.innerHTML =
        '<i></i><span>CALIBRATING LIVE FLOW</span>';
    } else if (live){
      badge.innerHTML =
        `<i></i><span>LIVE FLOW · ${state.flow.eventsPerSec.toFixed(1)} EVT/S</span>`;
    } else {
      badge.innerHTML =
        '<i></i><span>AWAITING LIVE FLOW</span>';
    }

    updateRateHUD(host);
  }

  function sampleRealThroughput(host){
    const now = performance.now();
    const events = readCounter('eventCount');
    const trades = readCounter('tradeCount');

    parseLiveTokens();

    if (events == null && trades == null){
      updateBadge(host);
      return;
    }

    const f = state.flow;

    if (
      f.lastEvents == null ||
      f.lastTrades == null ||
      !f.lastSampleAt
    ){
      f.lastEvents = events ?? 0;
      f.lastTrades = trades ?? 0;
      f.lastSampleAt = now;
      updateBadge(host);
      return;
    }

    const eventsChanged =
      events != null && events !== f.lastEvents;

    const tradesChanged =
      trades != null && trades !== f.lastTrades;

    // Counters are refreshed by the real system telemetry every ~4s.
    // Only calculate a rate when a new counter snapshot arrives.
    if (eventsChanged || tradesChanged){
      const seconds = Math.max(
        .25,
        (now - f.lastSampleAt) / 1000
      );

      const eventDelta =
        events == null
          ? 0
          : Math.max(0, events - f.lastEvents);

      const tradeDelta =
        trades == null
          ? 0
          : Math.max(0, trades - f.lastTrades);

      const rawEvents = eventDelta / seconds;
      const rawTrades = tradeDelta / seconds;

      f.rawEventsPerSec = rawEvents;
      f.rawTradesPerSec = rawTrades;

      // EMA smooths 4-second snapshots without falsifying the measured rate.
      if (!f.calibrated){
        f.eventsPerSec = rawEvents;
        f.tradesPerSec = rawTrades;
      } else {
        f.eventsPerSec =
          f.eventsPerSec * .58 + rawEvents * .42;

        f.tradesPerSec =
          f.tradesPerSec * .58 + rawTrades * .42;
      }

      f.calibrated = true;
      f.lastEvents = events ?? f.lastEvents;
      f.lastTrades = trades ?? f.lastTrades;
      f.lastSampleAt = now;

      if (eventDelta > 0 || tradeDelta > 0){
        f.lastLiveAt = now;
        state.hasTelemetry = true;
      }
    }

    // If the real counters have stopped changing for > 10 seconds,
    // visually decay to idle instead of pretending data is flowing.
    if (
      f.calibrated &&
      now - f.lastLiveAt > 10000
    ){
      f.eventsPerSec *= .94;
      f.tradesPerSec *= .94;

      if (
        f.eventsPerSec < .05 &&
        f.tradesPerSec < .05
      ){
        f.eventsPerSec = 0;
        f.tradesPerSec = 0;
        state.hasTelemetry =
          document.querySelectorAll(
            '#tokenRail .token-card[data-mint]'
          ).length > 0;
      }
    }

    updateBadge(host);
  }

  function installTelemetrySync(host){
    sampleRealThroughput(host);

    // 250ms observation is cheap: no API call is made here.
    setInterval(
      () => sampleRealThroughput(host),
      250
    );

    const rail = document.getElementById('tokenRail');

    if (rail){
      new MutationObserver(() => {
        parseLiveTokens();
      }).observe(rail,{
        childList:true,
        subtree:true,
        characterData:true
      });
    }
  }

  function rebuildParticles(rows){"""

s2, n = re.subn(pattern, replacement, s, count=1, flags=re.S)

if n != 1:
    raise SystemExit("V3 fetch block not found — nothing changed")

s = s2

# ---------------------------------------------------------
# 3. Real throughput controls token motion speed.
# ---------------------------------------------------------
old = """    const tt = t*.001*p.speed + p.phase;"""
new = """    const tt =
      t * .001 *
      p.speed *
      flowSpeed() +
      p.phase;"""

if old not in s:
    raise SystemExit("particle timing line not found")

s = s.replace(old, new, 1)

# ---------------------------------------------------------
# 4. Replace inbound stream:
# density + travel speed come from actual event rate.
# ---------------------------------------------------------
pattern = r"""  function drawInbound\(ctx,t\)\{.*?\n  \}\n\n  function drawAmbient\(ctx,t\)\{"""

replacement = r"""  function drawInbound(ctx,t){
    const rate = state.flow.eventsPerSec;
    const intensity = flowIntensity();
    const speed = flowSpeed();

    // Packet count follows real throughput.
    // Hard capped for mobile GPU/CPU safety.
    const count = state.flow.calibrated
      ? clamp(Math.round(7 + rate * .32), 7, 34)
      : 8;

    for (let i=0; i<count; i++){
      const q =
        (
          t * .000115 * speed +
          i / count
        ) % 1;

      const spread =
        8 + intensity * 18;

      const pos = bezier(
        ANCHORS.input,
        {
          x:-255,
          y:-18 + Math.sin(i * 1.7) * spread,
          z:28 + Math.cos(i) * 14
        },
        {
          x:-112,
          y:4,
          z:-18
        },
        {
          x:-28,
          y:0,
          z:0
        },
        q
      );

      dot3(
        ctx,
        pos,
        i % 6 === 0 ? COLORS.white : COLORS.neutral,
        .72 + intensity * .48,
        .20 + intensity * .45,
        2 + intensity * 5
      );
    }

    // Decoded trade activity gets its own cyan inner pulse.
    const tradeRate = state.flow.tradesPerSec;
    const tradeCount = state.flow.calibrated
      ? clamp(Math.round(3 + tradeRate * .42), 3, 22)
      : 3;

    for (let i=0; i<tradeCount; i++){
      const a =
        (
          t * .001 *
          (.24 + speed * .22) +
          i / tradeCount
        ) * TAU;

      const r = 64 + (i % 3) * 9;

      dot3(
        ctx,
        {
          x:Math.cos(a) * r,
          y:Math.sin(a * 1.43) * 8,
          z:Math.sin(a) * r
        },
        COLORS.watch,
        .72 + flowIntensity() * .42,
        .26 + flowIntensity() * .48,
        3 + flowIntensity() * 5
      );
    }
  }

  function drawAmbient(ctx,t){"""

s2, n = re.subn(pattern, replacement, s, count=1, flags=re.S)

if n != 1:
    raise SystemExit("drawInbound block not found")

s = s2

# ---------------------------------------------------------
# 5. Ambient idle motion also responds gently to load.
# ---------------------------------------------------------
old = """      const tt = t*.001*p.speed + p.phase;"""
new = """      const tt =
        t * .001 *
        p.speed *
        (.55 + flowSpeed() * .45) +
        p.phase;"""

if old not in s:
    raise SystemExit("ambient timing line not found")

s = s.replace(old, new, 1)

# ---------------------------------------------------------
# 6. Core shows actual throughput instead of generic LIVE DATA.
# ---------------------------------------------------------
old = """    ctx.fillText(
      state.hasTelemetry ? 'LIVE TOKEN FLOW' : 'AWAITING TOKEN FLOW',
      c.x,
      c.y + 12
    );"""

new = """    const flowText =
      state.flow.calibrated
        ? `${state.flow.eventsPerSec.toFixed(1)} EVT/S`
        : 'CALIBRATING';

    ctx.fillText(
      flowText,
      c.x,
      c.y + 12
    );"""

if old not in s:
    raise SystemExit("core flow label not found")

s = s.replace(old, new, 1)

# ---------------------------------------------------------
# 7. Boot uses existing system telemetry instead of duplicate API polling.
# ---------------------------------------------------------
old = """    fetchLiveData(host);
    setInterval(() => fetchLiveData(host), 2500);"""

new = """    installTelemetrySync(host);"""

if old not in s:
    raise SystemExit("V3 boot polling block not found")

s = s.replace(old, new, 1)

old = """      refresh: () => fetchLiveData(host),"""

new = """      refresh: () => sampleRealThroughput(host),"""

if old in s:
    s = s.replace(old, new, 1)

# Version markers
s = s.replace(
    "[MEMEFLOW Orbit V3] installed on",
    "[MEMEFLOW Orbit V3.1 REAL RATE] installed on"
)

s = s.replace(
    "window.__MEMEFLOW_ORBIT_V3__ = true;",
    """window.__MEMEFLOW_ORBIT_V3__ = true;
  window.__MEMEFLOW_ORBIT_V31__ = true;"""
)

p.write_text(s, encoding="utf-8")
print("V3.1 real throughput renderer written")
PY

# ---------------------------------------------------------
# Add compact live-rate HUD styling
# ---------------------------------------------------------
cat >> "$CSS" <<'CSS'

/* MEMEFLOW ORBIT V3.1 · REAL THROUGHPUT HUD */
.mf-orbit-ratehud{
  position:absolute;
  top:13px;
  right:13px;
  z-index:9;
  display:flex;
  gap:7px;
  pointer-events:none;
}

.mf-orbit-ratehud>div{
  min-width:76px;
  padding:7px 8px;
  border:1px solid rgba(130,167,190,.13);
  border-radius:9px;
  background:rgba(4,9,13,.58);
  backdrop-filter:blur(9px);
  -webkit-backdrop-filter:blur(9px);
}

.mf-orbit-ratehud span{
  display:block;
  color:#667b8a;
  font:800 6px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.13em;
}

.mf-orbit-ratehud b{
  display:inline-block;
  margin-top:4px;
  color:#dcecf3;
  font:800 11px/1 system-ui,-apple-system,sans-serif;
  font-variant-numeric:tabular-nums;
}

.mf-orbit-ratehud small{
  margin-left:3px;
  color:#657986;
  font:600 6px/1 system-ui,-apple-system,sans-serif;
}

.mf-orbit-ratehud>div:nth-child(1) b{
  color:#dcecf3;
}

.mf-orbit-ratehud>div:nth-child(2) b{
  color:#62dcf7;
}

@media(max-width:430px){
  .mf-orbit-ratehud{
    top:9px;
    right:9px;
    gap:5px;
  }

  .mf-orbit-ratehud>div{
    min-width:65px;
    padding:6px 7px;
  }

  .mf-orbit-ratehud b{
    font-size:10px;
  }
}
CSS

# ---------------------------------------------------------
# Force browser to load new JS/CSS
# ---------------------------------------------------------
python3 - "$HTML" <<'PY'
from pathlib import Path
import re, sys

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

s = re.sub(
    r'/memeflow-orbit-v2\.css\?v=[^"\']+',
    '/memeflow-orbit-v2.css?v=3.1-real-rate',
    s
)

s = re.sub(
    r'/memeflow-orbit-v2\.js\?v=[^"\']+',
    '/memeflow-orbit-v2.js?v=3.1-real-rate',
    s
)

p.write_text(s, encoding="utf-8")
PY

echo
echo "=== VERIFY ==="
grep -n "3.1 REAL RATE" "$JS" | head -1 || true
grep -n "3.1-real-rate" "$HTML" || true

echo
echo "==============================================="
echo " MEMEFLOW ORBIT V3.1 REAL THROUGHPUT INSTALLED"
echo "==============================================="
echo
echo "Real source:"
echo "  #eventCount  -> discovery.eventsReceived"
echo "  #tradeCount  -> tradeEventsDecoded"
echo "  #tokenRail   -> current live token states"
echo
echo "No extra API polling from Orbit."
echo "Backend logic NOT MODIFIED."
echo "Trading logic NOT MODIFIED."
echo
