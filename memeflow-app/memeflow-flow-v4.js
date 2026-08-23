(()=>{'use strict';

if(window.__MF_V44)return;
window.__MF_V44=1;

const Q=(s,r=document)=>r.querySelector(s);
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const T=Math.PI*2;

const C={
  raw:[215,228,236],
  soft:[112,136,151],
  cyan:[70,210,246],
  wait:[205,218,226],
  watch:[68,126,255],
  block:[255,86,106],
  ready:[72,230,157]
};

const S={
  w:1,
  h:1,
  d:1,

  e0:null,
  t0:null,
  at:0,
  lastLive:0,

  eRate:0,
  tRate:0,
  eSm:0,
  tSm:0,

  counts:{
    WAITING:0,
    WATCH:0,
    BLOCKED:0,
    READY:0,
    TOTAL:0
  },

  prev:new Map(),
  baseline:false,

  raw:[],
  dec:[],
  out:[],

  carryE:0,
  carryT:0,

  serial:0,
  lastFrame:performance.now()
};

const rgba=(c,a)=>
  `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const num=id=>{
  const e=document.getElementById(id);

  if(!e)return null;

  const n=Number(
    String(e.textContent||'')
      .replace(/[^0-9.-]/g,'')
  );

  return Number.isFinite(n)
    ? n
    : null;
};

const key=s=>{
  s=String(s||'').toUpperCase();

  if(
    s.includes('BUY')||
    s.includes('READY')
  ){
    return 'READY';
  }

  if(
    s.includes('BLOCK')||
    s.includes('REJECT')||
    s.includes('EXPIRED')
  ){
    return 'BLOCKED';
  }

  if(s.includes('WATCH')){
    return 'WATCH';
  }

  return 'WAITING';
};

function hash(s){
  let h=2166136261;

  for(const ch of String(s)){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }

  return h>>>0;
}

function rnd(n){
  const x=
    Math.sin(
      n*12.9898+78.233
    )*43758.5453;

  return x-Math.floor(x);
}

function bz(a,b,c,d,t){
  const u=1-t;

  return{
    x:
      u*u*u*a.x+
      3*u*u*t*b.x+
      3*u*t*t*c.x+
      t*t*t*d.x,

    y:
      u*u*u*a.y+
      3*u*u*t*b.y+
      3*u*t*t*c.y+
      t*t*t*d.y
  };
}

function curve(
  g,a,b,c,d,
  col,
  al=.1,
  w=1
){
  g.beginPath();
  g.moveTo(a.x,a.y);

  g.bezierCurveTo(
    b.x,b.y,
    c.x,c.y,
    d.x,d.y
  );

  g.strokeStyle=rgba(col,al);
  g.lineWidth=w;
  g.stroke();
}

function dot(
  g,p,col,
  r,
  al=.8,
  glow=0
){
  g.save();

  if(glow){
    g.shadowBlur=glow;
    g.shadowColor=rgba(col,.7);
  }

  g.beginPath();
  g.arc(
    p.x,p.y,
    r,
    0,T
  );

  g.fillStyle=rgba(col,al);
  g.fill();

  g.restore();
}

function txt(
  g,s,x,y,z,
  col,
  al=.9,
  align='left'
){
  g.save();

  g.textAlign=align;
  g.textBaseline='middle';

  g.font=
    `800 ${z}px system-ui,-apple-system,sans-serif`;

  g.fillStyle=rgba(col,al);
  g.fillText(s,x,y);

  g.restore();
}

function source(){
  return{
    x:S.w*.095,
    y:S.h*.565
  };
}

function core(){
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
}

function endY(st){
  return{
    WAITING:.31,
    WATCH:.445,
    BLOCKED:.615,
    READY:.785
  }[st]*S.h;
}

function traj(seed,end=null){
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
}

function outPath(st,seed){
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
}

function color(st){
  return st==='WATCH'
    ?C.watch
    :st==='BLOCKED'
      ?C.block
      :st==='READY'
        ?C.ready
        :C.wait;
}

function host(){
  const v=
    Q('.viewport-wrap');

  if(!v)return null;

  let h=
    Q('.mf-flow-v4',v);

  if(!h){
    h=document.createElement('div');
    h.className='mf-flow-v4';
    v.appendChild(h);
  }

  h.innerHTML=`
    <canvas></canvas>

    <div class="mf-flow-v4-topline">

      <div class="mf-flow-v4-mode">
        <i></i>
        <span>CALIBRATING</span>
      </div>

      <div class="mf-flow-v4-rates">

        <div class="mf-flow-v4-rate">
          <span>INGEST</span>
          <b data-e>—</b>
          <small>events/s</small>
        </div>

        <div class="mf-flow-v4-rate decode">
          <span>DECODE</span>
          <b data-t>—</b>
          <small>trades/s</small>
        </div>

        <div class="mf-flow-v4-rate share">
          <span>TRADE SHARE</span>
          <b data-s>—</b>
          <small>%</small>
        </div>

        <div class="mf-flow-v4-rate queue">
          <span>QUEUE</span>
          <b data-q>—</b>
          <small>jobs</small>
        </div>

      </div>
    </div>

    <div class="mf-flow-v4-foot">
      <i></i>
      <span data-scale>
        LIVE DECISION FEED
      </span>
    </div>
  `;

  return h;
}

function resize(c,h){
  const r=
    h.getBoundingClientRect();

  S.w=
    Math.round(r.width);

  S.h=
    Math.round(r.height);

  S.d=
    Math.min(
      2,
      devicePixelRatio||1
    );

  c.width=S.w*S.d;
  c.height=S.h*S.d;
}

function capE(){
  return S.w<640
    ?22
    :38;
}

function capT(){
  return S.w<640
    ?18
    :30;
}

function weight(rate,cap){
  return rate>0
    ?Math.max(
      1,
      Math.ceil(
        rate/cap
      )
    )
    :1;
}

function hud(h){
  Q('[data-e]',h).textContent=
    S.eRate.toFixed(
      S.eRate>=100
        ?0
        :1
    );

  Q('[data-t]',h).textContent=
    S.tRate.toFixed(
      S.tRate>=100
        ?0
        :1
    );

  Q('[data-s]',h).textContent=
    (
      S.eRate>0
        ?S.tRate/S.eRate*100
        :0
    ).toFixed(1);

  Q('[data-q]',h).textContent=
    num('holderQueue')??'—';

  const live=
    S.eRate>0||
    S.tRate>0;

  Q(
    '.mf-flow-v4-mode span',
    h
  ).textContent=
    live
      ?'LIVE THROUGHPUT'
      :'STATE SNAPSHOT';

  const scale=
    Q('[data-scale]',h);

  const we=
    weight(
      S.eRate,
      capE()
    );

  const wt=
    weight(
      S.tRate,
      capT()
    );

  scale.textContent=
    live
      ?`1 RAW STREAK ≈ ${we} EVENT${we>1?'S':''} · 1 DECODE STREAK ≈ ${wt} TRADE${wt>1?'S':''}`
      :'NO MOTION WITHOUT NEW TELEMETRY';
}

function sample(h){
  const n=
    performance.now();

  const e=
    num('eventCount');

  const t=
    num('tradeCount');

  if(
    e==null&&
    t==null
  ){
    return;
  }

  if(S.e0==null){
    S.e0=e??0;
    S.t0=t??0;
    S.at=n;

    hud(h);
    return;
  }

  if(
    e!==S.e0||
    t!==S.t0
  ){
    const sec=
      Math.max(
        .25,
        (n-S.at)/1000
      );

    const reset=
      (e??0)<S.e0||
      (t??0)<S.t0;

    const de=
      reset
        ?0
        :Math.max(
          0,
          (e??S.e0)-S.e0
        );

    const dt=
      reset
        ?0
        :Math.max(
          0,
          (t??S.t0)-S.t0
        );

    S.eRate=
      de/sec;

    S.tRate=
      dt/sec;

    S.eSm=
      S.eSm
        ?S.eSm*.58+
         S.eRate*.42
        :S.eRate;

    S.tSm=
      S.tSm
        ?S.tSm*.58+
         S.tRate*.42
        :S.tRate;

    if(de||dt){
      S.lastLive=n;
    }

    S.e0=e??S.e0;
    S.t0=t??S.t0;
    S.at=n;

    if(reset){
      S.eRate=0;
      S.tRate=0;
      S.eSm=0;
      S.tSm=0;

      S.raw=[];
      S.dec=[];
    }
  }

  if(
    S.lastLive&&
    n-S.lastLive>9000
  ){
    S.eRate=0;
    S.tRate=0;

    S.eSm*=.9;
    S.tSm*=.9;

    if(S.eSm<.05){
      S.eSm=0;
    }

    if(S.tSm<.05){
      S.tSm=0;
    }
  }

  hud(h);
}

function recent(row){
  const vals=[
    row?.updatedAt,
    row?.decidedAt,
    row?.createdAt,
    row?.timestamp
  ];

  for(const v of vals){

    if(v==null){
      continue;
    }

    let m=
      Number(v);

    if(Number.isFinite(m)){

      if(m<1e12){
        m*=1000;
      }

      if(
        Math.abs(
          Date.now()-m
        )<12000
      ){
        return true;
      }

    }else{

      m=
        Date.parse(v);

      if(
        Number.isFinite(m)&&
        Math.abs(
          Date.now()-m
        )<12000
      ){
        return true;
      }
    }
  }

  const a=
    Number(
      row?.ageMinutes
    );

  return(
    Number.isFinite(a)&&
    a>=0&&
    a<=.2
  );
}

async function states(){
  try{

    const r=
      await fetch(
        '/api/ai/decisions?scope=all&limit=200',
        {
          cache:'no-store',
          credentials:'same-origin'
        }
      );

    if(!r.ok){
      throw Error(r.status);
    }

    const d=
      await r.json();

    const rows=
      Array.isArray(
        d?.decisions
      )
        ?d.decisions
        :[];

    const cnt={
      WAITING:0,
      WATCH:0,
      BLOCKED:0,
      READY:0,
      TOTAL:rows.length
    };

    const next=
      new Map();

    const ev=[];

    for(const row of rows){

      const st=
        key(
          row?.state??
          row?.decision?.state
        );

      cnt[st]++;

      const m=
        String(
          row?.mint??
          row?.tokenMint??
          row?.id??
          ''
        );

      if(!m){
        continue;
      }

      next.set(m,st);

      if(S.baseline){

        if(
          S.prev.has(m)&&
          S.prev.get(m)!==st
        ){
          ev.push({
            m,
            st
          });

        }else if(
          !S.prev.has(m)&&
          recent(row)
        ){
          ev.push({
            m,
            st
          });
        }
      }
    }

    S.counts=cnt;

    if(S.baseline){

      for(
        const x of
        ev.slice(
          0,
          S.w<640
            ?18
            :32
        )
      ){
        S.out.push({
          born:
            performance.now(),

          dur:1050,

          seed:
            hash(
              x.m+
              ':'+
              x.st+
              ':'+
              S.serial++
            ),

          st:x.st
        });
      }
    }

    S.prev=next;
    S.baseline=true;

  }catch(e){
    console.warn(
      '[MF V4.4 states]',
      e
    );
  }
}

function spawn(dt){
  const re=S.eRate;
  const rt=S.tRate;

  const we=
    weight(
      re,
      capE()
    );

  const wt=
    weight(
      rt,
      capT()
    );

  S.carryE+=
    (re/we)*dt;

  S.carryT+=
    (rt/wt)*dt;

  for(
    let n=0;
    S.carryE>=1&&
    n<5;
    n++,
    S.carryE--
  ){
    S.raw.push({
      born:
        performance.now(),

      dur:900,

      seed:
        hash(
          'r'+
          S.serial++
        ),

      w:we
    });
  }

  for(
    let n=0;
    S.carryT>=1&&
    n<5;
    n++,
    S.carryT--
  ){
    S.dec.push({
      born:
        performance.now(),

      dur:760,

      seed:
        hash(
          'd'+
          S.serial++
        ),

      w:wt
    });
  }

  if(S.raw.length>60){
    S.raw.splice(
      0,
      S.raw.length-60
    );
  }

  if(S.dec.length>50){
    S.dec.splice(
      0,
      S.dec.length-50
    );
  }
}

function grid(g){
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
}

function infrastructure(g){
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
}

function drawCore(g){
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
}

function outcome(g,st){
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
}

function pulses(
  g,
  arr,
  type,
  now
){
  const keep=[];

  for(const p of arr){

    const q=
      (now-p.born)/
      p.dur;

    if(q>=1){
      continue;
    }

    keep.push(p);

    let tr;
    let col;
    let r;

    let u=
      cl(
        q,
        0,
        1
      );

    if(type==='out'){

      tr=
        outPath(
          p.st,
          p.seed
        );

      col=
        color(p.st);

      r=
        p.st==='BLOCKED'
          ?2
          :1.8;

    }else{

      tr=
        traj(p.seed);

      col=
        type==='dec'
          ?C.cyan
          :(
            p.seed%5===0
              ?C.cyan
              :C.raw
          );

      r=
        type==='dec'
          ?1.6
          :1.25;

      /*
        DECODE packets start after
        the first part of the RAW path.
      */
      if(type==='dec'){
        u=
          .46+
          .54*u;
      }
    }

    dot(
      g,

      bz(
        tr.a,
        tr.b,
        tr.c,
        tr.d,
        u
      ),

      col,
      r,
      .86,

      type==='out'
        ?7
        :5
    );
  }

  return keep;
}

function draw(g,now){
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
}

function boot(){
  const h=host();

  if(!h)return;

  const c=
    Q('canvas',h);

  const g=
    c.getContext('2d');

  resize(c,h);

  new ResizeObserver(
    ()=>resize(c,h)
  ).observe(h);

  sample(h);
  states();

  /*
    250ms = DOM observation only.
    No API request here.
  */
  setInterval(
    ()=>sample(h),
    250
  );

  /*
    Full authoritative state snapshot.
  */
  setInterval(
    states,
    3000
  );

  function frame(n){

    const dt=
      cl(
        (n-S.lastFrame)/1000,
        0,
        .05
      );

    S.lastFrame=n;

    spawn(dt);

    g.setTransform(
      S.d,
      0,0,
      S.d,
      0,0
    );

    draw(g,n);

    requestAnimationFrame(
      frame
    );
  }

  requestAnimationFrame(
    frame
  );

  console.info(
    '[MEMEFLOW V4.5] Professional Truth Motion active'
  );
}

document.readyState==='loading'
  ?document.addEventListener(
    'DOMContentLoaded',
    boot,
    {once:true}
  )
  :boot();

})();
