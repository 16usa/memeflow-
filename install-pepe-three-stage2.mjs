import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const appDir = [cwd, path.join(cwd, 'memeflow-app')].find((dir) =>
  fs.existsSync(path.join(dir, 'game.html')) &&
  fs.existsSync(path.join(dir, 'game.js')) &&
  fs.existsSync(path.join(dir, 'game.css'))
);

if (!appDir) {
  console.error('Pepe Rocket game files were not found. Run this from the repository root or memeflow-app.');
  process.exit(1);
}

const htmlPath = path.join(appDir, 'game.html');
const jsPath = path.join(appDir, 'game.js');
const cssPath = path.join(appDir, 'game.css');
const visualPath = path.join(appDir, 'game-25d.js');
const vendorDir = path.join(appDir, 'vendor');
const vendorThree = path.join(vendorDir, 'three.module.js');
const nodeThree = path.join(cwd, 'node_modules', 'three', 'build', 'three.module.js');
const nestedNodeThree = path.join(path.dirname(appDir), 'node_modules', 'three', 'build', 'three.module.js');

function backup(file) {
  const out = `${file}.before-three-25d`;
  if (!fs.existsSync(out)) fs.copyFileSync(file, out);
  return out;
}

function assertFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`);
}

assertFile(htmlPath, 'game.html');
assertFile(jsPath, 'game.js');
assertFile(cssPath, 'game.css');

fs.mkdirSync(vendorDir, { recursive: true });
if (!fs.existsSync(vendorThree)) {
  const source = [nodeThree, nestedNodeThree].find(fs.existsSync);
  if (!source) {
    throw new Error('Three.js package was not found. Run: npm install three --save');
  }
  fs.copyFileSync(source, vendorThree);
}

backup(htmlPath);
backup(jsPath);
backup(cssPath);

const visualModule = String.raw`import * as THREE from '/vendor/three.module.js';

