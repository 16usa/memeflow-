#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
JS="$APP/memeflow-orbit-v2.js"
CSS="$APP/memeflow-orbit-v2.css"
HTML="$APP/system.html"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW ORBIT V3.2 · AUTHORITATIVE STATES ==="

test -f "$JS"
test -f "$CSS"
test -f "$HTML"

cp "$JS"   "${JS}.before-v32.${STAMP}.bak"
cp "$CSS"  "${CSS}.before-v32.${STAMP}.bak"
cp "$HTML" "${HTML}.before-v32.${STAMP}.bak"

python3 - "$JS" <<'PY'
from pathlib import Path
import re
import sys

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

def replace_regex(pattern, replacement, name):
    global s
    s2, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"ERROR: {name} block not found")
    s = s2

# =========================================================
# 1. Stop reading state from the small Recent Token Flow rail.
#    Read the SAME 200-row authoritative feed as View All.
# =========================================================

replace_regex(
r"""  function parseLiveTokens\(\)\{.*?\n  \}\n\n  function updateRateHUD\(host\)\{""",
r"""  function buildVisualStateSample(rows){
    const groups = {
      WAITING: [],
      WATCH: [],
      BLOCKED: [],
      'BUY READY': []
    };

    for (const row of rows){
      const normalized = normalizeState(
        row?.state ??
        row?.decision?.state ??
        'WAITING'
      );

      if (groups[normalized]){
        groups[normalized].push({
          ...row,
          state: normalized
        });
      }
    }

    /*
      Exact COUNTS remain untouched.
      Only the number of rendered particles is capped for iPhone performance.

      With 191 BLOCKED tokens we don't need 191 glowing meshes;
      36 particles visually communicate a heavy blocked lane while
      the number next to BLOCKED remains the exact 191.
    */
    const limits = {
      'BUY READY': 12,
      WATCH: 14,
      WAITING: 20,
      BLOCKED: 36
    };

    const output = [];

    for (const name of ['BUY READY','WATCH','WAITING','BLOCKED']){
      const group = groups[name];
      const limit = limits[name];

      if (group.length <= limit){
        output.push(...group);
        continue;
      }

      const step = group.length / limit;

      for (let i=0; i<limit; i++){
        output.push(
          group[Math.floor(i * step)]
        );
      }
    }

    return output;
  }

  async function syncAuthoritativeStates(host){
    try{
      const response = await fetch(
        '/api/ai/decisions?scope=all&limit=200',
        {
          cache:'no-store',
          credentials:'same-origin',
          headers:{accept:'application/json'}
        }
      );

      if (!response.ok){
        throw new Error(
          'decision feed HTTP ' + response.status
        );
      }

      const payload = await response.json();

      const rows =
        Array.isArray(payload?.decisions)
          ? payload.decisions
          : [];

      const counts = {
        WAITING:0,
        WATCH:0,
        BLOCKED:0,
        'BUY READY':0,
        TRADING:0,
        TOTAL:rows.length
      };

      for (const row of rows){
        const normalized = normalizeState(
          row?.state ??
          row?.decision?.state ??
          'WAITING'
        );

        if (normalized === 'WAITING'){
          counts.WAITING++;
        } else if (normalized === 'WATCH'){
          counts.WATCH++;
        } else if (normalized === 'BLOCKED'){
          counts.BLOCKED++;
        } else if (normalized === 'BUY READY'){
          counts['BUY READY']++;
        }
      }

      state.counts = counts;

      const visualRows =
        buildVisualStateSample(rows);

      const signature = [
        counts.TOTAL,
        counts.WAITING,
        counts.WATCH,
        counts.BLOCKED,
        counts['BUY READY'],
        ...visualRows.map(
          row =>
            String(
              row?.mint ??
              row?.id ??
              ''
            ) +
            ':' +
            normalizeState(
              row?.state ??
              row?.decision?.state
            )
        )
      ].join('|');

      if (signature !== state.tokenSignature){
        state.tokenSignature = signature;
        rebuildParticles(visualRows);
      }

      /*
        State telemetry can exist even during a quiet event interval.
        Throughput live/idle status is handled separately.
      */
      if (rows.length > 0){
        state.hasTelemetry = true;
      }

      updateBadge(host);

    }catch(error){
      console.warn(
        '[MEMEFLOW Orbit V3.2] decision snapshot failed',
        error
      );
    }
  }

  function updateRateHUD(host){""",
"parseLiveTokens"
)

# =========================================================
# 2. HUD numbers = RAW measured rate.
#    Animation still uses smoothed rate to avoid jerky movement.
# =========================================================

