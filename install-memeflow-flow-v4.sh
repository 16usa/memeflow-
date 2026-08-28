#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
HTML="$APP/system.html"
CSS="$APP/memeflow-flow-v4.css"
JS="$APP/memeflow-flow-v4.js"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW FLOW V4 · DARK INDUSTRIAL OBSERVABILITY ==="

test -f "$HTML"

cp "$HTML" "${HTML}.before-flow-v4.${STAMP}.bak"

cat > "$CSS" <<'CSS'
/* MEMEFLOW FLOW V4 · DARK INDUSTRIAL OBSERVABILITY */

#systemCanvas,
#memeflowTrue3DHost,
#labels,
.scene-hint {
  opacity:0 !important;
  pointer-events:none !important;
}

.viewport-wrap{
  min-height:520px !important;
  height:clamp(520px,64vh,760px) !important;
  background:
    radial-gradient(ellipse at 47% 47%, rgba(37,114,128,.055), transparent 30%),
    linear-gradient(180deg,#05090d 0%,#030609 100%) !important;
}

.mf-flow-v4{
  position:absolute;
  inset:0;
  z-index:7;
  overflow:hidden;
  pointer-events:auto;
}

.mf-flow-v4 canvas{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  display:block;
  touch-action:none;
}

.mf-flow-v4-topline{
  position:absolute;
  left:16px;
  right:16px;
  top:14px;
  z-index:4;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  pointer-events:none;
}

.mf-flow-v4-mode{
  display:flex;
  align-items:center;
  gap:8px;
  color:#7f93a1;
  font:800 7px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.15em;
  text-transform:uppercase;
}

.mf-flow-v4-mode i{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#4de6a1;
  box-shadow:0 0 10px rgba(77,230,161,.55);
}

.mf-flow-v4-rates{
  display:flex;
  align-items:center;
  gap:14px;
  padding:7px 10px;
  border:1px solid rgba(139,171,194,.12);
  border-radius:9px;
  background:rgba(4,8,12,.56);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
}

.mf-flow-v4-rate{
  min-width:66px;
}

.mf-flow-v4-rate span{
  display:block;
  color:#617684;
  font:800 6px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.13em;
}

.mf-flow-v4-rate b{
  display:inline-block;
  margin-top:4px;
  color:#e0edf3;
  font:800 11px/1 system-ui,-apple-system,sans-serif;
  font-variant-numeric:tabular-nums;
}

.mf-flow-v4-rate small{
  margin-left:3px;
  color:#617684;
  font:650 6px/1 system-ui,-apple-system,sans-serif;
}

.mf-flow-v4-rate.decode b{
  color:#5edcf6;
}

.mf-flow-v4-rate.share b{
  color:#9cadb8;
}

.mf-flow-v4-rate.queue b{
  color:#9cadb8;
}

.mf-flow-v4-foot{
  position:absolute;
  left:16px;
  bottom:14px;
  z-index:4;
  display:flex;
  align-items:center;
  gap:8px;
  color:#718592;
  pointer-events:none;
  font:800 7px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.13em;
  text-transform:uppercase;
}

.mf-flow-v4-foot i{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#4de6a1;
  box-shadow:0 0 10px rgba(77,230,161,.5);
}

@media(max-width:760px){
  .viewport-wrap{
    min-height:500px !important;
    height:500px !important;
  }

  .mf-flow-v4-topline{
    left:9px;
    right:9px;
    top:9px;
  }

  .mf-flow-v4-mode{
    display:none;
  }

  .mf-flow-v4-rates{
    width:100%;
    justify-content:space-between;
    gap:5px;
    padding:7px 8px;
  }

  .mf-flow-v4-rate{
    min-width:0;
  }

  .mf-flow-v4-rate span{
    font-size:5.5px;
  }

  .mf-flow-v4-rate b{
    font-size:10px;
  }

  .mf-flow-v4-rate small{
    display:none;
  }

  .mf-flow-v4-foot{
    left:10px;
    bottom:10px;
  }
}
CSS

cat > "$JS" <<'JS'
(() => {
  'use strict';

  if (window.__MEMEFLOW_FLOW_V4__) return;
  window.__MEMEFLOW_FLOW_V4__ = true;

  const TAU = Math.PI * 2;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  const C = {
    bg:[3,7,10],
    grid:[65,87,101],
    raw:[183,203,216],
    decode:[88,216,244],
    core:[75,211,230],
    waiting:[162,178,188],
    watch:[91,141,255],
    blocked:[255,88,108],
    ready:[77,230,161]
  };

  const S = {
    w:1,
    h:1,
    dpr:1,
    lastEvents:null,
    lastTrades:null,
    lastAt:0,
    eventRate:0,
    tradeRate:0,
    smoothEventRate:0,
    smoothTradeRate:0,
    lastLiveAt:0,
    counts:{
      WAITING:0,
      WATCH:0,
      BLOCKED:0,
      READY:0,
      TOTAL:0
    },
    rows:[],
    packets:[],
    lastPacketAt:0,
    statePacketClock:0
  };

  const rgba = (c,a) =>
    `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function readNumber(id){
    const el=document.getElementById(id);
    if(!el)return null;
    const raw=String(el.textContent||'').replace(/[^0-9.-]/g,'');
    if(!raw)return null;
    const n=Number(raw);
    return Number.isFinite(n)?n:null;
  }

  function stateKey(raw=''){
    const s=String(raw).toUpperCase();
    if(s.includes('BUY')||s.includes('READY'))return 'READY';
    if(s.includes('BLOCK')||s.includes('REJECT')||s.includes('EXPIRED'))return 'BLOCKED';
    if(s.includes('WATCH'))return 'WATCH';
    return 'WAITING';
  }

  function makeUI(host){
    host.innerHTML=`
      <canvas aria-label="MEMEFLOW realtime data flow"></canvas>

      <div class="mf-flow-v4-topline">
        <div class="mf-flow-v4-mode">
          <i></i>
          <span>LIVE DATA ENGINE</span>
        </div>

        <div class="mf-flow-v4-rates">
          <div class="mf-flow-v4-rate">
            <span>INGEST</span>
            <b data-mf-events>—</b>
            <small>events/s</small>
          </div>

          <div class="mf-flow-v4-rate decode">
            <span>DECODE</span>
            <b data-mf-trades>—</b>
            <small>trades/s</small>
          </div>

          <div class="mf-flow-v4-rate share">
            <span>TRADE SHARE</span>
            <b data-mf-share>—</b>
            <small>%</small>
          </div>

          <div class="mf-flow-v4-rate queue">
            <span>QUEUE</span>
            <b data-mf-queue>—</b>
            <small>jobs</small>
          </div>
        </div>
      </div>

      <div class="mf-flow-v4-foot">
        <i></i>
        <span>SERVER-AUTHORITATIVE STATE FLOW</span>
      </div>
    `;

    return host.querySelector('canvas');
  }

  function installHost(){
    const viewport=document.querySelector('.viewport-wrap');
    if(!viewport)return null;

    let host=viewport.querySelector('.mf-flow-v4');

    if(!host){
      host=document.createElement('div');
      host.className='mf-flow-v4';
      viewport.appendChild(host);
    }

    return {viewport,host};
  }

  function resize(canvas,host){
    const r=host.getBoundingClientRect();
    S.w=Math.max(1,Math.round(r.width));
    S.h=Math.max(1,Math.round(r.height));
    S.dpr=Math.min(2,window.devicePixelRatio||1);

    canvas.width=Math.round(S.w*S.dpr);
    canvas.height=Math.round(S.h*S.dpr);
  }

  function sampleRates(host){
    const now=performance.now();
    const events=readNumber('eventCount');
    const trades=readNumber('tradeCount');

    if(events==null&&trades==null)return;

    if(S.lastEvents==null||S.lastTrades==null||!S.lastAt){
      S.lastEvents=events??0;
      S.lastTrades=trades??0;
      S.lastAt=now;
      return;
    }

    const changed=
      (events!=null&&events!==S.lastEvents)||
      (trades!=null&&trades!==S.lastTrades);

    if(changed){
      const sec=Math.max(.25,(now-S.lastAt)/1000);
      const de=events==null?0:Math.max(0,events-S.lastEvents);
      const dt=trades==null?0:Math.max(0,trades-S.lastTrades);

      S.eventRate=de/sec;
      S.tradeRate=dt/sec;

      S.smoothEventRate=
        S.smoothEventRate===0
          ? S.eventRate
          : S.smoothEventRate*.58+S.eventRate*.42;

      S.smoothTradeRate=
        S.smoothTradeRate===0
          ? S.tradeRate
          : S.smoothTradeRate*.58+S.tradeRate*.42;

      if(de>0||dt>0)S.lastLiveAt=now;

      S.lastEvents=events??S.lastEvents;
      S.lastTrades=trades??S.lastTrades;
      S.lastAt=now;
    }

    const e=host.querySelector('[data-mf-events]');
    const t=host.querySelector('[data-mf-trades]');
    const sh=host.querySelector('[data-mf-share]');
    const q=host.querySelector('[data-mf-queue]');

    if(e)e.textContent=S.eventRate.toFixed(S.eventRate>=100?0:1);
    if(t)t.textContent=S.tradeRate.toFixed(S.tradeRate>=100?0:1);

    const share=
      S.eventRate>0
        ? (S.tradeRate/S.eventRate)*100
        : 0;

    if(sh)sh.textContent=share.toFixed(share>=10?1:2);

    const queue=readNumber('holderQueue');
    if(q)q.textContent=queue==null?'—':String(queue);
  }

  async function syncStates(){
    try{
      const r=await fetch(
        '/api/ai/decisions?scope=all&limit=200',
        {
          cache:'no-store',
          credentials:'same-origin',
          headers:{accept:'application/json'}
        }
      );

      if(!r.ok)throw new Error('HTTP '+r.status);

      const data=await r.json();
      const rows=Array.isArray(data?.decisions)?data.decisions:[];

      const counts={
        WAITING:0,
        WATCH:0,
        BLOCKED:0,
        READY:0,
        TOTAL:rows.length
      };

      for(const row of rows){
        const k=stateKey(row?.state??row?.decision?.state);

        if(k==='READY')counts.READY++;
        else if(k==='BLOCKED')counts.BLOCKED++;
        else if(k==='WATCH')counts.WATCH++;
        else counts.WAITING++;
      }

      S.rows=rows;
      S.counts=counts;

    }catch(err){
      console.warn('[MEMEFLOW Flow V4] state sync failed',err);
    }
  }

  function flowSpeed(){
    const r=Math.max(S.smoothEventRate,0);
    return clamp(.45+Math.log1p(r)/Math.log(801)*1.65,.45,2.1);
  }

  function rawPacketCount(){
    return clamp(
      Math.round(8+Math.log1p(S.smoothEventRate)*3.3),
      8,
      34
    );
  }

  function decodedPacketCount(){
    return clamp(
      Math.round(4+Math.log1p(S.smoothTradeRate)*2.5),
      4,
      22
    );
  }

  function P(x,y){
    return {x:S.w*x,y:S.h*y};
  }

  function bezier(a,b,c,d,t){
    const u=1-t;
    return {
      x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,
      y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y
    };
  }

  function line(ctx,a,b,color,alpha,width=1){
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=rgba(color,alpha);
    ctx.lineWidth=width;
    ctx.stroke();
  }

  function curve(ctx,a,b,c,d,color,alpha,width=1){
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);
    ctx.strokeStyle=rgba(color,alpha);
    ctx.lineWidth=width;
    ctx.stroke();
  }

  function dot(ctx,p,color,r,alpha=1,glow=0){
    ctx.save();

    if(glow){
      ctx.shadowBlur=glow;
      ctx.shadowColor=rgba(color,.65);
    }

    ctx.beginPath();
    ctx.arc(p.x,p.y,r,0,TAU);
    ctx.fillStyle=rgba(color,alpha);
    ctx.fill();

    ctx.restore();
  }

  function text(ctx,label,x,y,size,color,alpha=.9,weight=800,align='left'){
    ctx.save();
    ctx.textAlign=align;
    ctx.textBaseline='middle';
    ctx.font=`${weight} ${size}px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle=rgba(color,alpha);
    ctx.fillText(label,x,y);
    ctx.restore();
  }

  function drawGrid(ctx){
    const top=S.h*.18;
    const bottom=S.h*.91;

    for(let i=0;i<9;i++){
      const y=top+(bottom-top)*(i/8);
      line(
        ctx,
        {x:S.w*.025,y},
        {x:S.w*.975,y},
        C.grid,
        i===4?.07:.035,
        1
      );
    }

    for(let i=0;i<14;i++){
      const x=S.w*.03+S.w*.94*(i/13);
      line(
        ctx,
        {x,y:top},
        {x,y:bottom},
        C.grid,
        .026,
        1
      );
    }
  }

  function drawStageLabel(ctx,title,sub,x,y,color){
    text(ctx,title,x,y,8,color,.9,850,'center');
    text(ctx,sub,x,y+15,6,C.grid,.95,700,'center');
  }

  function drawCore(ctx){
    const c=P(.53,.54);
    const w=Math.min(S.w*.23,150);
    const h=Math.min(S.h*.20,104);

    ctx.save();

    ctx.shadowBlur=24;
    ctx.shadowColor='rgba(67,206,228,.10)';

    ctx.beginPath();
    ctx.roundRect(c.x-w/2,c.y-h/2,w,h,14);
    ctx.fillStyle='rgba(7,17,22,.90)';
    ctx.fill();
    ctx.strokeStyle='rgba(92,211,231,.27)';
    ctx.lineWidth=1;
    ctx.stroke();

    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(
      c.x-w*.34,
      c.y-h*.23,
      w*.68,
      3,
      2
    );
    ctx.fillStyle='rgba(84,216,238,.38)';
    ctx.fill();

    text(ctx,'MEMEFLOW CORE',c.x,c.y-8,11,C.raw,.94,850,'center');
    text(ctx,'PROCESSING',c.x,c.y+13,7,C.core,.74,800,'center');

    const load=clamp(
      Math.log1p(S.smoothEventRate)/Math.log(801),
      0,
      1
    );

    const barW=w*.58;
    const barY=c.y+h*.34;

    ctx.fillStyle='rgba(96,117,130,.10)';
    ctx.fillRect(c.x-barW/2,barY,barW,2);

    ctx.fillStyle=rgba(C.core,.35+.4*load);
    ctx.fillRect(c.x-barW/2,barY,barW*load,2);
  }

  function drawStateLane(ctx,name,count,y,color){
    const start=P(.63,.54);
    const end=P(.91,y);

    const active=count>0;
    const total=Math.max(1,S.counts.TOTAL);
    const ratio=count/total;

    const width=
      active
        ? clamp(1.0+Math.sqrt(ratio)*5.5,1.2,5.2)
        : .65;

    const alpha=active?.22:.045;

    curve(
      ctx,
      start,
      P(.70,.54),
      P(.79,y),
      end,
      color,
      alpha,
      width
    );

    const dotR=active?4.1:2.3;
    dot(ctx,end,color,dotR,active?.92:.20,active?8:0);

    text(
      ctx,
      name,
      end.x-10,
      end.y-9,
      active?8:7,
      color,
      active?.92:.28,
      850,
      'right'
    );

    text(
      ctx,
      String(count),
      end.x-10,
      end.y+8,
      8,
      C.raw,
      active?.78:.24,
      750,
      'right'
    );
  }

  function drawRawPackets(ctx,t){
    const speed=flowSpeed();
    const count=rawPacketCount();

    const a=P(.035,.54);
    const b=P(.15,.46);
    const c=P(.27,.54);
    const d=P(.39,.54);

    for(let i=0;i<count;i++){
      const q=(t*.00010*speed+i/count)%1;
      const p=bezier(a,b,c,d,q);

      const bundle=(i%5===0)?1.35:1;

      dot(
        ctx,
        p,
        C.raw,
        1.25*bundle,
        .28+(S.smoothEventRate>0?.28:0),
        2
      );
    }
  }

  function drawDecodePackets(ctx,t){
    const speed=flowSpeed();
    const count=decodedPacketCount();

    const a=P(.39,.54);
    const b=P(.43,.54);
    const c=P(.47,.54);
    const d=P(.475,.54);

    for(let i=0;i<count;i++){
      const q=(t*.00013*speed+i/count)%1;
      const p=bezier(a,b,c,d,q);

      dot(ctx,p,C.decode,1.5,.72,5);
    }
  }

  function statePackets(ctx,t,name,count,y,color){
    if(count<=0)return;

    const visual=clamp(
      Math.round(1+Math.sqrt(count)*.72),
      1,
      12
    );

    const speed=flowSpeed()*.72;

    const a=P(.60,.54);
    const b=P(.70,.54);
    const c=P(.80,y);
    const d=P(.90,y);

    for(let i=0;i<visual;i++){
      const q=(t*.00008*speed+i/visual)%1;
      const p=bezier(a,b,c,d,q);

      dot(
        ctx,
        p,
        color,
        name==='BLOCKED'?1.7:1.8,
        .60,
        name==='READY'?7:4
      );
    }
  }

  function drawPipeline(ctx,t){
    const rawStart=P(.035,.54);
    const decode=P(.39,.54);
    const core=P(.475,.54);

    curve(
      ctx,
      rawStart,
      P(.15,.46),
      P(.27,.54),
      decode,
      C.raw,
      .09,
      1
    );

    line(
      ctx,
      decode,
      core,
      C.decode,
      .18,
      1
    );

    drawRawPackets(ctx,t);
    drawDecodePackets(ctx,t);

    drawStageLabel(
      ctx,
      'RAW EVENTS',
      'SOLANA / PUMP STREAM',
      S.w*.13,
      S.h*.34,
      C.raw
    );

    drawStageLabel(
      ctx,
      'DECODE',
      'TRADE EVENTS',
      S.w*.39,
      S.h*.34,
      C.decode
    );

    drawCore(ctx);

    drawStateLane(ctx,'WAITING',S.counts.WAITING,.34,C.waiting);
    drawStateLane(ctx,'WATCH',S.counts.WATCH,.46,C.watch);
    drawStateLane(ctx,'BLOCKED',S.counts.BLOCKED,.66,C.blocked);
    drawStateLane(ctx,'BUY READY',S.counts.READY,.79,C.ready);

    statePackets(ctx,t,'WAITING',S.counts.WAITING,.34,C.waiting);
    statePackets(ctx,t,'WATCH',S.counts.WATCH,.46,C.watch);
    statePackets(ctx,t,'BLOCKED',S.counts.BLOCKED,.66,C.blocked);
    statePackets(ctx,t,'READY',S.counts.READY,.79,C.ready);
  }

  function render(ctx,t){
    ctx.clearRect(0,0,S.w,S.h);

    const g=ctx.createRadialGradient(
      S.w*.53,S.h*.54,8,
      S.w*.53,S.h*.54,
      Math.max(S.w,S.h)*.60
    );

    g.addColorStop(0,'rgba(28,78,88,.09)');
    g.addColorStop(.35,'rgba(8,18,23,.035)');
    g.addColorStop(1,'rgba(0,0,0,0)');

    ctx.fillStyle=g;
    ctx.fillRect(0,0,S.w,S.h);

    drawGrid(ctx);
    drawPipeline(ctx,t);
  }

  function boot(){
    const found=installHost();
    if(!found)return;

    const {host}=found;
    const canvas=makeUI(host);
    const ctx=canvas.getContext('2d',{alpha:true});

    if(!ctx)return;

    resize(canvas,host);

    const ro=new ResizeObserver(
      ()=>resize(canvas,host)
    );
    ro.observe(host);

    sampleRates(host);
    syncStates();

    setInterval(
      ()=>sampleRates(host),
      250
    );

    setInterval(
      syncStates,
      3000
    );

    function frame(t){
      ctx.setTransform(S.dpr,0,0,S.dpr,0,0);
      render(ctx,t);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    const reset=document.getElementById('resetViewBtn');
    if(reset){
      reset.addEventListener('click',()=>{
        S.smoothEventRate=S.eventRate;
        S.smoothTradeRate=S.tradeRate;
      });
    }

    console.info(
      '[MEMEFLOW Flow V4] Dark Industrial Observability active'
    );
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {once:true}
    );
  }else{
    boot();
  }
})();
JS

