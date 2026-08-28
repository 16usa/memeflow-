#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"
CSS="$APP/memeflow-orbit-v2.css"
JS="$APP/memeflow-orbit-v2.js"
HTML="$APP/system.html"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "=== MEMEFLOW ORBIT V3 UPGRADE ==="

test -f "$HTML"
test -f "$CSS"
test -f "$JS"

cp "$CSS" "${CSS}.before-v3.${STAMP}.bak"
cp "$JS"  "${JS}.before-v3.${STAMP}.bak"
cp "$HTML" "${HTML}.before-v3-render.${STAMP}.bak"

echo "[1/2] Writing V3 CSS..."
cat > "$CSS" <<'CSS'
/* MEMEFLOW ORBIT V3
   Visual-only upgrade. No trading / backend logic changes.
*/

.mf-orbit-v2-host{
  position:relative !important;
  overflow:hidden !important;
  isolation:isolate !important;
  min-height:390px;
  background:
    radial-gradient(circle at 50% 48%, rgba(22,38,48,.24), transparent 24%),
    radial-gradient(circle at 50% 52%, rgba(0,229,240,.03), transparent 58%),
    linear-gradient(180deg, #05080c 0%, #04070b 100%) !important;
}

.mf-orbit-v2-host::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:1;
  pointer-events:none;
  background:
    radial-gradient(circle at center, transparent 22%, rgba(0,0,0,.10) 70%, rgba(0,0,0,.40) 100%);
}

.mf-orbit-v2-canvas{
  position:absolute !important;
  inset:0 !important;
  z-index:5 !important;
  width:100% !important;
  height:100% !important;
  display:block !important;
  touch-action:none;
  cursor:grab;
  user-select:none;
  -webkit-user-select:none;
}

.mf-orbit-v2-canvas:active{
  cursor:grabbing;
}

.mf-orbit-v2-original-canvas{
  opacity:0 !important;
  pointer-events:none !important;
}

.mf-orbit-v2-badge{
  position:absolute;
  left:14px;
  bottom:13px;
  z-index:8;
  display:flex;
  align-items:center;
  gap:8px;
  pointer-events:none;
  color:#7f8d9a;
  font:800 8px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  letter-spacing:.14em;
  text-transform:uppercase;
}

.mf-orbit-v2-badge i{
  width:7px;
  height:7px;
  border-radius:50%;
  background:#50e7a5;
  box-shadow:0 0 10px rgba(80,231,165,.5);
}

.mf-orbit-v2-badge.waiting i{
  background:#efc058;
  box-shadow:0 0 10px rgba(239,192,88,.45);
}

@media (max-width:820px){
  .mf-orbit-v2-host{
    min-height:340px;
  }
  .mf-orbit-v2-badge{
    left:10px;
    bottom:9px;
  }
}

@media (max-width:430px){
  .mf-orbit-v2-host{
    min-height:310px;
  }
}

@media (prefers-reduced-motion:reduce){
  .mf-orbit-v2-canvas{
    cursor:default;
  }
}
CSS

