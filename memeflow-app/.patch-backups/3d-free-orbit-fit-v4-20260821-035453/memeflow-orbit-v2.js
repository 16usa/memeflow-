(() => {
  'use strict';

  if (window.__MEMEFLOW_ORBIT_V2__) return;
  window.__MEMEFLOW_ORBIT_V2__ = true;

  const TAU = Math.PI * 2;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  const COLORS = {
    core:     [88,225,255],
    white:    [220,235,245],
    waiting:  [239,192,88],
    watch:    [84,221,255],
    blocked:  [255,91,110],
    ready:    [78,232,165],
    trading:  [83,242,178],
    muted:    [99,118,137]
  };

  const state = {
    yaw: -0.23,
    pitch: 0.11,
    zoom: 1,
    targetYaw: -0.23,
    targetPitch: 0.11,
    targetZoom: 1,
    dragging: false,
    lastX: 0,
    lastY: 0,
    width: 1,
    height: 1,
    dpr: 1,
    lastFetch: 0,
    apiOK: false,
    healthOK: false,
    counts: {
      WAITING: 0,
      WATCH: 0,
      BLOCKED: 0,
      'BUY READY': 0,
      TRADING: 0,
      TOTAL: 0
    },
    decisions: [],
    particles: [],
    reducedMotion:
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false
  };

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 120 &&
           r.height > 120 &&
           cs.display !== 'none' &&
           cs.visibility !== 'hidden';
  }

  function textOf(el) {
    return String(el?.innerText || el?.textContent || '');
  }

  function findArchitectureSection() {
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

    for (const selector of direct) {
      const el = document.querySelector(selector);
      if (visible(el)) return el;
    }

    const candidates = [
      ...document.querySelectorAll(
        'section,article,.panel,.card,.inspector,[class*="architecture"],[class*="pipeline"],[class*="inspector"]'
      )
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
    }).filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score);

    const section = scored[0]?.el;
    if (!section) return null;

    const canvases = [...section.querySelectorAll('canvas')].filter(visible);

    if (canvases.length) {
      canvases.sort((a,b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.width * br.height - ar.width * ar.height;
      });

      return canvases[0].parentElement || section;
    }

    const sceneCandidate = [...section.querySelectorAll('div')]
      .filter(visible)
      .sort((a,b) => {
        const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
        return br.width*br.height-ar.width*ar.height;
      })[0];

    return sceneCandidate || section;
  }

  function makeCanvas(host) {
    host.classList.add('mf-orbit-v2-host');

    const canvases = [...host.querySelectorAll('canvas')];
    for (const old of canvases) {
      if (!old.classList.contains('mf-orbit-v2-canvas')) {
        old.classList.add('mf-orbit-v2-original-canvas');
      }
    }

    let canvas = host.querySelector('.mf-orbit-v2-canvas');

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'mf-orbit-v2-canvas';
      canvas.setAttribute('aria-label','Live MEMEFLOW pipeline visualization');
      host.appendChild(canvas);
    }

    if (!host.querySelector('.mf-orbit-v2-badge')) {
      const badge = document.createElement('div');
      badge.className = 'mf-orbit-v2-badge';
      badge.innerHTML = '<i></i><span>LIVE PIPELINE</span>';
      host.appendChild(badge);
    }

    return canvas;
  }

  function hash(str) {
    let h = 2166136261;
    str = String(str || '');

    for (let i=0;i<str.length;i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h,16777619);
    }

    return h >>> 0;
  }

  function randFrom(n) {
    n = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function normalizeState(raw) {
    const s = String(raw || '').trim().toUpperCase();

    if (s === 'BUY_READY') return 'BUY READY';
    if (s.includes('BUY') && s.includes('READY')) return 'BUY READY';
    if (s.includes('WATCH')) return 'WATCH';
    if (s.includes('BLOCK') || s.includes('REJECT') || s.includes('EXPIRED'))
      return 'BLOCKED';
    if (s.includes('TRAD') || s.includes('POSITION')) return 'TRADING';

    return 'WAITING';
  }

  async function fetchLiveData() {
    try {
      const response = await fetch(
        '/api/ai/decisions?scope=all&limit=200',
        {
          credentials:'same-origin',
          cache:'no-store',
          headers:{accept:'application/json'}
        }
      );

      if (!response.ok) throw new Error('HTTP '+response.status);

      const data = await response.json();
      const rows = Array.isArray(data?.decisions) ? data.decisions : [];

      state.apiOK = true;
      state.decisions = rows;

      const counts = {
        WAITING:0,
        WATCH:0,
        BLOCKED:0,
        'BUY READY':0,
        TRADING:0,
        TOTAL:rows.length
      };

      for (const row of rows) {
        const s = normalizeState(row?.state);
        counts[s] = (counts[s] || 0) + 1;
      }

      if (data?.counts) {
        if (Number.isFinite(Number(data.counts.processing))) {
          counts.WAITING = Number(data.counts.processing);
        }

        if (Number.isFinite(Number(data.counts.candidates))) {
          counts['BUY READY'] = Number(data.counts.candidates);
        }

        if (Number.isFinite(Number(data.counts.filtered))) {
          counts.BLOCKED = Number(data.counts.filtered);
        }

        if (Number.isFinite(Number(data.counts.totalEvaluated))) {
          counts.TOTAL = Number(data.counts.totalEvaluated);
        }
      }

      state.counts = counts;
      rebuildParticles(rows);

    } catch (error) {
      state.apiOK = false;
      readCountsFromDOM();
    }

    try {
      const r = await fetch('/api/system/health',{
        credentials:'same-origin',
        cache:'no-store'
      });

      state.healthOK = r.ok;
    } catch {
      state.healthOK = false;
    }
  }

  function readCountsFromDOM() {
    const body = document.body?.innerText || '';

    function numberAfter(label) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re = new RegExp(escaped+'[^0-9]{0,20}([0-9]+)','i');
      const m = body.match(re);
      return m ? Number(m[1]) : 0;
    }

    state.counts = {
      WAITING: numberAfter('WAITING'),
      WATCH: numberAfter('WATCH'),
      BLOCKED: numberAfter('BLOCKED'),
      'BUY READY': numberAfter('BUY READY'),
      TRADING: numberAfter('TRADING'),
      TOTAL:
        numberAfter('SCANNED') ||
        numberAfter('TOTAL') ||
        state.counts.TOTAL ||
        0
    };

    if (!state.decisions.length) {
      const synthetic = [];
      let id = 0;

      for (const s of ['WAITING','WATCH','BLOCKED','BUY READY','TRADING']) {
        const count = Math.min(28,state.counts[s] || 0);

        for (let i=0;i<count;i++) {
          synthetic.push({
            mint:'synthetic-'+(id++),
            state:s
          });
        }
      }

      rebuildParticles(synthetic);
    }
  }

  function rebuildParticles(rows) {
    const source = Array.isArray(rows) ? rows.slice(0,140) : [];
    const next = [];

    for (let i=0;i<source.length;i++) {
      const row = source[i] || {};
      const key =
        row.mint ||
        row.tokenMint ||
        row.tokenAddress ||
        row.id ||
        'row-'+i;

      const h = hash(key);
      const s = normalizeState(row.state);

      next.push({
        id:key,
        state:s,
        seed:h,
        angle:randFrom(h) * TAU,
        radius:95 + randFrom(h+3) * 145,
        y:(randFrom(h+7)-.5)*145,
        speed:.12 + randFrom(h+11)*.25,
        size:.8 + randFrom(h+19)*2.2,
        phase:randFrom(h+31)*TAU
      });
    }

    if (!next.length) {
      for (let i=0;i<32;i++) {
        const s = i%9===0 ? 'BLOCKED' :
                  i%7===0 ? 'BUY READY' :
                  i%4===0 ? 'WATCH' : 'WAITING';

        next.push({
          id:'idle-'+i,
          state:s,
          seed:i*101,
          angle:(i/32)*TAU,
          radius:115+(i%7)*19,
          y:((i%9)-4)*19,
          speed:.10+(i%5)*.025,
          size:1+(i%4)*.45,
          phase:i*.73
        });
      }
    }

    state.particles = next;
  }

  function rotatePoint(p) {
    let x=p.x, y=p.y, z=p.z;

    const cy=Math.cos(state.yaw);
    const sy=Math.sin(state.yaw);

    let x1=x*cy-z*sy;
    let z1=x*sy+z*cy;

    const cp=Math.cos(state.pitch);
    const sp=Math.sin(state.pitch);

    let y1=y*cp-z1*sp;
    let z2=y*sp+z1*cp;

    return {x:x1,y:y1,z:z2};
  }

  function project(p) {
    const r = rotatePoint(p);
    const focal = 720;
    const camera = 600 / state.zoom;
    const depth = camera + r.z;
    const scale = focal / Math.max(180,depth);

    return {
      x:state.width*.5 + r.x*scale,
      y:state.height*.5 + r.y*scale,
      z:r.z,
      scale
    };
  }

  function rgba(c,a) {
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  function line3(ctx,a,b,color,alpha=1,width=1) {
    const A=project(a), B=project(b);

    ctx.beginPath();
    ctx.moveTo(A.x,A.y);
    ctx.lineTo(B.x,B.y);
    ctx.strokeStyle=rgba(color,alpha);
    ctx.lineWidth=width;
    ctx.stroke();
  }

  function dot3(ctx,p,color,size=2,alpha=1,glow=0) {
    const P=project(p);
    const r=Math.max(.5,size*P.scale);

    ctx.save();

    if (glow) {
      ctx.shadowBlur=glow*P.scale;
      ctx.shadowColor=rgba(color,.72);
    }

    ctx.beginPath();
    ctx.arc(P.x,P.y,r,0,TAU);
    ctx.fillStyle=rgba(color,alpha);
    ctx.fill();
    ctx.restore();
  }

  function ring3(ctx,radius,y,color,alpha=.18,segments=72) {
    let prev=null;

    for(let i=0;i<=segments;i++) {
      const a=(i/segments)*TAU;

      const p={
        x:Math.cos(a)*radius,
        y:y,
        z:Math.sin(a)*radius
      };

      if(prev) line3(ctx,prev,p,color,alpha,1);
      prev=p;
    }
  }

  function sphere(ctx,t) {
    const c=project({x:0,y:0,z:0});
    const r=56*c.scale;

    const glow=ctx.createRadialGradient(
      c.x-r*.2,c.y-r*.25,2,
      c.x,c.y,r*1.9
    );

    glow.addColorStop(0,'rgba(176,246,255,.22)');
    glow.addColorStop(.22,'rgba(84,221,255,.13)');
    glow.addColorStop(.62,'rgba(84,221,255,.035)');
    glow.addColorStop(1,'rgba(84,221,255,0)');

    ctx.beginPath();
    ctx.arc(c.x,c.y,r*1.9,0,TAU);
    ctx.fillStyle=glow;
    ctx.fill();

    const body=ctx.createRadialGradient(
      c.x-r*.28,c.y-r*.32,r*.04,
      c.x,c.y,r
    );

    body.addColorStop(0,'rgba(201,249,255,.30)');
    body.addColorStop(.20,'rgba(80,217,239,.20)');
    body.addColorStop(.58,'rgba(20,65,79,.34)');
    body.addColorStop(1,'rgba(2,11,16,.92)');

    ctx.beginPath();
    ctx.arc(c.x,c.y,r,0,TAU);
    ctx.fillStyle=body;
    ctx.fill();

    ctx.strokeStyle='rgba(112,229,246,.38)';
    ctx.lineWidth=1;
    ctx.stroke();

    for(let i=0;i<16;i++) {
      const a=t*.00012+i/16*TAU;

      const p={
        x:Math.cos(a)*52,
        y:Math.sin(a*1.7)*18,
        z:Math.sin(a)*52
      };

      dot3(ctx,p,COLORS.core,1.5,.62,8);
    }

    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';

    ctx.font=`800 ${clamp(13*c.scale,11,18)}px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle='rgba(235,250,255,.94)';
    ctx.fillText('MEMEFLOW',c.x,c.y-5*c.scale);

    ctx.font=`700 ${clamp(8*c.scale,7,11)}px system-ui,-apple-system,sans-serif`;
    ctx.fillStyle='rgba(111,226,242,.76)';
    ctx.letterSpacing='1px';
    ctx.fillText('CORE',c.x,c.y+12*c.scale);

    ctx.restore();
  }

  const anchors = {
    waiting:{x:-205,y:-100,z:-10},
    watch:{x:205,y:-105,z:25},
    blocked:{x:-225,y:120,z:20},
    ready:{x:205,y:105,z:-20},
    trading:{x:345,y:30,z:-5},
    input:{x:-355,y:-15,z:0}
  };

  function drawAnchor(ctx,p,label,count,color) {
    const P=project(p);

    ctx.save();
    ctx.shadowBlur=14;
    ctx.shadowColor=rgba(color,.35);

    ctx.beginPath();
    ctx.arc(P.x,P.y,4.3*P.scale,0,TAU);
    ctx.fillStyle=rgba(color,.9);
    ctx.fill();
    ctx.restore();

    ctx.textAlign='center';
    ctx.textBaseline='bottom';
    ctx.font='800 9px system-ui,-apple-system,sans-serif';
    ctx.fillStyle=rgba(color,.92);
    ctx.fillText(label,P.x,P.y-10);

    ctx.textBaseline='top';
    ctx.font='700 9px system-ui,-apple-system,sans-serif';
    ctx.fillStyle='rgba(166,182,197,.78)';
    ctx.fillText(String(count ?? 0),P.x,P.y+8);
  }

  function bezier(a,b,c,d,t) {
    const u=1-t;

    return {
      x:u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
      y:u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y,
      z:u*u*u*a.z + 3*u*u*t*b.z + 3*u*t*t*c.z + t*t*t*d.z
    };
  }

  function pathLine(ctx,a,b,c,d,color,alpha=.15) {
    let prev=a;

    for(let i=1;i<=32;i++) {
      const p=bezier(a,b,c,d,i/32);
      line3(ctx,prev,p,color,alpha,1);
      prev=p;
    }
  }

  function particlePosition(p,t) {
    const tt = t*.001*p.speed + p.phase;

    if(p.state==='BLOCKED') {
      const progress=(Math.sin(tt*.55)+1)/2;

      return bezier(
        {x:0,y:0,z:0},
        {x:-90,y:30,z:80},
        {x:-165,y:105,z:40},
        anchors.blocked,
        progress
      );
    }

    if(p.state==='BUY READY') {
      const progress=(Math.sin(tt*.5)+1)/2;

      return bezier(
        {x:0,y:0,z:0},
        {x:80,y:15,z:-55},
        {x:155,y:95,z:-35},
        anchors.ready,
        progress
      );
    }

    if(p.state==='TRADING') {
      const progress=(Math.sin(tt*.45)+1)/2;

      return bezier(
        anchors.ready,
        {x:245,y:100,z:-20},
        {x:300,y:55,z:20},
        anchors.trading,
        progress
      );
    }

    const baseRadius =
      p.state==='WATCH'
        ? p.radius*1.08
        : p.radius*.82;

    return {
      x:Math.cos(tt)*baseRadius,
      y:p.y*.47 + Math.sin(tt*1.33)*24,
      z:Math.sin(tt)*baseRadius
    };
  }

  function particleColor(s) {
    if(s==='WATCH') return COLORS.watch;
    if(s==='BLOCKED') return COLORS.blocked;
    if(s==='BUY READY') return COLORS.ready;
    if(s==='TRADING') return COLORS.trading;
    return COLORS.waiting;
  }

  function drawGrid(ctx) {
    ctx.save();

    for(let i=-4;i<=4;i++) {
      line3(
        ctx,
        {x:-330,y:170,z:i*55},
        {x:330,y:170,z:i*55},
        COLORS.muted,.055,1
      );

      line3(
        ctx,
        {x:i*70,y:170,z:-240},
        {x:i*70,y:170,z:240},
        COLORS.muted,.055,1
      );
    }

    ctx.restore();
  }

  function drawScene(ctx,t) {
    ctx.clearRect(0,0,state.width,state.height);

    const bg=ctx.createRadialGradient(
      state.width*.5,state.height*.47,10,
      state.width*.5,state.height*.5,
      Math.max(state.width,state.height)*.66
    );

    bg.addColorStop(0,'rgba(14,25,34,.24)');
    bg.addColorStop(.45,'rgba(5,10,15,.04)');
    bg.addColorStop(1,'rgba(0,0,0,.20)');

    ctx.fillStyle=bg;
    ctx.fillRect(0,0,state.width,state.height);

    drawGrid(ctx);

    ring3(ctx,112,0,COLORS.core,.10);
    ring3(ctx,170,0,COLORS.core,.065);
    ring3(ctx,225,0,COLORS.core,.04);

    pathLine(
      ctx,
      anchors.input,
      {x:-270,y:-30,z:40},
      {x:-110,y:-25,z:-30},
      {x:0,y:0,z:0},
      COLORS.white,.08
    );

    pathLine(
      ctx,
      {x:0,y:0,z:0},
      {x:-90,y:30,z:80},
      {x:-165,y:105,z:40},
      anchors.blocked,
      COLORS.blocked,.16
    );

    pathLine(
      ctx,
      {x:0,y:0,z:0},
      {x:80,y:15,z:-55},
      {x:155,y:95,z:-35},
      anchors.ready,
      COLORS.ready,.14
    );

    pathLine(
      ctx,
      anchors.ready,
      {x:245,y:100,z:-20},
      {x:300,y:55,z:20},
      anchors.trading,
      COLORS.trading,.12
    );

    const inboundCount=Math.max(
      9,
      Math.min(26,
        Math.ceil((state.counts.TOTAL || state.particles.length)/5)
      )
    );

    for(let i=0;i<inboundCount;i++) {
      const q=(t*.00012+i/inboundCount)%1;

      const pos=bezier(
        anchors.input,
        {x:-280,y:-45+Math.sin(i)*25,z:50},
        {x:-125,y:20,z:-35},
        {x:-42,y:0,z:0},
        q
      );

      dot3(ctx,pos,COLORS.white,1.2,.42,4);
    }

    const sorted = state.particles
      .map(p => ({p,pos:particlePosition(p,t)}))
      .sort((a,b) => a.pos.z-b.pos.z);

    for(const row of sorted) {
      const color=particleColor(row.p.state);
      dot3(
        ctx,
        row.pos,
        color,
        row.p.size,
        row.p.state==='BLOCKED'?.75:.82,
        row.p.state==='BUY READY'||row.p.state==='TRADING' ? 9 : 5
      );
    }

    sphere(ctx,t);

    drawAnchor(
      ctx,
      anchors.waiting,
      'WAITING',
      state.counts.WAITING,
      COLORS.waiting
    );

    drawAnchor(
      ctx,
      anchors.watch,
      'WATCH',
      state.counts.WATCH,
      COLORS.watch
    );

    drawAnchor(
      ctx,
      anchors.blocked,
      'BLOCKED',
      state.counts.BLOCKED,
      COLORS.blocked
    );

    drawAnchor(
      ctx,
      anchors.ready,
      'BUY READY',
      state.counts['BUY READY'],
      COLORS.ready
    );

    drawAnchor(
      ctx,
      anchors.trading,
      'TRADING',
      state.counts.TRADING,
      COLORS.trading
    );

    const core=project({x:0,y:0,z:0});

    ctx.textAlign='center';
    ctx.textBaseline='top';
    ctx.font='700 8px system-ui,-apple-system,sans-serif';
    ctx.fillStyle=state.apiOK
      ? 'rgba(80,231,165,.75)'
      : 'rgba(239,192,88,.68)';

    ctx.fillText(
      state.apiOK ? 'LIVE DATA' : 'WAITING FOR LIVE DATA',
      core.x,
      core.y+52
    );
  }

  function connectControls(canvas) {
    canvas.addEventListener('pointerdown',e => {
      state.dragging=true;
      state.lastX=e.clientX;
      state.lastY=e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    });

    canvas.addEventListener('pointermove',e => {
      if(!state.dragging) return;

      const dx=e.clientX-state.lastX;
      const dy=e.clientY-state.lastY;

      state.lastX=e.clientX;
      state.lastY=e.clientY;

      state.targetYaw += dx*.006;
      state.targetPitch = clamp(
        state.targetPitch+dy*.005,
        -.72,.72
      );
    });

    const stop=e => {
      state.dragging=false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
    };

    canvas.addEventListener('pointerup',stop);
    canvas.addEventListener('pointercancel',stop);

    canvas.addEventListener('wheel',e => {
      e.preventDefault();

      state.targetZoom = clamp(
        state.targetZoom * (e.deltaY>0 ? .91 : 1.10),
        .65,
        1.65
      );
    },{passive:false});

    canvas.addEventListener('dblclick',resetView);

    for(const button of document.querySelectorAll('button,[role="button"],a')) {
      if(/reset\s*view/i.test(textOf(button))) {
        button.addEventListener('click',() => {
          setTimeout(resetView,0);
        });
      }
    }
  }

  function resetView() {
    state.targetYaw=-.23;
    state.targetPitch=.11;
    state.targetZoom=1;
  }

  function resize(canvas,host) {
    const r=host.getBoundingClientRect();

    state.width=Math.max(1,Math.round(r.width));
    state.height=Math.max(1,Math.round(r.height));
    state.dpr=Math.min(2,window.devicePixelRatio||1);

    canvas.width=Math.round(state.width*state.dpr);
    canvas.height=Math.round(state.height*state.dpr);
  }

  function boot() {
    const host=findArchitectureSection();

    if(!host) {
      console.warn('[MEMEFLOW Orbit V2] Architecture container not found.');
      return;
    }

    const canvas=makeCanvas(host);
    const ctx=canvas.getContext('2d',{alpha:true});

    if(!ctx) return;

    resize(canvas,host);
    connectControls(canvas);

    const ro=new ResizeObserver(() => resize(canvas,host));
    ro.observe(host);

    rebuildParticles([]);
    fetchLiveData();

    setInterval(fetchLiveData,2500);

    let last=performance.now();

    function frame(t) {
      const dt=Math.min(32,t-last);
      last=t;

      state.yaw += (state.targetYaw-state.yaw)*.085;
      state.pitch += (state.targetPitch-state.pitch)*.085;
      state.zoom += (state.targetZoom-state.zoom)*.085;

      if(!state.dragging && !state.reducedMotion) {
        state.targetYaw += dt*.000015;
      }

      ctx.setTransform(
        state.dpr,0,0,state.dpr,0,0
      );

      drawScene(ctx,t);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    window.MEMEFLOW_ORBIT_V2 = {
      resetView,
      refresh:fetchLiveData,
      getState:() => ({
        apiOK:state.apiOK,
        healthOK:state.healthOK,
        counts:{...state.counts},
        particles:state.particles.length
      })
    };

    console.info(
      '[MEMEFLOW Orbit V2] installed on',
      host
    );
  }

  if(document.readyState==='loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => setTimeout(boot,80),
      {once:true}
    );
  } else {
    setTimeout(boot,80);
  }

})();
