/* MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* MEMEFLOW_V30_3_1_3D_LIGHTWEIGHT
   Performance scheduler only. */
const MF3D_MOBILE_V3031 = window.matchMedia('(max-width: 900px)');
const MF3D_LAST_FRAME_V3031 = new Map();

function mf3dMobileV3031() {
  return MF3D_MOBILE_V3031.matches;
}

function mf3dFrameAllowedV3031(key, mobileFps = 30, desktopFps = 45) {
  if (document.hidden) return false;

  const now = performance.now();
  const fps = mf3dMobileV3031() ? mobileFps : desktopFps;
  const interval = 1000 / Math.max(1, fps);
  const previous = MF3D_LAST_FRAME_V3031.get(key) || 0;

  if ((now - previous) < interval) {
    return false;
  }

  MF3D_LAST_FRAME_V3031.set(key, now);
  return true;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    MF3D_LAST_FRAME_V3031.clear();
  }
});


const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
const fmt = (v, d = 2) => finite(v) ? Number(v).toLocaleString(undefined, { maximumFractionDigits: d }) : '—';
const shortMint = (m = '') => m ? `${m.slice(0, 5)}…${m.slice(-4)}` : '—';

const ago = (ts) => {
  if (!finite(ts) || Number(ts) <= 0) return '—';
  const ms = Math.max(0, Date.now() - Number(ts));
  if (ms < 1000) return 'now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
};

const stateKey = (state = '') => {
  const s = String(state).toUpperCase();
  if (s.includes('BUY')) return 'ready';
  if (s.includes('BLOCK')) return 'blocked';
  if (s.includes('WATCH')) return 'watch';
  return 'waiting';
};

const COLORS = {
  cyan: 0x55d9ff,
  blue: 0x5c8dff,
  green: 0x4de6a1,
  yellow: 0xefc66a,
  red: 0xff6679,
  purple: 0xa98bff,
  neutral: 0x91a3af,
  waiting: 0x91a3af,
  watch: 0x5c8dff,
  blocked: 0xff6679,
  ready: 0x4de6a1
};

const LAYOUT = {
  discovery: { title: 'DISCOVERY', subtitle: 'Pump create · Solana WS', pos: [-10.2, 0.9, 0.0], color: COLORS.cyan, size: [3.2, 1.0, 1.9] },
  bootstrap: { title: 'FAST BOOTSTRAP', subtitle: 'price · holder · initial eval', pos: [-6.3, 2.2, -1.2], color: COLORS.blue, size: [3.5, 1.0, 2.0] },
  core: { title: 'MEMEFLOW CORE', subtitle: 'real-time event orchestration', pos: [-1.2, 0.7, 0.0], color: COLORS.green, size: [4.3, 1.4, 2.7], core: true },
  holders: { title: 'HOLDER LEDGER', subtitle: 'user-only live balances', pos: [2.7, 1.4, 1.9], color: COLORS.cyan, size: [3.3, 1.0, 1.9] },
  market: { title: 'MARKET LEDGER', subtitle: 'price · liquidity · pressure', pos: [2.7, -1.1, -0.2], color: COLORS.blue, size: [3.2, 1.0, 1.9] },
  risk: { title: 'RISK ENGINE', subtitle: 'deterministic gates', pos: [6.3, 0.9, 0.0], color: COLORS.green, size: [3.0, 1.0, 1.8] },
  decision: { title: 'DECISION', subtitle: 'WAIT · WATCH · BLOCK · READY', pos: [9.4, 0.9, 0.0], color: COLORS.purple, size: [2.8, 1.0, 1.8] },
  paper: { title: 'PAPER ENGINE', subtitle: 'observe · assist · automate', pos: [6.5, -2.1, -2.1], color: COLORS.purple, size: [3.0, 1.0, 1.8] },
  execution: { title: 'LIVE EXECUTION', subtitle: 'adapter not verified', pos: [9.5, -2.1, -2.1], color: COLORS.yellow, size: [3.0, 1.0, 1.8] },
  openai: { title: 'OPENAI ASSISTANT', subtitle: 'advisory · read-only context', pos: [0.7, 4.1, -3.5], color: COLORS.purple, size: [3.1, 1.0, 1.8] }
};

const SPECIAL_POINTS = {
  blockedExit: new THREE.Vector3(11.8, 1.1, 2.0),
  watchHold: new THREE.Vector3(10.3, 1.4, -1.0)
};

const EDGES = [
  { from: 'discovery', to: 'bootstrap', color: COLORS.cyan, via: [-8.4, 1.9, -0.4], pulses: 2, speed: 0.22 },
  { from: 'bootstrap', to: 'core', color: COLORS.blue, via: [-4.1, 2.4, -0.5], pulses: 3, speed: 0.24 },
  { from: 'core', to: 'holders', color: COLORS.cyan, via: [0.8, 1.8, 1.0], pulses: 2, speed: 0.19 },
  { from: 'core', to: 'market', color: COLORS.blue, via: [0.8, -0.8, -0.2], pulses: 2, speed: 0.19 },
  { from: 'holders', to: 'risk', color: COLORS.cyan, via: [4.4, 1.9, 1.0], pulses: 2, speed: 0.18 },
  { from: 'market', to: 'risk', color: COLORS.blue, via: [4.5, -0.1, -0.1], pulses: 2, speed: 0.18 },
  { from: 'openai', to: 'risk', color: COLORS.purple, via: [3.8, 3.0, -2.2], pulses: 1, speed: 0.12 },
  { from: 'risk', to: 'decision', color: COLORS.green, via: [7.9, 1.2, 0.0], pulses: 3, speed: 0.25 },
  { from: 'decision', to: 'paper', color: COLORS.purple, via: [7.9, -0.6, -1.0], pulses: 2, speed: 0.16 },
  { from: 'paper', to: 'execution', color: COLORS.yellow, via: [7.9, -2.0, -2.0], pulses: 1, speed: 0.12 }
];

const app = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: new THREE.Clock(),
  nodes: new Map(),
  labels: [],
  edgePulses: [],
  pickables: [],
  pointer: new THREE.Vector2(),
  raycaster: new THREE.Raycaster(),
  tokenMeshes: new Map(),
  selected: null,
  telemetry: null,
  autoRotate: true,
  cameraHome: new THREE.Vector3(2.2, 7.5, 20.8),
  targetHome: new THREE.Vector3(0.8, 0.5, -0.2)
};

function makeMaterial(color, emissive = 0.12, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.58,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity
  });
}

function addEdges(mesh, color = 0x315263, opacity = 0.62) {
  const line = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(line);
  return line;
}

function createLabel(id, object, title, subtitle, extraClass = '') {
  const el = document.createElement('div');
  el.className = `node-label ${extraClass}`.trim();
  el.innerHTML = `<strong>${title}</strong><small>${subtitle}</small>`;
  $('labels').appendChild(el);
  app.labels.push({
    id,
    object,
    el,
    offsetY: id === 'openai' ? 38 : 32
  });
}

function createModule(id, cfg) {
  const group = new THREE.Group();
  group.position.set(...cfg.pos);
  group.userData = { kind: 'module', id };

  const body = new THREE.Mesh(new THREE.BoxGeometry(...cfg.size), makeMaterial(cfg.core ? 0x0a151b : 0x081018, 0.02));
  addEdges(body, cfg.color);
  body.userData = { kind: 'module', id };
  group.add(body);

  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.size[0] * 0.78, 0.05, cfg.size[2] * 0.72),
    makeMaterial(cfg.color, cfg.core ? 0.78 : 0.64, 0.95)
  );
  topPlate.position.y = cfg.size[1] / 2 + 0.05;
  group.add(topPlate);

  const beacon = new THREE.PointLight(cfg.color, cfg.core ? 1.15 : 0.38, cfg.core ? 7.5 : 4.5, 2);
  beacon.position.y = 0.8;
  group.add(beacon);

  if (cfg.core) {
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.05, 12, 96), makeMaterial(COLORS.green, 0.95));
    ringA.rotation.x = Math.PI / 2;
    ringA.position.y = 0.82;
    group.add(ringA);

    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.032, 10, 72), makeMaterial(COLORS.cyan, 0.85));
    ringB.rotation.set(Math.PI / 2, 0.3, 0.2);
    ringB.position.y = 0.82;
    group.add(ringB);
  }

  app.scene.add(group);
  app.pickables.push(body);
  app.nodes.set(id, { id, group, body, topPlate, beacon, cfg });

  createLabel(id, group, cfg.title, cfg.subtitle, cfg.core ? 'core' : '');
}

function pointFor(id) {
  return app.nodes.get(id).group.position.clone();
}

function curveFromPoints(points) {
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.08);
}

function createFlowLine(edge) {
  const start = pointFor(edge.from);
  const end = pointFor(edge.to);
  const via = new THREE.Vector3(...edge.via);
  const curve = curveFromPoints([start, via, end]);

  const pts = curve.getPoints(80);
  const positions = [];
  for (const p of pts) positions.push(p.x, p.y, p.z);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({
      color: edge.color,
      transparent: true,
      opacity: 0.30
    })
  );

  app.scene.add(line);

  for (let i = 0; i < edge.pulses; i++) {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color: edge.color, transparent: true, opacity: 0.95 })
    );
    pulse.userData = {
      curve,
      t: Math.random(),
      speed: edge.speed * (0.9 + i * 0.12)
    };
    app.edgePulses.push(pulse);
    app.scene.add(pulse);
  }
}

function buildBackground() {
  const hemi = new THREE.HemisphereLight(0x7bbad6, 0x040609, 0.95);
  app.scene.add(hemi);

  const key = new THREE.DirectionalLight(0xd4efff, 1.15);
  key.position.set(8, 14, 10);
  app.scene.add(key);

  const rim = new THREE.DirectionalLight(0x6f91ff, 0.35);
  rim.position.set(-10, 6, -12);
  app.scene.add(rim);

  const grid = new THREE.GridHelper(56, 56, 0x173140, 0x0a171e);
  grid.position.y = -1.55;
  grid.material.transparent = true;
  grid.material.opacity = 0.26;
  app.scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 42),
    new THREE.MeshStandardMaterial({
      color: 0x03070a,
      roughness: 0.82,
      metalness: 0.2,
      transparent: true,
      opacity: 0.76
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.57;
  app.scene.add(floor);

  const rowGuideMaterial = new THREE.LineBasicMaterial({ color: 0x0f202b, transparent: true, opacity: 0.45 });
  const rowZ = [-3.4, 0.0, 3.4];
  for (const z of rowZ) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-13.0, -1.35, z),
      new THREE.Vector3(12.0, -1.35, z)
    ]);
    app.scene.add(new THREE.Line(geo, rowGuideMaterial));
  }

  const starGeo = new THREE.BufferGeometry();
  const stars = [];
  for (let i = 0; i < 420; i++) {
    stars.push((Math.random() - 0.5) * 46, Math.random() * 18 - 1, (Math.random() - 0.5) * 34);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x476c7c, size: 0.028, transparent: true, opacity: 0.42 });
  app.scene.add(new THREE.Points(starGeo, starMat));
}

function buildScene() {
  const canvas = $('systemCanvas');

  app.scene = new THREE.Scene();
  app.scene.fog = new THREE.FogExp2(0x020507, 0.024);

  app.camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  app.camera.position.copy(app.cameraHome);

  app.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });

  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mf3dMobileV3031() ? 1.5 : 1.8));
  app.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  app.renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  app.renderer.toneMappingExposure = 1.04;

  app.controls = new OrbitControls(app.camera, canvas);
  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.06;
  app.controls.enablePan = false;
  app.controls.minDistance = 12;
  app.controls.maxDistance = 28;
  app.controls.maxPolarAngle = Math.PI * 0.48;
  app.controls.minPolarAngle = Math.PI * 0.22;
  app.controls.minAzimuthAngle = -0.75;
  app.controls.maxAzimuthAngle = 0.55;
  app.controls.target.copy(app.targetHome);
  app.controls.autoRotate = true;
  app.controls.autoRotateSpeed = 0.18;

  buildBackground();
  Object.entries(LAYOUT).forEach(([id, cfg]) => createModule(id, cfg));
  /* Legacy flow geometry is disabled by CLEAN V29. */

  /* CLEAN V29 owns module picking. */
  window.addEventListener('resize', resize);
  animate();
}

function resize() {
  const c = $('systemCanvas');
  if (!app.renderer) return;
  const w = c.clientWidth;
  const h = c.clientHeight;
  app.camera.aspect = w / h;
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(w, h, false);
}

function updateLabels() {
  const w = $('systemCanvas').clientWidth;
  const h = $('systemCanvas').clientHeight;

  for (const label of app.labels) {
    const v = new THREE.Vector3();
    label.object.getWorldPosition(v);
    v.project(app.camera);

    const visible = v.z < 1 && v.z > -1;
    const x = (v.x * 0.5 + 0.5) * w;
    const mobileLabel = window.matchMedia('(max-width: 900px)').matches;
    const y = (-v.y * 0.5 + 0.5) * h + (mobileLabel ? 18 : 22);

    label.el.style.opacity = visible ? '1' : '0';
    label.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    label.el.classList.toggle('active', app.selected?.kind === 'module' && app.selected?.id === label.id);
  }
}

function pick(ev) {
  if (!app.renderer) return;

  const rect = $('systemCanvas').getBoundingClientRect();
  app.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  app.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

  app.raycaster.setFromCamera(app.pointer, app.camera);
  const hits = app.raycaster.intersectObjects(app.pickables, false);
  if (!hits.length) return;

  select(hits[0].object.userData);
}

function focusObject(object) {
  if (!object || !app.controls) return;

  const pos = new THREE.Vector3();
  object.getWorldPosition(pos);

  const direction = new THREE.Vector3().subVectors(app.camera.position, app.controls.target).normalize();
  app.controls.target.copy(pos);
  app.camera.position.copy(pos).add(direction.multiplyScalar(10.8));
  app.controls.update();
}

