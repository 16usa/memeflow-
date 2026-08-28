#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
JS="$APP/memeflow-flow-v4.js"
CSS="$APP/memeflow-flow-v4.css"
HTML="$APP/system.html"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW V4.5 · PROFESSIONAL TRAJECTORY UI ==="

test -f "$JS"
test -f "$CSS"
test -f "$HTML"

cp "$JS" "${JS}.before-v45.${STAMP}.bak"
cp "$CSS" "${CSS}.before-v45.${STAMP}.bak"
cp "$HTML" "${HTML}.before-v45.${STAMP}.bak"

python3 - "$JS" <<'PY'
from pathlib import Path
import re

p = Path("/home/runner/workspace/memeflow-app/memeflow-flow-v4.js")
s = p.read_text(encoding="utf-8")

def replace(pattern, replacement, name):
    global s
    s2, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"ERROR: {name} not found")
    s = s2

# =========================================================
# 1. Better mobile geometry
# =========================================================

replace(
r"""function source\(\)\{.*?\n\}""",
r"""function source(){
  return{
    x:S.w*.095,
    y:S.h*.565
  };
}""",
"source"
)

replace(
r"""function core\(\)\{.*?\n\}""",
r"""function core(){
  return{
    x:S.w*.535,
    y:S.h*.565,

    w:
      S.w<640
        ?92
        :116,

    h:
      S.w<640
        ?80
        :94
  };
}""",
"core"
)

replace(
r"""function endY\(st\)\{.*?\n\}""",
r"""function endY(st){
  return{
    WAITING:.31,
    WATCH:.445,
    BLOCKED:.615,
    READY:.785
  }[st]*S.h;
}""",
"endY"
)

# =========================================================
# 2. Professional converging trajectories
# =========================================================

replace(
r"""function traj\(seed,end=null\)\{.*?\n\}""",
r"""function traj(seed,end=null){
  const a=source();
  const co=core();

  const r1=rnd(seed+1);
  const r2=rnd(seed+2);
  const r3=rnd(seed+3);
  const r4=rnd(seed+4);

  const spread=
    S.h*(
      S.w<640
        ?.205
        :.285
    );

  return{
    a:{
      x:a.x+5,
      y:
        a.y+
        (r1-.5)*8
    },

    b:{
      x:S.w*.235,
      y:
        a.y+
        (r2-.5)*
        spread*.70
    },

    c:{
      x:S.w*.405,
      y:
        a.y+
        (r3-.5)*
        spread*.92
    },

    d:{
      x:
        co.x-
        co.w/2-
        4,

      y:
        end ??
        co.y+
        (r4-.5)*
        co.h*.30
    }
  };
}""",
"traj"
)

replace(
r"""function outPath\(st,seed\)\{.*?\n\}""",
r"""function outPath(st,seed){
  const co=core();
  const y=endY(st);

  const cnt=
    S.counts[st]||0;

  const ratio=
    cnt/
    Math.max(
      1,
      S.counts.TOTAL
    );

  const spread=
    cnt
      ?7+
        Math.sqrt(ratio)*
        (
          S.w<640
            ?24
            :38
        )
      :3;

  const off=
    (rnd(seed+9)-.5)*
    spread;

  return{
    a:{
      x:
        co.x+
        co.w/2+
        4,

      y:co.y
    },

    b:{
      x:S.w*.665,
      y:
        co.y+
        (y-co.y)*.20
    },

    c:{
      x:S.w*.79,
      y:
        y+
        off*.45
    },

    d:{
      x:S.w*.91,
      y:
        y+
        off
    }
  };
}""",
"outPath"
)

# =========================================================
# 3. Cleaner background grid
# =========================================================

replace(
r"""function grid\(g\)\{.*?\n\}""",
r"""function grid(g){
  const left=S.w*.025;
  const right=S.w*.975;
  const top=S.h*.17;
  const bottom=S.h*.91;

  for(let i=0;i<9;i++){
    const y=
      top+
      (bottom-top)*
      i/8;

    g.beginPath();
    g.moveTo(left,y);
    g.lineTo(right,y);

    g.strokeStyle=
      rgba(
        C.soft,
        i===4
          ?.022
          :.010
      );

    g.lineWidth=1;
    g.stroke();
  }

  for(let i=0;i<13;i++){
    const x=
      left+
      (right-left)*
      i/12;

    g.beginPath();
    g.moveTo(x,top);
    g.lineTo(x,bottom);

    g.strokeStyle=
      rgba(C.soft,.008);

    g.lineWidth=1;
    g.stroke();
  }
}""",
"grid"
)