echo "[2/2] Writing V3 JS..."
cat > "$JS" <<'JS'
(() => {
  'use strict';

  if (window.__MEMEFLOW_ORBIT_V3__) return;
  window.__MEMEFLOW_ORBIT_V3__ = true;

  const TAU = Math.PI * 2;
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  const COLORS = {
    white:    [221,233,242],
    core:     [83,222,245],
    waiting:  [239,192,88],
    watch:    [84,221,255],
    blocked:  [255,91,110],
    ready:    [78,232,165],
    trading:  [86,241,196],
    muted:    [84,101,117],
    neutral:  [125,144,159]
  };

  const state = {
    yaw: -0.18,
    pitch: 0.09,
    zoom: 1.03,
    targetYaw: -0.18,
    targetPitch: 0.09,
    targetZoom: 1.03,
    dragging: false,
    lastX: 0,
    lastY: 0,
    width: 1,
    height: 1,
    dpr: 1,
    apiOK: false,
    hasTelemetry: false,
    healthOK: false,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false,
    counts: {
      WAITING: 0,
      WATCH: 0,
      BLOCKED: 0,
      'BUY READY': 0,
      TRADING: 0,
      TOTAL: 0
    },
    particles: [],
    ambient: []
  };

  const ANCHORS = {
    input:    {x:-320,y:-8,z:10},
    waiting:  {x:-160,y:-112,z:25},
    watch:    {x:0,y:-140,z:22},
    blocked:  {x:-205,y:135,z:30},
    ready:    {x:180,y:-24,z:-5},
    trading:  {x:288,y:72,z:-20}
  };

  function hash(str){
    let h = 2166136261;
    str = String(str || '');
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function randFrom(n){
    n = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function visible(el){
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 140 && r.height > 140 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function textOf(el){
    return String(el?.innerText || el?.textContent || '');
  }

  function findArchitectureSection(){
    const direct = [
      '#liveInspector3d',
      '#live-inspector-3d',
      '#pipeline3d',
      '#pipeline-3d',
      '#pipelineScene',
      '#pipeline-scene',
      '#architecture3d',
      '#architecture-3d',
      '#threeContainer',
      '#three-container',
      '[data-pipeline-3d]',
      '[data-live-inspector]',
      '[data-architecture-3d]',
      '.pipeline-3d',
      '.live-inspector-3d',
      '.architecture-3d',
      '.three-stage',
      '.three-scene'
    ];

    for (const selector of direct){
      const el = document.querySelector(selector);
      if (visible(el)) return el;
    }

    const candidates = [
      ...document.querySelectorAll('section,article,.panel,.card,.inspector,[class*="architecture"],[class*="pipeline"],[class*="inspector"]')
    ];

    const scored = candidates.map(el => {
      const t = textOf(el).toUpperCase();
      let score = 0;
      if (t.includes('REAL-TIME ARCHITECTURE')) score += 15;
      if (t.includes('LIVE INSPECTOR')) score += 12;
      if (t.includes('RESET VIEW')) score += 8;
      if (t.includes('MEMEFLOW CORE')) score += 6;
      if (t.includes('WAITING')) score += 2;
      if (t.includes('BLOCKED')) score += 2;
      if (t.includes('BUY READY')) score += 2;
      return { el, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

    const section = scored[0]?.el;
    if (!section) return null;

    const canvases = [...section.querySelectorAll('canvas')].filter(visible);
    if (canvases.length){
      canvases.sort((a,b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.width * br.height - ar.width * ar.height;
      });
      return canvases[0].parentElement || section;
    }

    return [...section.querySelectorAll('div')]
      .filter(visible)
      .sort((a,b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.width * br.height - ar.width * ar.height;
      })[0] || section;
  }

  function makeCanvas(host){
    host.classList.add('mf-orbit-v2-host');

    for (const old of host.querySelectorAll('canvas')){
      if (!old.classList.contains('mf-orbit-v2-canvas')){
        old.classList.add('mf-orbit-v2-original-canvas');
      }
    }

    let canvas = host.querySelector('.mf-orbit-v2-canvas');
    if (!canvas){
      canvas = document.createElement('canvas');
      canvas.className = 'mf-orbit-v2-canvas';
      canvas.setAttribute('aria-label', 'Live MEMEFLOW pipeline visualization');
      host.appendChild(canvas);
    }

    let badge = host.querySelector('.mf-orbit-v2-badge');
    if (!badge){
      badge = document.createElement('div');
      badge.className = 'mf-orbit-v2-badge';
      badge.innerHTML = '<i></i><span>AWAITING TOKEN FLOW</span>';
      host.appendChild(badge);
    }

    return canvas;
  }

  function normalizeState(raw){
    const s = String(raw || '').trim().toUpperCase();
    if (s === 'BUY_READY') return 'BUY READY';
    if (s.includes('BUY') && s.includes('READY')) return 'BUY READY';
    if (s.includes('WATCH')) return 'WATCH';
    if (s.includes('TRAD') || s.includes('POSITION') || s.includes('OPEN')) return 'TRADING';
    if (s.includes('BLOCK') || s.includes('REJECT') || s.includes('EXPIRED') || s.includes('IGNORED') || s.includes('CLOSED')) return 'BLOCKED';
    return 'WAITING';
  }

  function updateBadge(host){
    const badge = host.querySelector('.mf-orbit-v2-badge');
    if (!badge) return;
    badge.classList.toggle('waiting', !state.hasTelemetry);
    badge.innerHTML = state.hasTelemetry
      ? '<i></i><span>LIVE TOKEN FLOW</span>'
      : '<i></i><span>AWAITING TOKEN FLOW</span>';
  }

  async function fetchLiveData(host){
    try {
      const response = await fetch('/api/ai/decisions?scope=all&limit=200', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept:'application/json' }
      });

      if (!response.ok) throw new Error('HTTP '+response.status);

      const data = await response.json();
      const rows = Array.isArray(data?.decisions) ? data.decisions : [];
      state.apiOK = true;

      const counts = {
        WAITING: 0,
        WATCH: 0,
        BLOCKED: 0,
        'BUY READY': 0,
        TRADING: 0,
        TOTAL: rows.length
      };

      for (const row of rows){
        const s = normalizeState(row?.state);
        counts[s] = (counts[s] || 0) + 1;
      }

      if (data?.counts){
        if (Number.isFinite(Number(data.counts.totalEvaluated))){
          counts.TOTAL = Number(data.counts.totalEvaluated);
        }
        if (Number.isFinite(Number(data.counts.processing)) && counts.WAITING === 0){
          counts.WAITING = Number(data.counts.processing);
        }
        if (Number.isFinite(Number(data.counts.candidates)) && counts['BUY READY'] === 0){
          counts['BUY READY'] = Number(data.counts.candidates);
        }
        if (Number.isFinite(Number(data.counts.filtered)) && counts.BLOCKED === 0){
          counts.BLOCKED = Number(data.counts.filtered);
        }
      }

      state.counts = counts;
      state.hasTelemetry = rows.length > 0 || counts.TOTAL > 0;
      rebuildParticles(rows);

    } catch (err){
      state.apiOK = false;
      state.hasTelemetry = false;
      state.counts = {
        WAITING:0,
        WATCH:0,
        BLOCKED:0,
        'BUY READY':0,
        TRADING:0,
        TOTAL:0
      };
      rebuildParticles([]);
    }

    try{
      const r = await fetch('/api/system/health', { credentials:'same-origin', cache:'no-store' });
      state.healthOK = r.ok;
    }catch{
      state.healthOK = false;
    }

    updateBadge(host);
  }

  function rebuildParticles(rows){
    const source = Array.isArray(rows) ? rows.slice(0, 180) : [];
    const next = [];

    for (let i=0;i<source.length;i++){
      const row = source[i] || {};
      const key = row.mint || row.tokenMint || row.tokenAddress || row.id || ('row-'+i);
      const h = hash(key);
      const s = normalizeState(row.state);

      next.push({
        id:key,
        state:s,
        seed:h,
        speed:.14 + randFrom(h+11)*.22,
        size:.85 + randFrom(h+19)*1.7,
        phase:randFrom(h+31)*TAU,
        yBand:(randFrom(h+7)-.5)*120,
        radius:95 + randFrom(h+3)*110
      });
    }

    state.particles = next;

    const ambient = [];
    for (let i=0;i<34;i++){
      const h = hash('ambient-'+i);
      ambient.push({
        seed:h,
        speed:.12 + randFrom(h+2)*.08,
        size:.55 + randFrom(h+3)*.95,
        phase:randFrom(h+5)*TAU,
        lane:i%3
      });
    }
    state.ambient = ambient;
  }

  function rotatePoint(p){
    let x=p.x, y=p.y, z=p.z;

    const cy=Math.cos(state.yaw), sy=Math.sin(state.yaw);
    const x1=x*cy-z*sy;
    const z1=x*sy+z*cy;

    const cp=Math.cos(state.pitch), sp=Math.sin(state.pitch);
    const y1=y*cp-z1*sp;
    const z2=y*sp+z1*cp;

    return {x:x1,y:y1,z:z2};
  }

  function project(p){
    const r = rotatePoint(p);
    const focal = 700;
    const camera = 560 / state.zoom;
    const depth = camera + r.z;
    const scale = focal / Math.max(160, depth);
    return {
      x: state.width*.5 + r.x*scale,
      y: state.height*.53 + r.y*scale,
      z: r.z,
      scale
    };
  }

  function rgba(c,a){
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  function line3(ctx,a,b,color,alpha=1,width=1){
    const A = project(a), B = project(b);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function dot3(ctx,p,color,size=2,alpha=1,glow=0){
    const P = project(p);
    const r = Math.max(.5, size * P.scale);
    ctx.save();
    if (glow){
      ctx.shadowBlur = glow * P.scale;
      ctx.shadowColor = rgba(color, .72);
    }
    ctx.beginPath();
    ctx.arc(P.x, P.y, r, 0, TAU);
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
    ctx.restore();
  }

  function ring3(ctx,radius,y,color,alpha=.16,segments=72){
    let prev = null;
    for (let i=0;i<=segments;i++){
      const a = (i/segments)*TAU;
      const p = { x:Math.cos(a)*radius, y:y, z:Math.sin(a)*radius };
      if (prev) line3(ctx, prev, p, color, alpha, 1);
      prev = p;
    }
  }

  function bezier(a,b,c,d,t){
    const u = 1 - t;
    return {
      x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
      y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y,
      z: u*u*u*a.z + 3*u*u*t*b.z + 3*u*t*t*c.z + t*t*t*d.z
    };
  }

  function pathLine(ctx,a,b,c,d,color,alpha=.18){
    let prev = a;
    for (let i=1;i<=32;i++){
      const p = bezier(a,b,c,d,i/32);
      line3(ctx, prev, p, color, alpha, 1);
      prev = p;
    }
  }

  function particleColor(s){
    if (s === 'WATCH') return COLORS.watch;
    if (s === 'BLOCKED') return COLORS.blocked;
    if (s === 'BUY READY') return COLORS.ready;
    if (s === 'TRADING') return COLORS.trading;
    return COLORS.waiting;
  }

  function particlePosition(p,t){
    const tt = t*.001*p.speed + p.phase;

    if (p.state === 'WAITING'){
      const r = p.radius * 1.12;
      return {
        x: Math.cos(tt)*r,
        y: p.yBand*.28 + Math.sin(tt*1.17)*12,
        z: Math.sin(tt)*r
      };
    }

    if (p.state === 'WATCH'){
      const r = p.radius * .76;
      return {
        x: Math.cos(tt*1.03)*r,
        y: p.yBand*.18 + Math.sin(tt*1.41)*9,
        z: Math.sin(tt*1.03)*r
      };
    }

    if (p.state === 'BLOCKED'){
      const progress = (Math.sin(tt*.72)+1)/2;
      return bezier(
        {x:-10,y:0,z:0},
        {x:-72,y:22,z:30},
        {x:-132,y:92,z:26},
        ANCHORS.blocked,
        progress
      );
    }

    if (p.state === 'BUY READY'){
      const progress = (Math.sin(tt*.66)+1)/2;
      return bezier(
        {x:12,y:-4,z:0},
        {x:86,y:-8,z:-12},
        {x:138,y:-18,z:-8},
        ANCHORS.ready,
        progress
      );
    }

    if (p.state === 'TRADING'){
      const progress = (Math.sin(tt*.60)+1)/2;
      return bezier(
        ANCHORS.ready,
        {x:220,y:6,z:-10},
        {x:253,y:42,z:-20},
        ANCHORS.trading,
        progress
      );
    }

    return {x:0,y:0,z:0};
  }

  function drawGrid(ctx){
    for (let i=-4;i<=4;i++){
      line3(ctx, {x:-320,y:155,z:i*52}, {x:320,y:155,z:i*52}, COLORS.muted, .05, 1);
      line3(ctx, {x:i*68,y:155,z:-220}, {x:i*68,y:155,z:220}, COLORS.muted, .05, 1);
    }
  }

  function drawAnchor(ctx,p,label,count,color){
    const P = project(p);

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = rgba(color,.30);
    ctx.beginPath();
    ctx.arc(P.x, P.y, 3.8*P.scale, 0, TAU);
    ctx.fillStyle = rgba(color,.92);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '800 8px system-ui,-apple-system,sans-serif';
    ctx.fillStyle = rgba(color,.92);
    ctx.fillText(label, P.x, P.y-8);

    ctx.textBaseline = 'top';
    ctx.font = '700 8px system-ui,-apple-system,sans-serif';
    ctx.fillStyle = 'rgba(160,176,190,.74)';
    ctx.fillText(String(count || 0), P.x, P.y+6);
  }

  function drawCore(ctx,t){
    const c = project({x:0,y:0,z:0});
    const r = clamp(42*c.scale, 30, 48);

    const glow = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, r*2.2);
    glow.addColorStop(0, 'rgba(121,243,255,.18)');
    glow.addColorStop(.32, 'rgba(71,211,236,.09)');
    glow.addColorStop(1, 'rgba(71,211,236,0)');
    ctx.beginPath();
    ctx.arc(c.x, c.y, r*2.2, 0, TAU);
    ctx.fillStyle = glow;
    ctx.fill();

    const body = ctx.createRadialGradient(c.x-r*.24, c.y-r*.28, r*.06, c.x, c.y, r);
    body.addColorStop(0,'rgba(204,249,255,.24)');
    body.addColorStop(.25,'rgba(61,208,232,.16)');
    body.addColorStop(.58,'rgba(15,52,63,.26)');
    body.addColorStop(1,'rgba(5,16,22,.90)');

    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(95,225,245,.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i=0;i<12;i++){
      const a = t*.00016 + (i/12)*TAU;
      const p = {
        x: Math.cos(a)*36,
        y: Math.sin(a*1.8)*10,
        z: Math.sin(a)*36
      };
      dot3(ctx, p, COLORS.core, 1.1, .62, 7);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${clamp(9*c.scale, 9, 12)}px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle = 'rgba(225,246,250,.92)';
    ctx.fillText('CORE', c.x, c.y-1);

    ctx.font = `700 ${clamp(6*c.scale, 6, 8)}px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle = state.hasTelemetry
      ? 'rgba(80,231,165,.80)'
      : 'rgba(239,192,88,.75)';
    ctx.fillText(
      state.hasTelemetry ? 'LIVE TOKEN FLOW' : 'AWAITING TOKEN FLOW',
      c.x,
      c.y + 12
    );
  }

  function drawInbound(ctx,t){
    const count = state.hasTelemetry
      ? Math.max(10, Math.min(26, Math.ceil((state.counts.TOTAL || state.particles.length)/4)))
      : 12;

    for (let i=0;i<count;i++){
      const q = ((t*.00018)+(i/count))%1;
      const pos = bezier(
        ANCHORS.input,
        {x:-255,y:-28 + Math.sin(i)*18, z:42},
        {x:-112,y:6, z:-20},
        {x:-28,y:0,z:0},
        q
      );
      const col = state.hasTelemetry
        ? (i%5===0 ? COLORS.white : COLORS.neutral)
        : COLORS.neutral;
      const glow = state.hasTelemetry ? 5 : 2;
      const alpha = state.hasTelemetry ? .48 : .20;
      dot3(ctx, pos, col, state.hasTelemetry ? 1.05 : .85, alpha, glow);
    }
  }

  function drawAmbient(ctx,t){
    for (const p of state.ambient){
      const tt = t*.001*p.speed + p.phase;
      const radius = 110 + p.lane*28;
      const pos = {
        x: Math.cos(tt)*radius,
        y: -10 + (p.lane-1)*16 + Math.sin(tt*1.7)*7,
        z: Math.sin(tt)*radius
      };
      dot3(ctx, pos, COLORS.neutral, p.size, .17, 0);
    }
  }

  function drawScene(ctx,t){
    ctx.clearRect(0,0,state.width,state.height);

    const bg = ctx.createRadialGradient(
      state.width*.5, state.height*.48, 8,
      state.width*.5, state.height*.55,
      Math.max(state.width,state.height)*.68
    );
    bg.addColorStop(0, 'rgba(10,22,28,.20)');
    bg.addColorStop(.48, 'rgba(5,10,15,.04)');
    bg.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,state.width,state.height);

    drawGrid(ctx);

    ring3(ctx, 92, 0, COLORS.core, .09);
    ring3(ctx, 132, 0, COLORS.watch, .06);
    ring3(ctx, 176, 0, COLORS.waiting, .04);

    pathLine(ctx, ANCHORS.input, {x:-255,y:-28,z:40}, {x:-112,y:6,z:-20}, {x:-28,y:0,z:0}, COLORS.white, .06);
    pathLine(ctx, {x:-8,y:0,z:0}, {x:-70,y:24,z:30}, {x:-132,y:92,z:26}, ANCHORS.blocked, COLORS.blocked, .12);
    pathLine(ctx, {x:10,y:-2,z:0}, {x:82,y:-8,z:-12}, {x:136,y:-18,z:-8}, ANCHORS.ready, COLORS.ready, .11);
    pathLine(ctx, ANCHORS.ready, {x:220,y:6,z:-10}, {x:253,y:42,z:-20}, ANCHORS.trading, COLORS.trading, .10);

    drawInbound(ctx,t);

    if (!state.hasTelemetry){
      drawAmbient(ctx,t);
    }

    const rows = state.particles
      .map(p => ({p, pos:particlePosition(p,t)}))
      .sort((a,b) => a.pos.z - b.pos.z);

    for (const row of rows){
      const color = particleColor(row.p.state);
      const glow = row.p.state === 'BLOCKED'
        ? 6
        : row.p.state === 'BUY READY' || row.p.state === 'TRADING'
          ? 8
          : 4;
      const alpha = row.p.state === 'WAITING'
        ? .62
        : row.p.state === 'WATCH'
          ? .74
          : .84;
      dot3(ctx, row.pos, color, row.p.size, alpha, glow);
    }

    drawCore(ctx,t);

    drawAnchor(ctx, ANCHORS.waiting, 'WAITING', state.counts.WAITING, COLORS.waiting);
    drawAnchor(ctx, ANCHORS.watch, 'WATCH', state.counts.WATCH, COLORS.watch);
    drawAnchor(ctx, ANCHORS.blocked, 'BLOCKED', state.counts.BLOCKED, COLORS.blocked);
    drawAnchor(ctx, ANCHORS.ready, 'BUY READY', state.counts['BUY READY'], COLORS.ready);
    drawAnchor(ctx, ANCHORS.trading, 'TRADING', state.counts.TRADING, COLORS.trading);
  }

  function resize(canvas,host){
    const r = host.getBoundingClientRect();
    state.width = Math.max(1, Math.round(r.width));
    state.height = Math.max(1, Math.round(r.height));
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
  }

  function resetView(){
    state.targetYaw = -0.18;
    state.targetPitch = 0.09;
    state.targetZoom = 1.03;
  }

  function connectControls(canvas){
    canvas.addEventListener('pointerdown', e => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('pointermove', e => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.targetYaw += dx * .0058;
      state.targetPitch = clamp(state.targetPitch + dy * .0048, -.65, .65);
    });

    const stop = e => {
      state.dragging = false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
    };

    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      state.targetZoom = clamp(
        state.targetZoom * (e.deltaY > 0 ? .92 : 1.09),
        .70,
        1.55
      );
    }, {passive:false});

    canvas.addEventListener('dblclick', resetView);

    for (const button of document.querySelectorAll('button,[role="button"],a')){
      if (/reset\s*view/i.test(textOf(button))){
        button.addEventListener('click', () => setTimeout(resetView, 0));
      }
    }
  }

  function boot(){
    const host = findArchitectureSection();
    if (!host){
      console.warn('[MEMEFLOW Orbit V3] Architecture container not found.');
      return;
    }

    const canvas = makeCanvas(host);
    const ctx = canvas.getContext('2d', {alpha:true});
    if (!ctx) return;

    resize(canvas, host);
    connectControls(canvas);
    rebuildParticles([]);
    updateBadge(host);

    const ro = new ResizeObserver(() => resize(canvas, host));
    ro.observe(host);

    fetchLiveData(host);
    setInterval(() => fetchLiveData(host), 2500);

    let last = performance.now();

    function frame(t){
      const dt = Math.min(32, t - last);
      last = t;

      state.yaw += (state.targetYaw - state.yaw) * .08;
      state.pitch += (state.targetPitch - state.pitch) * .08;
      state.zoom += (state.targetZoom - state.zoom) * .08;

      if (!state.dragging && !state.reducedMotion){
        state.targetYaw += dt * .000010;
      }

      ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
      drawScene(ctx, t);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    window.MEMEFLOW_ORBIT_V3 = {
      resetView,
      refresh: () => fetchLiveData(host),
      getState: () => ({
        apiOK: state.apiOK,
        hasTelemetry: state.hasTelemetry,
        counts: {...state.counts},
        particles: state.particles.length
      })
    };

    console.info('[MEMEFLOW Orbit V3] installed on', host);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 80), {once:true});
  } else {
    setTimeout(boot, 80);
  }
})();
JS

echo
echo "=== DONE ==="
echo "Updated:"
echo "  $CSS"
echo "  $JS"
echo
echo "Backups:"
echo "  ${CSS}.before-v3.${STAMP}.bak"
echo "  ${JS}.before-v3.${STAMP}.bak"
echo "  ${HTML}.before-v3-render.${STAMP}.bak"
echo
echo "--- quick verify ---"
grep -n "MEMEFLOW ORBIT V3" "$JS" | head -n 1 || true
grep -n "AWAITING TOKEN FLOW" "$JS" | head -n 2 || true