function metric(label, value) {
  return `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderModuleInspector(id) {
  const titles = {
    discovery: ['Discovery', 'Pump create events enter through Solana WebSocket.'],
    bootstrap: ['Fast Bootstrap', 'Price lifecycle, holder admission and initial evaluation start before slow enrichment.'],
    core: ['MEMEFLOW Core', 'Coordinates discovery, enrichment, evaluation, publication and engine updates.'],
    holders: ['Holder Ledger', 'Tracks user-only Pump trade balances and produces fresh holder concentration snapshots.'],
    market: ['Market Ledger', 'Updates price, liquidity and buy pressure from live trade events and curve snapshots.'],
    risk: ['Risk Engine', 'Independent quality score plus user-specific deterministic gates.'],
    decision: ['Decision', 'Current deterministic state: WAITING, WATCH, BLOCKED or BUY READY.'],
    paper: ['Paper Engine', 'Receives BUY READY decisions and applies paper execution safety gates.'],
    openai: ['OpenAI Assistant', 'Optional advisory layer. Deterministic risk engine remains authoritative.'],
    execution: ['Live Execution', 'Production signing / live execution adapter is not verified in this build.']
  };

  const x = titles[id] || titles.core;
  $('inspectorTitle').textContent = x[0];
  $('inspectorSummary').textContent = x[1];
  $('inspectorState').textContent = id === 'execution' ? 'NOT VERIFIED' : 'SYSTEM';
  $('inspectorState').className = `state-pill ${id === 'execution' ? 'waiting' : 'neutral'}`;

  const d = app.telemetry?.diag || {};
  const disc = app.telemetry?.discovery || {};

  const maps = {
    discovery: [['Events', disc.eventsReceived], ['Connected', disc.connected ? 'Yes' : 'No'], ['Queue', disc.queueDepth], ['Last event', ago(disc.lastEventAt)]],
    bootstrap: [['Starts', d.fastPhase?.starts], ['Holder queued', d.fastPhase?.holderQueued], ['Eval started', d.fastPhase?.initialEvaluationStarted], ['Errors', d.fastPhase?.bootstrapErrors]],
    holders: [['Queue', disc.holderQueueDepth], ['Processing', disc.holderProcessing], ['Snapshots', d.liveTradeFeed?.holderSnapshots], ['Ledger mints', d.eventHolderLedger?.trackedMints]],
    market: [['Snapshots', d.liveTradeFeed?.marketSnapshots], ['Trade events', d.liveTradeFeed?.tradeEventsDecoded], ['WS direct', d.liveTradeFeed?.connected ? 'Live' : 'Offline'], ['HTTP hot path', d.liveTradeFeed?.httpRpcCalls ?? 0]],
    risk: [['Active users', disc.activeEvaluationUsers], ['Evaluations', disc.liveEvaluationsPerformed], ['Tokens', disc.liveEvaluationTokensProcessed], ['Batch errors', disc.liveEvaluationBatchErrors]],
    decision: [['Tokens', d.counts?.returned], ['Fresh backlog', d.bridge?.currentFreshBacklog], ['SLA misses', d.bridge?.slaMissesCurrent], ['Eval calls', d.liveTradeFeed?.evaluationCalls]],
    paper: [['Environment', 'Paper'], ['Source', 'BUY READY'], ['Safety', 'Enabled'], ['Live funds', 'No']],
    openai: [['Configured', app.telemetry?.openai?.configured ? 'Yes' : 'No'], ['Mode', app.telemetry?.openai?.mode || 'read-only'], ['Model', app.telemetry?.openai?.model || '—'], ['Authority', 'Advisory']],
    execution: [['Adapter', 'Not verified'], ['Signing', 'Unavailable'], ['Paper engine', 'Available'], ['Risk authority', 'Enabled']],
    core: [['Tokens', d.counts?.tokensInThisInstance], ['Pump tokens', d.counts?.pumpTokensInThisInstance], ['Fresh backlog', d.bridge?.currentFreshBacklog], ['PID', d.instance?.pid]]
  };

  $('metricGrid').innerHTML = (maps[id] || maps.core).map(([a, b]) => metric(a, b ?? '—')).join('');
  $('primaryReason').textContent = x[1];
  $('gateList').innerHTML = '';
  $('inspectorMint').textContent = 'Architecture module';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function renderTokenInspector(row) {
  const d = row.decision || {};
  const h = row.holder || {};
  const m = row.market || {};
  const state = d.state || 'WAITING';
  const key = stateKey(state);

  $('inspectorTitle').textContent = shortMint(row.mint);
  $('inspectorSummary').textContent = `Pump token · ${row.schedulerLane || 'pipeline'} · age ${fmt(row.ageMinutes, 1)} min`;
  $('inspectorState').textContent = state;
  $('inspectorState').className = `state-pill ${key}`;

  $('metricGrid').innerHTML = [
    ['AI score', d.score ?? '—'],
    ['Holders', h.count ?? '—'],
    ['Top 10', finite(h.top10Pct) ? `${fmt(h.top10Pct, 2)}%` : '—'],
    ['Developer', finite(h.developerPct) ? `${fmt(h.developerPct, 2)}%` : '—'],
    ['Buy pressure', finite(m.buyPressure) ? `${fmt(m.buyPressure, 2)}×` : '—'],
    ['Price SOL', finite(m.priceSol) ? fmt(m.priceSol, 9) : '—']
  ].map(([a, b]) => metric(a, b)).join('');

  $('primaryReason').textContent =
    d.primaryReason ||
    (Array.isArray(d.reasons) && d.reasons[0]) ||
    'Waiting for deterministic evaluation.';

  const gates = row.gates || null;
  let list = [];

  if (gates) {
    list = Object.entries(gates).map(([name, g]) => ({
      name,
      status: g?.pass === true ? 'PASS' : g?.pass === false ? 'FAIL' : 'WAIT'
    }));
  } else if (Array.isArray(d.reasons) && d.reasons.length) {
    list = d.reasons.slice(0, 4).map((r, i) => ({
      name: r,
      status: i === 0 && key === 'blocked' ? 'FAIL' : 'INFO'
    }));
  }

  $('gateList').innerHTML = list.map((g) => `
    <div class="gate ${g.status === 'PASS' ? 'pass' : g.status === 'FAIL' ? 'fail' : 'wait'}">
      <span>${escapeHtml(g.name)}</span>
      <b>${g.status}</b>
    </div>
  `).join('');

  $('inspectorMint').textContent = row.mint || '—';
}

function select(data) {
  app.selected = data;
  window.__mf29SyncSelection?.();

  document.querySelectorAll('.token-card').forEach((x) => {
    x.classList.toggle('active', data.kind === 'token' && x.dataset.mint === data.mint);
  });

  if (data.kind === 'token') {
    renderTokenInspector(data.row);
  } else {
    renderModuleInspector(data.id);
  }
}

function rankSample(sample = []) {
  const priority = { ready: 0, blocked: 1, watch: 2, waiting: 3 };

  return sample
    .filter((row) => row?.mint)
    .slice()
    .sort((a, b) => {
      const pa = priority[stateKey(a.decision?.state)] ?? 9;
      const pb = priority[stateKey(b.decision?.state)] ?? 9;
      if (pa !== pb) return pa - pb;

      const sa = Number(a.decision?.score ?? -1);
      const sb = Number(b.decision?.score ?? -1);
      if (sa !== sb) return sb - sa;

      return Number(a.ageMinutes ?? 0) - Number(b.ageMinutes ?? 0);
    })
    .slice(0, 12);
}

function routePointsFor(row, index) {
  const state = stateKey(row.decision?.state);
  const branch = ((index + (row.holder?.count || 0)) % 2 === 0) ? 'holders' : 'market';

  const points = [
    pointFor('discovery'),
    pointFor('bootstrap'),
    pointFor('core')
  ];

  const hasMidTelemetry =
    finite(row.market?.priceSol) ||
    finite(row.market?.buyPressure) ||
    finite(row.holder?.count) ||
    row.pipelineStarted;

  if (hasMidTelemetry) {
    points.push(pointFor(branch));
    points.push(pointFor('risk'));
  }

  if (state === 'watch' || state === 'blocked' || state === 'ready') {
    points.push(pointFor('decision'));
  }

  if (state === 'watch') {
    points.push(SPECIAL_POINTS.watchHold.clone());
  }

  if (state === 'ready') {
    points.push(pointFor('paper'));
  }

  if (state === 'blocked') {
    points.push(SPECIAL_POINTS.blockedExit.clone());
  }

  return points;
}

function routeCapFor(row) {
  const state = stateKey(row.decision?.state);

  if (state === 'ready') return 1;
  if (state === 'blocked') return 1;
  if (state === 'watch') return 0.92;

  const hasMidTelemetry =
    finite(row.market?.priceSol) ||
    finite(row.market?.buyPressure) ||
    finite(row.holder?.count) ||
    row.pipelineStarted;

  if (hasMidTelemetry) return 0.78;
  return 0.48;
}

function createTokenMesh(color) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.19, 1),
    makeMaterial(color, 0.88)
  );

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.018, 8, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
  );
  halo.rotation.x = Math.PI / 2;
  mesh.add(halo);

  return { mesh, halo };
}

function syncTokenMeshes(sample = []) {
  const keep = new Set();

  sample.forEach((row, index) => {
    if (!row?.mint) return;

    keep.add(row.mint);

    const key = stateKey(row.decision?.state);
    const color = COLORS[key];
    let item = app.tokenMeshes.get(row.mint);

    if (!item) {
      const created = createTokenMesh(color);
      created.mesh.userData = { kind: 'token', mint: row.mint, row };
      app.scene.add(created.mesh);
      app.pickables.push(created.mesh);

      item = {
        mesh: created.mesh,
        halo: created.halo,
        seed: Math.random(),
        speed: 0.10 + (index % 5) * 0.02,
        curve: curveFromPoints(routePointsFor(row, index)),
        cap: routeCapFor(row),
        state: key
      };

      app.tokenMeshes.set(row.mint, item);
    }

    item.mesh.userData = { kind: 'token', mint: row.mint, row };
    item.curve = curveFromPoints(routePointsFor(row, index));
    item.cap = routeCapFor(row);
    item.speed = 0.10 + (index % 5) * 0.02;
    item.state = key;

    item.mesh.material.color.setHex(color);
    item.mesh.material.emissive.setHex(color);
    item.halo.material.color.setHex(color);
  });

  for (const [mint, item] of app.tokenMeshes) {
    if (!keep.has(mint)) {
      app.scene.remove(item.mesh);
      app.pickables = app.pickables.filter((x) => x !== item.mesh);
      app.tokenMeshes.delete(mint);
    }
  }
}

function renderRail(sample = []) {
  const tokenRailEl = $('tokenRail');
  if (!tokenRailEl) return;
  tokenRailEl.innerHTML = sample.length
    ? sample.map((row) => {
        const key = stateKey(row.decision?.state);
        const state = row.decision?.state || 'WAITING';

        return `
          <button class="token-card" type="button" data-mint="${escapeHtml(row.mint)}">
            <div class="token-card-top">
              <span class="token-symbol">${escapeHtml(shortMint(row.mint))}</span>
              <span class="token-state ${key}">${escapeHtml(state)}</span>
            </div>
            <div class="token-card-meta">
              <span>Holders<b>${row.holder?.count ?? '—'}</b></span>
              <span>Buy pressure<b>${finite(row.market?.buyPressure) ? fmt(row.market.buyPressure, 2) + '×' : '—'}</b></span>
              <span>Top 10<b>${finite(row.holder?.top10Pct) ? fmt(row.holder.top10Pct, 1) + '%' : '—'}</b></span>
              <span>Age<b>${fmt(row.ageMinutes, 1)}m</b></span>
            </div>
          </button>
        `;
      }).join('')
    : `
      <div class="token-card">
        <div class="token-symbol">No token telemetry yet</div>
        <div class="token-card-meta">
          <span>Pipeline<b>waiting</b></span>
        </div>
      </div>
    `;

  document.querySelectorAll('.token-card[data-mint]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = app.telemetry?.diag?.sample?.find((x) => x.mint === btn.dataset.mint);
      if (row) select({ kind: 'token', mint: row.mint, row });
    });
  });
}

function setStatus(dot, status, text, kind) {
  dot.className = `dot ${kind}`;
  status.textContent = text;
}

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json();
}

async function refreshTelemetry() {
  const results = await Promise.allSettled([
    getJson(`/api/debug/filter-pipeline-lifecycle?limit=12`),
    getJson('/api/discovery/status'),
    getJson('/api/market/status'),
    getJson('/api/openai/status')
  ]);

  const [diagR, discR, marketR, aiR] = results;
  const diag = diagR.status === 'fulfilled' ? diagR.value : null;
  const discovery = discR.status === 'fulfilled' ? discR.value : null;
  const market = marketR.status === 'fulfilled' ? marketR.value : null;
  const openai = aiR.status === 'fulfilled' ? aiR.value : null;

  app.telemetry = { diag, discovery, market, openai };

  if (discovery?.connected) {
    setStatus($('wsDot'), $('wsStatus'), 'Live', 'ok');
  } else if (discovery) {
    setStatus($('wsDot'), $('wsStatus'), 'Connecting', 'warning');
  } else {
    setStatus($('wsDot'), $('wsStatus'), 'Unavailable', 'bad');
  }

  const rpcOK = market?.rpc === 'online' || market?.solana?.ok === true || discovery?.rpcLastHttpStatus === 200;
  if (rpcOK) {
    setStatus($('rpcDot'), $('rpcStatus'), 'Online', 'ok');
  } else if (market) {
    setStatus($('rpcDot'), $('rpcStatus'), market.rpc || 'Degraded', 'warning');
  } else {
    setStatus($('rpcDot'), $('rpcStatus'), 'Unavailable', 'bad');
  }

  if (openai?.configured) {
    setStatus($('aiDot'), $('aiStatus'), 'Configured', 'ok');
  } else if (openai) {
    setStatus($('aiDot'), $('aiStatus'), 'Optional', 'warning');
  } else {
    setStatus($('aiDot'), $('aiStatus'), 'Unavailable', 'bad');
  }

  const eventCountEl = $('eventCount');
  if (eventCountEl) eventCountEl.textContent = discovery?.eventsReceived ?? '—';
  const tradeCountEl = $('tradeCount');
  if (tradeCountEl) tradeCountEl.textContent = diag?.liveTradeFeed?.tradeEventsDecoded ?? discovery?.liveTradeFeed?.tradeEventsDecoded ?? '—';
  const holderQueueEl = $('holderQueue');
  if (holderQueueEl) holderQueueEl.textContent = discovery?.holderQueueDepth ?? '—';
  const activeUsersEl = $('activeUsers');
  if (activeUsersEl) activeUsersEl.textContent = discovery?.activeEvaluationUsers ?? '—';
  const freshBacklogEl = $('freshBacklog');
  if (freshBacklogEl) freshBacklogEl.textContent = diag?.bridge?.currentFreshBacklog ?? '—';
  const lastEventEl = $('lastEvent');
  if (lastEventEl) lastEventEl.textContent = ago(discovery?.lastEventAt);
  const lastSyncEl = $('lastSync');
  if (lastSyncEl) lastSyncEl.textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  const ranked = rankSample(diag?.sample || []);
  /* CLEAN V29 keeps token telemetry in the rail only. */
  renderRail(ranked);

  const telemetryModeEl = $('telemetryMode');
  if (telemetryModeEl) {
    telemetryModeEl.classList.toggle('offline', !(diag || discovery));
    if (telemetryModeEl.lastChild) {
      telemetryModeEl.lastChild.textContent = (diag || discovery) ? 'LIVE' : 'DEGRADED';
    }
  }

  if (app.selected?.kind === 'token') {
    const latest = (diag?.sample || []).find((x) => x.mint === app.selected.mint);
    if (latest) {
      app.selected.row = latest;
      renderTokenInspector(latest);
    }
  } else {
    renderModuleInspector(app.selected?.id || 'core');
  }
}

function animate() {
  // MF_V3031_GATE_animate
  requestAnimationFrame(animate);
  if (window.__MEMEFLOW_TRUE_3D_ACTIVE__) return;
  if (!mf3dFrameAllowedV3031('animate', 30, 45)) return;



  const dt = Math.min(app.clock.getDelta(), 0.05);
  const t = performance.now() * 0.001;

  app.controls.update();

  for (const pulse of app.edgePulses) {
    pulse.userData.t = (pulse.userData.t + dt * pulse.userData.speed) % 1;
    pulse.position.copy(pulse.userData.curve.getPointAt(pulse.userData.t));
    const s = 0.86 + Math.sin((pulse.userData.t * 10 + t * 2.4) * Math.PI) * 0.18;
    pulse.scale.setScalar(s);
  }

  for (const [id, node] of app.nodes) {
    const pulse = 0.74 + Math.sin(t * 1.7 + node.group.position.x * 0.15) * 0.18;
    node.beacon.intensity = id === 'core' ? 1.08 + pulse * 0.35 : 0.22 + pulse * 0.16;
    node.topPlate.position.y = node.cfg.size[1] / 2 + 0.05 + Math.sin(t * 1.5 + node.group.position.x * 0.1) * 0.01;
    if (node.cfg.core) {
      for (const child of node.group.children) {
        if (child.geometry?.type === 'TorusGeometry') {
          child.rotation.z += dt * (child.geometry.parameters.tube > 0.04 ? 0.20 : -0.24);
        }
      }
    }
  }

  for (const [mint, item] of app.tokenMeshes) {
    const base = ((t * item.speed) + item.seed) % 1;
    const u = clamp(0.04 + base * item.cap, 0, 1);
    const pos = item.curve.getPointAt(u);
    const ahead = item.curve.getPointAt(Math.min(u + 0.01, 1));

    item.mesh.position.copy(pos);
    item.mesh.position.y += 0.42 + Math.sin(t * 3.0 + item.seed * 10) * 0.05;
    item.mesh.lookAt(ahead);
    item.mesh.rotation.z += dt * 1.2;

    const glow = item.state === 'ready' ? 1.0 : item.state === 'blocked' ? 0.9 : 0.78;
    item.mesh.material.emissiveIntensity = glow;
    item.halo.material.opacity = item.state === 'waiting' ? 0.38 : 0.64;
  }

  updateLabels();
  app.renderer.render(app.scene, app.camera);
}

$('autoRotateBtn').addEventListener('click', () => {
  app.autoRotate = !app.autoRotate;
  app.controls.autoRotate = app.autoRotate;
  $('autoRotateBtn').classList.toggle('active', app.autoRotate);
});

$('resetViewBtn').addEventListener('click', () => {
  app.camera.position.copy(app.cameraHome);
  app.controls.target.copy(app.targetHome);
  app.controls.update();
});

$('focusBtn').addEventListener('click', () => {
  if (app.selected?.kind === 'token') {
    const x = app.tokenMeshes.get(app.selected.mint);
    if (x) focusObject(x.mesh);
    return;
  }

  focusObject(app.nodes.get(app.selected?.id || 'core')?.group);
});

try {
  buildScene();
  app.selected = { kind: 'module', id: 'core' };
  renderModuleInspector('core');
  refreshTelemetry().finally(() => setTimeout(() => $('boot').classList.add('hidden'), 420));
  setInterval(refreshTelemetry, 4000);
} catch (err) {
  console.error('[MEMEFLOW SYSTEM VIEW]', err);
  $('fatal').hidden = false;
  $('boot').classList.add('hidden');
}

/* ===== MEMEFLOW CLEAN HARDWARE V20 ===== */

const MF20 = {
  installed: false,
  hardware: new Map(),
  pipes: [],
  packets: [],
  coreFx: null,
  floor: null,
  lastFrame: performance.now()
};

const MF20_COLOR = {
  cyan: 0x54dfff,
  blue: 0x4f83ff,
  green: 0x47e5a4,
  purple: 0x8d67ff,
  red: 0xff5a70
};

const MF20_LAYOUT = {
  discovery: [-4.10, 0.00, -3.65],
  bootstrap: [-1.20, 0.00, -3.65],
  core: [2.35, 0.13, -3.25],

  risk: [-4.10, 0.00, -0.55],
  market: [-1.00, 0.00, -0.55],
  holders: [2.75, 0.00, -0.55],

  openai: [-4.10, 0.00, 2.50],
  decision: [-1.00, 0.00, 2.50],
  paper: [2.75, 0.00, 2.50],

  execution: [-0.75, 0.00, 5.05]
};

const MF20_NODE_COLOR = {
  discovery: MF20_COLOR.blue,
  bootstrap: MF20_COLOR.blue,
  core: MF20_COLOR.green,

  risk: MF20_COLOR.cyan,
  market: MF20_COLOR.blue,
  holders: MF20_COLOR.cyan,

  openai: MF20_COLOR.cyan,
  decision: MF20_COLOR.purple,
  paper: MF20_COLOR.blue,

  execution: MF20_COLOR.green
};

const MF20_LABELS = {
  discovery: 'DISCOVERY',
  bootstrap: 'FAST BOOTSTRAP',
  core: 'MEMEFLOW CORE',
  risk: 'RISK ENGINE',
  market: 'MARKET LEDGER',
  holders: 'HOLDER LEDGER',
  openai: 'OPENAI ASSISTANT',
  decision: 'DECISION',
  paper: 'PAPER ENGINE',
  execution: 'LIVE EXECUTION'
};

const MF20_ROUTES = [
  ['discovery', 'bootstrap', MF20_COLOR.blue],
  ['bootstrap', 'core', MF20_COLOR.blue],

  ['core', 'holders', MF20_COLOR.green],
  ['core', 'market', MF20_COLOR.green],

  ['holders', 'risk', MF20_COLOR.cyan],
  ['market', 'risk', MF20_COLOR.red],

  ['openai', 'decision', MF20_COLOR.cyan],
  ['risk', 'decision', MF20_COLOR.blue],

  ['decision', 'paper', MF20_COLOR.purple],
  ['paper', 'execution', MF20_COLOR.green]
];

function mf20Hex(value) {
  return (
    '#' +
    Number(value)
      .toString(16)
      .padStart(6, '0')
  );
}

function mf20MakeTopTexture(id, color) {
  const canvas =
    document.createElement('canvas');

  canvas.width = 1024;
  canvas.height = 512;

  const ctx =
    canvas.getContext('2d');

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const accent =
    mf20Hex(color);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;

  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;

  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const x = 512;
  const y = 165;

  if (id === 'discovery') {
    ctx.beginPath();
    ctx.arc(x - 20, y, 64, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 28, y + 48);
    ctx.lineTo(x + 92, y + 108);
    ctx.stroke();
  }

  if (id === 'bootstrap') {
    ctx.beginPath();
    ctx.moveTo(x + 22, y - 90);
    ctx.lineTo(x - 66, y + 22);
    ctx.lineTo(x - 5, y + 22);
    ctx.lineTo(x - 38, y + 112);
    ctx.lineTo(x + 80, y - 25);
    ctx.lineTo(x + 20, y - 25);
    ctx.closePath();
    ctx.fill();
  }

  if (id === 'core') {
    ctx.beginPath();
    ctx.moveTo(x - 85, y - 38);
    ctx.lineTo(x - 8, y + 40);
    ctx.lineTo(x + 92, y - 72);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 52, y + 64);
    ctx.lineTo(x + 4, y + 116);
    ctx.lineTo(x + 70, y + 48);
    ctx.stroke();
  }

  if (id === 'risk') {
    ctx.beginPath();
    ctx.moveTo(x, y - 94);
    ctx.lineTo(x + 92, y - 50);
    ctx.lineTo(x + 78, y + 43);

    ctx.quadraticCurveTo(
      x + 65,
      y + 102,
      x,
      y + 132
    );

    ctx.quadraticCurveTo(
      x - 65,
      y + 102,
      x - 78,
      y + 43
    );

    ctx.lineTo(x - 92, y - 50);
    ctx.closePath();
    ctx.stroke();
  }

  if (id === 'market') {
    ctx.beginPath();
    ctx.moveTo(x - 112, y + 86);
    ctx.lineTo(x - 45, y + 18);
    ctx.lineTo(x + 10, y + 43);
    ctx.lineTo(x + 72, y - 54);
    ctx.lineTo(x + 118, y - 28);
    ctx.stroke();
  }

  if (id === 'holders') {
    const points = [
      [x, y - 68, 40],
      [x - 72, y + 50, 34],
      [x + 72, y + 50, 34]
    ];

    for (const [px, py, r] of points) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(x - 30, y - 38);
    ctx.lineTo(x - 56, y + 22);

    ctx.moveTo(x + 30, y - 38);
    ctx.lineTo(x + 56, y + 22);

    ctx.moveTo(x - 38, y + 52);
    ctx.lineTo(x + 38, y + 52);
    ctx.stroke();
  }

  if (id === 'openai') {
    for (let i = 0; i < 6; i++) {
      ctx.save();

      ctx.translate(x, y);
      ctx.rotate(i * Math.PI / 3);

      ctx.beginPath();
      ctx.ellipse(
        0,
        -48,
        42,
        74,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.restore();
    }
  }

  if (id === 'decision') {
    ctx.beginPath();
    ctx.arc(
      x - 28,
      y,
      62,
      Math.PI * 0.55,
      Math.PI * 1.55
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      x + 28,
      y,
      62,
      -Math.PI * 0.55,
      Math.PI * 0.45
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 86);
    ctx.lineTo(x, y + 90);
    ctx.stroke();
  }

  if (id === 'paper') {
    ctx.strokeRect(
      x - 72,
      y - 92,
      144,
      184
    );

    for (const offset of [-38, 0, 38]) {
      ctx.beginPath();
      ctx.moveTo(x - 40, y + offset);
      ctx.lineTo(x + 40, y + offset);
      ctx.stroke();
    }
  }

  if (id === 'execution') {
    ctx.beginPath();
    ctx.moveTo(x, y - 105);

    ctx.quadraticCurveTo(
      x + 84,
      y - 55,
      x + 72,
      y + 35
    );

    ctx.lineTo(x + 25, y + 92);
    ctx.lineTo(x - 25, y + 92);
    ctx.lineTo(x - 72, y + 35);

    ctx.quadraticCurveTo(
      x - 84,
      y - 55,
      x,
      y - 105
    );

    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y - 8, 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.needsUpdate = true;

  return texture;
}

function mf20HideExistingNode(node) {
  if (
    !node?.group ||
    node.group.userData.mf20Hidden
  ) {
    return;
  }

  node.group.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    if (!object.material) {
      return;
    }

    const materials =
      Array.isArray(object.material)
        ? object.material
        : [object.material];

    object.material =
      materials.map(material => {
        const clone =
          material.clone();

        clone.transparent = true;
        clone.opacity = 0.001;
        clone.depthWrite = false;

        if (
          clone.emissive &&
          'emissiveIntensity' in clone
        ) {
          clone.emissiveIntensity = 0;
        }

        return clone;
      });

    if (!Array.isArray(object.material)) {
      object.material =
        object.material[0];
    }
  });

  node.group.userData.mf20Hidden =
    true;
}

/* ===== MEMEFLOW_PREMIUM_GLASS_3D_V5 HELPERS ===== */

function mf5GlassMaterial(color, core = false, layer = 0) {
  const top = layer === 2;

  return new THREE.MeshPhysicalMaterial({
    color: top ? 0x071018 : 0x020609,
    emissive: color,
    emissiveIntensity:
      top
        ? core ? 0.16 : 0.065
        : core ? 0.045 : 0.018,
    metalness: top ? 0.48 : 0.62,
    roughness: top ? 0.20 : 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: top ? 0.93 : 0.97
  });
}

function mf5TopGlassMaterial(color, core = false) {
  return new THREE.MeshPhysicalMaterial({
    color: core ? 0x082018 : 0x07131b,
    emissive: color,
    emissiveIntensity: core ? 0.21 : 0.075,
    metalness: 0.26,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: core ? 0.72 : 0.58,
    depthWrite: true
  });
}

function mf5EdgeMaterial(color, opacity = 0.5) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function mf5GlowPlane(width, depth, color, opacity) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );

  glow.rotation.x = -Math.PI / 2;
  return glow;
}

function mf5MakeLed(color, opacity = 0.94) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 10, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

function mf5RouteColor(edge) {
  if (edge?.key === 'paper:execution') {
    return COLORS.green;
  }

  return edge?.color || COLORS.cyan;
}

function mf5HideLegacyPipes() {
  if (typeof MF20 === 'undefined') return;

  for (const route of MF20.pipes || []) {
    if (route?.pipe) route.pipe.visible = false;
    if (route?.halo) route.halo.visible = false;
  }

  for (const packet of MF20.packets || []) {
    if (packet) packet.visible = false;
  }
}

/* ===== MEMEFLOW_RENDER_MATCH_V6 HELPERS ===== */

function mf6Hex(value) {
  return '#' + Number(value).toString(16).padStart(6, '0');
}

function mf6MakeLabelTexture(id, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;

  const ctx = canvas.getContext('2d');
  const accent = mf6Hex(color);
  const label = MF20_LABELS[id] || id.toUpperCase();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, 'rgba(5,10,14,0.96)');
  bg.addColorStop(1, 'rgba(2,5,8,0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 6;
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
  ctx.globalAlpha = 1;

  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f3f8fb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize =
    label.length > 15
      ? 58
      : label.length > 11
        ? 66
        : 74;

  ctx.font = `800 ${fontSize}px Arial`;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function mf6GlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 124);

  g.addColorStop(0.00, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.38)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.10)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const MF6_GLOW_TEXTURE = mf6GlowTexture();

function mf6SoftGlow(width, depth, color, opacity) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: MF6_GLOW_TEXTURE,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );

  plane.rotation.x = -Math.PI / 2;
  return plane;
}

function mf6ShellMaterial(color, core = false, top = false) {
  return new THREE.MeshPhysicalMaterial({
    color: top
      ? core ? 0x0a251c : 0x07131d
      : 0x03090d,
    emissive: color,
    emissiveIntensity:
      top
        ? core ? 0.34 : 0.16
        : core ? 0.11 : 0.055,
    metalness: top ? 0.32 : 0.58,
    roughness: top ? 0.14 : 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    transparent: true,
    opacity: top ? 0.78 : 0.98
  });
}

function mf6BrightLine(color, opacity) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function mf6AddCoreRings(hardware, color) {
  const group = new THREE.Group();
  group.position.y = 0.19;

  for (const [radius, tube, opacity] of [
    [0.63, 0.024, 0.92],
    [0.84, 0.018, 0.62],
    [1.04, 0.013, 0.32]
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, 72),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  hardware.add(group);
  return group;
}

function mf6HideLegacyDomLabels() {
  const labels = document.getElementById('labels');
  if (labels) labels.setAttribute('aria-hidden', 'true');
}

function mf20BuildModule(id) {
  const node = app.nodes.get(id);
  if (!node?.group) return;

  const color = MF20_NODE_COLOR[id];
  const core = id === 'core';
  const decision = id === 'decision';
  const execution = id === 'execution';

  node.group.position.set(...MF20_LAYOUT[id]);
  node.group.scale.set(1, 1, 1);
  mf20HideExistingNode(node);

  const hardware = new THREE.Group();
  hardware.name = 'MF20_HARDWARE_' + id;

  const width =
    core ? 3.45 :
    decision ? 2.72 :
    execution ? 2.82 : 2.66;

  const depth =
    core ? 2.30 :
    decision ? 1.82 :
    execution ? 1.84 : 1.76;

  const radius = core ? 0.22 : 0.17;

  const tiers = [
    { w: 1.12, d: 1.12, h: 0.19, y: -0.47, glow: 0.16 },
    { w: 1.065, d: 1.065, h: 0.18, y: -0.285, glow: 0.26 },
    { w: 1.00, d: 1.00, h: 0.22, y: -0.09, glow: 0.50 }
  ];

  const bodies = [];
  const edgeLayers = [];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];

    const geometry = new RoundedBoxGeometry(
      width * tier.w,
      tier.h,
      depth * tier.d,
      4,
      radius
    );

    const body = new THREE.Mesh(
      geometry,
      mf6ShellMaterial(color, core, i === 2)
    );

    body.position.y = tier.y;
    body.renderOrder = 4 + i;
    hardware.add(body);
    bodies.push(body);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 22),
      mf6BrightLine(
        color,
        core
          ? Math.min(1, tier.glow + 0.26)
          : decision || execution
            ? Math.min(1, tier.glow + 0.15)
            : tier.glow
      )
    );

    edges.position.copy(body.position);
    edges.renderOrder = 9;
    hardware.add(edges);
    edgeLayers.push(edges);
  }

  const glassGeometry = new RoundedBoxGeometry(
    width * 0.94,
    0.11,
    depth * 0.89,
    4,
    radius * 0.86
  );

  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshPhysicalMaterial({
      color: core ? 0x0b2f22 : 0x081723,
      emissive: color,
      emissiveIntensity:
        core ? 0.40 :
        decision ? 0.27 :
        execution ? 0.32 : 0.18,
      metalness: 0.18,
      roughness: 0.10,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      transparent: true,
      opacity: core ? 0.68 : 0.58
    })
  );

  glass.position.y = 0.105;
  glass.renderOrder = 7;
  hardware.add(glass);

  const glassEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glassGeometry, 22),
    mf6BrightLine(
      color,
      core ? 1.00 :
      decision ? 0.94 :
      execution ? 0.96 : 0.82
    )
  );

  glassEdges.position.copy(glass.position);
  glassEdges.renderOrder = 11;
  hardware.add(glassEdges);

  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.78,
      depth * 0.69
    ),
    new THREE.MeshBasicMaterial({
      map: mf20MakeTopTexture(id, color),
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  display.rotation.x = -Math.PI / 2;
  display.position.y = 0.168;
  display.renderOrder = 13;
  hardware.add(display);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(
      width * 0.78,
      core ? 0.38 : 0.34
    ),
    new THREE.MeshBasicMaterial({
      map: mf6MakeLabelTexture(id, color),
      transparent: true,
      opacity: 1,
      depthWrite: false
    })
  );

  label.position.set(0, -0.115, depth * 0.505);
  label.renderOrder = 14;
  hardware.add(label);

  const boltX = width * 0.405;
  const boltZ = depth * 0.375;

  for (const x of [-boltX, boltX]) {
    for (const z of [-boltZ, boltZ]) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.040, 0.040, 0.028, 12),
        new THREE.MeshStandardMaterial({
          color: 0x9bb5c2,
          emissive: color,
          emissiveIntensity: 0.18,
          metalness: 0.92,
          roughness: 0.16
        })
      );

      bolt.position.set(x, 0.175, z);
      hardware.add(bolt);
    }
  }

  const leds = [];

  for (let index = 0; index < 3; index++) {
    const ledColor =
      index === 2
        ? color
        : index === 1
          ? 0x4e819a
          : 0x315565;

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 8),
      new THREE.MeshBasicMaterial({
        color: ledColor,
        transparent: true,
        opacity: index === 2 ? 1 : 0.74,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    led.position.set(
      width * 0.27 + index * 0.13,
      -0.005,
      depth * 0.535
    );

    hardware.add(led);
    leds.push(led);
  }

  const underside = mf6SoftGlow(
    width * 1.62,
    depth * 1.72,
    color,
    core ? 0.27 :
    decision ? 0.20 :
    execution ? 0.23 : 0.115
  );

  underside.position.y = -0.59;
  underside.renderOrder = 1;
  hardware.add(underside);

  const innerGlow = mf6SoftGlow(
    width * 1.14,
    depth * 1.18,
    color,
    core ? 0.22 : 0.095
  );

  innerGlow.position.y = -0.545;
  innerGlow.renderOrder = 2;
  hardware.add(innerGlow);

  let coreRings = null;
  if (core) coreRings = mf6AddCoreRings(hardware, color);

  node.group.add(hardware);

  MF20.hardware.set(id, {
    group: hardware,
    display,
    label,
    underside,
    innerGlow,
    glass,
    glassEdges,
    bodies,
    edgeLayers,
    leds,
    coreRings,
    color
  });
}

function mf20CreateFloor() {
  const floor =
    new THREE.Group();

  floor.name =
    'MF20_FLOOR';

  const grid =
    new THREE.GridHelper(
      22,
      34,
      0x12363e,
      0x081820
    );

  grid.position.y =
    -0.48;

  grid.material.transparent =
    true;

  grid.material.opacity =
    0.12;

  floor.add(grid);

  const glow =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        5.4,
        96
      ),
      new THREE.MeshBasicMaterial({
        color: 0x0c5660,
        transparent: true,
        opacity: 0.024,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending,
        side:
          THREE.DoubleSide
      })
    );

  glow.rotation.x =
    -Math.PI / 2;

  glow.position.set(
    -0.25,
    -0.465,
    0.40
  );

  floor.add(glow);

  app.scene.add(floor);

  MF20.floor = floor;
}

function mf20WorldPoint(id) {
  const p =
    MF20_LAYOUT[id];

  return new THREE.Vector3(
    p[0],
    -0.17,
    p[2]
  );
}

function mf20CreatePipe(
  from,
  to,
  color
) {
  const start =
    mf20WorldPoint(from);

  const end =
    mf20WorldPoint(to);

  const direction =
    end.clone().sub(start);

  const horizontalFirst =
    Math.abs(direction.x) >
    Math.abs(direction.z);

  let points;

  if (horizontalFirst) {
    const mx =
      start.x +
      direction.x * 0.50;

    points = [
      start,
      new THREE.Vector3(
        mx,
        -0.17,
        start.z
      ),
      new THREE.Vector3(
        mx,
        -0.17,
        end.z
      ),
      end
    ];
  } else {
    const mz =
      start.z +
      direction.z * 0.50;

    points = [
      start,
      new THREE.Vector3(
        start.x,
        -0.17,
        mz
      ),
      new THREE.Vector3(
        end.x,
        -0.17,
        mz
      ),
      end
    ];
  }

  const curve =
    new THREE.CatmullRomCurve3(
      points,
      false,
      'catmullrom',
      0.03
    );

  const pipe =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        72,
        0.035,
        8,
        false
      ),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.72,
        metalness: 0.22,
        roughness: 0.30,
        transparent: true,
        opacity: 0.72
      })
    );

  app.scene.add(pipe);

  const halo =
    new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        72,
        0.065,
        8,
        false
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending
      })
    );

  app.scene.add(halo);

  const route = {
    from,
    to,
    curve,
    pipe,
    halo
  };

  MF20.pipes.push(route);

  for (
    let index = 0;
    index < 2;
    index++
  ) {
    const packet =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.028,
          10,
          8
        ),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.88,
          blending:
            THREE.AdditiveBlending
        })
      );

    packet.userData.mf20 = {
      curve,
      from,
      to,
      progress:
        (
          index / 3 +
          Math.random() * 0.08
        ) % 1
    };

    app.scene.add(packet);

    MF20.packets.push(
      packet
    );
  }
}

function mf20BuildRoutes() {
  for (const route of MF20_ROUTES) {
    mf20CreatePipe(
      route[0],
      route[1],
      route[2]
    );
  }
}

function mf20CreateCoreFx() {
  const core =
    app.nodes.get('core');

  if (!core?.group) {
    return;
  }

  const fx =
    new THREE.Group();

  fx.name =
    'MF20_CORE_FX';

  const rings = [];

  for (
    const data
    of [
      [1.10, 0.18],
      [1.43, 0.10],
      [1.76, 0.055]
    ]
  ) {
    const ring =
      new THREE.Mesh(
        new THREE.TorusGeometry(
          data[0],
          0.018,
          8,
          96
        ),
        new THREE.MeshBasicMaterial({
          color:
            MF20_COLOR.green,

          transparent: true,
          opacity: data[1],

          blending:
            THREE.AdditiveBlending
        })
      );

    ring.rotation.x =
      Math.PI / 2;

    ring.position.y =
      0.04;

    fx.add(ring);

    rings.push(ring);
  }

  const orb =
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(
        0.42,
        2
      ),
      new THREE.MeshBasicMaterial({
        color:
          MF20_COLOR.green,

        wireframe: true,
        transparent: true,
        opacity: 0.28
      })
    );

  orb.position.y =
    0.78;

  fx.add(orb);

  const light =
    new THREE.PointLight(
      MF20_COLOR.green,
      0.45,
      4.5,
      2
    );

  light.position.y =
    0.70;

  fx.add(light);

  core.group.add(fx);

  MF20.coreFx = {
    group: fx,
    rings,
    orb,
    light
  };
}

function mf20HideLegacyEffects() {
  if (
    typeof PREMIUM_V11 !==
    'undefined'
  ) {
    if (
      PREMIUM_V11.stage
    ) {
      PREMIUM_V11.stage.visible =
        false;
    }

    if (
      PREMIUM_V11.selectedRoute
    ) {
      PREMIUM_V11.selectedRoute.visible =
        false;
    }

    if (
      PREMIUM_V11.selectedRouteGlow
    ) {
      PREMIUM_V11.selectedRouteGlow.visible =
        false;
    }
  }

  if (
    typeof CONTROL_ROOM_V14 !==
    'undefined'
  ) {
    if (
      CONTROL_ROOM_V14.stage
    ) {
      CONTROL_ROOM_V14.stage.visible =
        false;
    }

    if (
      CONTROL_ROOM_V14.selectionRing
    ) {
      CONTROL_ROOM_V14.selectionRing.visible =
        false;
    }

    if (
      CONTROL_ROOM_V14.routeLine
    ) {
      CONTROL_ROOM_V14.routeLine.visible =
        false;
    }

    if (
      CONTROL_ROOM_V14.routeGlow
    ) {
      CONTROL_ROOM_V14.routeGlow.visible =
        false;
    }
  }

  if (
    typeof FLOW_REALITY_V8 !==
    'undefined'
  ) {
    for (
      const entry
      of FLOW_REALITY_V8.lines || []
    ) {
      if (entry?.line) {
        entry.line.visible =
          false;
      }
    }
  }

  for (
    const pulse
    of app.edgePulses || []
  ) {
    pulse.visible =
      false;
  }
}

function mf20PacketSpeed(
  from,
  to
) {
  const source =
    (app.edgePulses || [])
      .find(pulse => {
        const key =
          String(
            pulse?.userData
              ?.edgeKey || ''
          ).toLowerCase();

        return (
          key.includes(from) &&
          key.includes(to)
        );
      });

  const speed =
    Number(
      source?.userData?.speed
    );

  if (
    Number.isFinite(speed) &&
    speed > 0
  ) {
    return Math.max(
      0.14,
      Math.min(
        1.2,
        speed
      )
    );
  }

  return 0.34;
}

function mf20Camera(
  reset = true
) {
  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  app.camera.fov =
    mobile ? 41 : 38;

  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    0,
    mobile ? 8.15 : 7.3,
    mobile ? 17.5 : 16.1
  );

  app.targetHome.set(
    -0.35,
    -0.20,
    0.70
  );

  if (reset) {
    app.camera.position.copy(
      app.cameraHome
    );

    app.controls.target.copy(
      app.targetHome
    );
  }

  app.controls.enablePan =
    false;

  app.controls.enableZoom =
    true;

  app.controls.minDistance =
    10;

  app.controls.maxDistance =
    27;

  app.controls.zoomSpeed =
    1.05;

  app.controls.rotateSpeed =
    0.54;

  app.controls.minAzimuthAngle =
    -0.48;

  app.controls.maxAzimuthAngle =
    0.48;

  app.controls.minPolarAngle =
    Math.PI * 0.22;

  app.controls.maxPolarAngle =
    Math.PI * 0.46;

  app.controls.autoRotate =
    false;

  app.autoRotate =
    false;

  app.controls.update();
}

function mf20Animate(now) {
  // MF_V3031_GATE_mf20Animate
  requestAnimationFrame(mf20Animate);
  if (!mf3dFrameAllowedV3031('mf20Animate', 18, 24)) return;



  if (!MF20.installed) {
    return;
  }

  const delta =
    Math.min(
      0.05,
      Math.max(
        0,
        (now - MF20.lastFrame) /
        1000
      )
    );

  MF20.lastFrame =
    now;

  const seconds =
    now * 0.001;

  for (
    const packet
    of MF20.packets
  ) {
    const data =
      packet.userData.mf20;

    const speed =
      mf20PacketSpeed(
        data.from,
        data.to
      );

    data.progress +=
      delta *
      (
        0.95 +
        speed * 0.65
      );

    if (
      data.progress >= 1
    ) {
      data.progress -= 1;
    }

    packet.position.copy(
      data.curve.getPointAt(
        data.progress
      )
    );

    const size =
      0.88 +
      Math.sin(
        seconds * 8 +
        data.progress * 12
      ) * 0.12;

    packet.scale.setScalar(
      size
    );
  }

  for (
    const [id, hw]
    of MF20.hardware
  ) {
    const selected =
      app.selected?.kind ===
        'module' &&
      app.selected?.id === id;

    const target =
      selected
        ? 0.14
        : id === 'core'
          ? 0.04
          : 0.012;

    hw.underside.material.opacity +=
      (
        target -
        hw.underside.material.opacity
      ) * 0.07;
  }

  if (MF20.coreFx) {
    MF20.coreFx.orb.rotation.y +=
      delta * 0.28;

    MF20.coreFx.orb.rotation.x +=
      delta * 0.07;

    MF20.coreFx.rings[0].rotation.z +=
      delta * 0.18;

    MF20.coreFx.rings[1].rotation.z -=
      delta * 0.12;

    MF20.coreFx.rings[2].rotation.z +=
      delta * 0.07;

    MF20.coreFx.light.intensity =
      0.41 +
      Math.sin(seconds * 2) *
        0.045;
  }
}

function mf20Install() {
  if (
    MF20.installed ||
    !app.scene ||
    !app.nodes?.size
  ) {
    return;
  }

  MF20.installed = true;

  mf20HideLegacyEffects();

  for (
    const id
    of Object.keys(
      MF20_LAYOUT
    )
  ) {
    mf20BuildModule(id);
  }

  mf20CreateFloor();
  mf20BuildRoutes();
  mf20CreateCoreFx();
  mf20Camera(true);

  resize();

  const reset =
    [...document.querySelectorAll(
      'button'
    )]
      .find(button =>
        /reset\s*view/i.test(
          button.textContent || ''
        )
      );

  if (reset) {
    reset.addEventListener(
      'click',
      () => {
        setTimeout(
          () => {
            if (typeof REAL_WEB_V31 !== 'undefined' && REAL_WEB_V31.installed) {
              applyWebLayoutV31(true);
              return;
            }
            mf20Camera(true);
            resize();
          },
          30
        );
      }
    );
  }

  requestAnimationFrame(
    mf20Animate
  );
}

mf20Install();

window.addEventListener(
  'resize',
  () => {
    if (!MF20.installed) {
      return;
    }

    setTimeout(
      () => {
        if (typeof REAL_WEB_V31 !== 'undefined' && REAL_WEB_V31.installed) {
          return;
        }
        mf20Camera(false);
        resize();
      },
      220
    );
  }
);
/* ===== MEMEFLOW CLEAN SYSTEM V29 ===== */

const MF29 = {
  installed: false,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  hitTargets: [],
  pointerDown: null,
  pressedId: null,
  lights: new Map(),
  materialState: new Map()
};

const MF29_HEIGHT = {
  discovery: 0.16,
  bootstrap: 0.16,
  core: 0.32,
  risk: 0.08,
  market: 0.08,
  holders: 0.08,
  openai: 0.00,
  decision: 0.00,
  paper: 0.00,
  execution: 0.02
};

function mf29ProtectedObject(object) {
  let current = object;

  while (current) {
    const name = String(current.name || '');

    if (
      name.startsWith('MF20_HARDWARE_') ||
      name === 'MF20_CORE_FX' ||
      name === 'MF20_FLOOR'
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function mf29HideLegacyNodeGeometry() {
  for (const node of app.nodes.values()) {
    if (!node?.group) {
      continue;
    }

    node.group.traverse((object) => {
      if (object === node.group || mf29ProtectedObject(object)) {
        return;
      }

      if (
        object.isMesh ||
        object.isLine ||
        object.isLineSegments ||
        object.isPoints ||
        object.isLight
      ) {
        object.visible = false;
      }
    });
  }

  app.scene.traverse((object) => {
    if (mf29ProtectedObject(object)) {
      return;
    }

    if (object.isLine || object.isLineSegments || object.isPoints) {
      object.visible = false;
    }
  });
}

function mf29RefineHardware() {
  for (const [id, hardware] of MF20.hardware) {
    const node = app.nodes.get(id);

    if (!node?.group || !hardware?.group) {
      continue;
    }

    const position = MF20_LAYOUT[id];

    if (position) {
      node.group.position.set(
        position[0],
        MF29_HEIGHT[id] ?? 0,
        position[2]
      );
    }

    hardware.group.scale.setScalar(
      id === 'core' ? 1.14 : 1.03
    );

    if (hardware.display?.material) {
      hardware.display.material.opacity = id === 'core' ? 1 : 0.94;
    }

    if (hardware.underside?.material) {
      hardware.underside.material.opacity = id === 'core' ? 0.04 : 0.012;
    }

    hardware.group.traverse((object) => {
      const materials = object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [];

      for (const material of materials) {
        if (!MF29.materialState.has(material)) {
          MF29.materialState.set(material, {
            opacity: Number(material.opacity ?? 1),
            emissiveIntensity: Number(material.emissiveIntensity ?? 0)
          });
        }
      }
    });
  }
}

function mf29CreateHitTarget(id, hardware) {
  if (!hardware?.group || !hardware?.display?.geometry) {
    return;
  }

  const width = Number(hardware.display.geometry.parameters?.width) || 2.4;
  const depth = Number(hardware.display.geometry.parameters?.height) || 1.6;

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.18, 0.72, depth * 1.22),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.001,
      depthWrite: false,
      colorWrite: false
    })
  );

  hit.name = `MF29_HIT_${id}`;
  hit.position.y = -0.02;
  hit.userData = { kind: 'module', id };

  hardware.group.add(hit);
  MF29.hitTargets.push(hit);

  const light = new THREE.PointLight(
    hardware.color || MF20_COLOR.cyan,
    0,
    id === 'core' ? 4.8 : 3.5,
    2
  );

  light.name = `MF29_LIGHT_${id}`;
  light.position.set(0, 0.58, 0);
  hardware.group.add(light);
  MF29.lights.set(id, light);
}

function mf29SelectionId() {
  return app.selected?.kind === 'module'
    ? app.selected.id
    : null;
}

function mf29ApplyVisualState() {
  const selectedId = mf29SelectionId();

  for (const [id, hardware] of MF20.hardware) {
    const selected = id === selectedId;
    const pressed = id === MF29.pressedId;
    const energy = pressed ? 1 : selected ? 0.82 : 0;
    const baseScale = id === 'core' ? 1.14 : 1.03;

    hardware.group.scale.setScalar(
      baseScale * (1 + energy * (id === 'core' ? 0.028 : 0.040))
    );

    if (hardware.underside?.material) {
      hardware.underside.material.opacity = energy > 0
        ? 0.12 + energy * 0.045
        : id === 'core'
          ? 0.04
          : 0.012;
    }

    if (hardware.display?.material) {
      hardware.display.material.opacity = energy > 0
        ? 1
        : id === 'core'
          ? 1
          : 0.94;
    }

    const light = MF29.lights.get(id);

    if (light) {
      light.intensity = energy * (id === 'core' ? 0.85 : 0.62);
    }

    hardware.group.traverse((object) => {
      if (object.name?.startsWith('MF29_HIT_')) {
        return;
      }

      const materials = object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [];

      for (const material of materials) {
        const base = MF29.materialState.get(material);

        if (!base) {
          continue;
        }

        if (object.isLineSegments) {
          material.opacity = Math.min(
            1,
            base.opacity + energy * 0.34
          );
        }

        if (material.emissive && 'emissiveIntensity' in material) {
          material.emissiveIntensity =
            base.emissiveIntensity + energy * 0.34;
        }
      }
    });
  }
}

function mf29PointerFromEvent(event) {
  const canvas = app.renderer?.domElement;

  if (!canvas) {
    return false;
  }

  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  MF29.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  MF29.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  return true;
}

function mf29HitTest(event) {
  if (!mf29PointerFromEvent(event) || !app.camera) {
    return null;
  }

  MF29.raycaster.setFromCamera(MF29.pointer, app.camera);

  const hits = MF29.raycaster.intersectObjects(MF29.hitTargets, false);

  if (!hits.length) {
    return null;
  }

  const id = hits[0].object?.userData?.id;

  return id ? { id, hit: hits[0] } : null;
}

function mf29PointerDown(event) {
  const hit = mf29HitTest(event);

  MF29.pointerDown = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
    id: hit?.id || null,
    moved: false
  };

  MF29.pressedId = hit?.id || null;
  mf29ApplyVisualState();
}

function mf29PointerMove(event) {
  if (!MF29.pointerDown) {
    return;
  }

  const dx = event.clientX - MF29.pointerDown.x;
  const dy = event.clientY - MF29.pointerDown.y;

  if (Math.hypot(dx, dy) > 9) {
    MF29.pointerDown.moved = true;
    MF29.pressedId = null;
    mf29ApplyVisualState();
  }
}

function mf29PointerCancel() {
  MF29.pointerDown = null;
  MF29.pressedId = null;
  mf29ApplyVisualState();
}

function mf29PointerUp(event) {
  const down = MF29.pointerDown;
  MF29.pointerDown = null;

  if (!down) {
    MF29.pressedId = null;
    mf29ApplyVisualState();
    return;
  }

  const distance = Math.hypot(
    event.clientX - down.x,
    event.clientY - down.y
  );

  const elapsed = performance.now() - down.time;

  if (down.moved || distance > 10 || elapsed > 700) {
    MF29.pressedId = null;
    mf29ApplyVisualState();
    return;
  }

  const hit = mf29HitTest(event);
  const id = hit?.id || down.id;

  MF29.pressedId = null;

  if (!id) {
    mf29ApplyVisualState();
    return;
  }

  select({ kind: 'module', id });
  mf29ApplyVisualState();
}

function mf29Camera(reset = true) {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  app.camera.fov = mobile ? 40 : 36;
  app.camera.updateProjectionMatrix();

  const canvas = app.renderer?.domElement || document.getElementById('systemCanvas');
  const aspect = canvas && canvas.clientHeight > 0
    ? Math.max(0.55, canvas.clientWidth / canvas.clientHeight)
    : (mobile ? 1.25 : 1.55);

  const box = new THREE.Box3().makeEmpty();
  if (typeof MF20 !== 'undefined' && MF20.hardware && typeof MF20.hardware.values === 'function') {
    for (const hardware of MF20.hardware.values()) {
      if (hardware?.group) box.expandByObject(hardware.group);
    }
  }

  const center = new THREE.Vector3(0, 0, 0.65);
  const size = new THREE.Vector3(9.5, 1.5, 10.5);
  if (!box.isEmpty()) {
    box.getCenter(center);
    box.getSize(size);
  }

  const verticalFov = THREE.MathUtils.degToRad(app.camera.fov);
  const tanHalfFov = Math.tan(verticalFov / 2);
  const halfDepth = Math.max(3.8, size.z * 0.5);
  const halfWidth = Math.max(3.8, size.x * 0.5);
  const distanceForDepth = halfDepth / tanHalfFov;
  const distanceForWidth = halfWidth / (tanHalfFov * aspect);
  const distance = Math.max(distanceForDepth, distanceForWidth) * (mobile ? 1.34 : 1.20);

  app.cameraHome.set(
    center.x,
    center.y + distance,
    center.z + distance * (mobile ? 0.10 : 0.14)
  );
  app.targetHome.set(center.x, center.y - 0.18, center.z);

  if (reset) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.enablePan = false;
  app.controls.enableZoom = true;
  app.controls.minDistance = Math.max(8.8, distance * 0.55);
  app.controls.maxDistance = Math.max(30, distance * 1.8);
  app.controls.zoomSpeed = 1.02;
  app.controls.rotateSpeed = 0.50;
  app.controls.minPolarAngle = Math.PI * 0.075;
  app.controls.maxPolarAngle = Math.PI * 0.47;
  app.controls.minAzimuthAngle = -0.68;
  app.controls.maxAzimuthAngle = 0.68;
  app.controls.autoRotate = false;
  app.autoRotate = false;
  app.controls.update();
}

function mf29DisableLegacyTokenMeshes() {
  for (const item of app.tokenMeshes.values()) {
    if (item?.mesh) {
      app.scene.remove(item.mesh);
    }
  }

  app.tokenMeshes.clear();
  app.pickables = [];
}

function mf29Install() {
  if (MF29.installed || !MF20.installed || !MF20.hardware?.size) {
    return;
  }

  MF29.installed = true;

  mf29DisableLegacyTokenMeshes();
  mf29HideLegacyNodeGeometry();
  mf29RefineHardware();

  for (const [id, hardware] of MF20.hardware) {
    mf29CreateHitTarget(id, hardware);
  }

  const canvas = app.renderer?.domElement;

  if (!canvas) {
    throw new Error('MEMEFLOW V29 canvas is unavailable');
  }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', mf29PointerDown, { passive: true });
  canvas.addEventListener('pointermove', mf29PointerMove, { passive: true });
  canvas.addEventListener('pointerup', mf29PointerUp, { passive: true });
  canvas.addEventListener('pointercancel', mf29PointerCancel, { passive: true });

  window.__mf29SyncSelection = mf29ApplyVisualState;

  mf29Camera(true);
  mf29ApplyVisualState();
  resize();

  console.log('[MF29] Clean system layer enabled');
}

mf29Install();

window.addEventListener('resize', () => {
  if (!MF29.installed) {
    return;
  }

  if (typeof REAL_WEB_V31 !== 'undefined' && REAL_WEB_V31.installed) {
    return;
  }
  mf29Camera(false);
  resize();
});

/* ===== MEMEFLOW V29.3 CAMERA FIT + SETTINGS ===== */

const MF293 = {
  installed: false,
  settings: null,
  version: null,
  capabilities: null,
  profilePresets: {},
  killSwitchActive: false,
  dirty: false,
  saving: false
};

const MF293_GROUPS = [
  ['logic', 'Logic', 'Decision thresholds and operating policy', true, [
    ['operatingMode', 'Operating mode', 'select', [['observe','Observe'],['assist','Assist'],['automate','Automate']]],
    ['tradingEnvironment', 'Trading environment', 'select', [['paper','Paper'],['live','Live']]],
    ['profile', 'Profile', 'select', [['conservative','Conservative'],['balanced','Balanced'],['aggressive','Aggressive']]],
    ['minScore', 'Minimum AI score', 'number', 0, 100, 1],
    ['minConfidence', 'Minimum confidence %', 'number', 0, 100, 1],
    ['minBuyPressure', 'Minimum buy pressure', 'number', 0, null, 0.01],
    ['decisionFreshnessSec', 'Decision freshness sec', 'integer', 5, 3600, 1],
    ['requireFreshHolderSnapshot', 'Require fresh holder snapshot', 'boolean'],
    ['requireWebsiteOrX', 'Require website or X', 'boolean'],
    ['ownerApproval', 'Owner approval', 'boolean'],
    ['shadowValidation', 'Shadow validation', 'boolean'],
    ['changeLog', 'Settings change log', 'boolean']
  ]],
  ['trading', 'Trading', 'Capital, position sizing and daily limits', true, [
    ['tradingCapital', 'Trading capital SOL', 'number', 0, null, 0.01],
    ['dailySpendLimit', 'Daily spend limit SOL', 'number', 0, null, 0.01],
    ['positionSize', 'Default position SOL', 'number', 0.000001, null, 0.01],
    ['maxPositionSize', 'Maximum position SOL', 'number', 0.000001, null, 0.01],
    ['maxOpenPositions', 'Maximum open positions', 'integer', 0, null, 1],
    ['maxDailyEntries', 'Maximum daily entries', 'integer', 0, null, 1],
    ['dailyLossLimit', 'Daily loss limit SOL', 'number', 0, null, 0.01],
    ['feeReserve', 'Fee reserve SOL', 'number', 0, null, 0.001]
  ]],
  /* MEMEFLOW_NATIVE_COPY_TRADING_SETTINGS_V3 */
  ['copyTrading', 'Copy trading', 'Mirror a Solana wallet with your own position size', false, [
    ['copyTradingEnabled', 'Enable copy trading', 'boolean'],
    ['copyTradingWallet', 'Tracked Solana wallet', 'text'],
    ['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001],
    ['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']
  ]],
  ['filters', 'Entry filters', 'Scanner scans all · these filters control cards + trading', false, [
    ['minLiquidityUsd', 'Minimum liquidity USD', 'number', 0, null, 1],
    ['minHolders', 'Minimum holders', 'nullable', 0, null, 1],
    ['maxHolders', 'Maximum holders', 'nullable', 0, null, 1],
    ['minTokenAgeMinutes', 'Minimum age min', 'nullable', 0, null, 0.1],
    ['maxTokenAgeMinutes', 'Maximum age min', 'nullable', 0, null, 0.1],
    ['minMarketCapUsd', 'Minimum market cap USD', 'nullable', 0, null, 1],
    ['maxMarketCapUsd', 'Maximum market cap USD', 'nullable', 0, null, 1],
    ['minBondingCurvePct', 'Minimum bonding curve %', 'nullable', 0, 100, 0.1],
    ['maxBondingCurvePct', 'Maximum bonding curve %', 'nullable', 0, 100, 0.1],
    ['minTotalFeesSol', 'Minimum total fees SOL', 'nullable', 0, null, 0.001],
    ['maxTotalFeesSol', 'Maximum total fees SOL', 'nullable', 0, null, 0.001],
    ['minVolume24hUsd', 'Minimum 24h volume USD', 'nullable', 0, null, 1],
    ['maxVolume24hUsd', 'Maximum 24h volume USD', 'nullable', 0, null, 1],
    ['minBuyTransactions', 'Minimum buy transactions', 'nullable', 0, null, 1],
    ['maxBuyTransactions', 'Maximum buy transactions', 'nullable', 0, null, 1],
    ['minSellTransactions', 'Minimum sell transactions', 'nullable', 0, null, 1],
    ['maxSellTransactions', 'Maximum sell transactions', 'nullable', 0, null, 1],
    ['minTotalTransactions', 'Minimum total transactions', 'nullable', 0, null, 1],
    ['maxTotalTransactions', 'Maximum total transactions', 'nullable', 0, null, 1],
    ['minTop10Pct', 'Minimum Top 10 %', 'nullable', 0, 100, 0.1],
    ['maxTop10Pct', 'Maximum Top 10 %', 'nullable', 0, 100, 0.1],
    ['minDeveloperPct', 'Minimum developer %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperPct', 'Maximum developer %', 'nullable', 0, 100, 0.1],
    ['minBundlePct', 'Minimum bundle %', 'nullable', 0, 100, 0.1],
    ['maxBundlePct', 'Maximum bundle %', 'nullable', 0, 100, 0.1],
    ['minSniperPct', 'Minimum sniper %', 'nullable', 0, 100, 0.1],
    ['maxSniperPct', 'Maximum sniper %', 'nullable', 0, 100, 0.1],
    ['maxSuspectedRiskyWalletsPct', 'Maximum suspected risky wallets %', 'nullable', 0, 100, 0.1],
    ['maxInsidersPct', 'Maximum insiders %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperRugHistoryPct', 'Maximum developer rug history %', 'nullable', 0, 100, 0.1],
    ['maxDeveloperExitPct', 'Maximum developer exit %', 'nullable', 0, 100, 0.1],
    ['requireDevMigrated', 'Require dev migrated', 'boolean'],
    ['requireTokenLogo', 'Require token logo', 'boolean'],
    ['requireTwitter', 'Require X / Twitter', 'boolean'],
    ['requireWebsite', 'Require website', 'boolean'],
    ['requireTelegram', 'Require Telegram', 'boolean'],
    ['requireAnySocial', 'Require any social', 'boolean'],
    ['includeKeywords', 'Include keywords', 'text'],
    ['excludeKeywords', 'Exclude keywords', 'text'],
    ['developerBlacklistWallets', 'Developer blacklist wallets', 'array']
  ]],
  ['exits', 'Risk & exits', 'Stops, take profit allocation and exit pressure', true, [
    ['hardStopPct', 'Hard stop %', 'number', 0.000001, 100, 0.1],
    ['trailingStopPct', 'Trailing stop %', 'number', 0, 100, 0.1],
    ['tp1Pct', 'TP1 gain %', 'number', 0.000001, null, 1],
    ['tp1SellPct', 'TP1 sell %', 'number', 0, 100, 1],
    ['tp2Pct', 'TP2 gain %', 'number', 0.000001, null, 1],
    ['tp2SellPct', 'TP2 sell %', 'number', 0, 100, 1],
    ['runnerPct', 'Runner %', 'number', 0, 100, 1],
    ['maxHoldMinutes', 'Maximum hold min', 'integer', 1, null, 1],
    ['exitBuyPressure', 'Exit buy pressure', 'number', 0, null, 0.01],
    ['exitOnWeakBuyPressure', 'Exit on weak buy pressure', 'boolean']
  ]]
];

/*
 * Strategy profiles are deliberately scoped to the visible Logic group only.
 * Nothing outside this whitelist may be changed by Conservative / Balanced /
 * Aggressive, even if a future server response contains extra preset keys.
 */
const MF293_PROFILE_LOGIC_KEYS = Object.freeze([
  'minScore',
  'minConfidence',
  'minBuyPressure',
  'decisionFreshnessSec',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX'
]);

function mf293Clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mf293Fields() {
  return MF293_GROUPS.flatMap(group => group[4]);
}

function mf293Status(text, state = '') {
  const node = document.getElementById('mf293SettingsStatus');
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function mf293Error(message) {
  let node = document.getElementById('mf293SettingsError');
  if (!node) {
    node = document.createElement('div');
    node.id = 'mf293SettingsError';
    node.className = 'mf293-settings-error';
    document.getElementById('mf293SettingsBody')?.prepend(node);
  }
  node.hidden = false;
  node.textContent = String(message || 'Unknown error');
}

function mf293ClearError() {
  const node = document.getElementById('mf293SettingsError');
  if (node) {
    node.hidden = true;
    node.textContent = '';
  }
}

function mf293Disable(disabled) {
  for (const id of ['mf293SaveSettings', 'mf293RestoreDefaults']) {
    const node = document.getElementById(id);
    if (node) node.disabled = disabled;
  }
}

function mf293CreateField(field) {
  const [key, label, kind, min, max, step] = field;
  const wrap = document.createElement('label');
  wrap.className = kind === 'boolean'
    ? 'mf293-field mf293-field-switch'
    : 'mf293-field';

  const title = document.createElement('span');
  title.className = 'mf293-field-label';
  title.textContent = label;
  wrap.appendChild(title);

  let input;

  if (kind === 'boolean') {
    const switchWrap = document.createElement('span');
    switchWrap.className = 'mf293-switch';
    input = document.createElement('input');
    input.type = 'checkbox';
    const track = document.createElement('span');
    track.className = 'mf293-switch-track';
    switchWrap.append(input, track);
    wrap.appendChild(switchWrap);
  } else if (kind === 'select') {
    input = document.createElement('select');
    for (const [value, text] of field[3]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.appendChild(option);
    }
    wrap.appendChild(input);
  } else if (kind === 'array') {
    input = document.createElement('textarea');
    input.rows = 3;
    input.placeholder = 'One wallet per line or comma-separated';
    wrap.classList.add('mf293-field-wide');
    wrap.appendChild(input);
  } else {
    input = document.createElement('input');
    input.type = (kind === 'number' || kind === 'integer' || kind === 'nullable') ? 'number' : 'text';
    if (min !== undefined && min !== null) input.min = String(min);
    if (max !== undefined && max !== null) input.max = String(max);
    if (step !== undefined && step !== null) input.step = String(step);
    if (kind === 'nullable') input.placeholder = 'Off';
    wrap.appendChild(input);
  }

  input.dataset.settingKey = key;
  input.dataset.settingKind = kind;
  const markDirty = () => {
    MF293.dirty = true;
    mf293Status('Unsaved', 'dirty');
  };
  input.addEventListener('input', markDirty);
  input.addEventListener('change', markDirty);

  return wrap;
}


function mf293ApplyProfilePreset(profile) {
  const key = String(profile || '').trim().toLowerCase();
  const preset = MF293.profilePresets?.[key];

  if (!preset || typeof preset !== 'object') {
    mf293Error(`Profile preset is unavailable: ${key || 'unknown'}`);
    return false;
  }

  mf293ClearError();

  for (const settingKey of MF293_PROFILE_LOGIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(preset, settingKey)) continue;

    const input = document.querySelector(`[data-setting-key="${settingKey}"]`);
    if (!input) continue;

    const value = preset[settingKey];

    if (input.dataset.settingKind === 'boolean') {
      input.checked = Boolean(value);
    } else {
      input.value = value === null || value === undefined ? '' : String(value);
    }
  }

  MF293.dirty = true;
  mf293Status(`${key.charAt(0).toUpperCase()}${key.slice(1)} · Unsaved`, 'dirty');
  return true;
}

function mf293Build() {
  if (document.getElementById('mf293SettingsPanel')) return;

  /* MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1: Settings header trigger removed; settings engine preserved. */

  const backdrop = document.createElement('div');
  backdrop.id = 'mf293SettingsBackdrop';
  backdrop.className = 'mf293-settings-backdrop';
  backdrop.hidden = true;

  const panel = document.createElement('section');
  panel.id = 'mf293SettingsPanel';
  panel.className = 'mf293-settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'mf293SettingsTitle');
  panel.innerHTML = `
    <header class="mf293-settings-head">
      <div>
        <span class="eyebrow">LIVE CONFIGURATION</span>
        <h2 id="mf293SettingsTitle">System settings</h2>
      </div>
      <div class="mf293-settings-head-actions">
        <span id="mf293SettingsStatus" class="mf293-settings-status">Ready</span>
        <button id="mf293SettingsClose" type="button" aria-label="Close settings">×</button>
      </div>
    </header>
    <div class="mf293-settings-meta">
      <span>Platform<strong>Pump.fun</strong></span>
      <span>AI policy<strong>Propose only</strong></span>
      <span>Kill switch<strong id="mf293KillSwitch">Checking</strong></span>
    </div>
    <div id="mf293SettingsBody" class="mf293-settings-body"></div>
    <footer class="mf293-settings-footer">
      <button id="mf293RestoreDefaults" class="mf293-secondary" type="button">Restore defaults</button>
      <button id="mf293SaveSettings" class="mf293-primary" type="button">Save settings</button>
    </footer>
  `;

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  const body = document.getElementById('mf293SettingsBody');
  for (const [id, title, subtitle, open, fields] of MF293_GROUPS) {
    const section = document.createElement('details');
    section.className = 'mf293-settings-group';
    section.open = open;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span><strong>${title}</strong><small>${subtitle}</small></span><i></i>`;
    const grid = document.createElement('div');
    grid.className = 'mf293-settings-grid';
    for (const field of fields) grid.appendChild(mf293CreateField(field));
    section.append(summary, grid);
    body.appendChild(section);
  }

  document.getElementById('mf293SettingsClose')?.addEventListener('click', mf293Close);
  document.getElementById('mf293SaveSettings')?.addEventListener('click', mf293Save);
  document.getElementById('mf293RestoreDefaults')?.addEventListener('click', mf293Restore);
  document.querySelector('[data-setting-key="profile"]')?.addEventListener('change', event => {
    mf293ApplyProfilePreset(event.currentTarget?.value);
  });

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) mf293Close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !backdrop.hidden) mf293Close();
  });

}