s = s.replace(
"""    e.textContent = state.flow.eventsPerSec.toFixed(
      state.flow.eventsPerSec >= 100 ? 0 : 1
    );

    t.textContent = state.flow.tradesPerSec.toFixed(
      state.flow.tradesPerSec >= 100 ? 0 : 1
    );""",
"""    const exactEvents =
      state.flow.rawEventsPerSec;

    const exactTrades =
      state.flow.rawTradesPerSec;

    e.textContent = exactEvents.toFixed(
      exactEvents >= 100 ? 0 : 1
    );

    t.textContent = exactTrades.toFixed(
      exactTrades >= 100 ? 0 : 1
    );"""
)

# =========================================================
# 3. Bottom LIVE badge no longer repeats rate.
# =========================================================

s = s.replace(
"""      badge.innerHTML =
        `<i></i><span>LIVE FLOW · ${state.flow.eventsPerSec.toFixed(1)} EVT/S</span>`;""",
"""      badge.innerHTML =
        '<i></i><span>LIVE DATA FLOW</span>';"""
)

# =========================================================
# 4. Don't read token rail during throughput sampling.
# =========================================================

s = s.replace(
"""    parseLiveTokens();

    if (events == null && trades == null){""",
"""    if (events == null && trades == null){"""
)

# =========================================================
# 5. Quiet throughput must NOT delete valid decision state.
# =========================================================

s = s.replace(
"""        state.hasTelemetry =
          document.querySelectorAll(
            '#tokenRail .token-card[data-mint]'
          ).length > 0;""",
"""        state.hasTelemetry =
          state.counts.TOTAL > 0;"""
)

# =========================================================
# 6. Install:
#    - throughput observer: 250ms, NO API request
#    - state snapshot: same server-authoritative feed every 3s
# =========================================================

replace_regex(
r"""  function installTelemetrySync\(host\)\{.*?\n  \}\n\n  function rebuildParticles""",
r"""  function installTelemetrySync(host){
    sampleRealThroughput(host);
    syncAuthoritativeStates(host);

    /*
      Reads DOM counters only.
      No request every 250ms.
    */
    setInterval(
      () => sampleRealThroughput(host),
      250
    );

    /*
      Exact state snapshot.
      Same cadence and source used by the View All token page.
    */
    setInterval(
      () => syncAuthoritativeStates(host),
      3000
    );
  }

  function rebuildParticles""",
"installTelemetrySync"
)

# =========================================================
# 7. Zero-state labels become quiet instead of giant signals.
# =========================================================

replace_regex(
r"""  function drawAnchor\(ctx,p,label,count,color\)\{.*?\n  \}\n\n  function drawCore""",
r"""  function drawAnchor(ctx,p,label,count,color){
    const P = project(p);

    const active =
      Number(count || 0) > 0;

    const alpha =
      active ? .94 : .23;

    const dotSize =
      active ? 3.9 : 2.0;

    ctx.save();

    if (active){
      ctx.shadowBlur = 13;
      ctx.shadowColor = rgba(color,.34);
    }

    ctx.beginPath();
    ctx.arc(
      P.x,
      P.y,
      dotSize * P.scale,
      0,
      TAU
    );

    ctx.fillStyle =
      rgba(color,alpha);

    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    ctx.font =
      active
        ? '800 8px system-ui,-apple-system,sans-serif'
        : '750 7px system-ui,-apple-system,sans-serif';

    ctx.fillStyle =
      rgba(color,alpha);

    ctx.fillText(
      label,
      P.x,
      P.y - 8
    );

    ctx.textBaseline = 'top';
    ctx.font =
      '700 8px system-ui,-apple-system,sans-serif';

    ctx.fillStyle =
      active
        ? 'rgba(178,193,204,.82)'
        : 'rgba(110,126,138,.31)';

    ctx.fillText(
      String(count || 0),
      P.x,
      P.y + 6
    );
  }

  function drawCore""",
"drawAnchor"
)

# =========================================================
# 8. CORE = processor. Exact speed is already in HUD.
# =========================================================

s = re.sub(
r"""    const flowText =\s*state\.flow\.calibrated\s*\?\s*`\$\{state\.flow\.eventsPerSec\.toFixed$begin:math:text$1$end:math:text$\} EVT/S`\s*:\s*'CALIBRATING';""",
"""    const flowText =
      state.flow.calibrated
        ? 'PROCESSING'
        : 'CALIBRATING';""",
s,
count=1
)

# =========================================================
# 9. Branches only glow if the state actually exists.
# =========================================================

