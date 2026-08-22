import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
    const y = (-v.y * 0.5 + 0.5) * h - label.offsetY;

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
  $('tokenRail').innerHTML = sample.length
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
    getJson('/api/debug/filter-pipeline-lifecycle?limit=12'),
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

  $('eventCount').textContent = discovery?.eventsReceived ?? '—';
  $('tradeCount').textContent = diag?.liveTradeFeed?.tradeEventsDecoded ?? discovery?.liveTradeFeed?.tradeEventsDecoded ?? '—';
  $('holderQueue').textContent = discovery?.holderQueueDepth ?? '—';
  $('activeUsers').textContent = discovery?.activeEvaluationUsers ?? '—';
  $('freshBacklog').textContent = diag?.bridge?.currentFreshBacklog ?? '—';
  $('lastEvent').textContent = ago(discovery?.lastEventAt);
  $('lastSync').textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  const ranked = rankSample(diag?.sample || []);
  /* CLEAN V29 keeps token telemetry in the rail only. */
  renderRail(ranked);

  $('telemetryMode').classList.toggle('offline', !(diag || discovery));
  $('telemetryMode').lastChild.textContent = (diag || discovery) ? 'LIVE' : 'DEGRADED';

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

  ctx.font =
    id === 'core'
      ? '700 53px Arial'
      : '700 44px Arial';

  ctx.fillStyle = '#d8e8ef';

  ctx.fillText(
    MF20_LABELS[id] || id,
    512,
    385
  );

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

function mf20BuildModule(id) {
  const node =
    app.nodes.get(id);

  if (!node?.group) {
    return;
  }

  const color =
    MF20_NODE_COLOR[id];

  const core =
    id === 'core';

  node.group.position.set(
    ...MF20_LAYOUT[id]
  );

  node.group.scale.set(1, 1, 1);

  mf20HideExistingNode(node);

  const hardware =
    new THREE.Group();

  hardware.name =
    'MF20_HARDWARE_' + id;

  const width =
    core ? 3.15 : 2.46;

  const depth =
    core ? 2.05 : 1.58;

  const levels = [
    {
      w: 1.10,
      d: 1.12,
      h: 0.13,
      y: -0.34
    },
    {
      w: 1.045,
      d: 1.055,
      h: 0.15,
      y: -0.21
    },
    {
      w: 1.00,
      d: 1.00,
      h: 0.18,
      y: -0.07
    }
  ];

  for (
    let i = 0;
    i < levels.length;
    i++
  ) {
    const level =
      levels[i];

    const geometry =
      new THREE.BoxGeometry(
        width * level.w,
        level.h,
        depth * level.d
      );

    const body =
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color:
            i === 2
              ? 0x071016
              : 0x03080c,

          emissive: color,

          emissiveIntensity:
            i === 2
              ? core ? 0.13 : 0.055
              : 0.018,

          metalness: 0.74,
          roughness: 0.28
        })
      );

    body.position.y =
      level.y;

    hardware.add(body);

    const edges =
      new THREE.LineSegments(
        new THREE.EdgesGeometry(
          geometry
        ),
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity:
            i === 2
              ? core ? 0.54 : 0.34
              : 0.17
        })
      );

    edges.position.copy(
      body.position
    );

    hardware.add(edges);
  }

  const display =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 0.87,
        depth * 0.80
      ),
      new THREE.MeshBasicMaterial({
        map:
          mf20MakeTopTexture(
            id,
            color
          ),

        transparent: true,
        opacity: 0.96,
        depthWrite: false
      })
    );

  display.rotation.x =
    -Math.PI / 2;

  display.position.y =
    0.035;

  hardware.add(display);

  const underside =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 1.18,
        depth * 1.22
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity:
          core ? 0.075 : 0.025,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending,
        side:
          THREE.DoubleSide
      })
    );

  underside.rotation.x =
    -Math.PI / 2;

  underside.position.y =
    -0.42;

  hardware.add(underside);

  node.group.add(hardware);

  MF20.hardware.set(
    id,
    {
      group: hardware,
      display,
      underside,
      color
    }
  );
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

  mf29Camera(false);
  resize();
});

/* ===== MEMEFLOW V29.3 CAMERA FIT + SETTINGS ===== */