function mf293Populate() {
  if (!MF293.settings) return;

  for (const field of mf293Fields()) {
    const [key, , kind] = field;
    const input = document.querySelector(`[data-setting-key="${key}"]`);
    if (!input) continue;
    const value = MF293.settings[key];

    if (kind === 'boolean') input.checked = Boolean(value);
    else if (kind === 'array') input.value = Array.isArray(value) ? value.join('\n') : '';
    else if (kind === 'nullable') input.value = value === null || value === undefined ? '' : String(value);
    else input.value = value === null || value === undefined ? '' : String(value);
  }

  const environment = document.querySelector('[data-setting-key="tradingEnvironment"]');
  if (environment) {
    const liveOption = [...environment.options].find(option => option.value === 'live');
    if (liveOption) {
      const currentLive = MF293.settings.tradingEnvironment === 'live';
      liveOption.disabled = !currentLive && MF293.capabilities?.liveAutomation !== true;
    }
  }

  const kill = document.getElementById('mf293KillSwitch');
  if (kill) {
    kill.textContent = MF293.killSwitchActive ? 'ACTIVE' : 'Off';
    kill.dataset.active = MF293.killSwitchActive ? 'true' : 'false';
  }

  MF293.dirty = false;
  mf293Status(`v${MF293.version ?? '—'}`, 'saved');
}