const ASSET_ROOT = '/game-assets/25d/';
const LAYERS = [
  { key: 'starsBg', file: 'stars_bg.png', z: -10, depth: 0.10, order: 1, fallback: 'stars' },
  { key: 'nebula', file: 'nebula.png', z: -9, depth: 0.16, order: 2, fallback: 'nebula' },
  { key: 'starsFg', file: 'stars_fg.png', z: -8, depth: 0.23, order: 3, fallback: 'starsFg' },
  { key: 'planet', file: 'planet.png', z: -6, depth: 0.30, order: 4, fallback: 'planet' },
  { key: 'bottomGlow', file: 'bottom_glow.png', z: -5, depth: 0.38, order: 5, fallback: 'bottomGlow', additive: true },
  { key: 'smoke', file: 'smoke.png', z: -3, depth: 0.58, order: 6, fallback: 'smoke', flight: true },
  { key: 'flame', file: 'flame.png', z: -2, depth: 0.70, order: 7, fallback: 'flame', flight: true, additive: true },
  { key: 'sparks', file: 'sparks.png', z: -1.5, depth: 0.78, order: 8, fallback: 'sparks', flight: true, additive: true },
  { key: 'rocket', file: 'rocket.png', z: 0, depth: 0.90, order: 9, fallback: 'rocket', flight: true },
  { key: 'pepe', file: 'pepe.png', z: 0.5, depth: 0.96, order: 10, fallback: 'pepe', flight: true },
  { key: 'highlights', file: 'glow_highlights.png', z: 1, depth: 1.0, order: 11, fallback: 'highlights', flight: true, additive: true }
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(current, target, rate, dt) { return lerp(current, target, 1 - Math.exp(-rate * dt)); }
function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * .5, h * .5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
function ellipseGradient(ctx, x, y, rx, ry, inner, outer) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function fallbackCanvas(kind, w = 1280, h = 720) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); const rnd = seeded(0x25d + kind.length * 911);
  ctx.clearRect(0, 0, w, h);

  if (kind === 'stars') {
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#010207'); bg.addColorStop(.58, '#03101c'); bg.addColorStop(1, '#082434'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 210; i++) { const x=rnd()*w, y=rnd()*h*.78, r=.4+rnd()*1.45, a=.22+rnd()*.72; ctx.fillStyle='rgba(235,248,255,'+a+')'; ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill(); }
  }
  if (kind === 'nebula') {
    for (let i = 0; i < 10; i++) { const x=(.18+rnd()*.66)*w, y=(.08+rnd()*.58)*h, r=(.12+rnd()*.2)*w; ellipseGradient(ctx,x,y,r,r*.45,'rgba(50,120,170,.10)','rgba(15,30,70,0)'); }
    for (let i = 0; i < 6; i++) { const x=(.25+rnd()*.65)*w, y=(.08+rnd()*.55)*h, r=(.08+rnd()*.16)*w; ellipseGradient(ctx,x,y,r,r*.5,'rgba(105,60,155,.08)','rgba(0,0,0,0)'); }
  }
  if (kind === 'starsFg') {
    for (let i = 0; i < 70; i++) { const x=rnd()*w, y=rnd()*h*.7, r=.7+rnd()*2.1, a=.18+rnd()*.45; ctx.fillStyle='rgba(140,220,255,'+a+')'; ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill(); }
  }
  if (kind === 'planet') {
    const x=w*.80, y=h*.25, r=w*.07; const g=ctx.createRadialGradient(x-r*.25,y-r*.3,r*.08,x,y,r); g.addColorStop(0,'rgba(245,250,252,.86)');g.addColorStop(.45,'rgba(150,168,180,.72)');g.addColorStop(1,'rgba(50,60,70,.12)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.18;ctx.fillStyle='#1d2932';for(let i=0;i<11;i++){ctx.beginPath();ctx.arc(x+(rnd()-.5)*r*1.2,y+(rnd()-.5)*r*1.2,3+rnd()*10,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  }
  if (kind === 'bottomGlow') {
    ellipseGradient(ctx,w*.5,h*.94,w*.64,w*.12,'rgba(50,210,255,.20)','rgba(0,0,0,0)');
    ellipseGradient(ctx,w*.5,h*.99,w*.32,w*.06,'rgba(70,255,200,.15)','rgba(0,0,0,0)');
  }
  if (kind === 'smoke') {
    for (let i=0;i<24;i++){const x=w*.5+(rnd()-.5)*150,y=h*.78+rnd()*h*.19,r=28+rnd()*65;ellipseGradient(ctx,x,y,r,r*.65,'rgba(205,222,226,'+(.13+rnd()*.12)+')','rgba(20,35,42,0)');}
  }
  if (kind === 'flame') {
    const x=w*.5,y=h*.78; const g=ctx.createLinearGradient(x,h*.61,x,h*.98);g.addColorStop(0,'rgba(255,255,225,.98)');g.addColorStop(.12,'rgba(255,223,98,.95)');g.addColorStop(.48,'rgba(255,102,55,.85)');g.addColorStop(1,'rgba(255,65,30,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-16,h*.61);ctx.bezierCurveTo(x-36,h*.74,x-54,h*.88,x,h*.98);ctx.bezierCurveTo(x+54,h*.88,x+36,h*.74,x+16,h*.61);ctx.closePath();ctx.fill();
  }
  if (kind === 'sparks') {
    ctx.lineCap='round'; for(let i=0;i<34;i++){const x=w*.5+(rnd()-.5)*220,y=h*.64+rnd()*h*.3,len=6+rnd()*24;ctx.strokeStyle='rgba(255,'+(120+Math.round(rnd()*110))+',55,'+(.25+rnd()*.7)+')';ctx.lineWidth=.7+rnd()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rnd()-.5)*18,y+len);ctx.stroke();}
  }
  if (kind === 'rocket') {
    const x=w*.5, y=h*.55; ctx.save(); ctx.translate(x,y); ctx.rotate(-.035);
    const body=ctx.createLinearGradient(-42,0,45,0);body.addColorStop(0,'#566672');body.addColorStop(.35,'#dbe4e9');body.addColorStop(.55,'#f8fcff');body.addColorStop(1,'#687986');ctx.fillStyle=body;roundedRect(ctx,-40,-122,80,184,38);ctx.fill();
    const nose=ctx.createLinearGradient(-42,0,42,0);nose.addColorStop(0,'#d83e51');nose.addColorStop(.5,'#ff6b63');nose.addColorStop(1,'#b93349');ctx.fillStyle=nose;ctx.beginPath();ctx.moveTo(0,-190);ctx.lineTo(40,-116);ctx.lineTo(-40,-116);ctx.closePath();ctx.fill();
    ctx.fillStyle='#d64456';ctx.beginPath();ctx.moveTo(-40,25);ctx.lineTo(-78,82);ctx.lineTo(-34,67);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(40,25);ctx.lineTo(78,82);ctx.lineTo(34,67);ctx.closePath();ctx.fill();
    const win=ctx.createRadialGradient(-8,-55,3,0,-50,30);win.addColorStop(0,'#c9f7ff');win.addColorStop(.4,'#5eb5cd');win.addColorStop(1,'#102d3a');ctx.fillStyle='#33424d';ctx.beginPath();ctx.arc(0,-53,29,0,Math.PI*2);ctx.fill();ctx.fillStyle=win;ctx.beginPath();ctx.arc(0,-53,21,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  if (kind === 'pepe') {
    const x=w*.5, y=h*.38; ctx.save(); ctx.translate(x,y);
    ellipseGradient(ctx,0,12,76,72,'rgba(94,201,103,1)','rgba(20,99,58,.95)');
    ctx.fillStyle='#71c96d';ctx.beginPath();ctx.arc(-42,-38,32,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(42,-38,32,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#eef7e8';ctx.beginPath();ctx.ellipse(-42,-36,18,22,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(42,-36,18,22,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#101516';ctx.beginPath();ctx.arc(-38,-32,6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(38,-32,6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#123d2a';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.arc(0,15,43,.18,Math.PI-.18);ctx.stroke();
    ctx.strokeStyle='#58b767';ctx.lineWidth=22;ctx.beginPath();ctx.moveTo(55,12);ctx.quadraticCurveTo(96,-26,108,-84);ctx.stroke();ctx.strokeStyle='#58b767';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(105,-83);ctx.lineTo(120,-104);ctx.moveTo(105,-83);ctx.lineTo(130,-82);ctx.stroke();ctx.restore();
  }
  if (kind === 'highlights') {
    ellipseGradient(ctx,w*.5,h*.56,w*.19,w*.19,'rgba(255,112,65,.10)','rgba(0,0,0,0)');
    const g=ctx.createLinearGradient(w*.25,0,w*.75,0);g.addColorStop(0,'rgba(90,220,255,0)');g.addColorStop(.5,'rgba(90,220,255,.16)');g.addColorStop(1,'rgba(90,220,255,0)');ctx.fillStyle=g;ctx.fillRect(w*.22,h*.46,w*.56,2);
  }
  return c;
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; return tex;
}

function loadOrFallback(loader, def) {
  return new Promise((resolve) => {
    loader.load(ASSET_ROOT + def.file, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; resolve({ tex, external: true }); }, undefined, () => resolve({ tex: canvasTexture(fallbackCanvas(def.fallback)), external: false }));
  });
}

export function createPepeRocket25D({ mount, sky, shell } = {}) {
  if (!mount || !sky) return { setState(){}, updateMultiplier(){}, reset(){}, destroy(){}, ready: Promise.resolve(false) };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (error) { console.warn('[Pepe 2.5D] WebGL unavailable, keeping CSS fallback.', error); return { setState(){}, updateMultiplier(){}, reset(){}, destroy(){}, ready: Promise.resolve(false) }; }

  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.setAttribute('aria-hidden','true'); mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100); camera.position.set(0, 0, 22);
  const backgroundGroup = new THREE.Group(); const flightGroup = new THREE.Group(); scene.add(backgroundGroup, flightGroup);
  const loader = new THREE.TextureLoader(); const meshes = new Map();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const motion = { state: 'idle', multiplier: 1, targetMultiplier: 1, lift: 0, targetLift: 0, tilt: 0, targetTilt: 0, flame: .28, targetFlame: .28, search: 0 };
  let frame = 0, last = performance.now(), disposed = false, viewW = 20, viewH = 12;

  function resize() {
    const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    const dist = camera.position.z; viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)) * dist; viewW = viewH * camera.aspect;
    for (const mesh of meshes.values()) mesh.scale.set(viewW / 12.8 * 1.08, viewH / 7.2 * 1.08, 1);
  }

  function pointerMove(event) { const r=mount.getBoundingClientRect(); const cx=('clientX' in event?event.clientX:event.touches?.[0]?.clientX) ?? r.left+r.width/2; const cy=('clientY' in event?event.clientY:event.touches?.[0]?.clientY) ?? r.top+r.height/2; pointer.tx=clamp(((cx-r.left)/r.width-.5)*2,-1,1); pointer.ty=clamp(((cy-r.top)/r.height-.5)*2,-1,1); }
  mount.addEventListener('pointermove', pointerMove, { passive:true }); mount.addEventListener('pointerleave',()=>{pointer.tx=0;pointer.ty=0;},{passive:true});

  const ready = Promise.all(LAYERS.map(async (def) => {
    const { tex, external } = await loadOrFallback(loader, def);
    const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, blending: def.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 7.2), material); mesh.position.z = def.z; mesh.renderOrder = def.order; mesh.userData = { ...def, external, baseZ: def.z }; (def.flight ? flightGroup : backgroundGroup).add(mesh); meshes.set(def.key, mesh); return mesh;
  })).then(() => { resize(); sky.classList.add('three-ready'); mount.dataset.renderer='three'; return true; });

  function updateMultiplier(value) {
    const m = clamp(Number(value) || 1, .4, 8); motion.targetMultiplier = m; let n;
    if (m <= 1) n = (m - .4) / .6 * .10; else n = .10 + Math.min(.90, Math.log(m) / Math.log(5) * .82);
    motion.targetLift = n * viewH * .31; motion.targetTilt = m < .94 ? -.08 : m > 1.01 ? .035 : 0; motion.targetFlame = clamp(.38 + Math.max(0, m - 1) * .14, .28, 1.0);
  }
  function setState(state) { motion.state = state || 'idle'; if (state === 'searching') motion.search = 1; else motion.search = 0; if (state === 'idle') motion.targetFlame=.28; if (state === 'live') motion.targetFlame=Math.max(motion.targetFlame,.62); if (state === 'complete') motion.targetFlame=.24; }
  function reset() { motion.multiplier=motion.targetMultiplier=1; motion.lift=motion.targetLift=0; motion.tilt=motion.targetTilt=0; motion.flame=motion.targetFlame=.28; flightGroup.position.set(0,0,0); flightGroup.rotation.z=0; }

  function animate(now) {
    if (disposed) return; frame=requestAnimationFrame(animate); const dt=Math.min(.05,Math.max(.001,(now-last)/1000)); last=now;
    pointer.x=smooth(pointer.x,pointer.tx,5,dt);pointer.y=smooth(pointer.y,pointer.ty,5,dt);motion.multiplier=smooth(motion.multiplier,motion.targetMultiplier,5.2,dt);motion.lift=smooth(motion.lift,motion.targetLift,3.6,dt);motion.tilt=smooth(motion.tilt,motion.targetTilt,4.5,dt);motion.flame=smooth(motion.flame,motion.targetFlame,7,dt);
    const t=now*.001; const autoX=reduced?0:Math.sin(t*.31)*.08; const autoY=reduced?0:Math.cos(t*.27)*.055; camera.position.x=smooth(camera.position.x,(pointer.x*.18+autoX),2.2,dt); camera.position.y=smooth(camera.position.y,(-pointer.y*.12+autoY),2.2,dt); camera.lookAt(0,0,0);
    for (const mesh of meshes.values()) { const d=mesh.userData.depth; const driftX=(pointer.x*.24+Math.sin(t*.23+mesh.renderOrder)*.035)*d; const driftY=(-pointer.y*.14+Math.cos(t*.19+mesh.renderOrder)*.025)*d; mesh.position.x=driftX; mesh.position.y=driftY; }
    const searching = motion.state==='searching' && !reduced ? Math.sin(t*18)*.045 : 0; const idleBob = !reduced ? Math.sin(t*2.1)*.035 : 0; flightGroup.position.y=motion.lift+idleBob; flightGroup.position.x=searching; flightGroup.rotation.z=motion.tilt+(motion.state==='searching'&&!reduced?Math.sin(t*11)*.012:0);
    const flame=meshes.get('flame'), smoke=meshes.get('smoke'), sparks=meshes.get('sparks'), glow=meshes.get('highlights'); if(flame){flame.material.opacity=motion.flame*(.88+(!reduced?Math.sin(t*32)*.10:0));flame.scale.y=(viewH/7.2*1.08)*(1+motion.flame*.12);} if(smoke)smoke.material.opacity=motion.state==='live'?.55:motion.state==='searching'?.34:.22; if(sparks)sparks.material.opacity=motion.state==='live'?.75:motion.state==='searching'?.38:.14; if(glow)glow.material.opacity=.42+motion.flame*.24;
    renderer.render(scene,camera);
  }
  frame=requestAnimationFrame(animate);
  const observer=new ResizeObserver(resize);observer.observe(mount);window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) last=performance.now(); });

  function destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',resize);for(const mesh of meshes.values()){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}renderer.dispose();mount.replaceChildren();sky.classList.remove('three-ready');}
  return { setState, updateMultiplier, reset, destroy, ready };
}
`;

fs.writeFileSync(visualPath, visualModule, 'utf8');

let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('id="threeStage"')) {
  const needle = '<div class="sky" id="sky" aria-hidden="true">';
  if (!html.includes(needle)) throw new Error('Could not find #sky in game.html. No HTML changes written.');
  html = html.replace(needle, `${needle}\n          <div class="three-stage" id="threeStage"></div><!-- MF_PEPE_THREE_25D -->`);
}
html = html.replace('<script src="/game.js" defer></script>', '<script type="module" src="/game.js"></script>');
if (!html.includes('<script type="module" src="/game.js"></script>')) {
  throw new Error('Could not convert game.js script tag to type=module.');
}
fs.writeFileSync(htmlPath, html, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* MF_PEPE_THREE_25D */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.three-stage{position:absolute;inset:0;z-index:0;overflow:hidden;border-radius:18px 18px 0 0;pointer-events:auto;touch-action:pan-y;background:transparent}\n.three-stage canvas{display:block;width:100%;height:100%;outline:0}\n.sky.three-ready>.stars,.sky.three-ready>.moon,.sky.three-ready>.cloud,.sky.three-ready>.rocket-wrap,.sky.three-ready>.launch-pad,.sky.three-ready>.earth{opacity:0!important;visibility:hidden!important;pointer-events:none!important}\n.sky.three-ready>.trajectory{opacity:.13;z-index:2}\n.sky.three-ready>.altitude{z-index:3}\n.sky.three-ready:after{z-index:2}\n@media (prefers-reduced-motion:reduce){.three-stage canvas{transform:none!important}}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

let js = fs.readFileSync(jsPath, 'utf8');
js = js.replace(/^\s*import\s+\*\s+as\s+THREE\s+from\s+['"]\/vendor\/three\.module\.js['"];?\s*\n/m, '');
if (!js.includes("from '/game-25d.js'")) js = `import { createPepeRocket25D } from '/game-25d.js';\n${js}`;

if (!js.includes("stage: $('#threeStage')")) {
  const needle = "playAgain: $('#playAgainBtn')";
  if (!js.includes(needle)) throw new Error('Could not find UI map insertion point in game.js.');
  js = js.replace(needle, `${needle}, stage: $('#threeStage'), sky: $('#sky')`);
}

if (!js.includes("visual: null")) {
  const needle = "lastFeedAt: 0, showingResultId: null";
  if (!js.includes(needle)) throw new Error('Could not find game state insertion point in game.js.');
  js = js.replace(needle, `${needle}, visual: null`);
}

if (!js.includes("game.visual?.setState(state)")) {
  const needle = "game.state = state; ui.shell.dataset.state = state;";
  if (!js.includes(needle)) throw new Error('Could not find setState() in game.js.');
  js = js.replace(needle, `${needle}\n    game.visual?.setState(state);`);
}

if (!js.includes("game.visual?.updateMultiplier(multiplier)")) {
  const needle = "ui.shell.dataset.stage = multiplier >= 5 ? 'deep' : multiplier >= 1.8 ? 'space' : multiplier >= 1.1 ? 'sky' : 'ground';";
  if (!js.includes(needle)) throw new Error('Could not find updateFlight() stage assignment in game.js.');
  js = js.replace(needle, `${needle}\n    game.visual?.updateMultiplier(multiplier);`);
}

if (!js.includes("game.visual?.reset()")) {
  const needle = "ui.rocket.style.transform = 'translate3d(-50%, 0, 0) rotate(0deg)'; ui.shell.dataset.stage = 'ground'; renderMultiplier(1);";
  if (!js.includes(needle)) throw new Error('Could not find resetFlightVisual() in game.js.');
  js = js.replace(needle, `${needle}\n    game.visual?.reset();`);
}

if (!js.includes("createPepeRocket25D({ mount: ui.stage")) {
  const needle = "async function boot() {\n    bind(); updateStakePreview(); setState('idle', 'Loading server paper-game state…');";
  if (!js.includes(needle)) throw new Error('Could not find boot() in game.js.');
  const replacement = "async function boot() {\n    game.visual = createPepeRocket25D({ mount: ui.stage, sky: ui.sky, shell: ui.shell });\n    bind(); updateStakePreview(); setState('idle', 'Loading server paper-game state…');";
  js = js.replace(needle, replacement);
}

if (!js.includes("game.visual?.destroy()")) {
  const needle = "window.addEventListener('beforeunload', closeFeed);";
  if (!js.includes(needle)) throw new Error('Could not find beforeunload binding in game.js.');
  js = js.replace(needle, "window.addEventListener('beforeunload', () => { closeFeed(); game.visual?.destroy(); });");
}

fs.writeFileSync(jsPath, js, 'utf8');

const assetsDir = path.join(appDir, 'game-assets', '25d');
fs.mkdirSync(assetsDir, { recursive: true });
const readme = `MEMEFLOW Pepe Rocket 2.5D assets\n\nThe Three.js renderer is live now and uses generated WebGL fallback artwork when files are absent.\nTo replace the fallback art with final transparent PNG layers, place these files in this folder:\n\n1. stars_bg.png\n2. nebula.png\n3. stars_fg.png\n4. planet.png\n5. bottom_glow.png\n6. smoke.png\n7. flame.png\n8. sparks.png\n9. rocket.png\n10. pepe.png\n11. glow_highlights.png\n\nRecommended canvas: 1920x1080 transparent PNG for every layer, aligned to the same canvas.\nDo not crop each layer differently; shared canvas alignment is what makes replacement drop-in safe.\n`;
fs.writeFileSync(path.join(assetsDir, 'README.txt'), readme, 'utf8');

console.log('✓ Pepe Rocket Stage 2 installed');
console.log(`✓ App directory: ${appDir}`);
console.log('✓ Three.js WebGL renderer: /game-25d.js');
console.log('✓ 11 logical Z-depth layers + parallax + smooth 60fps animation');
console.log('✓ Existing START / multiplier / CASH OUT game logic preserved');
console.log('✓ Final PNG drop-in folder: game-assets/25d/');
console.log('✓ CSS scene remains as automatic fallback if WebGL cannot start');
console.log('Next: restart the app, open /game, and hard-refresh once.');
