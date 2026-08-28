#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
JS="$APP/memeflow-flow-v4.js"
CSS="$APP/memeflow-flow-v4.css"
HTML="$APP/system.html"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW FLOW V4.1 · PROFESSIONAL POLISH ==="

test -f "$JS"
test -f "$CSS"
test -f "$HTML"

cp "$JS" "${JS}.before-v41.${STAMP}.bak"
cp "$CSS" "${CSS}.before-v41.${STAMP}.bak"

python3 - "$JS" <<'PY'
from pathlib import Path
import re

p=Path("/home/runner/workspace/memeflow-app/memeflow-flow-v4.js")
s=p.read_text(encoding="utf-8")

# ---------------------------------------------------------
# 1. Honest live/idle state
# ---------------------------------------------------------

s=s.replace(
"""  function flowSpeed(){
    const r=Math.max(S.smoothEventRate,0);""",
"""  function isLiveThroughput(){
    return (
      performance.now() - S.lastLiveAt < 9000 &&
      (S.eventRate > 0 || S.tradeRate > 0)
    );
  }

  function flowSpeed(){
    const r=Math.max(S.smoothEventRate,0);"""
)

# ---------------------------------------------------------
# 2. Header mode: LIVE DATA ENGINE / STATE SNAPSHOT
# ---------------------------------------------------------

s=s.replace(
"""    if(q)q.textContent=queue==null?'—':String(queue);
  }""",
"""    if(q)q.textContent=queue==null?'—':String(queue);

    const mode=host.querySelector('.mf-flow-v4-mode span');
    const modeDot=host.querySelector('.mf-flow-v4-mode i');

    if(mode){
      mode.textContent=
        isLiveThroughput()
          ? 'LIVE DATA ENGINE'
          : 'STATE SNAPSHOT';
    }

    if(modeDot){
      modeDot.style.background=
        isLiveThroughput()
          ? '#4de6a1'
          : '#efc66a';

      modeDot.style.boxShadow=
        isLiveThroughput()
          ? '0 0 10px rgba(77,230,161,.55)'
          : '0 0 9px rgba(239,198,106,.35)';
    }
  }"""
)

# ---------------------------------------------------------
# 3. Smaller, cleaner CORE
# ---------------------------------------------------------

s=s.replace(
"""    const w=Math.min(S.w*.23,150);
    const h=Math.min(S.h*.20,104);""",
"""    const w=Math.min(S.w*.205,132);
    const h=Math.min(S.h*.165,86);"""
)

s=s.replace(
"""    text(ctx,'MEMEFLOW CORE',c.x,c.y-8,11,C.raw,.94,850,'center');
    text(ctx,'PROCESSING',c.x,c.y+13,7,C.core,.74,800,'center');""",
"""    text(ctx,'MEMEFLOW',c.x,c.y-9,10,C.raw,.94,850,'center');
    text(ctx,'CORE',c.x,c.y+4,8,C.core,.90,850,'center');

    text(
      ctx,
      isLiveThroughput() ? 'PROCESSING' : 'STATE ENGINE',
      c.x,
      c.y+20,
      6,
      C.core,
      .62,
      750,
      'center'
    );"""
)

# ---------------------------------------------------------
# 4. More professional stage positions
# ---------------------------------------------------------

s=s.replace(
"""      S.w*.13,
      S.h*.34,""",
"""      S.w*.14,
      S.h*.31,""",
1
)

s=s.replace(
"""      S.w*.39,
      S.h*.34,""",
"""      S.w*.385,
      S.h*.31,""",
1
)

# ---------------------------------------------------------
# 5. State outputs evenly spaced
# ---------------------------------------------------------

s=s.replace(
"""    drawStateLane(ctx,'WAITING',S.counts.WAITING,.34,C.waiting);
    drawStateLane(ctx,'WATCH',S.counts.WATCH,.46,C.watch);
    drawStateLane(ctx,'BLOCKED',S.counts.BLOCKED,.66,C.blocked);
    drawStateLane(ctx,'BUY READY',S.counts.READY,.79,C.ready);

    statePackets(ctx,t,'WAITING',S.counts.WAITING,.34,C.waiting);
    statePackets(ctx,t,'WATCH',S.counts.WATCH,.46,C.watch);
    statePackets(ctx,t,'BLOCKED',S.counts.BLOCKED,.66,C.blocked);
    statePackets(ctx,t,'READY',S.counts.READY,.79,C.ready);""",
"""    drawStateLane(ctx,'WAITING',S.counts.WAITING,.35,C.waiting);
    drawStateLane(ctx,'WATCH',S.counts.WATCH,.47,C.watch);
    drawStateLane(ctx,'BLOCKED',S.counts.BLOCKED,.63,C.blocked);
    drawStateLane(ctx,'BUY READY',S.counts.READY,.76,C.ready);

    statePackets(ctx,t,'WAITING',S.counts.WAITING,.35,C.waiting);
    statePackets(ctx,t,'WATCH',S.counts.WATCH,.47,C.watch);
    statePackets(ctx,t,'BLOCKED',S.counts.BLOCKED,.63,C.blocked);
    statePackets(ctx,t,'READY',S.counts.READY,.76,C.ready);"""
)