# =========================================================
# 4. Main inference field.
#    Static lines = architecture.
#    Moving dots remain REAL telemetry pulses from V4.4.
# =========================================================

replace(
r"""function infrastructure\(g\)\{.*?\n\}""",
r"""function infrastructure(g){
  const cnt=
    cl(
      Math.round(
        44+
        Math.log1p(
          Math.max(
            0,
            S.eSm
          )
        )*11
      ),
      44,
      S.w<640
        ?82
        :126
    );

  /*
    Three depth classes create the Monte-Carlo /
    inference-cloud look without claiming each line
    is a real event.
  */
  for(let i=0;i<cnt;i++){
    const tr=
      traj(
        hash(
          'infra:'+i
        )
      );

    const layer=i%11;

    let col=C.soft;
    let alpha=.032;
    let width=.48;

    if(layer===0){
      col=C.cyan;
      alpha=.105;
      width=.85;
    }else if(layer===1||layer===2){
      col=C.raw;
      alpha=.060;
      width=.58;
    }

    curve(
      g,
      tr.a,
      tr.b,
      tr.c,
      tr.d,
      col,
      alpha,
      width
    );
  }

  /*
    Thin envelope curves — visual boundary of
    the current processing field.
  */
  for(let i=-3;i<=3;i++){
    const a=source();
    const co=core();

    const yy=
      co.y+
      i*
      S.h*.025;

    curve(
      g,
      {
        x:a.x+4,
        y:a.y
      },
      {
        x:S.w*.22,
        y:
          a.y+
          i*S.h*.018
      },
      {
        x:S.w*.40,
        y:
          yy+
          i*S.h*.011
      },
      {
        x:
          co.x-
          co.w/2-
          4,
        y:yy
      },
      C.cyan,
      i===0
        ?.075
        :.025,
      i===0
        ?.75
        :.5
    );
  }

  const p=source();

  /*
    Source glow.
  */
  const grad=
    g.createRadialGradient(
      p.x,p.y,1,
      p.x,p.y,27
    );

  grad.addColorStop(
    0,
    'rgba(235,246,251,.25)'
  );

  grad.addColorStop(
    .25,
    'rgba(196,218,229,.10)'
  );

  grad.addColorStop(
    1,
    'rgba(196,218,229,0)'
  );

  g.fillStyle=grad;

  g.fillRect(
    p.x-30,
    p.y-30,
    60,
    60
  );

  dot(
    g,
    p,
    C.raw,
    4.6,
    .98,
    12
  );

  txt(
    g,
    'RAW STREAM',
    p.x,
    p.y-27,
    7.5,
    C.raw,
    .86,
    'center'
  );

  txt(
    g,
    'INFERENCE PATHS',
    S.w*.305,
    S.h*.205,
    7.5,
    C.cyan,
    .82,
    'center'
  );
}""",
"infrastructure"
)

# =========================================================
# 5. Smaller, premium CORE
# =========================================================