const MF293 = {
  installed: false,
  settings: null,
  version: null,
  capabilities: null,
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
  ['filters', 'Entry filters', 'Market, holder, concentration and token filters', false, [
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

function mf293Build() {
  if (document.getElementById('mf293SettingsPanel')) return;

  const actions = document.querySelector('.top-actions');
  if (actions) {
    const button = document.createElement('button');
    button.id = 'mf293SettingsBtn';
    button.className = 'tool-btn mf293-settings-trigger';
    button.type = 'button';
    button.textContent = 'Settings';
    actions.insertBefore(button, document.getElementById('resetViewBtn') || null);
    button.addEventListener('click', mf293Open);
  }

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

/* ===== MEMEFLOW V30 TRADING TERMINAL LINK ===== */
(function mf30TradingLink(){
  const actions = document.querySelector('.top-actions');
  if (!actions || document.getElementById('mf30TradingBtn')) return;

  const button = document.createElement('button');
  button.id = 'mf30TradingBtn';
  button.className = 'tool-btn';
  button.type = 'button';
  button.textContent = 'Trading';
  button.addEventListener('click', () => {
    window.location.href = '/trading.html';
  });

  const settings = document.getElementById('mf293SettingsBtn');
  if (settings && settings.parentNode === actions) {
    actions.insertBefore(button, settings);
  } else {
    actions.insertBefore(button, actions.firstChild);
  }
})();

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
  discovery: { pos:[-4.45,  2.85,  0.12], scale:0.52 },
  bootstrap: { pos:[ 0.00,  2.85, -0.04], scale:0.52 },
  core:      { pos:[ 4.45,  2.85,  0.18], scale:0.59 },

  risk:      { pos:[-4.45,  0.62,  0.08], scale:0.50 },
  market:    { pos:[ 0.00,  0.62, -0.06], scale:0.50 },
  holders:   { pos:[ 4.45,  0.62,  0.18], scale:0.50 },

  openai:    { pos:[-4.45, -1.62, -0.10], scale:0.49 },
  decision:  { pos:[ 0.00, -1.62,  0.04], scale:0.51 },
  paper:     { pos:[ 4.45, -1.62,  0.02], scale:0.50 },

  execution: { pos:[ 0.00, -3.78, -0.12], scale:0.49 }
};

const WEB_LAYOUT_DESKTOP_V31 = {
  discovery: { pos:[-5.60,  3.10,  0.10], scale:0.68 },
  bootstrap: { pos:[ 0.00,  3.10, -0.05], scale:0.68 },
  core:      { pos:[ 5.60,  3.10,  0.20], scale:0.76 },

  risk:      { pos:[-5.60,  0.55,  0.08], scale:0.66 },
  market:    { pos:[ 0.00,  0.55, -0.08], scale:0.66 },
  holders:   { pos:[ 5.60,  0.55,  0.18], scale:0.66 },

  openai:    { pos:[-5.60, -2.00, -0.12], scale:0.64 },
  decision:  { pos:[ 0.00, -2.00,  0.02], scale:0.67 },
  paper:     { pos:[ 5.60, -2.00,  0.02], scale:0.65 },

  execution: { pos:[ 0.00, -4.45, -0.12], scale:0.63 }
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
  const mid = a.clone().lerp(b, 0.5);

  mid.z += ((index % 3) - 1) * 0.18;
  mid.y += (index % 2 === 0 ? 0.10 : -0.06);

  return new THREE.CatmullRomCurve3(
    [a, mid, b],
    false,
    'catmullrom',
    0.06
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

  if (mobile) {
    app.cameraHome.set(0.0, 13.4, 28.2);
    app.targetHome.set(0.0, -1.15, 0.0);

    app.controls.minDistance = 13.5;
    app.controls.maxDistance = 46.0;
    app.controls.minPolarAngle = Math.PI * 0.20;
    app.controls.maxPolarAngle = Math.PI * 0.52;
    app.controls.minAzimuthAngle = -0.95;
    app.controls.maxAzimuthAngle = 0.95;
  } else {
    app.cameraHome.set(0.0, 12.0, 30.0);
    app.targetHome.set(0.0, -0.65, 0.0);

    app.controls.minDistance = 14.0;
    app.controls.maxDistance = 48.0;
    app.controls.minPolarAngle = Math.PI * 0.20;
    app.controls.maxPolarAngle = Math.PI * 0.55;
    app.controls.minAzimuthAngle = -1.20;
    app.controls.maxAzimuthAngle = 1.20;
  }

  app.controls.enableZoom = true;
  app.controls.enableRotate = true;
  app.controls.enablePan = false;
  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.055;
  app.controls.zoomSpeed = 1.15;
  app.controls.rotateSpeed = 0.76;
  app.controls.autoRotate = false;
  app.autoRotate = false;

  if (app.controls.touches) {
    app.controls.touches.ONE = THREE.TOUCH.ROTATE;
    app.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  if (forceHome) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.update();
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

  const group = new THREE.Group();
  group.name = 'MEMEFLOW_REAL_EVENT_WEB_V31';
  app.scene.add(group);
  REAL_WEB_V31.group = group;

  WEB_EDGES_V31.forEach((edge, index) => {
    const curve = webCurveV31(edge, index);
    const points = curve.getPoints(72);

    const baseGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const base = new THREE.Line(
      baseGeometry,
      new THREE.LineBasicMaterial({
        color: edge.color,
        transparent: true,
        opacity: edge.key === 'paper:execution' ? 0.018 : 0.034,
        depthWrite: false
      })
    );
    base.renderOrder = 4;
    group.add(base);

    const hotGeometry = new THREE.BufferGeometry().setFromPoints(points);
    hotGeometry.setDrawRange(0, 0);

    const hot = new THREE.Line(
      hotGeometry,
      new THREE.LineBasicMaterial({
        color: edge.color,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    hot.renderOrder = 8;
    group.add(hot);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 10),
      new THREE.MeshBasicMaterial({
        color: edge.color,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    head.visible = false;
    head.renderOrder = 9;
    group.add(head);

    REAL_WEB_V31.edges.set(edge.key, {
      ...edge,
      curve,
      points,
      base,
      hot,
      head,
      active: false,
      startedAt: 0,
      durationMs: 90,
      fadeStartedAt: 0,
      fadeMs: 105,
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

  if (document.hidden || !REAL_WEB_V31.installed) return;

  if ((now - REAL_WEB_V31.lastFrameAt) < 32) return;
  REAL_WEB_V31.lastFrameAt = now;

  for (const entry of REAL_WEB_V31.edges.values()) {
    if (!entry.active) continue;

    const elapsed = now - entry.startedAt;
    const p = webClampV31(elapsed / entry.durationMs, 0, 1);

    if (p < 1) {
      const count = Math.max(2, Math.floor(entry.points.length * p));
      entry.hot.geometry.setDrawRange(0, count);
      entry.hot.material.opacity = Math.min(1, 0.80 * entry.boost);

      const headP = entry.curve.getPointAt(Math.min(0.999, p));
      entry.head.position.copy(headP);
      entry.head.material.opacity = Math.min(1, 0.96 * entry.boost);

      continue;
    }

    if (!entry.fadeStartedAt) {
      entry.fadeStartedAt = now;
      entry.hot.geometry.setDrawRange(0, entry.points.length);
    }

    const fade = webClampV31(
      1 - ((now - entry.fadeStartedAt) / entry.fadeMs),
      0,
      1
    );

    entry.hot.material.opacity = fade * 0.62 * entry.boost;
    entry.head.material.opacity = fade * 0.78 * entry.boost;

    if (fade <= 0) {
      entry.active = false;
      entry.boost = 1;
      entry.hot.visible = false;
      entry.head.visible = false;
      entry.hot.geometry.setDrawRange(0, 0);
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

// MEMEFLOW_DISCOVERY_SETTINGS_UI_V1

(() => {
  'use strict';

  const PATCH = 'MEMEFLOW_DISCOVERY_SETTINGS_UI_V1';
  if (window.__mfDiscoverySettingsUiV1) return;
  window.__mfDiscoverySettingsUiV1 = true;

  const state = {
    busy: false,
    mode: null,
    source: null,
    dex: null,
    pump: null,
    platformValueEl: null,
    mountedAt: 0,
    poll: null,
    observer: null,
    mountTimer: null
  };

  const css = `
  #mfds-panel-v1 {
    margin: 16px 20px 0;
    padding: 16px;
    border: 1px solid #17303a;
    border-radius: 20px;
    background:
      radial-gradient(120% 180% at 0% 0%, rgba(45,218,255,.045), transparent 44%),
      linear-gradient(180deg, #030b10 0%, #02080c 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.014);
  }
  #mfds-panel-v1 * { box-sizing: border-box; }
  .mfds-v1-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 13px;
  }
  .mfds-v1-kicker {
    color: #647f8b;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    letter-spacing: .17em;
    text-transform: uppercase;
  }
  .mfds-v1-title {
    margin-top: 6px;
    color: #eaf4f8;
    font-size: 17px;
    line-height: 1.15;
    font-weight: 730;
    letter-spacing: -.015em;
  }
  .mfds-v1-status {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid #1a333d;
    border-radius: 999px;
    color: #86a0ab;
    background: #02090d;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: .12em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .mfds-v1-status::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6d8490;
    box-shadow: 0 0 0 2px rgba(109,132,144,.08);
  }
  .mfds-v1-status.live {
    color: #72eec0;
    border-color: rgba(52,190,139,.34);
  }
  .mfds-v1-status.live::before {
    background: #44edac;
    box-shadow: 0 0 10px rgba(68,237,172,.45);
  }
  .mfds-v1-status.starting {
    color: #7ccfe5;
    border-color: rgba(60,172,205,.30);
  }
  .mfds-v1-status.starting::before {
    background: #4ed8ff;
    box-shadow: 0 0 10px rgba(78,216,255,.35);
  }
  .mfds-v1-segment {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    padding: 5px;
    border: 1px solid #142731;
    border-radius: 15px;
    background: #02070b;
  }
  .mfds-v1-mode {
    appearance: none;
    -webkit-appearance: none;
    min-width: 0;
    height: 42px;
    border: 1px solid transparent;
    border-radius: 11px;
    background: transparent;
    color: #718995;
    font: inherit;
    font-size: 10px;
    font-weight: 780;
    letter-spacing: .12em;
    text-transform: uppercase;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition:
      background .14s ease,
      border-color .14s ease,
      color .14s ease,
      transform .08s ease,
      box-shadow .14s ease;
  }
  .mfds-v1-mode:active { transform: scale(.975); }
  .mfds-v1-mode[disabled] { opacity: .55; }
  .mfds-v1-mode.active[data-mode="pump"] {
    color: #e6faff;
    border-color: rgba(66,211,244,.52);
    background: rgba(35,157,186,.10);
    box-shadow: inset 0 0 0 1px rgba(66,211,244,.08);
  }
  .mfds-v1-mode.active[data-mode="dex"] {
    color: #dffbed;
    border-color: rgba(66,230,164,.48);
    background: rgba(40,176,122,.10);
    box-shadow: inset 0 0 0 1px rgba(66,230,164,.08);
  }
  .mfds-v1-mode.active[data-mode="hybrid"] {
    color: #eeeaff;
    border-color: rgba(132,112,255,.50);
    background: rgba(101,79,214,.11);
    box-shadow: inset 0 0 0 1px rgba(132,112,255,.08);
  }
  .mfds-v1-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 20px;
    margin-top: 10px;
    color: #5f7884;
    font-size: 10px;
    line-height: 1.35;
  }
  .mfds-v1-note { min-width: 0; }
  .mfds-v1-metric {
    flex: 0 0 auto;
    color: #78939e;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .mfds-v1-error {
    color: #ff7489 !important;
  }
  @media (max-width: 560px) {
    #mfds-panel-v1 {
      margin: 14px 20px 0;
      padding: 14px;
      border-radius: 18px;
    }
    .mfds-v1-title { font-size: 16px; }
    .mfds-v1-mode { height: 40px; font-size: 9px; }
    .mfds-v1-foot { font-size: 9px; }
  }
  `;

  function installStyle() {
    if (document.getElementById('mfds-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'mfds-style-v1';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function leaves() {
    return Array.from(document.querySelectorAll('body *')).filter(el => {
      if (el.id === 'mfds-panel-v1' || el.closest?.('#mfds-panel-v1')) return false;
      if (el.children.length) return false;
      const t = (el.textContent || '').trim();
      return Boolean(t);
    });
  }

  function leafExact(text) {
    const wanted = String(text).trim().toLowerCase();
    return leaves().find(el => (el.textContent || '').trim().toLowerCase() === wanted) || null;
  }

  function leafIncludes(text) {
    const wanted = String(text).trim().toLowerCase();
    return leaves().find(el => (el.textContent || '').trim().toLowerCase().includes(wanted)) || null;
  }

  function findSummaryRow() {
    const label = leafExact('Platform');
    if (!label) return null;

    let n = label.parentElement;
    while (n && n !== document.body) {
      const txt = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const hasAll =
        txt.includes('platform') &&
        txt.includes('ai policy') &&
        txt.includes('kill switch');

      if (hasAll && txt.length < 520) return n;
      n = n.parentElement;
    }
    return null;
  }

  function findPlatformValue() {
    if (state.platformValueEl?.isConnected) return state.platformValueEl;

    const label = leafExact('Platform');
    if (!label) return null;

    let n = label.parentElement;
    for (let depth = 0; n && n !== document.body && depth < 5; depth++, n = n.parentElement) {
      const candidates = Array.from(n.querySelectorAll('*')).filter(el => {
        if (el.children.length) return false;
        const t = (el.textContent || '').trim();
        if (!t) return false;
        if (t.toLowerCase() === 'platform') return false;
        return true;
      });

      const direct = candidates.find(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        return ['pump.fun', 'pump', 'dex', 'hybrid'].includes(t);
      });

      if (direct) {
        state.platformValueEl = direct;
        return direct;
      }

      if ((n.innerText || '').length < 100 && candidates.length === 1) {
        state.platformValueEl = candidates[0];
        return candidates[0];
      }
    }

    return null;
  }

  function findLogicSection() {
    const title = leafExact('Logic');
    if (!title) return null;

    let n = title.parentElement;
    while (n && n !== document.body) {
      const txt = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (
        txt.includes('logic') &&
        txt.includes('decision thresholds') &&
        txt.length < 320
      ) return n;
      n = n.parentElement;
    }
    return null;
  }

  function createPanel() {
    const panel = document.createElement('section');
    panel.id = 'mfds-panel-v1';
    panel.setAttribute('data-patch', PATCH);
    panel.innerHTML = `
      <div class="mfds-v1-head">
        <div>
          <div class="mfds-v1-kicker">Token intake</div>
          <div class="mfds-v1-title">Discovery source</div>
        </div>
        <div class="mfds-v1-status starting" id="mfds-status-v1">Loading</div>
      </div>

      <div class="mfds-v1-segment" role="group" aria-label="Discovery source">
        <button class="mfds-v1-mode" type="button" data-mode="pump">Pump</button>
        <button class="mfds-v1-mode" type="button" data-mode="dex">DEX</button>
        <button class="mfds-v1-mode" type="button" data-mode="hybrid">Hybrid</button>
      </div>

      <div class="mfds-v1-foot">
        <span class="mfds-v1-note" id="mfds-note-v1">Switches token intake only. Risk and trading settings stay unchanged.</span>
        <span class="mfds-v1-metric" id="mfds-metric-v1"></span>
      </div>
    `;

    panel.querySelectorAll('.mfds-v1-mode').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode), {passive: true});
    });

    return panel;
  }

  function mount() {
    installStyle();

    if (document.getElementById('mfds-panel-v1')) {
      updatePlatformSummary();
      return true;
    }

    const panel = createPanel();
    const summary = findSummaryRow();
    const logic = findLogicSection();

    if (summary?.parentElement) {
      summary.insertAdjacentElement('afterend', panel);
    } else if (logic?.parentElement) {
      logic.parentElement.insertBefore(panel, logic);
    } else {
      return false;
    }

    state.mountedAt = Date.now();
    loadStatus();
    return true;
  }

  function modeLabel(mode) {
    if (mode === 'pump') return 'Pump.fun';
    if (mode === 'dex') return 'DEX';
    if (mode === 'hybrid') return 'Hybrid';
    return '—';
  }

  function updatePlatformSummary() {
    const value = findPlatformValue();
    if (value && state.mode) {
      value.textContent = modeLabel(state.mode);
    }
  }

  function render() {
    const panel = document.getElementById('mfds-panel-v1');
    if (!panel) return;

    panel.querySelectorAll('.mfds-v1-mode').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
      btn.disabled = state.busy;
    });

    const status = panel.querySelector('#mfds-status-v1');
    const note = panel.querySelector('#mfds-note-v1');
    const metric = panel.querySelector('#mfds-metric-v1');

    let connected = false;
    let starting = false;

    if (state.mode === 'dex') {
      connected = Boolean(state.dex?.connected);
      starting = !connected && !state.dex?.lastError;
    } else if (state.mode === 'pump') {
      connected = Boolean(state.pump?.connected);
      starting = !connected;
    } else if (state.mode === 'hybrid') {
      const pumpOn = Boolean(state.pump?.connected);
      const dexOn = Boolean(state.dex?.connected);
      connected = pumpOn && dexOn;
      starting = !connected;
    }

    if (status) {
      status.classList.remove('live', 'starting');
      if (state.busy) {
        status.classList.add('starting');
        status.textContent = 'Switching';
      } else if (connected) {
        status.classList.add('live');
        status.textContent = 'Live';
      } else if (starting) {
        status.classList.add('starting');
        status.textContent = 'Starting';
      } else {
        status.textContent = 'Offline';
      }
    }

    if (metric) {
      if (state.mode === 'dex' || state.mode === 'hybrid') {
        const q = Number(state.dex?.queueDepth || 0);
        const pending = Number(state.dex?.pendingConfirms || 0);
        metric.textContent = `Q ${q} · P ${pending}`;
      } else {
        metric.textContent = '';
      }
    }

    if (note && !note.classList.contains('mfds-v1-error')) {
      note.textContent = 'Switches token intake only. Risk and trading settings stay unchanged.';
    }

    updatePlatformSummary();
  }

  async function loadStatus() {
    if (document.hidden) return;
    if (!document.getElementById('mfds-panel-v1')) {
      mount();
      return;
    }

    try {
      const r = await fetch('/api/discovery-source', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {'accept': 'application/json'}
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || `HTTP ${r.status}`);

      state.source = j?.source || null;
      state.mode = String(j?.source?.mode || '').toLowerCase() || state.mode;
      state.dex = j?.dex || null;
      state.pump = j?.pump || null;

      const note = document.getElementById('mfds-note-v1');
      note?.classList.remove('mfds-v1-error');
      render();
    } catch (e) {
      const note = document.getElementById('mfds-note-v1');
      if (note) {
        note.textContent = `Discovery status unavailable: ${e?.message || e}`;
        note.classList.add('mfds-v1-error');
      }
    }
  }

  async function switchMode(mode) {
    mode = String(mode || '').toLowerCase();
    if (!['pump', 'dex', 'hybrid'].includes(mode) || state.busy) return;
    if (mode === state.mode) return;

    const previous = state.mode;
    state.busy = true;
    state.mode = mode;
    render();

    try {
      const r = await fetch('/api/discovery-source', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({mode})
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || `HTTP ${r.status}`);

      state.source = j?.source || null;
      state.mode = String(j?.source?.mode || mode).toLowerCase();
      state.dex = j?.dex || null;
      state.pump = j?.pump || null;

      const note = document.getElementById('mfds-note-v1');
      if (note) {
        note.classList.remove('mfds-v1-error');
        note.textContent = `${modeLabel(state.mode)} is now the active token source.`;
      }
    } catch (e) {
      state.mode = previous;
      const note = document.getElementById('mfds-note-v1');
      if (note) {
        note.textContent = `Switch failed: ${e?.message || e}`;
        note.classList.add('mfds-v1-error');
      }
    } finally {
      state.busy = false;
      render();
      setTimeout(loadStatus, 500);
    }
  }

  function queueMount() {
    clearTimeout(state.mountTimer);
    state.mountTimer = setTimeout(() => {
      mount();
      updatePlatformSummary();
    }, 80);
  }

  function start() {
    installStyle();
    mount();

    state.observer = new MutationObserver(queueMount);
    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    state.poll = setInterval(loadStatus, 2500);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        queueMount();
        loadStatus();
      }
    });

    window.addEventListener('pageshow', () => {
      queueMount();
      loadStatus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
})();