python3 - "$HTML" <<'PY'
from pathlib import Path
import re

p=Path("/home/runner/workspace/memeflow-app/system.html")
s=p.read_text(encoding="utf-8")

# Remove every previous Orbit visual layer.
s=re.sub(
    r'\s*<link[^>]+memeflow-orbit-v2\.css[^>]*>\s*',
    '\n',
    s,
    flags=re.I
)

s=re.sub(
    r'\s*<script[^>]+memeflow-orbit-v2\.js[^>]*>\s*</script>\s*',
    '\n',
    s,
    flags=re.I
)

# Remove old embedded 3D renderer only.
s=re.sub(
    r'\s*<script[^>]+memeflow-3d/embed\.js[^>]*>\s*</script>\s*',
    '\n',
    s,
    flags=re.I
)

# Remove old V4 refs if rerunning.
s=re.sub(
    r'\s*<link[^>]+memeflow-flow-v4\.css[^>]*>\s*',
    '\n',
    s,
    flags=re.I
)

s=re.sub(
    r'\s*<script[^>]+memeflow-flow-v4\.js[^>]*>\s*</script>\s*',
    '\n',
    s,
    flags=re.I
)

css='<link rel="stylesheet" href="/memeflow-flow-v4.css?v=4.0-industrial">'
js='<script src="/memeflow-flow-v4.js?v=4.0-industrial" defer></script>'