async function mf293Load() {
  mf293Status('Loading', 'busy');
  mf293Disable(true);
  mf293ClearError();

  try {
    const response = await fetch('/api/settings', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Unable to load settings');
    }

    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? 1;
    MF293.capabilities = payload.capabilities || {};
    MF293.profilePresets = payload.profilePresets || {};
    MF293.killSwitchActive = payload.killSwitchActive === true;
    mf293Populate();
  } catch (error) {
    mf293Status('Load failed', 'error');
    mf293Error(error.message || 'Unable to load settings');
  } finally {
    mf293Disable(false);
  }
}

function mf293Read(field, input) {
  const kind = field[2];
  if (kind === 'boolean') return input.checked;
  if (kind === 'array') {
    return [...new Set(String(input.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(Boolean))];
  }
  if (kind === 'nullable') {
    const text = String(input.value || '').trim();
    return text === '' ? null : Number(text);
  }
  if (kind === 'number') return Number(input.value);
  if (kind === 'integer') return Math.trunc(Number(input.value));
  return String(input.value || '').trim();
}

function mf293Collect() {
  if (!MF293.settings) throw new Error('Settings are not loaded');
  const next = mf293Clone(MF293.settings);

  for (const field of mf293Fields()) {
    const input = document.querySelector(`[data-setting-key="${field[0]}"]`);
    if (input) next[field[0]] = mf293Read(field, input);
  }

  // Discovery remains Pump.fun only.
  next.launchPlatforms = ['pump'];
  next.aiChangePolicy = 'propose';
  next.adaptiveProfile = false;
  return next;
}

async function mf293Save() {
  if (MF293.saving) return;
  mf293ClearError();

  let next;
  try {
    next = mf293Collect();
  } catch (error) {
    mf293Error(error.message);
    return;
  }

  MF293.saving = true;
  mf293Disable(true);
  mf293Status('Saving', 'busy');

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({settings: next, version: MF293.version})
    });
    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 409) {
        await mf293Load();
        throw new Error('Settings changed on the server. Latest values were reloaded.');
      }
      const message = Array.isArray(payload?.errors)
        ? payload.errors.join(' ')
        : (payload?.message || payload?.error || 'Unable to save settings');
      throw new Error(message);
    }

    MF293.settings = mf293Clone(payload.settings || next);
    MF293.version = payload.version ?? MF293.version;
    MF293.dirty = false;
    mf293Populate();

    const count = Number(payload.decisionsReevaluated);
    mf293Status(
      Number.isFinite(count) ? `Saved · ${count} re-evaluated` : 'Saved',
      'saved'
    );
  } catch (error) {
    mf293Status('Save failed', 'error');
    mf293Error(error.message || 'Unable to save settings');
  } finally {
    MF293.saving = false;
    mf293Disable(false);
  }
}