replace(
r"""function drawCore\(g\)\{.*?\n\}""",
r"""function drawCore(g){
  const c=core();

  /*
    Subtle outer glow.
  */
  const halo=
    g.createRadialGradient(
      c.x,c.y,4,
      c.x,c.y,c.w*.78
    );

  halo.addColorStop(
    0,
    'rgba(68,205,232,.08)'
  );

  halo.addColorStop(
    .52,
    'rgba(68,205,232,.025)'
  );

  halo.addColorStop(
    1,
    'rgba(68,205,232,0)'
  );

  g.fillStyle=halo;

  g.fillRect(
    c.x-c.w,
    c.y-c.h,
    c.w*2,
    c.h*2
  );

  g.save();

  g.shadowBlur=13;
  g.shadowColor=
    rgba(
      C.cyan,
      .12
    );

  g.fillStyle=
    'rgba(5,12,17,.965)';

  g.strokeStyle=
    rgba(
      C.cyan,
      .34
    );

  g.lineWidth=1.05;

  g.beginPath();

  g.roundRect(
    c.x-c.w/2,
    c.y-c.h/2,
    c.w,
    c.h,
    11
  );

  g.fill();
  g.stroke();

  g.restore();

  /*
    Tiny processor pins.
  */
  for(let i=0;i<12;i++){
    const yy=
      c.y-
      c.h*.34+
      i/11*
      c.h*.68;

    g.beginPath();

    g.moveTo(
      c.x-c.w/2-7,
      yy
    );

    g.lineTo(
      c.x-c.w/2-2,
      yy
    );

    g.strokeStyle=
      rgba(
        C.cyan,
        .16
      );

    g.lineWidth=.75;
    g.stroke();

    g.beginPath();

    g.moveTo(
      c.x+c.w/2+2,
      yy
    );

    g.lineTo(
      c.x+c.w/2+7,
      yy
    );

    g.stroke();
  }

  txt(
    g,
    'MEMEFLOW',
    c.x,
    c.y-15,
    8.5,
    C.raw,
    .91,
    'center'
  );

  txt(
    g,
    'CORE',
    c.x,
    c.y,
    8,
    C.cyan,
    .96,
    'center'
  );

  txt(
    g,
    S.eRate||S.tRate
      ?'PROCESSING'
      :'STATE ENGINE',

    c.x,
    c.y+19,
    5.2,
    C.cyan,
    .58,
    'center'
  );
}""",
"drawCore"
)

# =========================================================
# 6. Professional output fans.
#    Width/density = current real state count.
#    Moving pulse remains actual state change.
# =========================================================

replace(
r"""function outcome\(g,st\)\{.*?\n\}""",
r"""function outcome(g,st){
  const cnt=
    S.counts[st]||0;

  const ratio=
    cnt/
    Math.max(
      1,
      S.counts.TOTAL
    );

  const col=
    color(st);

  const paths=
    cnt
      ?cl(
        Math.round(
          4+
          Math.sqrt(cnt)*1.15
        ),
        4,
        S.w<640
          ?25
          :40
      )
      :2;

  for(let i=0;i<paths;i++){
    const tr=
      outPath(
        st,
        hash(
          'out:'+
          st+
          ':'+
          i
        )
      );

    const major=
      i%8===0;

    curve(
      g,
      tr.a,
      tr.b,
      tr.c,
      tr.d,
      col,

      cnt
        ?(
          major
            ?.10+
             Math.sqrt(ratio)*.07
            :.026+
             Math.sqrt(ratio)*.042
        )
        :.010,

      cnt
        ?(
          major
            ?.86
            :.46
        )
        :.42
    );
  }

  const p={
    x:S.w*.91,
    y:endY(st)
  };

  /*
    Endpoint marker.
  */
  dot(
    g,
    p,
    col,

    cnt
      ?3.8
      :1.8,

    cnt
      ?.94
      :.15,

    cnt
      ?8
      :0
  );

  txt(
    g,
    st==='READY'
      ?'BUY READY'
      :st,

    p.x-12,
    p.y-13,

    cnt
      ?7.5
      :6.7,

    col,

    cnt
      ?.90
      :.17,

    'right'
  );

  txt(
    g,
    String(cnt),

    p.x+12,
    p.y,

    cnt
      ?10
      :8,

    col,

    cnt
      ?.92
      :.17,

    'left'
  );
}""",
"outcome"
)

# =========================================================
# 7. Cleaner scene composition
# =========================================================