# Stop system.js visual renderer but keep all its telemetry/inspector logic.
flag='<script>window.__MEMEFLOW_TRUE_3D_ACTIVE__=true;</script>'

head=s.lower().rfind('</head>')
if head<0:
    raise SystemExit("ERROR: </head> not found")

s=s[:head]+css+'\n'+flag+'\n'+s[head:]

body=s.lower().rfind('</body>')
if body<0:
    raise SystemExit("ERROR: </body> not found")

s=s[:body]+js+'\n'+s[body:]

p.write_text(s,encoding="utf-8")
PY

echo
echo "=== VERIFY ==="
grep -n "memeflow-flow-v4" "$HTML"
grep -n "MEMEFLOW_TRUE_3D_ACTIVE" "$HTML"

echo
echo "======================================================"
echo " MEMEFLOW FLOW V4 · INDUSTRIAL OBSERVABILITY INSTALLED"
echo "======================================================"
echo
echo "REAL SPEED:"
echo "  #eventCount  -> INGEST"
echo "  #tradeCount  -> DECODE"
echo
echo "REAL STATES:"
echo "  /api/ai/decisions?scope=all&limit=200"
echo
echo "OLD 3D:"
echo "  disabled on this page only"
echo
echo "Backend:       NOT MODIFIED"
echo "Evaluator:     NOT MODIFIED"
echo "Trading logic: NOT MODIFIED"