async function mf293Restore() {
  if (!window.confirm('Restore all MEMEFLOW settings to server defaults?')) return;
  mf293ClearError();
  mf293Disable(true);
  mf293Status('Restoring', 'busy');

  try {
    const response = await fetch('/api/settings/defaults', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Unable to restore defaults');
    }

    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? MF293.version;
    mf293Populate();
    mf293Status('Defaults restored', 'saved');
  } catch (error) {
    mf293Status('Restore failed', 'error');
    mf293Error(error.message || 'Unable to restore defaults');
  } finally {
    mf293Disable(false);
  }
}

async function mf293Open() {
  const backdrop = document.getElementById('mf293SettingsBackdrop');
  if (!backdrop) return;
  backdrop.hidden = false;
  document.body.classList.add('mf293-settings-open');
  await mf293Load();
}

function mf293Close() {
  const backdrop = document.getElementById('mf293SettingsBackdrop');
  if (!backdrop) return;
  if (MF293.dirty && !window.confirm('Close settings without saving changes?')) return;
  backdrop.hidden = true;
  document.body.classList.remove('mf293-settings-open');
}

function mf293Install() {
  if (MF293.installed) return;
  MF293.installed = true;
  mf293Build();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (typeof mf29Camera === 'function' && app?.camera && app?.controls) {
        mf29Camera(true);
        resize();
      }
    });
  });
}