replace(
r"""function draw\(g,now\)\{.*?\n\}""",
r"""function draw(g,now){
  g.clearRect(
    0,0,
    S.w,S.h
  );

  /*
    Very subtle central atmosphere.
  */
  const co=core();

  const bg=
    g.createRadialGradient(
      co.x,
      co.y,
      10,
      co.x,
      co.y,
      Math.max(
        S.w,
        S.h
      )*.48
    );

  bg.addColorStop(
    0,
    'rgba(15,49,58,.045)'
  );

  bg.addColorStop(
    .45,
    'rgba(4,12,17,.012)'
  );

  bg.addColorStop(
    1,
    'rgba(0,0,0,0)'
  );

  g.fillStyle=bg;

  g.fillRect(
    0,0,
    S.w,S.h
  );

  grid(g);
  infrastructure(g);

  /*
    Output architecture first,
    processor above it.
  */
  [
    'WAITING',
    'WATCH',
    'BLOCKED',
    'READY'
  ].forEach(
    st=>outcome(g,st)
  );

  drawCore(g);

  /*
    ONLY these are moving telemetry.
  */
  S.raw=
    pulses(
      g,
      S.raw,
      'raw',
      now
    );

  S.dec=
    pulses(
      g,
      S.dec,
      'dec',
      now
    );

  S.out=
    pulses(
      g,
      S.out,
      'out',
      now
    );
}""",
"draw"
)

s=s.replace(
  "[MEMEFLOW V4.4] Truth Motion active",
  "[MEMEFLOW V4.5] Professional Truth Motion active"
)

p.write_text(s, encoding="utf-8")

print("V4.5 professional renderer patched")
PY

node --check "$JS"

cat >> "$CSS" <<'CSS'

/* ======================================================
   MEMEFLOW V4.5 · PROFESSIONAL VISUAL SYSTEM
   ====================================================== */

.mf-flow-v4{
  background:
    radial-gradient(
      ellipse at 52% 52%,
      rgba(31,89,104,.030),
      transparent 37%
    ) !important;
}

.mf-flow-v4-rates{
  border-color:rgba(138,166,185,.11) !important;

  background:
    linear-gradient(
      180deg,
      rgba(6,11,15,.70),
      rgba(3,7,10,.62)
    ) !important;

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.018),
    0 12px 30px rgba(0,0,0,.12) !important;
}

.mf-flow-v4-rate b{
  letter-spacing:-.015em;
}

.mf-flow-v4-foot{
  bottom:9px !important;

  opacity:.48 !important;

  font-size:5.2px !important;

  letter-spacing:.055em !important;
}

/*
  Old duplicate legend above the visual is removed.
  State labels now exist in the actual outcome graph.
*/
.legend,
.mf-legend-standalone-v4{
  display:none !important;
}

/*
  Recover the vertical space left by the removed legend.
*/
.viewport-wrap{
  margin-top:10px !important;
}

/*
  Slightly calmer panel borders.
*/
.viewport-wrap{
  border-color:
    rgba(126,157,178,.13) !important;
}

@media(max-width:760px){

  .viewport-wrap{
    height:510px !important;
    min-height:510px !important;
  }

  .mf-flow-v4-rates{
    padding:8px 9px !important;
  }

  .mf-flow-v4-rate span{
    letter-spacing:.12em;
  }

  .mf-flow-v4-foot{
    left:11px !important;
    right:11px !important;
    max-width:calc(100% - 22px) !important;
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
    '/memeflow-flow-v4.css?v=4.5-pro-truth',
    s
)

s=re.sub(
    r'/memeflow-flow-v4\.js\?v=[^"\']+',
    '/memeflow-flow-v4.js?v=4.5-pro-truth',
    s
)

p.write_text(
    s,
    encoding="utf-8"
)
PY

echo
echo "=== VERIFY ==="

grep -n \
  "4.5-pro-truth" \
  "$HTML" || true

grep -n \
  "Professional Truth Motion" \
  "$JS" || true

echo
echo "======================================================"
echo " MEMEFLOW V4.5 · PROFESSIONAL TRUTH MOTION INSTALLED"
echo "======================================================"
echo
echo "CHANGED:"
echo "  cleaner trajectory field"
echo "  professional convergence"
echo "  smaller MEMEFLOW CORE"
echo "  quieter grid"
echo "  cleaner state fans"
echo "  zero states visually suppressed"
echo "  duplicate legend removed"
echo
echo "NOT CHANGED:"
echo "  INGEST measurement"
echo "  DECODE measurement"
echo "  real movement spawning"
echo "  state-change pulses"
echo "  authoritative decision counts"
echo "  backend"
echo "  evaluator"
echo "  trading"