# ---------------------------------------------------------
# 6. No fake left-side movement when counters are zero
# ---------------------------------------------------------

s=s.replace(
"""    drawRawPackets(ctx,t);
    drawDecodePackets(ctx,t);""",
"""    if(isLiveThroughput()){
      drawRawPackets(ctx,t);
      drawDecodePackets(ctx,t);
    }else{
      /*
        State data can remain valid after a server restart even while
        cumulative event counters are still at zero.
        Show a quiet transport line, not fake activity.
      */
      for(let i=0;i<8;i++){
        const q=i/7;

        const p=bezier(
          P(.035,.54),
          P(.15,.46),
          P(.27,.54),
          P(.39,.54),
          q
        );

        dot(ctx,p,C.raw,.9,.15,0);
      }

      text(
        ctx,
        'AWAITING LIVE EVENTS',
        S.w*.25,
        S.h*.60,
        6,
        C.grid,
        .72,
        750,
        'center'
      );
    }"""
)

# ---------------------------------------------------------
# 7. Slow state particles when ingest is idle
# ---------------------------------------------------------

s=s.replace(
"""    const speed=flowSpeed()*.72;""",
"""    const speed=
      isLiveThroughput()
        ? flowSpeed()*.72
        : .22;"""
)

# ---------------------------------------------------------
# 8. Render fewer blocked dots on mobile but preserve exact count
# ---------------------------------------------------------

s=s.replace(
"""      Math.round(1+Math.sqrt(count)*.72),""",
"""      Math.round(
        1 +
        Math.sqrt(count) *
        (S.w < 520 ? .46 : .72)
      ),"""
)

# ---------------------------------------------------------
# 9. Version marker
# ---------------------------------------------------------

s=s.replace(
"""'[MEMEFLOW Flow V4] Dark Industrial Observability active'""",
"""'[MEMEFLOW Flow V4.1] Professional Industrial Observability active'"""
)

p.write_text(s,encoding="utf-8")
print("V4.1 JS patched")
PY

cat >> "$CSS" <<'CSS'

/* ===== MEMEFLOW FLOW V4.1 PROFESSIONAL POLISH ===== */

.mf-flow-v4{
  background:
    radial-gradient(
      ellipse at 51% 51%,
      rgba(38,110,124,.045),
      transparent 31%
    );
}

.mf-flow-v4-rates{
  box-shadow:
    inset 0 1px rgba(255,255,255,.018),
    0 12px 36px rgba(0,0,0,.16);
}

@media(max-width:760px){
  .viewport-wrap{
    height:520px !important;
    min-height:520px !important;
  }

  .mf-flow-v4-foot{
    font-size:6px;
    opacity:.72;
  }
}
CSS

python3 - "$HTML" <<'PY'
from pathlib import Path
import re

p=Path("/home/runner/workspace/memeflow-app/system.html")
s=p.read_text(encoding="utf-8")

s=re.sub(
    r'/memeflow-flow-v4\.css\?v=[^"\']+',
    '/memeflow-flow-v4.css?v=4.1-pro',
    s
)

s=re.sub(
    r'/memeflow-flow-v4\.js\?v=[^"\']+',
    '/memeflow-flow-v4.js?v=4.1-pro',
    s
)

p.write_text(s,encoding="utf-8")
PY

echo
echo "============================================"
echo " MEMEFLOW FLOW V4.1 PROFESSIONAL INSTALLED"
echo "============================================"
echo
echo "If counters = 0:"
echo "  STATE SNAPSHOT"
echo "  no fake ingest animation"
echo
echo "If live events start:"
echo "  LIVE DATA ENGINE"
echo "  packet speed follows actual rate"
echo
echo "Decision counts remain server-authoritative."
echo "Backend / evaluator / trading NOT MODIFIED."