mf293Install();

/* MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1: legacy Trading header-link installer removed. */


// MEMEFLOW_V31_REAL_EVENT_WEB

/* ========================================================================
   MEMEFLOW V31 — REAL EVENT WEB / FITTED DIGITAL TWIN
   ======================================================================== */

const REAL_WEB_V31 = {
  installed: false,
  group: null,
  edges: new Map(),
  source: null,
  frame: 0,
  lastFrameAt: 0,
  lastTelemetry: null,
  resizeTimer: null,
  installTimer: null,
  reconnects: 0,
  mobileQuery: window.matchMedia('(max-width: 900px)')
};

const WEB_EDGES_V31 = [
  { key:'discovery:bootstrap', from:'discovery', to:'bootstrap', color:COLORS.cyan },
  { key:'bootstrap:core',      from:'bootstrap', to:'core',      color:COLORS.blue },
  { key:'core:holders',        from:'core',      to:'holders',   color:COLORS.cyan },
  { key:'core:market',         from:'core',      to:'market',    color:COLORS.blue },
  { key:'holders:risk',        from:'holders',   to:'risk',      color:COLORS.cyan },
  { key:'market:risk',         from:'market',    to:'risk',      color:COLORS.blue },
  { key:'openai:risk',         from:'openai',    to:'risk',      color:COLORS.purple },
  { key:'risk:decision',       from:'risk',      to:'decision',  color:COLORS.green },
  { key:'decision:paper',      from:'decision',  to:'paper',     color:COLORS.purple },
  { key:'paper:execution',     from:'paper',     to:'execution', color:COLORS.yellow }
];

const WEB_LAYOUT_MOBILE_V31 = {
  discovery: { pos:[-3.42, 0.08, -3.45], scale:0.82 },
  bootstrap: { pos:[ 0.00, 0.08, -3.45], scale:0.82 },
  core:      { pos:[ 3.42, 0.12, -3.45], scale:0.92 },

  risk:      { pos:[-3.42, 0.05, -0.55], scale:0.80 },
  market:    { pos:[ 0.00, 0.05, -0.55], scale:0.80 },
  holders:   { pos:[ 3.42, 0.05, -0.55], scale:0.80 },

  openai:    { pos:[-3.42, 0.03,  2.35], scale:0.78 },
  decision:  { pos:[ 0.00, 0.03,  2.35], scale:0.86 },
  paper:     { pos:[ 3.42, 0.03,  2.35], scale:0.78 },

  execution: { pos:[ 0.00, 0.03,  5.05], scale:0.82 }
};

const WEB_LAYOUT_DESKTOP_V31 = {
  discovery: { pos:[-4.65, 0.08, -3.85], scale:0.78 },
  bootstrap: { pos:[ 0.00, 0.08, -3.85], scale:0.78 },
  core:      { pos:[ 4.65, 0.13, -3.85], scale:0.94 },

  risk:      { pos:[-4.65, 0.05, -0.55], scale:0.76 },
  market:    { pos:[ 0.00, 0.05, -0.55], scale:0.76 },
  holders:   { pos:[ 4.65, 0.05, -0.55], scale:0.76 },

  openai:    { pos:[-4.65, 0.03,  2.75], scale:0.74 },
  decision:  { pos:[ 0.00, 0.03,  2.75], scale:0.82 },
  paper:     { pos:[ 4.65, 0.03,  2.75], scale:0.75 },

  execution: { pos:[ 0.00, 0.03,  5.95], scale:0.80 }
};

function webClampV31(v, a, b) {
  return Math.max(a, Math.min(b, Number(v) || 0));
}

function webMobileV31() {
  return REAL_WEB_V31.mobileQuery.matches;
}

function webNodeV31(id) {
  return app.nodes?.get?.(id) || null;
}

function webPointV31(id) {
  const node = webNodeV31(id);
  if (!node?.group) return new THREE.Vector3();

  const p = node.group.position.clone();
  p.y += 0.18;
  return p;
}

function webCurveV31(edge, index = 0) {
  const a = webPointV31(edge.from);
  const b = webPointV31(edge.to);
  const points = [a];

  const dx = Math.abs(b.x - a.x);
  const dz = Math.abs(b.z - a.z);

  if (dx < 0.22 || dz < 0.22) {
    points.push(a.clone().lerp(b, 0.5));
  } else if (dx >= dz) {
    const mx = a.x + (b.x - a.x) * 0.52;

    points.push(
      new THREE.Vector3(mx, a.y + 0.03, a.z),
      new THREE.Vector3(mx, b.y + 0.03, b.z)
    );
  } else {
    const mz = a.z + (b.z - a.z) * 0.50;

    points.push(
      new THREE.Vector3(a.x, a.y + 0.03, mz),
      new THREE.Vector3(b.x, b.y + 0.03, mz)
    );
  }

  points.push(b);

  return new THREE.CatmullRomCurve3(
    points,
    false,
    'catmullrom',
    0.035
  );
}

function webDisposeObjectV31(object) {
  if (!object) return;

  object.traverse?.((child) => {
    child.geometry?.dispose?.();

    if (Array.isArray(child.material)) {
      for (const m of child.material) m?.dispose?.();
    } else {
      child.material?.dispose?.();
    }
  });

  object.parent?.remove?.(object);
}

function disableLegacyFlowV31() {
  try {
    if (typeof syncRealitySpeedsV8 === 'function') {
      syncRealitySpeedsV8 = () => {};
    }
  } catch {}

  try {
    if (typeof clearFlowLinesV7 === 'function') {
      clearFlowLinesV7();
    }
  } catch {}

  try {
    for (const entry of FLOW_REALITY_V8?.lines || []) {
      webDisposeObjectV31(entry?.line);
    }
    if (FLOW_REALITY_V8?.lines) FLOW_REALITY_V8.lines.length = 0;
  } catch {}

  try {
    for (const pulse of app.edgePulses || []) {
      webDisposeObjectV31(pulse);
    }
    if (app.edgePulses) app.edgePulses.length = 0;
  } catch {}
}

function applyWebLayoutV31(forceHome = false) {
  if (!app.scene || !app.camera || !app.controls || !app.nodes?.size) return false;

  const mobile = webMobileV31();
  const layout = mobile ? WEB_LAYOUT_MOBILE_V31 : WEB_LAYOUT_DESKTOP_V31;

  for (const [id, cfg] of Object.entries(layout)) {
    const node = webNodeV31(id);
    if (!node?.group) continue;

    node.group.position.set(...cfg.pos);
    node.group.scale.setScalar(cfg.scale);
  }

  /*
    V4: the 3D frame is a pure black viewport.
    Remove the legacy floor/glow planes that created the lighter band.
  */
  app.scene.background = new THREE.Color(0x000000);

  if (app.scene.fog?.color) {
    app.scene.fog.color.set(0x000000);
  }

  if (typeof MF20 !== 'undefined' && MF20.floor) {
    MF20.floor.visible = false;
  }

  app.scene.traverse((object) => {
    if (!object?.isMesh || object.geometry?.type !== 'PlaneGeometry') return;

    const width = Number(object.geometry.parameters?.width) || 0;
    const height = Number(object.geometry.parameters?.height) || 0;

    /*
      Only the old giant environment plane is removed.
      Small module display planes remain untouched.
    */
    if (width >= 40 && height >= 30) {
      object.visible = false;
    }
  });

  const box = new THREE.Box3().makeEmpty();

  if (typeof MF20 !== 'undefined' && MF20.hardware?.values) {
    for (const hardware of MF20.hardware.values()) {
      if (hardware?.group) box.expandByObject(hardware.group);
    }
  }

  const center = new THREE.Vector3(0, 0, 0.65);
  const size = new THREE.Vector3(9.0, 1.2, 10.0);

  if (!box.isEmpty()) {
    box.getCenter(center);
    box.getSize(size);
  }

  const canvas =
    app.renderer?.domElement ||
    document.getElementById('systemCanvas');

  const aspect =
    canvas?.clientHeight > 0
      ? Math.max(0.55, canvas.clientWidth / canvas.clientHeight)
      : (mobile ? 1.10 : 1.60);

  /*
    V4 initial fit:
    - full architecture visible at reset/first load
    - substantially larger than V31
    - no title/telemetry/legend overlay is consuming canvas space
  */
  app.camera.fov = mobile ? 38 : 36;
  app.camera.near = 0.05;
  app.camera.far = 180;
  app.camera.updateProjectionMatrix();

  const fov = THREE.MathUtils.degToRad(app.camera.fov);
  const tanHalf = Math.tan(fov / 2);

  const halfX = Math.max(4.0, size.x * 0.5);
  const halfZ = Math.max(4.4, size.z * 0.5);

  const forWidth =
    halfX /
    Math.max(0.01, tanHalf * aspect);

  const forDepth =
    halfZ /
    Math.max(0.01, tanHalf);

  /*
    Old V31 used 1.28 on mobile, which made the topology too small.
    1.10 keeps a safe frame while filling the viewport much better.
  */
  const fitMargin = mobile ? 0.93 : 1.02;
  const distance = Math.max(forWidth, forDepth) * fitMargin;

  const topTilt = mobile ? 0.72 : 0.70;

  app.cameraHome.set(
    center.x,
    center.y + distance,
    center.z + distance * topTilt
  );

  app.targetHome.set(
    center.x,
    center.y - 0.04,
    center.z
  );

  /*
    Full free orbit inside the 3D frame.
    Pan remains disabled so the architecture cannot be accidentally lost.
  */
  app.controls.enableZoom = true;
  app.controls.enableRotate = true;
  app.controls.enablePan = false;

  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.055;

  app.controls.zoomSpeed = 1.08;
  app.controls.rotateSpeed = mobile ? 0.62 : 0.56;

  /*
    Unlimited horizontal orbit and almost the full vertical sphere.
    Tiny pole guards avoid OrbitControls singularities.
  */
  app.controls.minAzimuthAngle = -Infinity;
  app.controls.maxAzimuthAngle = Infinity;
  app.controls.minPolarAngle = 0.025;
  app.controls.maxPolarAngle = Math.PI - 0.025;

  /*
    Much wider zoom range than V31:
    close inspection is possible, but Reset View always restores the fit.
  */
  app.controls.minDistance = Math.max(3.2, distance * 0.27);
  app.controls.maxDistance = Math.max(42, distance * 3.2);

  app.controls.autoRotate = false;
  app.autoRotate = false;

  if ('zoomToCursor' in app.controls) {
    app.controls.zoomToCursor = false;
  }

  if (app.controls.touches) {
    app.controls.touches.ONE = THREE.TOUCH.ROTATE;
    app.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  if (app.controls.mouseButtons) {
    app.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    app.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    app.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  }

  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
  }

  if (forceHome) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.update();
  resize();
  updateLabels();
  return true;
}

function clearWebV31() {
  if (REAL_WEB_V31.group) {
    webDisposeObjectV31(REAL_WEB_V31.group);
  }

  REAL_WEB_V31.group = null;
  REAL_WEB_V31.edges.clear();
}