s = s.replace(
"""    pathLine(ctx, {x:-8,y:0,z:0}, {x:-70,y:24,z:30}, {x:-132,y:92,z:26}, ANCHORS.blocked, COLORS.blocked, .12);
    pathLine(ctx, {x:10,y:-2,z:0}, {x:82,y:-8,z:-12}, {x:136,y:-18,z:-8}, ANCHORS.ready, COLORS.ready, .11);
    pathLine(ctx, ANCHORS.ready, {x:220,y:6,z:-10}, {x:253,y:42,z:-20}, ANCHORS.trading, COLORS.trading, .10);""",
"""    if (state.counts.BLOCKED > 0){
      pathLine(
        ctx,
        {x:-8,y:0,z:0},
        {x:-70,y:24,z:30},
        {x:-132,y:92,z:26},
        ANCHORS.blocked,
        COLORS.blocked,
        .15
      );
    }

    if (state.counts['BUY READY'] > 0){
      pathLine(
        ctx,
        {x:10,y:-2,z:0},
        {x:82,y:-8,z:-12},
        {x:136,y:-18,z:-8},
        ANCHORS.ready,
        COLORS.ready,
        .14
      );
    }"""
)

# =========================================================
# 10. Remove fake TRADING output.
#     We will restore it only when we wire a real position source.
# =========================================================

s = re.sub(
r"""\s*drawAnchor\(ctx,\s*ANCHORS\.trading,\s*'TRADING',\s*state\.counts\.TRADING,\s*COLORS\.trading\s*\);""",
"",
s,
count=1
)

# =========================================================
# 11. Better mobile anchor positions.
# =========================================================

s = s.replace(
"""    waiting:  {x:-160,y:-112,z:25},
    watch:    {x:0,y:-140,z:22},
    blocked:  {x:-205,y:135,z:30},
    ready:    {x:180,y:-24,z:-5},
    trading:  {x:288,y:72,z:-20}""",
"""    waiting:  {x:-145,y:-78,z:22},
    watch:    {x:8,y:-108,z:18},
    blocked:  {x:-178,y:104,z:26},
    ready:    {x:166,y:-24,z:-5},
    trading:  {x:288,y:72,z:-20}"""
)

# =========================================================
# 12. Version markers
# =========================================================

s = s.replace(
"[MEMEFLOW Orbit V3.1 REAL RATE] installed on",
"[MEMEFLOW Orbit V3.2 AUTHORITATIVE STATES] installed on"
)

s = s.replace(
"""window.__MEMEFLOW_ORBIT_V31__ = true;""",
"""window.__MEMEFLOW_ORBIT_V31__ = true;
  window.__MEMEFLOW_ORBIT_V32__ = true;"""
)

p.write_text(s, encoding="utf-8")

print("V3.2 authoritative state renderer written")
PY

# Slightly tighten the rate HUD on mobile.
cat >> "$CSS" <<'CSS'

/* MEMEFLOW ORBIT V3.2 */
@media(max-width:430px){
  .mf-orbit-ratehud > div{
    min-width:61px;
  }

  .mf-orbit-ratehud span{
    font-size:5.8px;
  }

  .mf-orbit-ratehud small{
    font-size:5.5px;
  }
}
CSS

# Force Safari/Replit to load V3.2.
python3 - "$HTML" <<'PY'
from pathlib import Path
import re

p = Path("/home/runner/workspace/memeflow-app/system.html")
s = p.read_text(encoding="utf-8")

s = re.sub(
    r'/memeflow-orbit-v2\.css\?v=[^"\']+',
    '/memeflow-orbit-v2.css?v=3.2-states',
    s
)

s = re.sub(
    r'/memeflow-orbit-v2\.js\?v=[^"\']+',
    '/memeflow-orbit-v2.js?v=3.2-states',
    s
)

p.write_text(s, encoding="utf-8")
PY

echo
echo "=== VERIFY ==="
grep -n "V3.2 AUTHORITATIVE" "$JS" | head -1 || true
grep -n "3.2-states" "$HTML" || true

echo
echo "================================================="
echo " MEMEFLOW ORBIT V3.2 STATES INSTALLED"
echo "================================================="
echo
echo "Throughput:"
echo "  REAL eventCount / tradeCount"
echo
echo "Decision states:"
echo "  /api/ai/decisions?scope=all&limit=200"
echo
echo "Expected current screenshot state:"
echo "  BUY READY should become 2"
echo "  WAITING should become 7"
echo "  BLOCKED should become 191"
echo "  WATCH should become 0"
echo
echo "TRADING visualization removed until a real"
echo "position/execution source is connected."
echo
echo "Backend / evaluator / trading logic NOT MODIFIED."
