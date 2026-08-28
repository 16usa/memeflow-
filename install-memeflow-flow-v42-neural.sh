#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
HTML="$APP/system.html"
CSS="$APP/memeflow-flow-v4.css"
JS="$APP/memeflow-flow-v4.js"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW FLOW V4.2 · NEURAL NETWORK VIEW ==="

test -f "$HTML"

if [ -f "$CSS" ]; then cp "$CSS" "${CSS}.before-v42.${STAMP}.bak"; fi
if [ -f "$JS" ]; then cp "$JS" "${JS}.before-v42.${STAMP}.bak"; fi
cp "$HTML" "${HTML}.before-v42.${STAMP}.bak"

cat > "$CSS" <<'CSS'
/* MEMEFLOW FLOW V4.2 · NEURAL NETWORK VIEW */

#systemCanvas,
#memeflowTrue3DHost,
#labels,
.scene-hint{
  opacity:0 !important;
  pointer-events:none !important;
}

.viewport-wrap{
  min-height:520px !important;
  height:clamp(520px,64vh,760px) !important;
  background:
    radial-gradient(ellipse at 50% 52%, rgba(34,120,144,.05), transparent 30%),
    linear-gradient(180deg,#04090d 0%,#03070a 100%) !important;
}

.mf-flow-v4{
  position:absolute;
  inset:0;
  z-index:7;
  overflow:hidden;
  pointer-events:auto;
  background:
    radial-gradient(ellipse at 52% 50%, rgba(48,122,144,.04), transparent 34%);
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
  left:14px;
  right:14px;
  top:12px;
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
  color:#7c8f9d;
  font:800 7px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.14em;
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
  border:1px solid rgba(130,165,190,.12);
  border-radius:10px;
  background:rgba(4,8,12,.54);
  backdrop-filter:blur(9px);
  -webkit-backdrop-filter:blur(9px);
  box-shadow:
    inset 0 1px rgba(255,255,255,.018),
    0 10px 26px rgba(0,0,0,.14);
}

.mf-flow-v4-rate{
  min-width:72px;
}

.mf-flow-v4-rate span{
  display:block;
  color:#647986;
  font:800 6px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.13em;
  text-transform:uppercase;
}

.mf-flow-v4-rate b{
  display:inline-block;
  margin-top:4px;
  color:#e2eef4;
  font:800 11px/1 system-ui,-apple-system,sans-serif;
  font-variant-numeric:tabular-nums;
}

.mf-flow-v4-rate small{
  margin-left:3px;
  color:#677a86;
  font:650 6px/1 system-ui,-apple-system,sans-serif;
}

.mf-flow-v4-rate.decode b{ color:#59daf5; }
.mf-flow-v4-rate.share b{ color:#8fa1ac; }
.mf-flow-v4-rate.queue b{ color:#8fa1ac; }

.mf-flow-v4-foot{
  position:absolute;
  left:14px;
  bottom:12px;
  z-index:4;
  display:flex;
  align-items:center;
  gap:8px;
  color:#6c818e;
  pointer-events:none;
  font:800 7px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.13em;
  text-transform:uppercase;
}

.mf-flow-v4-foot i{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#49e5a0;
  box-shadow:0 0 10px rgba(73,229,160,.45);
}

@media(max-width:760px){
  .viewport-wrap{
    min-height:520px !important;
    height:520px !important;
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
    font-size:6px;
    opacity:.78;
  }
}
CSS

cat > "$JS" <<'JS'
(() => {
  'use strict';

  if (window.__MEMEFLOW_FLOW_V42__) return;
  window.__MEMEFLOW_FLOW_V42__ = true;

  const TAU = Math.PI * 2;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  const C = {
    grid:[60,78,92],
    raw:[206,221,232],
    rawSoft:[132,156,170],
    decode:[72,208,246],
    core:[74,212,239],
    coreSoft:[34,108,129],
    waiting:[214,222,229],
    waitingSoft:[143,158,170],
    watch:[71,128,255],
    watchSoft:[61,97,174],
    blocked:[255,89,108],
    blockedSoft:[173,58,71],
    ready:[76,231,160],
    readySoft:[52,131,98]
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
    sourceNodes:[],
    decodeNodes:[],
    outNodes:{
      waiting:[],
      watch:[],
      blocked:[],
      ready:[]
    }
  };

  function readNumber(id){
    const el = document.getElementById(id);
    if(!el) return null;
    const raw = String(el.textContent || '').replace(/[^0-9.-]/g,'');
    if(!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function stateKey(raw=''){
    const s = String(raw).toUpperCase();
    if (s.includes('BUY') || s.includes('READY')) return 'READY';
    if (s.includes('BLOCK') || s.includes('REJECT') || s.includes('EXPIRED')) return 'BLOCKED';
    if (s.includes('WATCH')) return 'WATCH';
    return 'WAITING';
  }

  function rgba(c,a){
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  function text(ctx,label,x,y,size,color,alpha=.9,weight=800,align='left'){
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.font = `${weight} ${size}px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle = rgba(color,alpha);
    ctx.fillText(label,x,y);
    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function line(ctx,a,b,color,alpha=1,width=1){
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(b.x,b.y);
    ctx.strokeStyle = rgba(color,alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function curve(ctx,a,b,c,d,color,alpha=1,width=1){
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);
    ctx.strokeStyle = rgba(color,alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function dot(ctx,p,color,r,alpha=1,glow=0){
    ctx.save();
    if(glow){
      ctx.shadowBlur = glow;
      ctx.shadowColor = rgba(color,.72);
    }
    ctx.beginPath();
    ctx.arc(p.x,p.y,r,0,TAU);
    ctx.fillStyle = rgba(color,alpha);
    ctx.fill();
    ctx.restore();
  }

  function bezier(a,b,c,d,t){
    const u = 1 - t;
    return {
      x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
      y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y
    };
  }

  function hash(s){
    s = String(s || '');
    let h = 2166136261;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h,16777619);
    }
    return h >>> 0;
  }

  function rand(seed){
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function isLiveThroughput(){
    return (
      performance.now() - S.lastLiveAt < 9000 &&
      (S.eventRate > 0 || S.tradeRate > 0)
    );
  }

  function makeUI(host){
    host.innerHTML = `
      <canvas aria-label="MEMEFLOW neural realtime flow"></canvas>

      <div class="mf-flow-v4-topline">
        <div class="mf-flow-v4-mode">
          <i></i>
          <span>LIVE NEURAL FLOW</span>
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
        <span>LIVE DECISION FEED</span>
      </div>
    `;
    return host.querySelector('canvas');
  }

  function installHost(){
    const viewport = document.querySelector('.viewport-wrap');
    if(!viewport) return null;

    let host = viewport.querySelector('.mf-flow-v4');
    if(!host){
      host = document.createElement('div');
      host.className = 'mf-flow-v4';
      viewport.appendChild(host);
    }
    return { viewport, host };
  }

  function resize(canvas,host){
    const r = host.getBoundingClientRect();
    S.w = Math.max(1,Math.round(r.width));
    S.h = Math.max(1,Math.round(r.height));
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(S.w * S.dpr);
    canvas.height = Math.round(S.h * S.dpr);
    buildLayout();
  }

  function sampleRates(host){
    const now = performance.now();
    const events = readNumber('eventCount');
    const trades = readNumber('tradeCount');

    if(events == null && trades == null) return;

    if(S.lastEvents == null || S.lastTrades == null || !S.lastAt){
      S.lastEvents = events ?? 0;
      S.lastTrades = trades ?? 0;
      S.lastAt = now;
    } else {
      const changed =
        (events != null && events !== S.lastEvents) ||
        (trades != null && trades !== S.lastTrades);

      if(changed){
        const sec = Math.max(.25, (now - S.lastAt)/1000);
        const de = events == null ? 0 : Math.max(0, events - S.lastEvents);
        const dt = trades == null ? 0 : Math.max(0, trades - S.lastTrades);

        S.eventRate = de / sec;
        S.tradeRate = dt / sec;

        S.smoothEventRate =
          S.smoothEventRate === 0
            ? S.eventRate
            : S.smoothEventRate * .58 + S.eventRate * .42;

        S.smoothTradeRate =
          S.smoothTradeRate === 0
            ? S.tradeRate
            : S.smoothTradeRate * .58 + S.tradeRate * .42;

        if(de > 0 || dt > 0) S.lastLiveAt = now;

        S.lastEvents = events ?? S.lastEvents;
        S.lastTrades = trades ?? S.lastTrades;
        S.lastAt = now;
      }
    }

    const e = host.querySelector('[data-mf-events]');
    const t = host.querySelector('[data-mf-trades]');
    const sh = host.querySelector('[data-mf-share]');
    const q = host.querySelector('[data-mf-queue]');

    if(e) e.textContent = S.eventRate.toFixed(S.eventRate >= 100 ? 0 : 1);
    if(t) t.textContent = S.tradeRate.toFixed(S.tradeRate >= 100 ? 0 : 1);

    const share = S.eventRate > 0 ? (S.tradeRate / S.eventRate) * 100 : 0;
    if(sh) sh.textContent = share.toFixed(share >= 10 ? 1 : 2);

    const queue = readNumber('holderQueue');
    if(q) q.textContent = queue == null ? '0' : String(queue);

    const mode = host.querySelector('.mf-flow-v4-mode span');
    const modeDot = host.querySelector('.mf-flow-v4-mode i');

    if(mode){
      mode.textContent = isLiveThroughput() ? 'LIVE NEURAL FLOW' : 'STATE SNAPSHOT';
    }
    if(modeDot){
      modeDot.style.background = isLiveThroughput() ? '#4de6a1' : '#efc66a';
      modeDot.style.boxShadow = isLiveThroughput()
        ? '0 0 10px rgba(77,230,161,.55)'
        : '0 0 9px rgba(239,198,106,.35)';
    }
  }

  async function syncStates(){
    try{
      const r = await fetch('/api/ai/decisions?scope=all&limit=200', {
        cache:'no-store',
        credentials:'same-origin',
        headers:{ accept:'application/json' }
      });

      if(!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const rows = Array.isArray(data?.decisions) ? data.decisions : [];

      const counts = {
        WAITING:0,
        WATCH:0,
        BLOCKED:0,
        READY:0,
        TOTAL:rows.length
      };

      for(const row of rows){
        const k = stateKey(row?.state ?? row?.decision?.state);
        counts[k]++;
      }

      S.counts = counts;
    }catch(err){
      console.warn('[MEMEFLOW Flow V4.2] state sync failed', err);
    }
  }

  function buildLayout(){
    const mobile = S.w < 640;
    const leftX = S.w * 0.09;
    const panelW = mobile ? S.w * 0.09 : S.w * 0.10;
    const panelH = mobile ? 26 : 30;
    const panelGap = mobile ? 42 : 48;
    const startY = S.h * 0.33;

    S.sourceNodes = [];
    for(let i=0;i<6;i++){
      S.sourceNodes.push({
        panel:{
          x:leftX - panelW*.5,
          y:startY + i*panelGap - panelH*.5,
          w:panelW,
          h:panelH
        },
        out:{
          x:leftX + panelW*.5 + 4,
          y:startY + i*panelGap
        }
      });
    }

    const decodeCols = [0.30,0.35,0.40,0.45].map(v => S.w*v);
    const decodeRows = mobile ? 6 : 7;
    S.decodeNodes = [];

    for(let c=0;c<decodeCols.length;c++){
      for(let r=0;r<decodeRows;r++){
        const seed = c*100 + r*11 + S.w;
        const x = decodeCols[c] + (rand(seed) - .5) * 18;
        const y = S.h*(0.27 + (r/(decodeRows-1))*0.42) + (rand(seed+9)-.5)*16;
        S.decodeNodes.push({ x,y,col:c,row:r });
      }
    }

    S.core = {
      x:S.w*0.57,
      y:S.h*0.55,
      w:mobile ? 118 : 136,
      h:mobile ? 88 : 102
    };

    const clusterRightX = S.w * 0.90;
    S.outNodes = {
      waiting: clusterNodes(clusterRightX, S.h*0.32, 'waiting'),
      watch: clusterNodes(clusterRightX, S.h*0.45, 'watch'),
      blocked: clusterNodes(clusterRightX, S.h*0.61, 'blocked'),
      ready: clusterNodes(clusterRightX, S.h*0.78, 'ready')
    };
  }

  function clusterNodes(cx,cy,key){
    const out = [];
    const base = hash(key + ':' + S.w + ':' + S.h);
    for(let i=0;i<16;i++){
      const a = (i/16) * TAU + rand(base+i)*.55;
      const rr = 10 + rand(base+i*3)*26;
      out.push({
        x: cx + Math.cos(a)*rr,
        y: cy + Math.sin(a)*rr*.62
      });
    }
    out.push({ x:cx, y:cy });
    return out;
  }

  function drawGrid(ctx){
    const left = S.w * 0.02;
    const right = S.w * 0.98;
    const top = S.h * 0.18;
    const bottom = S.h * 0.92;

    for(let i=0;i<10;i++){
      const y = top + (bottom-top)*(i/9);
      line(ctx,{x:left,y},{x:right,y},C.grid,i===5?.045:.022,1);
    }

    for(let i=0;i<15;i++){
      const x = left + (right-left)*(i/14);
      line(ctx,{x,y:top},{x,y:bottom},C.grid,.018,1);
    }
  }

  function drawSourcePanels(ctx){
    for(const node of S.sourceNodes){
      const p = node.panel;
      ctx.save();
      roundRect(ctx,p.x,p.y,p.w,p.h,6);
      ctx.fillStyle = 'rgba(6,13,19,.56)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(92,116,132,.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      for(let i=0;i<3;i++){
        const yy = p.y + 8 + i*6;
        line(ctx,{x:p.x+8,y:yy},{x:p.x+p.w-18,y:yy},C.rawSoft,.12,1);
      }

      dot(ctx,{x:p.x+p.w-12,y:p.y+p.h*.5},C.decode,1.7,.9,5);
      dot(ctx,{x:p.x+p.w-7,y:p.y+p.h*.5},C.decode,1.7,.9,5);
      ctx.restore();
    }

    text(ctx,'RAW EVENTS',S.w*0.11,S.h*0.24,8,C.raw,.92,850,'center');
    text(ctx,'SOLANA / PUMP STREAM',S.w*0.11,S.h*0.28,6,C.rawSoft,.92,750,'center');
  }

  function drawDecodeMesh(ctx,t){
    text(ctx,'DECODE',S.w*0.38,S.h*0.24,8,C.decode,.95,850,'center');
    text(ctx,'TRADE EVENTS',S.w*0.38,S.h*0.28,6,C.rawSoft,.92,750,'center');

    const cols = {};
    for(const n of S.decodeNodes){
      if(!cols[n.col]) cols[n.col] = [];
      cols[n.col].push(n);
    }

    for(let c=0;c<3;c++){
      const A = cols[c] || [];
      const B = cols[c+1] || [];
      for(let i=0;i<A.length;i++){
        const a = A[i];
        for(let j=0;j<B.length;j++){
          const b = B[j];
          if(Math.abs(a.row - b.row) <= 1){
            line(ctx,a,b,C.decode,.12,1);
          }
        }
      }
    }

    for(const src of S.sourceNodes){
      const target = cols[0][Math.floor(rand(src.out.x)*cols[0].length) % cols[0].length];
      curve(
        ctx,
        src.out,
        {x:src.out.x+20,y:src.out.y},
        {x:target.x-28,y:target.y},
        target,
        C.rawSoft,
        .16,
        1
      );
    }

    for(const node of S.decodeNodes){
      dot(ctx,node,C.decode,2.1,.82,6);
    }

    const flow = isLiveThroughput();
    const rawBundles = clamp(Math.round(6 + Math.log1p(S.smoothEventRate)*2.4), 6, 20);
    for(let i=0;i<rawBundles;i++){
      const src = S.sourceNodes[i % S.sourceNodes.length];
      const target = cols[0][i % cols[0].length];
      const q = flow ? ((t*.00007*speedFactor()) + i/rawBundles) % 1 : (i/rawBundles);
      const p = bezier(
        src.out,
        {x:src.out.x+20,y:src.out.y},
        {x:target.x-28,y:target.y},
        target,
        q
      );
      dot(ctx,p,C.raw, flow ? 1.8 : 1.1, flow ? .74 : .18, flow ? 4 : 0);
    }

    const decodePulseCount = clamp(Math.round(4 + Math.log1p(S.smoothTradeRate)*1.8), 4, 16);
    for(let i=0;i<decodePulseCount;i++){
      const n1 = S.decodeNodes[(i*3) % S.decodeNodes.length];
      const n2 = S.decodeNodes[(i*5 + 9) % S.decodeNodes.length];
      const mid = {
        x:n1.x + (n2.x-n1.x)*(((t*.00011*speedFactor()) + i/decodePulseCount)%1),
        y:n1.y + (n2.y-n1.y)*(((t*.00011*speedFactor()) + i/decodePulseCount)%1)
      };
      dot(ctx,mid,C.decode,1.8,flow ? .88 : .25,flow ? 5 : 0);
    }
  }

  function drawCore(ctx){
    const c = S.core;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(66,205,232,.12)';
    roundRect(ctx,c.x-c.w/2,c.y-c.h/2,c.w,c.h,14);
    ctx.fillStyle = 'rgba(7,15,20,.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(78,205,229,.24)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    roundRect(ctx,c.x-c.w*0.30,c.y-c.h*0.30,c.w*0.60,c.h*0.60,8);
    ctx.fillStyle = 'rgba(6,14,19,.48)';
    ctx.fill();

    for(let i=0;i<18;i++){
      const x = c.x - c.w*.56 + (i/17) * c.w*1.12;
      line(ctx,{x,y:c.y-c.h*.54},{x,y:c.y-c.h*.62},C.coreSoft,.20,1);
      line(ctx,{x,y:c.y+c.h*.54},{x,y:c.y+c.h*.62},C.coreSoft,.20,1);
    }

    for(let i=0;i<14;i++){
      const y = c.y - c.h*.42 + (i/13) * c.h*.84;
      line(ctx,{x:c.x-c.w*.58,y},{x:c.x-c.w*.66,y},C.coreSoft,.18,1);
      line(ctx,{x:c.x+c.w*.58,y},{x:c.x+c.w*.66,y},C.coreSoft,.18,1);
    }

    text(ctx,'MEMEFLOW',c.x,c.y-10,10,C.raw,.94,850,'center');
    text(ctx,'CORE',c.x,c.y+5,9,C.decode,.92,850,'center');
    text(ctx,'PROCESSING',c.x,c.y+23,6,C.core,.66,760,'center');
  }

  function speedFactor(){
    const r = Math.max(S.smoothEventRate,0);
    return clamp(.45 + Math.log1p(r)/Math.log(801)*1.7, .45, 2.1);
  }

  function drawCoreLinks(ctx){
    const lastDecode = S.decodeNodes.filter(n => n.col === 3);
    for(let i=0;i<lastDecode.length;i++){
      const n = lastDecode[i];
      const target = {
        x: S.core.x - S.core.w/2 - 4,
        y: S.core.y - S.core.h*.24 + (i/(lastDecode.length-1))*S.core.h*.48
      };
      curve(
        ctx,
        n,
        {x:n.x+18,y:n.y},
        {x:target.x-18,y:target.y},
        target,
        C.decode,
        .18,
        1.2
      );
    }

    const count = clamp(Math.round(5 + Math.log1p(S.smoothTradeRate)*1.7), 5, 16);
    const flow = isLiveThroughput();
    for(let i=0;i<count;i++){
      const n = lastDecode[i % lastDecode.length];
      const target = {
        x: S.core.x - S.core.w/2 - 4,
        y: S.core.y - S.core.h*.24 + ((i % lastDecode.length)/(lastDecode.length-1))*S.core.h*.48
      };
      const q = flow ? ((performance.now()*.00009*speedFactor()) + i/count) % 1 : (i/count);
      const p = bezier(
        n,
        {x:n.x+18,y:n.y},
        {x:target.x-18,y:target.y},
        target,
        q
      );
      dot(ctx,p,C.decode,1.9,flow ? .86 : .24,flow ? 6 : 0);
    }
  }

  function drawStateLane(ctx,label,key,count,color,soft,cluster,t,y){
    const active = count > 0;
    const total = Math.max(1, S.counts.TOTAL);
    const ratio = count / total;
    const start = { x:S.core.x + S.core.w/2 + 6, y:S.core.y };
    const end = { x:S.w*0.89, y };
    const laneWidth = active ? clamp(1 + Math.sqrt(ratio)*5.2, 1.2, 4.8) : .8;

    curve(
      ctx,
      start,
      {x:S.w*0.68,y:S.core.y},
      {x:S.w*0.78,y:y},
      end,
      soft,
      active ? .22 : .05,
      laneWidth
    );

    for(let i=0;i<cluster.length;i++){
      const a = cluster[i];
      for(let j=i+1;j<cluster.length;j++){
        const b = cluster[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < 26){
          line(ctx,a,b,soft,active ? .22 : .05,1);
        }
      }
    }

    const visibleNodes = active
      ? clamp(Math.round(6 + Math.sqrt(count)*(S.w<520 ? .52 : .72)), 6, 22)
      : 4;

    for(let i=0;i<visibleNodes;i++){
      const n = cluster[i % cluster.length];
      dot(ctx,n,color,active ? 1.9 : 1.2,active ? .92 : .16,active ? 6 : 0);
    }

    dot(ctx,end,color,active ? 4.9 : 2.4,active ? .95 : .18,active ? 10 : 0);

    text(ctx,label,end.x-12,end.y-12,active ? 8 : 7,color,active ? .95 : .24,850,'right');
    text(ctx,String(count),end.x+12,end.y,active ? 11 : 9,color,active ? .92 : .24,850,'left');

    if(active){
      const pulseCount = clamp(Math.round(1 + Math.sqrt(count)*.38), 1, 10);
      const speed = isLiveThroughput() ? speedFactor()*.72 : .22;
      for(let i=0;i<pulseCount;i++){
        const q = ((t*.000075*speed) + i/pulseCount) % 1;
        const p = bezier(
          start,
          {x:S.w*0.68,y:S.core.y},
          {x:S.w*0.78,y:y},
          end,
          q
        );
        dot(ctx,p,color,key === 'blocked' ? 2.1 : 2.0,.66,key === 'blocked' ? 7 : 5);
      }
    }
  }

  function drawScene(ctx,t){
    ctx.clearRect(0,0,S.w,S.h);

    const glow = ctx.createRadialGradient(
      S.core.x,S.core.y,10,
      S.core.x,S.core.y,Math.max(S.w,S.h)*.36
    );
    glow.addColorStop(0,'rgba(31,106,123,.10)');
    glow.addColorStop(.42,'rgba(5,14,19,.03)');
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0,0,S.w,S.h);

    drawGrid(ctx);
    drawSourcePanels(ctx);
    drawDecodeMesh(ctx,t);
    drawCore(ctx);
    drawCoreLinks(ctx);

    drawStateLane(ctx,'WAITING','waiting',S.counts.WAITING,C.waiting,C.waitingSoft,S.outNodes.waiting,t,S.h*0.32);
    drawStateLane(ctx,'WATCH','watch',S.counts.WATCH,C.watch,C.watchSoft,S.outNodes.watch,t,S.h*0.45);
    drawStateLane(ctx,'BLOCKED','blocked',S.counts.BLOCKED,C.blocked,C.blockedSoft,S.outNodes.blocked,t,S.h*0.61);
    drawStateLane(ctx,'BUY READY','ready',S.counts.READY,C.ready,C.readySoft,S.outNodes.ready,t,S.h*0.78);

    if(!isLiveThroughput()){
      text(ctx,'AWAITING LIVE EVENTS',S.w*0.24,S.h*0.63,6,C.rawSoft,.68,760,'center');
    }
  }

  function boot(){
    const found = installHost();
    if(!found) return;

    const { host } = found;
    const canvas = makeUI(host);
    const ctx = canvas.getContext('2d',{alpha:true});
    if(!ctx) return;

    resize(canvas,host);

    const ro = new ResizeObserver(() => resize(canvas,host));
    ro.observe(host);

    sampleRates(host);
    syncStates();

    setInterval(() => sampleRates(host), 250);
    setInterval(() => syncStates(), 3000);

    function frame(t){
      ctx.setTransform(S.dpr,0,0,S.dpr,0,0);
      drawScene(ctx,t);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    console.info('[MEMEFLOW Flow V4.2] Neural network view active');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
JS

python3 - "$HTML" <<'PY'
from pathlib import Path
import re

p = Path("/home/runner/workspace/memeflow-app/system.html")
s = p.read_text(encoding="utf-8")

# remove old V4 refs if present
s = re.sub(
    r'\s*<link[^>]+memeflow-flow-v4\.css[^>]*>\s*',
    '\n',
    s,
    flags=re.I
)

s = re.sub(
    r'\s*<script[^>]+memeflow-flow-v4\.js[^>]*>\s*</script>\s*',
    '\n',
    s,
    flags=re.I
)

css = '<link rel="stylesheet" href="/memeflow-flow-v4.css?v=4.2-neural">'
js  = '<script src="/memeflow-flow-v4.js?v=4.2-neural" defer></script>'

head = s.lower().rfind('</head>')
if head < 0:
    raise SystemExit("ERROR: </head> not found")
s = s[:head] + css + '\n' + s[head:]

body = s.lower().rfind('</body>')
if body < 0:
    raise SystemExit("ERROR: </body> not found")
s = s[:body] + js + '\n' + s[body:]

p.write_text(s, encoding="utf-8")
PY

echo
echo "=== VERIFY ==="
grep -n "4.2-neural" "$HTML" || true
grep -n "Neural network view active" "$JS" || true

echo
echo "=================================================="
echo " MEMEFLOW FLOW V4.2 · NEURAL NETWORK INSTALLED"
echo "=================================================="
echo
echo "REAL SPEED:"
echo "  #eventCount -> INGEST"
echo "  #tradeCount -> DECODE"
echo
echo "REAL STATES:"
echo "  /api/ai/decisions?scope=all&limit=200"
echo
echo "Backend:       NOT MODIFIED"
echo "Evaluator:     NOT MODIFIED"
echo "Trading logic: NOT MODIFIED"