function buildWebV31() {
  if (!app.scene || !app.nodes?.size) return;

  clearWebV31();
  mf5HideLegacyPipes();

  const group = new THREE.Group();
  group.name = 'MEMEFLOW_REAL_EVENT_WEB_V31';
  app.scene.add(group);
  REAL_WEB_V31.group = group;

  WEB_EDGES_V31.forEach((edge, index) => {
    const curve = webCurveV31(edge, index);
    const points = curve.getPoints(110);

    const color =
      edge.key === 'decision:paper'
        ? COLORS.purple
        : edge.key === 'paper:execution'
          ? COLORS.green
          : edge.key === 'core:holders' ||
            edge.key === 'core:market' ||
            edge.key === 'risk:decision'
            ? COLORS.green
            : edge.color;

    const outer = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        96,
        webMobileV31() ? 0.080 : 0.090,
        10,
        false
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.085,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    outer.renderOrder = 2;
    group.add(outer);

    const pipe = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        96,
        webMobileV31() ? 0.030 : 0.036,
        9,
        false
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: edge.key === 'paper:execution' ? 0.92 : 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    pipe.renderOrder = 5;
    group.add(pipe);

    const baseGeometry =
      new THREE.BufferGeometry().setFromPoints(points);

    const base = new THREE.Line(
      baseGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    base.renderOrder = 7;
    group.add(base);

    const hotGeometry =
      new THREE.BufferGeometry().setFromPoints(points);

    hotGeometry.setDrawRange(0, 0);

    const hot = new THREE.Line(
      hotGeometry,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    hot.renderOrder = 12;
    group.add(hot);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(
        webMobileV31() ? 0.085 : 0.098,
        12,
        10
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    head.visible = false;
    head.renderOrder = 13;
    group.add(head);

    const idleDots = [];

    for (let dotIndex = 0; dotIndex < 5; dotIndex++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(
          webMobileV31() ? 0.046 : 0.054,
          10,
          8
        ),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.68,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );

      dot.userData.mf6 = {
        seed:
          (
            dotIndex / 5 +
            index * 0.061
          ) % 1,
        speed:
          edge.key === 'paper:execution'
            ? 0.070
            : 0.088 + (index % 3) * 0.010
      };

      dot.renderOrder = 10;
      group.add(dot);
      idleDots.push(dot);
    }

    REAL_WEB_V31.edges.set(edge.key, {
      ...edge,
      color,
      curve,
      points,
      outer,
      pipe,
      base,
      hot,
      head,
      idleDots,
      active: false,
      startedAt: 0,
      durationMs: 95,
      fadeStartedAt: 0,
      fadeMs: 150,
      boost: 1,
      lastShotAt: 0
    });
  });
}

function visualLatencyV31(serverTs) {
  const lag = Math.max(0, Date.now() - Number(serverTs || Date.now()));
  return webClampV31(lag, 70, 220);
}

function flashNodeV31(id, until) {
  const node = webNodeV31(id);
  if (!node?.group) return;

  node.group.userData.webFlashUntilV31 = Math.max(
    Number(node.group.userData.webFlashUntilV31) || 0,
    until
  );
}

function shootWebEdgeV31(key, serverTs, strength = 1) {
  const entry = REAL_WEB_V31.edges.get(key);
  if (!entry || key === 'paper:execution') return;

  const now = performance.now();
  const duration = visualLatencyV31(serverTs);

  if (entry.active && (now - entry.lastShotAt) < 34) {
    entry.boost = Math.min(1.8, entry.boost + 0.20 * strength);
    entry.lastShotAt = now;
    return;
  }

  entry.active = true;
  entry.startedAt = now;
  entry.durationMs = duration;
  entry.fadeStartedAt = 0;
  entry.boost = webClampV31(strength, 0.65, 1.8);
  entry.lastShotAt = now;

  entry.hot.visible = true;
  entry.hot.material.opacity = Math.min(1, 0.76 * entry.boost);
  entry.hot.geometry.setDrawRange(0, 1);

  entry.head.visible = true;
  entry.head.material.opacity = Math.min(1, 0.92 * entry.boost);
  entry.head.scale.setScalar(0.78 + 0.30 * entry.boost);

  const until = now + duration + 120;
  flashNodeV31(entry.from, until);
  flashNodeV31(entry.to, until);
}

function currentDecisionForMintV31(mint) {
  const sample = Array.isArray(app.telemetry?.diag?.sample)
    ? app.telemetry.diag.sample
    : [];

  const row = sample.find((item) => String(item?.mint || '') === String(mint || ''));
  return stateKey(row?.decision?.state || '');
}

function runCreateRouteV31(payload = {}) {
  const d = visualLatencyV31(payload.ts);

  shootWebEdgeV31('discovery:bootstrap', payload.ts, 1.12);

  setTimeout(
    () => shootWebEdgeV31('bootstrap:core', payload.ts, 1.18),
    Math.max(24, d * 0.42)
  );
}

function runTokenRouteV31(payload = {}) {
  const d = visualLatencyV31(payload.ts);

  shootWebEdgeV31('core:holders', payload.ts, 1.06);
  shootWebEdgeV31('core:market', payload.ts, 1.12);

  setTimeout(() => {
    shootWebEdgeV31('holders:risk', payload.ts, 1.02);
    shootWebEdgeV31('market:risk', payload.ts, 1.08);
  }, Math.max(18, d * 0.30));

  setTimeout(() => {
    shootWebEdgeV31('risk:decision', payload.ts, 1.15);
  }, Math.max(34, d * 0.60));

  if (currentDecisionForMintV31(payload.mint) === 'ready') {
    setTimeout(() => {
      shootWebEdgeV31('decision:paper', payload.ts, 1.22);
    }, Math.max(48, d * 0.88));
  }
}

function applyNodeFlashV31(now) {
  for (const [, node] of app.nodes || []) {
    if (!node?.group) continue;

    const until = Number(node.group.userData.webFlashUntilV31) || 0;
    const active = until > now;

    if (!node.group.userData.webHaloV31) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.72, 0.79, 40),
        new THREE.MeshBasicMaterial({
          color: node.cfg?.color || COLORS.cyan,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = (Number(node.cfg?.size?.[1]) || 1) * 0.56 + 0.08;
      node.group.add(ring);
      node.group.userData.webHaloV31 = ring;
    }

    const halo = node.group.userData.webHaloV31;
    const target = active ? 0.55 : 0.0;
    const current = Number(halo.material.opacity) || 0;

    halo.material.opacity += (target - current) * 0.22;

    if (active) {
      const pulse = 1 + Math.sin(now * 0.020) * 0.08;
      halo.scale.setScalar(pulse);
    }
  }
}

function animateWebV31(now) {
  REAL_WEB_V31.frame = requestAnimationFrame(animateWebV31);
  if (window.__MEMEFLOW_TRUE_3D_ACTIVE__) return;

  if (document.hidden || !REAL_WEB_V31.installed) return;
  if ((now - REAL_WEB_V31.lastFrameAt) < 32) return;

  REAL_WEB_V31.lastFrameAt = now;
  const seconds = now * 0.001;

  for (const entry of REAL_WEB_V31.edges.values()) {
    for (let index = 0; index < (entry.idleDots || []).length; index++) {
      const dot = entry.idleDots[index];
      const data = dot.userData.mf6 || {};

      const t =
        (
          Number(data.seed || 0) +
          seconds * Number(data.speed || 0.09)
        ) % 1;

      dot.position.copy(entry.curve.getPointAt(t));

      const pulse =
        0.84 +
        Math.sin(
          seconds * 8.5 +
          index * 1.7 +
          t * 12
        ) * 0.16;

      dot.scale.setScalar(
        entry.active
          ? 1.42 + pulse * 0.18
          : 0.92 + pulse * 0.12
      );

      dot.material.opacity =
        entry.active
          ? 0.96
          : 0.48 + pulse * 0.20;
    }

    if (!entry.active) continue;

    const elapsed = now - entry.startedAt;
    const p = webClampV31(
      elapsed / entry.durationMs,
      0,
      1
    );

    if (p < 1) {
      const count = Math.max(
        2,
        Math.floor(entry.points.length * p)
      );

      entry.hot.geometry.setDrawRange(0, count);
      entry.hot.material.opacity =
        Math.min(1, 0.98 * entry.boost);

      const headP =
        entry.curve.getPointAt(
          Math.min(0.999, p)
        );

      entry.head.position.copy(headP);
      entry.head.material.opacity =
        Math.min(1, 1.0 * entry.boost);

      entry.head.scale.setScalar(
        1.0 + 0.36 * entry.boost
      );

      continue;
    }

    if (!entry.fadeStartedAt) {
      entry.fadeStartedAt = now;
      entry.hot.geometry.setDrawRange(
        0,
        entry.points.length
      );
    }

    const fade = webClampV31(
      1 - (
        (now - entry.fadeStartedAt) /
        entry.fadeMs
      ),
      0,
      1
    );

    entry.hot.material.opacity =
      fade * 0.82 * entry.boost;

    entry.head.material.opacity =
      fade * 0.96 * entry.boost;

    if (fade <= 0) {
      entry.active = false;
      entry.boost = 1;
      entry.head.visible = false;
      entry.hot.geometry.setDrawRange(0, 0);
    }
  }

  for (const id of ['core', 'decision', 'execution']) {
    const hardware = MF20?.hardware?.get?.(id);
    if (!hardware?.innerGlow?.material) continue;

    const base =
      id === 'core'
        ? 0.19
        : id === 'decision'
          ? 0.12
          : 0.14;

    hardware.innerGlow.material.opacity =
      base +
      Math.sin(
        seconds * 2.1 +
        (id === 'core' ? 0 : id === 'decision' ? 1.8 : 3.2)
      ) * 0.035;

    if (hardware.coreRings) {
      hardware.coreRings.rotation.y += 0.0025;
    }
  }

  applyNodeFlashV31(now);
}

function parseWebEventV31(event) {
  try {
    return JSON.parse(event.data || '{}');
  } catch {
    return {};
  }
}

function connectSystemStreamV31() {
  try {
    REAL_WEB_V31.source?.close?.();
  } catch {}

  if (typeof EventSource === 'undefined') return;

  const source = new EventSource('/api/system/stream');
  REAL_WEB_V31.source = source;

  source.addEventListener('create', (event) => {
    runCreateRouteV31(parseWebEventV31(event));
  });

  source.addEventListener('token', (event) => {
    runTokenRouteV31(parseWebEventV31(event));
  });

  source.addEventListener('hello', () => {
    REAL_WEB_V31.reconnects = 0;
  });

  source.onerror = () => {
    REAL_WEB_V31.reconnects += 1;
  };
}

function telemetryFallbackV31() {
  // Do not synthesize fallback shots while the real SSE transport is open.
  if (
    REAL_WEB_V31.source &&
    typeof EventSource !== 'undefined' &&
    REAL_WEB_V31.source.readyState === EventSource.OPEN
  ) {
    return;
  }

  const current = {
    ts: Date.now(),
    events: Number(app.telemetry?.discovery?.eventsReceived) || 0,
    trades: Number(app.telemetry?.diag?.liveTradeFeed?.tradeEventsDecoded) || 0
  };

  const previous = REAL_WEB_V31.lastTelemetry;
  REAL_WEB_V31.lastTelemetry = current;

  if (!previous) return;

  if (current.events > previous.events) {
    runCreateRouteV31({ ts: current.ts });
  }

  if (current.trades > previous.trades) {
    runTokenRouteV31({ ts: current.ts });
  }
}

function rebuildRealWebV31(forceHome = false) {
  if (!applyWebLayoutV31(forceHome)) return;

  disableLegacyFlowV31();
  buildWebV31();
}

function installRealWebV31() {
  mf6HideLegacyDomLabels();
  if (REAL_WEB_V31.installed) return;

  if (!app.scene || !app.camera || !app.controls || !app.nodes?.size) {
    REAL_WEB_V31.installTimer = setTimeout(installRealWebV31, 180);
    return;
  }

  REAL_WEB_V31.installed = true;

  rebuildRealWebV31(true);
  connectSystemStreamV31();

  REAL_WEB_V31.frame = requestAnimationFrame(animateWebV31);

  setInterval(() => {
    if (!document.hidden) telemetryFallbackV31();
  }, 1500);

  setTimeout(() => {
    if (!REAL_WEB_V31.installed) return;
    rebuildRealWebV31(true);
  }, 900);
}

window.addEventListener('resize', () => {
  if (!REAL_WEB_V31.installed) return;

  clearTimeout(REAL_WEB_V31.resizeTimer);
  REAL_WEB_V31.resizeTimer = setTimeout(() => {
    rebuildRealWebV31(false);
  }, 320);
});

setTimeout(installRealWebV31, 1250);

// MEMEFLOW_PLATFORM_SOURCE_CLEAN_V5

// MEMEFLOW_TOP_VIEW_V32

/* MEMEFLOW_ANTI_RUG_V1_5_EXACT */

/* ===== MEMEFLOW_LIVE_INSPECTOR_STANDALONE_V1 =====
   Disabled because LIVE INSPECTOR was removed from the System Overview page.
   Keep the DOM node hidden/inert so other system JS can safely keep references.
*/
(() => {
  'use strict';

  function removeLiveInspectorV3() {
    document.documentElement.classList.remove(
      'mf-live-inspector-standalone-layout-v1'
    );

    const inspector = document.getElementById('inspector');
    if (!inspector) return;

    inspector.classList.remove('mf-live-inspector-standalone-v1');
    inspector.classList.add('mf-live-inspector-removed-v3');
    inspector.hidden = true;
    inspector.setAttribute('aria-hidden', 'true');
    inspector.style.display = 'none';
    inspector.style.pointerEvents = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      removeLiveInspectorV3,
      { once: true }
    );
  } else {
    removeLiveInspectorV3();
  }
})();

/* ===== MEMEFLOW_3D_VIEWPORT_FREE_ORBIT_FIT_V4 ===== */

/* ===== MEMEFLOW_PREMIUM_GLASS_3D_V5 ===== */

/* ===== MEMEFLOW_RENDER_MATCH_V6 ===== */

/* ===== MEMEFLOW_TRUE_3D_EMBED_V1 ===== */

/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_V1 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REALTIME_PAGE_GALLERY_V1';
  const DESTINATIONS = [
    { title: 'Trading Terminal', image: '/memeflow-gallery/trading-terminal.webp?v=page-gallery-v1', href: '/trading.html', slot: 'left' },
    { title: 'System Settings', image: '/memeflow-gallery/system-settings.webp?v=page-gallery-v1', href: '/settings.html', slot: 'center' },
    { title: 'Real-Time Pipeline', image: '/memeflow-gallery/live-token-states.webp?v=page-gallery-v1', href: '/system-tokens.html', slot: 'right' },
    { title: 'How It Works', image: '/memeflow-gallery/how-it-works.svg?v=how-it-works-carousel-v1', href: '/how-it-works.html', slot: 'hidden' }
  ];

  function stopOldTrue3D() {
    try {
      const app = window.__memeflowTrue3D;
      if (app && typeof app.dispose === 'function') {
        app.dispose();
        window.__memeflowTrue3D = null;
      }
    } catch (error) {
      console.warn('[PAGE-GALLERY] old 3D dispose skipped:', error);
    }
  }

  function openSettingsFromQuery() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mfOpenSettings') !== '1') return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const direct = document.getElementById('mf293SettingsBtn');
      const fallback = Array.from(document.querySelectorAll('button, [role="button"]'))
        .find(el => String(el.textContent || '').trim().toLowerCase() === 'settings');
      const button = direct || fallback;

      if (button) {
        window.clearInterval(timer);
        button.click();
        url.searchParams.delete('mfOpenSettings');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        return;
      }

      if (tries >= 45) {
        window.clearInterval(timer);
        console.warn('[PAGE-GALLERY] Settings button was not found.');
      }
    }, 100);
  }

  function makeCard(item) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mfpg-card';
    card.dataset.slot = item.slot;
    card.dataset.href = item.href;
    card.setAttribute('aria-label', `Open ${item.title}`);
    card.innerHTML = `
      <img class="mfpg-shot" src="${item.image}" alt="" draggable="false">
      <span class="mfpg-label" aria-hidden="true">
        <span class="mfpg-title">${item.title}</span>
        <span class="mfpg-open">OPEN</span>
      </span>
      <span class="mfpg-pulse" aria-hidden="true"></span>
    `;

    card.addEventListener('pointerenter', () => card.classList.add('is-hovered'));
    card.addEventListener('pointerleave', () => card.classList.remove('is-hovered'));

    card.addEventListener('click', () => {
      if (card.dataset.busy === '1') return;
      card.dataset.busy = '1';
      const gallery = document.getElementById('mfPageGallery');
      gallery?.classList.add('is-leaving');
      card.classList.add('is-launching');

      if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch (_) {}
      }

      window.setTimeout(() => window.location.assign(item.href), 285);
    });

    return card;
  }

  function mountGallery() {
    const viewport = document.querySelector('.viewport-wrap');
    if (!viewport || document.getElementById('mfPageGallery')) return false;

    viewport.classList.add('mf-page-gallery-host');

    const gallery = document.createElement('section');
    gallery.id = 'mfPageGallery';
    gallery.setAttribute('aria-label', 'MEMEFLOW page navigator');

    const head = document.createElement('div');
    head.className = 'mfpg-head';
    head.innerHTML = `
      <span class="mfpg-kicker">SYSTEM OVERVIEW</span>
      <span class="mfpg-sub">Interactive architecture</span>
    `;

    const deck = document.createElement('div');
    deck.className = 'mfpg-deck';
    DESTINATIONS.forEach(item => deck.appendChild(makeCard(item)));

    gallery.appendChild(head);
    gallery.appendChild(deck);
    viewport.appendChild(gallery);

    gallery.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const rect = gallery.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((event.clientX - rect.left) / rect.width) - .5;
      const ny = ((event.clientY - rect.top) / rect.height) - .5;
      gallery.style.setProperty('--mfpg-ry', `${(nx * 2.2).toFixed(2)}deg`);
      gallery.style.setProperty('--mfpg-rx', `${(-ny * 1.2).toFixed(2)}deg`);
    });

    gallery.addEventListener('pointerleave', () => {
      gallery.style.setProperty('--mfpg-ry', '0deg');
      gallery.style.setProperty('--mfpg-rx', '0deg');
    });

    let cleanupTicks = 0;
    const cleanup = window.setInterval(() => {
      cleanupTicks += 1;
      stopOldTrue3D();
      if (cleanupTicks >= 15) window.clearInterval(cleanup);
    }, 200);

    console.log(`[PAGE-GALLERY] ${PATCH_ID} mounted`);
    return true;
  }

  function boot() {
    openSettingsFromQuery();

    if (mountGallery()) return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (mountGallery() || tries >= 50) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_V1 ===== */

/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2 ===== */
(() => {
  'use strict';

  function removeLegacyFlowLayer() {
    const viewport = document.querySelector(
      '.viewport-wrap.mf-page-gallery-clean-v2, .viewport-wrap.mf-page-gallery-host'
    );
    if (!viewport) return;

    viewport.classList.add('mf-page-gallery-host', 'mf-page-gallery-clean-v2');

    viewport.querySelectorAll('.mf-flow-v4').forEach(node => node.remove());

    const oldCanvas = viewport.querySelector('#systemCanvas');
    const oldTrue3D = viewport.querySelector('#memeflowTrue3DHost');
    const oldLabels = viewport.querySelector('.scene-labels');
    const oldHint = viewport.querySelector('.scene-hint');

    for (const node of [oldCanvas, oldTrue3D, oldLabels, oldHint]) {
      if (!node) continue;
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
      node.style.pointerEvents = 'none';
    }

    try {
      const old3D = window.__memeflowTrue3D;
      if (old3D && typeof old3D.dispose === 'function') old3D.dispose();
      window.__memeflowTrue3D = null;
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyFlowLayer, { once: true });
  } else {
    removeLegacyFlowLayer();
  }

  const startGuard = () => {
    const viewport = document.querySelector('.viewport-wrap');
    if (!viewport || typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver(() => {
      const legacy = viewport.querySelector('.mf-flow-v4');
      if (legacy) removeLegacyFlowLayer();
    });

    observer.observe(viewport, { childList: true, subtree: false });

    window.setTimeout(() => {
      observer.disconnect();
    }, 4000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGuard, { once: true });
  } else {
    startGuard();
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CLEAN_V2 ===== */

/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3';
  const MIN_SWIPE_X = 46;
  const AXIS_LOCK_GAP = 8;
  const CLICK_SUPPRESS_MS = 320;

  function wrapIndex(index, length) {
    return ((index % length) + length) % length;
  }

  function getGalleryState() {
    const gallery = document.getElementById('mfPageGallery');
    if (!gallery) return null;
    const deck = gallery.querySelector('.mfpg-deck');
    if (!deck) return null;

    const cards = Array.from(deck.querySelectorAll('.mfpg-card'));
    if (cards.length < 3) return null;

    cards.sort((a, b) => {
      const order = { left: 0, center: 1, right: 2 };
      return (order[a.dataset.slot] ?? 99) - (order[b.dataset.slot] ?? 99);
    });

    const howItWorksIndex = cards.findIndex(
      card => String(card.dataset.href || '').includes('/how-it-works.html')
    );

    let activeIndex = howItWorksIndex;

    if (activeIndex < 0) {
      activeIndex = cards.findIndex(card => card.dataset.slot === 'center');
    }

    if (activeIndex < 0) {
      activeIndex = Math.max(0, cards.length - 1);
    }

    return {
      gallery,
      deck,
      cards,
      activeIndex,
      swipe: null,
      suppressClickUntil: 0,
      dots: []
    };
  }

  function ensureDots(state) {
    let dotsWrap = state.gallery.querySelector('.mfpg-dots');
    if (!dotsWrap) {
      dotsWrap = document.createElement('div');
      dotsWrap.className = 'mfpg-dots';
      dotsWrap.setAttribute('aria-hidden', 'true');
      state.gallery.appendChild(dotsWrap);
    }

    dotsWrap.innerHTML = '';
    state.dots = state.cards.map(() => {
      const dot = document.createElement('span');
      dot.className = 'mfpg-dot';
      dotsWrap.appendChild(dot);
      return dot;
    });
  }

  function updateDots(state) {
    state.dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index == state.activeIndex);
    });
  }

  function render(state, pulseCard = null) {
    const n = state.cards.length;
    state.cards.forEach((card, index) => {
      const diff = (index - state.activeIndex + n) % n;
      let slot = 'hidden';
      if (diff === 0) slot = 'center';
      else if (diff === 1) slot = 'right';
      else if (diff === n - 1) slot = 'left';

      card.dataset.slot = slot;
      card.setAttribute('aria-current', slot === 'center' ? 'true' : 'false');
      card.classList.toggle('is-selected-pulse', pulseCard === card && slot === 'center');
    });
    updateDots(state);
  }

  function shift(state, direction) {
    state.activeIndex = wrapIndex(state.activeIndex + direction, state.cards.length);
    state.gallery.classList.add('is-swipe-armed');
    render(state, state.cards[state.activeIndex]);
    window.setTimeout(() => {
      state.gallery.classList.remove('is-swipe-armed');
      state.cards.forEach(card => card.classList.remove('is-selected-pulse'));
    }, 260);
  }

  function focusCard(state, card) {
    const nextIndex = state.cards.indexOf(card);
    if (nextIndex < 0 || nextIndex === state.activeIndex) return false;
    state.activeIndex = nextIndex;
    state.gallery.classList.add('is-swipe-armed');
    render(state, card);
    window.setTimeout(() => {
      state.gallery.classList.remove('is-swipe-armed');
      state.cards.forEach(item => item.classList.remove('is-selected-pulse'));
    }, 260);
    return true;
  }

  function installInteraction(state) {
    ensureDots(state);
    render(state);

    state.gallery.addEventListener('click', event => {
      const card = event.target.closest('.mfpg-card');
      if (!card) return;

      if (Date.now() < state.suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (card.dataset.slot !== 'center') {
        event.preventDefault();
        event.stopImmediatePropagation();
        focusCard(state, card);
      }
    }, true);

    let startX = 0;
    let startY = 0;
    let axis = null;

    state.gallery.addEventListener('touchstart', event => {
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      axis = null;
    }, { passive: true });

    state.gallery.addEventListener('touchmove', event => {
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (axis == null) {
        if (Math.abs(dx) > Math.abs(dy) + AXIS_LOCK_GAP) axis = 'x';
        else if (Math.abs(dy) > Math.abs(dx) + AXIS_LOCK_GAP) axis = 'y';
      }

      if (axis === 'x') {
        event.preventDefault();
      }
    }, { passive: false });

    state.gallery.addEventListener('touchend', event => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const horizontal = Math.abs(dx) > Math.abs(dy) + AXIS_LOCK_GAP;

      if (horizontal && Math.abs(dx) >= MIN_SWIPE_X) {
        state.suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
        shift(state, dx < 0 ? 1 : -1);
      }

      axis = null;
    }, { passive: true });

    state.gallery.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        shift(state, -1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        shift(state, 1);
      }
    });

    console.log(`[PAGE-GALLERY] ${PATCH_ID} mounted`);
  }

  function boot() {
    const state = getGalleryState();
    if (!state || state.gallery.dataset.swipeReady === '1') return;
    state.gallery.dataset.swipeReady = '1';
    installInteraction(state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.setTimeout(boot, 0);
      window.setTimeout(boot, 350);
    }, { once: true });
  } else {
    window.setTimeout(boot, 0);
    window.setTimeout(boot, 350);
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_SWIPE_V3 ===== */

/* ===== MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6';

  const PAGE_META = {
    'Trading Terminal': {
      index: '01 / 04',
      title: 'TRADING TERMINAL',
      text: 'Live workspace for chart analysis, open positions, signals and trade execution.'
    },
    'System Settings': {
      index: '02 / 04',
      title: 'SYSTEM SETTINGS',
      text: 'Configure trading mode, AI thresholds, risk filters and execution rules.'
    },
    'Real-Time Pipeline': {
      index: '03 / 04',
      title: 'REAL-TIME PIPELINE',
      text: 'Monitor live token states, candidates, decisions and active positions.'
    },
    'How It Works': {
      index: '04 / 04',
      title: 'HOW IT WORKS',
      text: 'See how your wallet, Smart Vault and executor work together — from deposit to automated trading and withdrawal.'
    }
  };

  function normalizeTitle(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleFromCard(card) {
    if (!card) return '';

    const visibleTitle = card.querySelector('.mfpg-title');
    const title = normalizeTitle(visibleTitle?.textContent);

    if (PAGE_META[title]) return title;

    const href = String(card.dataset.href || '');

    if (href.includes('/trading.html')) return 'Trading Terminal';
    if (href.includes('/settings.html') || href.includes('mfOpenSettings=1')) return 'System Settings';
    if (href.includes('/system-tokens.html')) return 'Real-Time Pipeline';

    return title;
  }

  function currentCenterCard(gallery) {
    return gallery?.querySelector('.mfpg-card[data-slot="center"]') || null;
  }

  function renderCaption(meta, animate = true) {
    const root = document.getElementById('mfPageCaption');
    const inner = root?.querySelector('.mfpg-caption-inner');
    const index = document.getElementById('mfPageCaptionIndex');
    const title = document.getElementById('mfPageCaptionTitle');
    const text = document.getElementById('mfPageCaptionText');

    if (!root || !inner || !index || !title || !text || !meta) return;

    const apply = () => {
      index.textContent = meta.index;
      title.textContent = meta.title;
      text.textContent = meta.text;

      inner.classList.remove('is-changing');
      inner.classList.remove('is-entering');

      if (animate) {
        void inner.offsetWidth;
        inner.classList.add('is-entering');
        window.setTimeout(() => inner.classList.remove('is-entering'), 280);
      }
    };

    if (!animate) {
      apply();
      return;
    }

    inner.classList.remove('is-entering');
    inner.classList.add('is-changing');
    window.setTimeout(apply, 145);
  }

  function syncCaption(gallery, animate = true) {
    const center = currentCenterCard(gallery);
    const key = titleFromCard(center);
    const meta = PAGE_META[key];

    if (!meta) return;

    const active = document.getElementById('mfPageCaptionTitle');
    if (active?.textContent === meta.title && animate) return;

    renderCaption(meta, animate);
  }

  function install() {
    const gallery = document.getElementById('mfPageGallery');
    const caption = document.getElementById('mfPageCaption');

    if (!gallery || !caption || caption.dataset.captionReady === '1') return false;

    caption.dataset.captionReady = '1';

    syncCaption(gallery, false);

    const observer = new MutationObserver(mutations => {
      const changed = mutations.some(mutation =>
        mutation.type === 'attributes' &&
        mutation.attributeName === 'data-slot' &&
        mutation.target?.classList?.contains('mfpg-card')
      );

      if (changed) {
        window.requestAnimationFrame(() => syncCaption(gallery, true));
      }
    });

    const deck = gallery.querySelector('.mfpg-deck');
    if (deck) {
      observer.observe(deck, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-slot']
      });
    }

    console.log(`[PAGE-GALLERY] ${PATCH_ID} mounted`);
    return true;
  }

  function boot() {
    if (install()) return;

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (install() || tries >= 40) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_REALTIME_PAGE_GALLERY_CAPTION_V6 ===== */

/* ===== MEMEFLOW_REMOVE_BACK_AND_RESET_V7 ===== */
(() => {
  'use strict';

  const PATCH_ID = 'MEMEFLOW_REMOVE_BACK_AND_RESET_V7';

  function isResetViewButton(node) {
    if (!node) return false;
    const text = String(node.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return text === 'reset view';
  }

  function removeTargets() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return false;

    let changed = false;

    const back = topbar.querySelector('.back');
    if (back) {
      back.remove();
      changed = true;
    }

    const byId = document.getElementById('resetViewBtn');
    if (byId) {
      byId.remove();
      changed = true;
    }

    const buttons = Array.from(topbar.querySelectorAll('button, .tool-btn'));
    for (const button of buttons) {
      if (isResetViewButton(button)) {
        button.remove();
        changed = true;
      }
    }

    return changed;
  }

  function boot() {
    removeTargets();

    if (typeof MutationObserver !== 'function') return;

    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    const observer = new MutationObserver(() => {
      removeTargets();
    });

    observer.observe(topbar, { childList: true, subtree: true });

    window.setTimeout(() => observer.disconnect(), 4000);

    console.log(`[TOPBAR] ${PATCH_ID} mounted`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_REMOVE_BACK_AND_RESET_V7 ===== */

/* MEMEFLOW_SYSTEM_REMOVE_TRADING_SETTINGS_HEADER_BUTTONS_V1: obsolete System-page Settings trigger router removed. */


/* ===== MEMEFLOW_GALLERY_LIVE_IFRAMES_V1 ===== */
(() => {
  'use strict';

  /*
    TRUE LIVE PREVIEWS

    Each existing 3D gallery card keeps its WEBP <img> as a fallback.
    A same-origin iframe is mounted above that image and renders the actual
    page continuously. Because the iframe itself has pointer-events:none,
    all existing swipe/click/navigation behavior stays owned by the card.

    This is deliberately NOT a screenshot loop:
      - no html2canvas
      - no polling interval
      - no rasterization
      - no 5-minute refresh
      - the embedded page simply stays alive while System View is open
  */

  const PATCH_ID = 'MEMEFLOW_GALLERY_LIVE_IFRAMES_V1';
  const BASE_WIDTH = 390;
  const BASE_HEIGHT = 844;
  const LOAD_FADE_DELAY_MS = 450;

  const LIVE_PAGES = {
    'Trading Terminal': '/trading.html',
    'System Settings': '/settings.html',
    'Real-Time Pipeline': '/system-tokens.html',
    'How It Works': '/how-it-works.html'
  };

  const states = new Map();
  let resizeObserver = null;
  let stopped = false;

  function previewUrl(path) {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('mfGalleryLive', '1');
    return url.href;
  }

  function cardTitle(card) {
    return String(
      card.querySelector('.mfpg-title')?.textContent || ''
    ).trim();
  }

  function scaleFrame(state) {
    const { card, frame } = state;
    if (!card?.isConnected || !frame?.isConnected) return;

    const width = Math.max(1, card.clientWidth);
    const height = Math.max(1, card.clientHeight);

    // Match the old object-fit:cover behavior:
    // fill the complete card, crop only what does not fit.
    const scale = Math.max(
      width / BASE_WIDTH,
      height / BASE_HEIGHT
    );

    frame.style.transform =
      `translate(-50%, -50%) scale(${scale.toFixed(5)})`;
  }

  function makeLiveLayer(card, title, path) {
    const shot = card.querySelector('.mfpg-shot');
    if (!shot) return null;

    const layer = document.createElement('span');
    layer.className = 'mfpg-live-viewport';
    layer.setAttribute('aria-hidden', 'true');

    const frame = document.createElement('iframe');
    frame.className = 'mfpg-live-frame';
    frame.src = previewUrl(path);
    frame.width = String(BASE_WIDTH);
    frame.height = String(BASE_HEIGHT);
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', `${title} live preview`);
    frame.setAttribute('loading', 'eager');

    // Important: no sandbox here. These are same-origin app pages and must
    // retain the same cookies/session/API/SSE/WebSocket behavior as when
    // opened normally.
    layer.appendChild(frame);

    // Put live page after the fallback image but before labels/pulse.
    shot.insertAdjacentElement('afterend', layer);

    const state = {
      card,
      layer,
      frame,
      title,
      path,
      loaded: false
    };

    frame.addEventListener('load', () => {
      if (stopped || !layer.isConnected) return;

      state.loaded = true;
      scaleFrame(state);

      window.setTimeout(() => {
        if (
          !stopped &&
          layer.isConnected &&
          state.loaded
        ) {
          layer.classList.add('is-live');
          card.dataset.mfLivePreview = 'ready';
        }
      }, LOAD_FADE_DELAY_MS);
    });

    frame.addEventListener('error', () => {
      card.dataset.mfLivePreview = 'fallback';
      layer.classList.remove('is-live');
    });

    return state;
  }

  function mount() {
    if (stopped) return true;

    const gallery = document.getElementById('mfPageGallery');
    if (!gallery) return false;

    const cards = Array.from(
      gallery.querySelectorAll('.mfpg-card')
    );

    if (cards.length < 3) return false;

    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const state = states.get(entry.target);
        if (state) scaleFrame(state);
      }
    });

    for (const card of cards) {
      const title = cardTitle(card);
      const path = LIVE_PAGES[title];
      if (!path || states.has(card)) continue;

      const state = makeLiveLayer(card, title, path);
      if (!state) continue;

      states.set(card, state);
      resizeObserver.observe(card);
      scaleFrame(state);
    }

    gallery.dataset.mfLivePages = '1';
    gallery.dataset.mfLiveMode = 'continuous';
    gallery.dataset.mfLivePageCount = String(states.size);

    console.log(
      `[PAGE-GALLERY] ${PATCH_ID} mounted; live pages=${states.size}`
    );

    return states.size >= 3;
  }

  function boot() {
    let attempts = 0;

    const timer = window.setInterval(() => {
      attempts += 1;

      if (mount() || attempts >= 100) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function destroy() {
    stopped = true;

    try {
      resizeObserver?.disconnect();
    } catch (_) {}

    for (const state of states.values()) {
      try {
        state.frame.src = 'about:blank';
      } catch (_) {}

      try {
        state.layer.remove();
      } catch (_) {}
    }

    states.clear();
  }

  // Pages keep updating naturally while visible. On return from background,
  // only re-scale them; do not reload them and lose their live state.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      for (const state of states.values()) {
        scaleFrame(state);
      }
    }
  });

  window.addEventListener('pagehide', destroy, { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {
      once: true
    });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_GALLERY_LIVE_IFRAMES_V1 ===== */
