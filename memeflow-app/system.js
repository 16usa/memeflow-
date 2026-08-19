import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
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
  EDGES.forEach(createFlowLine);

  canvas.addEventListener('pointerup', pick);
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
  syncTokenMeshes(ranked);
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
  requestAnimationFrame(animate);

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
  setInterval(refreshTelemetry, 2500);
} catch (err) {
  console.error('[MEMEFLOW SYSTEM VIEW]', err);
  $('fatal').hidden = false;
  $('boot').classList.add('hidden');
}

/* ===== MOBILE PORTRAIT DIGITAL TWIN V7 ===== */

const PORTRAIT_LAYOUT_V7 = {
  discovery: {
    pos: [-4.6, 4.0, 0.3],
    scale: 0.72
  },

  bootstrap: {
    pos: [0.0, 4.0, -0.25],
    scale: 0.72
  },

  core: {
    pos: [4.6, 4.0, 0.2],
    scale: 0.76
  },

  holders: {
    pos: [4.6, 1.1, 0.8],
    scale: 0.70
  },

  market: {
    pos: [0.0, 1.1, -0.25],
    scale: 0.70
  },

  risk: {
    pos: [-4.6, 1.1, 0.15],
    scale: 0.70
  },

  openai: {
    pos: [-4.6, -2.0, -0.9],
    scale: 0.67
  },

  decision: {
    pos: [0.0, -2.0, 0.0],
    scale: 0.72
  },

  paper: {
    pos: [4.6, -2.0, 0.15],
    scale: 0.70
  },

  execution: {
    pos: [4.6, -4.7, -1.0],
    scale: 0.65
  }
};

const PORTRAIT_EDGES_V7 = [
  {
    from: 'discovery',
    to: 'bootstrap',
    color: COLORS.cyan,
    via: [-2.3, 4.25, 0.0],
    pulses: 3,
    speed: 0.26
  },

  {
    from: 'bootstrap',
    to: 'core',
    color: COLORS.blue,
    via: [2.3, 4.25, 0.0],
    pulses: 3,
    speed: 0.25
  },

  {
    from: 'core',
    to: 'holders',
    color: COLORS.cyan,
    via: [4.8, 2.55, 0.55],
    pulses: 2,
    speed: 0.21
  },

  {
    from: 'core',
    to: 'market',
    color: COLORS.blue,
    via: [2.25, 2.45, -0.30],
    pulses: 2,
    speed: 0.20
  },

  {
    from: 'holders',
    to: 'risk',
    color: COLORS.cyan,
    via: [0.0, 1.55, 0.65],
    pulses: 3,
    speed: 0.20
  },

  {
    from: 'market',
    to: 'risk',
    color: COLORS.blue,
    via: [-2.35, 1.15, -0.10],
    pulses: 2,
    speed: 0.20
  },

  {
    from: 'openai',
    to: 'risk',
    color: COLORS.purple,
    via: [-4.75, -0.45, -0.55],
    pulses: 1,
    speed: 0.12
  },

  {
    from: 'risk',
    to: 'decision',
    color: COLORS.green,
    via: [-2.25, -0.80, 0.05],
    pulses: 3,
    speed: 0.26
  },

  {
    from: 'decision',
    to: 'paper',
    color: COLORS.purple,
    via: [2.25, -1.75, 0.05],
    pulses: 2,
    speed: 0.19
  },

  {
    from: 'paper',
    to: 'execution',
    color: COLORS.yellow,
    via: [4.75, -3.40, -0.50],
    pulses: 1,
    speed: 0.13
  }
];

function clearFlowLinesV7() {
  const remove = [];

  app.scene.traverse((object) => {
    if (
      object.isLine === true &&
      object.isLineSegments !== true
    ) {
      remove.push(object);
    }
  });

  for (const object of remove) {
    app.scene.remove(object);

    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      object.material.dispose();
    }
  }

  for (const pulse of app.edgePulses) {
    app.scene.remove(pulse);

    if (pulse.geometry) {
      pulse.geometry.dispose();
    }

    if (pulse.material) {
      pulse.material.dispose();
    }
  }

  app.edgePulses.length = 0;
}

function applyPortraitTopologyV7() {
  const mobile =
    window.matchMedia('(max-width: 900px)').matches;

  if (!mobile) {
    return;
  }

  for (
    const [id, config]
    of Object.entries(PORTRAIT_LAYOUT_V7)
  ) {
    const node = app.nodes.get(id);

    if (!node) {
      continue;
    }

    node.group.position.set(
      config.pos[0],
      config.pos[1],
      config.pos[2]
    );

    node.group.scale.setScalar(
      config.scale
    );
  }

  SPECIAL_POINTS.watchHold.set(
    0.0,
    -3.65,
    1.15
  );

  SPECIAL_POINTS.blockedExit.set(
    -3.3,
    -3.75,
    1.75
  );

  clearFlowLinesV7();

  for (
    const edge
    of PORTRAIT_EDGES_V7
  ) {
    createFlowLine(edge);
  }

  app.cameraHome.set(
    0.0,
    6.5,
    24.0
  );

  app.targetHome.set(
    0.0,
    0.0,
    0.0
  );

  app.camera.position.copy(
    app.cameraHome
  );

  app.controls.target.copy(
    app.targetHome
  );

  app.controls.enablePan = false;

  app.controls.minDistance = 20;
  app.controls.maxDistance = 27;

  app.controls.minAzimuthAngle = -0.28;
  app.controls.maxAzimuthAngle = 0.28;

  app.controls.minPolarAngle =
    Math.PI * 0.30;

  app.controls.maxPolarAngle =
    Math.PI * 0.43;

  app.autoRotate = false;
  app.controls.autoRotate = false;

  const autoButton =
    document.getElementById('autoRotateBtn');

  if (autoButton) {
    autoButton.classList.remove('active');
  }

  for (
    const label
    of app.labels
  ) {
    label.el.dataset.node =
      label.id;
  }

  app.controls.update();
  resize();

  app.__portraitTopologyV7 = true;
}

let portraitResizeTimerV7 = null;

window.addEventListener(
  'resize',
  () => {
    clearTimeout(
      portraitResizeTimerV7
    );

    portraitResizeTimerV7 =
      setTimeout(
        () => {
          applyPortraitTopologyV7();
        },
        160
      );
  }
);

setTimeout(
  () => {
    applyPortraitTopologyV7();
  },
  80
);


/* ===== LIVE FLOW REALITY V8 ===== */

const FLOW_REALITY_V8 = {
  previousSnapshot: null,
  lines: [],
  lastTopologyKey: '',
  timer: null
};

function topologyKeyV8() {
  const mobile =
    window.matchMedia('(max-width: 900px)').matches &&
    typeof PORTRAIT_EDGES_V7 !== 'undefined';

  return mobile ? 'portrait-v7' : 'desktop-v6';
}

function activeEdgesV8() {
  const mobile =
    window.matchMedia('(max-width: 900px)').matches &&
    typeof PORTRAIT_EDGES_V7 !== 'undefined';

  return mobile ? PORTRAIT_EDGES_V7 : EDGES;
}

function edgeKeyV8(edge) {
  return `${edge.from}:${edge.to}`;
}

function lineOpacityV8(level) {
  return 0.10 + level * 0.36;
}

function pulseOpacityV8(level) {
  return 0.28 + level * 0.68;
}

function speedFromLevelV8(minSpeed, maxSpeed, level) {
  return minSpeed + (maxSpeed - minSpeed) * level;
}

function clampRateV8(value) {
  return clamp(value, 0, 1);
}

function normalizeRateV8(rate, expectedPeak) {
  const safe = Math.max(0, Number(rate) || 0);
  const peak = Math.max(1, Number(expectedPeak) || 1);

  return clampRateV8(
    Math.log10(1 + safe) / Math.log10(1 + peak)
  );
}

function safeCounterV8(value) {
  return Math.max(0, Number(value) || 0);
}

function counterDeltaV8(next, prev) {
  const a = safeCounterV8(next);
  const b = safeCounterV8(prev);

  return a >= b ? a - b : 0;
}

function ratePerSecondV8(next, prev, dtSeconds) {
  if (!dtSeconds || dtSeconds <= 0) {
    return 0;
  }

  return counterDeltaV8(next, prev) / dtSeconds;
}

function stateCountsV8(sample) {
  const counts = {
    total: 0,
    waiting: 0,
    watch: 0,
    blocked: 0,
    ready: 0
  };

  for (const row of sample || []) {
    counts.total += 1;
    counts[stateKey(row?.decision?.state)] += 1;
  }

  return counts;
}

function captureRealitySnapshotV8() {
  const diag = app.telemetry?.diag || {};
  const discovery = app.telemetry?.discovery || {};
  const live = diag.liveTradeFeed || {};
  const sample = Array.isArray(diag.sample) ? diag.sample : [];

  return {
    ts: Date.now(),
    eventsReceived: safeCounterV8(discovery.eventsReceived),
    tradeEventsDecoded: safeCounterV8(
      live.tradeEventsDecoded ??
      diag.liveTradeFeed?.tradeEventsDecoded
    ),
    holderSnapshots: safeCounterV8(live.holderSnapshots),
    marketSnapshots: safeCounterV8(live.marketSnapshots),
    evaluationCalls: safeCounterV8(live.evaluationCalls),
    freshBacklog: safeCounterV8(diag.bridge?.currentFreshBacklog),
    holderQueueDepth: safeCounterV8(discovery.holderQueueDepth),
    activeEvaluationUsers: safeCounterV8(discovery.activeEvaluationUsers),
    openaiConfigured: !!app.telemetry?.openai?.configured,
    sample,
    counts: stateCountsV8(sample)
  };
}

function rebuildRealityLinesV8() {
  if (!app.scene) {
    return;
  }

  if (typeof clearFlowLinesV7 === 'function') {
    clearFlowLinesV7();
  } else {
    for (const pulse of app.edgePulses || []) {
      app.scene.remove(pulse);

      if (pulse.geometry) {
        pulse.geometry.dispose();
      }

      if (pulse.material) {
        pulse.material.dispose();
      }
    }

    app.edgePulses.length = 0;
  }

  for (const lineEntry of FLOW_REALITY_V8.lines) {
    app.scene.remove(lineEntry.line);

    if (lineEntry.line.geometry) {
      lineEntry.line.geometry.dispose();
    }

    if (lineEntry.line.material) {
      lineEntry.line.material.dispose();
    }
  }

  FLOW_REALITY_V8.lines.length = 0;

  for (const edge of activeEdgesV8()) {
    const start = pointFor(edge.from);
    const end = pointFor(edge.to);
    const via = new THREE.Vector3(...edge.via);

    const curve = curveFromPoints([start, via, end]);
    const pts = curve.getPoints(80);
    const positions = [];

    for (const p of pts) {
      positions.push(p.x, p.y, p.z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: edge.color,
        transparent: true,
        opacity: 0.18
      })
    );

    line.userData = {
      edgeKey: edgeKeyV8(edge)
    };

    app.scene.add(line);
    FLOW_REALITY_V8.lines.push({
      line,
      edgeKey: edgeKeyV8(edge)
    });

    for (let i = 0; i < edge.pulses; i++) {
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshBasicMaterial({
          color: edge.color,
          transparent: true,
          opacity: 0.55
        })
      );

      pulse.userData = {
        curve,
        t: Math.random(),
        speed: edge.speed || 0.18,
        baseSpeed: edge.speed || 0.18,
        edgeKey: edgeKeyV8(edge),
        edgeColor: edge.color
      };

      app.edgePulses.push(pulse);
      app.scene.add(pulse);
    }
  }

  FLOW_REALITY_V8.lastTopologyKey = topologyKeyV8();
}

function computeRealityMapV8(current, previous) {
  const dtSeconds = Math.max(
    0.001,
    (current.ts - previous.ts) / 1000
  );

  const eventsRate =
    ratePerSecondV8(
      current.eventsReceived,
      previous.eventsReceived,
      dtSeconds
    );

  const tradesRate =
    ratePerSecondV8(
      current.tradeEventsDecoded,
      previous.tradeEventsDecoded,
      dtSeconds
    );

  const holderRate =
    ratePerSecondV8(
      current.holderSnapshots,
      previous.holderSnapshots,
      dtSeconds
    );

  const marketRate =
    ratePerSecondV8(
      current.marketSnapshots,
      previous.marketSnapshots,
      dtSeconds
    );

  const evalRate =
    ratePerSecondV8(
      current.evaluationCalls,
      previous.evaluationCalls,
      dtSeconds
    );

  const total = Math.max(1, current.counts.total);
  const readyRatio = current.counts.ready / total;
  const blockedRatio = current.counts.blocked / total;
  const watchRatio = current.counts.watch / total;

  const backlogPenalty =
    clampRateV8(current.freshBacklog / 12);

  const holderQueuePenalty =
    clampRateV8(current.holderQueueDepth / 20);

  const eventLevel =
    normalizeRateV8(eventsRate, 180);

  const tradeLevel =
    normalizeRateV8(tradesRate, 160);

  const holderLevel =
    normalizeRateV8(holderRate, 24);

  const marketLevel =
    normalizeRateV8(marketRate, 40);

  const evalLevel =
    normalizeRateV8(evalRate, 70);

  const advisoryLevel =
    current.openaiConfigured
      ? 0.28 + evalLevel * 0.35
      : 0.10;

  const riskLevel =
    clampRateV8(
      (holderLevel * 0.42) +
      (marketLevel * 0.34) +
      (evalLevel * 0.24) -
      (backlogPenalty * 0.14)
    );

  return {
    'discovery:bootstrap': {
      level: eventLevel,
      speed: speedFromLevelV8(0.10, 0.70, eventLevel),
      pulseOpacity: pulseOpacityV8(eventLevel),
      lineOpacity: lineOpacityV8(eventLevel)
    },

    'bootstrap:core': {
      level: clampRateV8((eventLevel * 0.55) + (tradeLevel * 0.45)),
      speed: speedFromLevelV8(
        0.10,
        0.66,
        clampRateV8((eventLevel * 0.55) + (tradeLevel * 0.45))
      ),
      pulseOpacity: pulseOpacityV8(
        clampRateV8((eventLevel * 0.55) + (tradeLevel * 0.45))
      ),
      lineOpacity: lineOpacityV8(
        clampRateV8((eventLevel * 0.55) + (tradeLevel * 0.45))
      )
    },

    'core:holders': {
      level: clampRateV8(holderLevel - holderQueuePenalty * 0.12),
      speed: speedFromLevelV8(
        0.08,
        0.48,
        clampRateV8(holderLevel - holderQueuePenalty * 0.12)
      ),
      pulseOpacity: pulseOpacityV8(
        clampRateV8(holderLevel - holderQueuePenalty * 0.12)
      ),
      lineOpacity: lineOpacityV8(
        clampRateV8(holderLevel - holderQueuePenalty * 0.12)
      )
    },

    'core:market': {
      level: clampRateV8((tradeLevel * 0.58) + (marketLevel * 0.42)),
      speed: speedFromLevelV8(
        0.08,
        0.56,
        clampRateV8((tradeLevel * 0.58) + (marketLevel * 0.42))
      ),
      pulseOpacity: pulseOpacityV8(
        clampRateV8((tradeLevel * 0.58) + (marketLevel * 0.42))
      ),
      lineOpacity: lineOpacityV8(
        clampRateV8((tradeLevel * 0.58) + (marketLevel * 0.42))
      )
    },

    'holders:risk': {
      level: riskLevel,
      speed: speedFromLevelV8(0.08, 0.44, riskLevel),
      pulseOpacity: pulseOpacityV8(riskLevel),
      lineOpacity: lineOpacityV8(riskLevel)
    },

    'market:risk': {
      level: riskLevel,
      speed: speedFromLevelV8(0.08, 0.46, riskLevel),
      pulseOpacity: pulseOpacityV8(riskLevel),
      lineOpacity: lineOpacityV8(riskLevel)
    },

    'openai:risk': {
      level: advisoryLevel,
      speed: speedFromLevelV8(0.04, 0.18, advisoryLevel),
      pulseOpacity: pulseOpacityV8(advisoryLevel * 0.75),
      lineOpacity: lineOpacityV8(advisoryLevel * 0.70)
    },

    'risk:decision': {
      level: clampRateV8(
        (evalLevel * 0.72) +
        (watchRatio * 0.12) +
        (readyRatio * 0.16) -
        (backlogPenalty * 0.12)
      ),
      speed: speedFromLevelV8(
        0.10,
        0.78,
        clampRateV8(
          (evalLevel * 0.72) +
          (watchRatio * 0.12) +
          (readyRatio * 0.16) -
          (backlogPenalty * 0.12)
        )
      ),
      pulseOpacity: pulseOpacityV8(
        clampRateV8(
          (evalLevel * 0.72) +
          (watchRatio * 0.12) +
          (readyRatio * 0.16) -
          (backlogPenalty * 0.12)
        )
      ),
      lineOpacity: lineOpacityV8(
        clampRateV8(
          (evalLevel * 0.72) +
          (watchRatio * 0.12) +
          (readyRatio * 0.16) -
          (backlogPenalty * 0.12)
        )
      )
    },

    'decision:paper': {
      level: clampRateV8(
        (readyRatio * 0.64) +
        (evalLevel * 0.26) +
        (watchRatio * 0.10)
      ),
      speed: speedFromLevelV8(
        0.05,
        0.42,
        clampRateV8(
          (readyRatio * 0.64) +
          (evalLevel * 0.26) +
          (watchRatio * 0.10)
        )
      ),
      pulseOpacity: pulseOpacityV8(
        clampRateV8(
          (readyRatio * 0.64) +
          (evalLevel * 0.26) +
          (watchRatio * 0.10)
        )
      ),
      lineOpacity: lineOpacityV8(
        clampRateV8(
          (readyRatio * 0.64) +
          (evalLevel * 0.26) +
          (watchRatio * 0.10)
        )
      )
    },

    'paper:execution': {
      level: clampRateV8(readyRatio * 0.30),
      speed: speedFromLevelV8(
        0.02,
        0.10,
        clampRateV8(readyRatio * 0.30)
      ),
      pulseOpacity: pulseOpacityV8(
        clampRateV8(readyRatio * 0.30) * 0.7
      ),
      lineOpacity: lineOpacityV8(
        clampRateV8(readyRatio * 0.30) * 0.7
      )
    }
  };
}

function applyRealityMapV8(map) {
  for (const pulse of app.edgePulses) {
    const cfg = map[pulse.userData.edgeKey];

    if (!cfg) {
      continue;
    }

    pulse.userData.speed = cfg.speed;
    pulse.material.opacity = cfg.pulseOpacity;
  }

  for (const entry of FLOW_REALITY_V8.lines) {
    const cfg = map[entry.edgeKey];

    if (!cfg) {
      continue;
    }

    entry.line.material.opacity = cfg.lineOpacity;
  }
}

function syncRealitySpeedsV8(force = false) {
  if (!app.scene || !app.telemetry) {
    return;
  }

  const nextKey = topologyKeyV8();

  if (
    force ||
    nextKey !== FLOW_REALITY_V8.lastTopologyKey ||
    FLOW_REALITY_V8.lines.length === 0
  ) {
    rebuildRealityLinesV8();
  }

  const current = captureRealitySnapshotV8();

  if (!FLOW_REALITY_V8.previousSnapshot) {
    FLOW_REALITY_V8.previousSnapshot = current;
    return;
  }

  const dtMs =
    current.ts - FLOW_REALITY_V8.previousSnapshot.ts;

  if (!force && dtMs < 900) {
    return;
  }

  const map = computeRealityMapV8(
    current,
    FLOW_REALITY_V8.previousSnapshot
  );

  applyRealityMapV8(map);

  FLOW_REALITY_V8.previousSnapshot = current;
}

function scheduleRealityRebuildV8() {
  clearTimeout(FLOW_REALITY_V8.timer);

  FLOW_REALITY_V8.timer = setTimeout(
    () => {
      syncRealitySpeedsV8(true);
    },
    180
  );
}

window.addEventListener(
  'resize',
  scheduleRealityRebuildV8
);

setTimeout(
  () => {
    syncRealitySpeedsV8(true);
  },
  220
);

setInterval(
  () => {
    syncRealitySpeedsV8(false);
  },
  900
);


/* ===== CENTERED MOBILE SCENE + VISUAL POLISH V9 ===== */

function applyCenteredPortraitV9() {
  if (
    typeof PORTRAIT_LAYOUT_V7 === 'undefined' ||
    typeof PORTRAIT_EDGES_V7 === 'undefined' ||
    !app.scene ||
    !app.controls
  ) {
    return;
  }

  const mobile =
    window.matchMedia('(max-width: 900px)').matches;

  if (!mobile) {
    return;
  }

  const nextLayout = {
    discovery: { pos: [-4.7, 3.15, 0.20], scale: 0.69 },
    bootstrap: { pos: [ 0.0, 3.15,-0.15], scale: 0.69 },
    core:      { pos: [ 4.7, 3.15, 0.15], scale: 0.74 },

    risk:      { pos: [-4.7, 0.45, 0.10], scale: 0.68 },
    market:    { pos: [ 0.0, 0.45,-0.15], scale: 0.68 },
    holders:   { pos: [ 4.7, 0.45, 0.65], scale: 0.68 },

    openai:    { pos: [-4.7,-2.35,-0.75], scale: 0.64 },
    decision:  { pos: [ 0.0,-2.35, 0.00], scale: 0.70 },
    paper:     { pos: [ 4.7,-2.35, 0.10], scale: 0.67 },

    execution: { pos: [ 4.7,-4.65,-0.90], scale: 0.62 }
  };

  for (const [id, cfg] of Object.entries(nextLayout)) {
    if (!PORTRAIT_LAYOUT_V7[id]) {
      continue;
    }

    PORTRAIT_LAYOUT_V7[id].pos = cfg.pos;
    PORTRAIT_LAYOUT_V7[id].scale = cfg.scale;
  }

  const edgeByKey = new Map(
    PORTRAIT_EDGES_V7.map((edge) => [`${edge.from}:${edge.to}`, edge])
  );

  const patchEdge = (key, via, speed, pulses) => {
    const edge = edgeByKey.get(key);
    if (!edge) return;
    edge.via = via;
    if (typeof speed === 'number') edge.speed = speed;
    if (typeof pulses === 'number') edge.pulses = pulses;
  };

  patchEdge('discovery:bootstrap', [-2.35, 3.35, 0.00], 0.28, 3);
  patchEdge('bootstrap:core',      [ 2.35, 3.35, 0.00], 0.27, 3);

  patchEdge('core:holders',        [ 4.75, 1.85, 0.55], 0.22, 2);
  patchEdge('core:market',         [ 2.25, 1.55,-0.20], 0.22, 2);

  patchEdge('holders:risk',        [ 0.00, 0.95, 0.55], 0.20, 3);
  patchEdge('market:risk',         [-2.35, 0.55,-0.05], 0.20, 2);

  patchEdge('openai:risk',         [-4.75,-0.95,-0.45], 0.13, 1);
  patchEdge('risk:decision',       [-2.35,-1.05, 0.05], 0.28, 3);
  patchEdge('decision:paper',      [ 2.35,-2.05, 0.05], 0.20, 2);
  patchEdge('paper:execution',     [ 4.75,-3.55,-0.40], 0.14, 1);

  SPECIAL_POINTS.watchHold.set(
    0.15,
    -3.95,
    1.00
  );

  SPECIAL_POINTS.blockedExit.set(
    -3.55,
    -3.95,
    1.60
  );

  if (typeof applyPortraitTopologyV7 === 'function') {
    applyPortraitTopologyV7();
  }

  app.cameraHome.set(
    0.1,
    5.55,
    21.8
  );

  app.targetHome.set(
    0.0,
    -0.15,
    0.0
  );

  app.camera.position.copy(
    app.cameraHome
  );

  app.controls.target.copy(
    app.targetHome
  );

  app.controls.enablePan = false;

  app.controls.minDistance = 13.5;
  app.controls.maxDistance = 31.0;

  app.controls.minAzimuthAngle = -0.42;
  app.controls.maxAzimuthAngle = 0.42;

  app.controls.minPolarAngle = Math.PI * 0.27;
  app.controls.maxPolarAngle = Math.PI * 0.47;

  app.controls.enableZoom = true;
  app.controls.zoomSpeed = 1.05;
  app.controls.rotateSpeed = 0.72;

  if (app.controls.touches) {
    app.controls.touches.ONE = THREE.TOUCH.ROTATE;
    app.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  for (const label of app.labels) {
    label.offsetY = label.id === 'openai' ? 34 : 30;
  }

  const coreNode = app.nodes.get('core');
  if (coreNode) {
    coreNode.beacon.intensity = 1.45;

    if (!coreNode.group.userData.heroGlowV9) {
      const heroDisk = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 48),
        new THREE.MeshBasicMaterial({
          color: COLORS.green,
          transparent: true,
          opacity: 0.11
        })
      );

      heroDisk.rotation.x = -Math.PI / 2;
      heroDisk.position.set(0, -0.62, 0);
      coreNode.group.add(heroDisk);

      const heroRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.65, 0.03, 12, 72),
        new THREE.MeshBasicMaterial({
          color: COLORS.cyan,
          transparent: true,
          opacity: 0.32
        })
      );

      heroRing.rotation.x = Math.PI / 2;
      heroRing.position.set(0, 0.92, 0);
      coreNode.group.add(heroRing);

      coreNode.group.userData.heroGlowV9 = {
        heroDisk,
        heroRing
      };
    }
  }

  if (!app.scene.userData.v9Atmosphere) {
    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({
        color: 0x103442,
        transparent: true,
        opacity: 0.09,
        depthWrite: false
      })
    );

    glowPlane.position.set(0, 0.6, -5.5);
    app.scene.add(glowPlane);

    const glowPlane2 = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 8),
      new THREE.MeshBasicMaterial({
        color: 0x0c2f3a,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      })
    );

    glowPlane2.position.set(0, -1.6, -4.4);
    app.scene.add(glowPlane2);

    app.scene.userData.v9Atmosphere = {
      glowPlane,
      glowPlane2
    };
  }

  if (app.scene.userData.v9Atmosphere) {
    const a = app.scene.userData.v9Atmosphere;
    a.glowPlane.position.set(0, 0.6, -5.5);
    a.glowPlane2.position.set(0, -1.6, -4.4);
  }

  for (const pulse of app.edgePulses) {
    pulse.scale.setScalar(1.10);

    if (pulse.material) {
      pulse.material.opacity =
        Math.max(
          0.48,
          Number(pulse.material.opacity) || 0
        );
    }
  }

  app.__centeredV9 = true;
  app.controls.update();
  resize();

  if (typeof syncRealitySpeedsV8 === 'function') {
    syncRealitySpeedsV8(true);
  }
}

let centeredV9ResizeTimer = null;

window.addEventListener(
  'resize',
  () => {
    clearTimeout(centeredV9ResizeTimer);

    centeredV9ResizeTimer = setTimeout(
      () => {
        applyCenteredPortraitV9();
      },
      180
    );
  }
);

setTimeout(
  () => {
    applyCenteredPortraitV9();
  },
  140
);


/* ===== PREMIUM DIGITAL TWIN V11 ===== */

const PREMIUM_V11 = {
  selectedRoute: null,
  selectedRouteGlow: null,
  selectedKey: '',
  stage: null,
  orbitals: [],
  pads: [],
  running: false
};

function premiumColorForStateV11(state) {
  const key = stateKey(state);

  return COLORS[key] || COLORS.cyan;
}

function createStageV11() {
  if (!app.scene || PREMIUM_V11.stage) {
    return;
  }

  const stage = new THREE.Group();
  stage.name = 'PremiumDigitalTwinStageV11';

  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(17.8, 11.4),
    new THREE.MeshStandardMaterial({
      color: 0x02080c,
      roughness: 0.58,
      metalness: 0.62,
      transparent: true,
      opacity: 0.56
    })
  );

  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -1.47;
  stage.add(deck);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(15.5, 9.3),
    new THREE.MeshBasicMaterial({
      color: 0x123b46,
      transparent: true,
      opacity: 0.055,
      depthWrite: false
    })
  );

  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -1.44;
  stage.add(glow);

  const framePoints = [
    new THREE.Vector3(-8.8, -1.40, -5.5),
    new THREE.Vector3( 8.8, -1.40, -5.5),
    new THREE.Vector3( 8.8, -1.40,  5.5),
    new THREE.Vector3(-8.8, -1.40,  5.5),
    new THREE.Vector3(-8.8, -1.40, -5.5)
  ];

  const frameGeometry =
    new THREE.BufferGeometry()
      .setFromPoints(framePoints);

  const frame =
    new THREE.Line(
      frameGeometry,
      new THREE.LineBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity: 0.10
      })
    );

  stage.add(frame);

  for (let i = 0; i < 5; i++) {
    const ring =
      new THREE.Mesh(
        new THREE.RingGeometry(
          1.0 + i * 0.72,
          1.015 + i * 0.72,
          96
        ),
        new THREE.MeshBasicMaterial({
          color:
            i % 2 === 0
              ? COLORS.cyan
              : COLORS.green,
          transparent: true,
          opacity: 0.035,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );

    ring.rotation.x =
      -Math.PI / 2;

    ring.position.set(
      0,
      -1.39,
      0
    );

    stage.add(ring);
  }

  app.scene.add(stage);

  PREMIUM_V11.stage =
    stage;
}

function addNodeHardwareV11() {
  for (
    const [id, node]
    of app.nodes
  ) {
    if (
      !node ||
      node.group.userData.premiumV11
    ) {
      continue;
    }

    const cfg =
      node.cfg || {};

    const width =
      cfg.size?.[0] || 3;

    const depth =
      cfg.size?.[2] || 1.8;

    const pad =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          width * 1.22,
          depth * 1.36
        ),
        new THREE.MeshBasicMaterial({
          color: cfg.color || COLORS.cyan,
          transparent: true,
          opacity:
            id === 'core'
              ? 0.075
              : 0.035,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );

    pad.rotation.x =
      -Math.PI / 2;

    pad.position.y =
      -0.56;

    node.group.add(pad);

    PREMIUM_V11.pads.push({
      id,
      mesh: pad,
      baseOpacity:
        id === 'core'
          ? 0.075
          : 0.035
    });

    const railMaterial =
      new THREE.MeshBasicMaterial({
        color: cfg.color || COLORS.cyan,
        transparent: true,
        opacity: 0.24
      });

    const railLeft =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.028,
          0.035,
          depth * 0.94
        ),
        railMaterial.clone()
      );

    railLeft.position.set(
      -width * 0.49,
      -0.49,
      0
    );

    const railRight =
      railLeft.clone();

    railRight.position.x =
      width * 0.49;

    node.group.add(
      railLeft,
      railRight
    );

    const statusLight =
      new THREE.PointLight(
        cfg.color || COLORS.cyan,
        id === 'core' ? 0.85 : 0.18,
        id === 'core' ? 5.5 : 2.8,
        2
      );

    statusLight.position.set(
      0,
      0.85,
      0
    );

    node.group.add(
      statusLight
    );

    node.group.userData.premiumV11 = {
      pad,
      railLeft,
      railRight,
      statusLight
    };
  }
}

function addCoreOrbitalsV11() {
  const core =
    app.nodes.get('core');

  if (
    !core ||
    core.group.userData.orbitalsV11
  ) {
    return;
  }

  const orbitalA =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        2.05,
        0.018,
        8,
        120
      ),
      new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity: 0.19
      })
    );

  orbitalA.rotation.set(
    Math.PI / 2,
    0.18,
    0.10
  );

  orbitalA.position.y =
    0.05;

  const orbitalB =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        2.45,
        0.014,
        8,
        120
      ),
      new THREE.MeshBasicMaterial({
        color: COLORS.green,
        transparent: true,
        opacity: 0.11
      })
    );

  orbitalB.rotation.set(
    Math.PI / 2,
    -0.20,
    0.28
  );

  orbitalB.position.y =
    0.02;

  core.group.add(
    orbitalA,
    orbitalB
  );

  PREMIUM_V11.orbitals.push(
    orbitalA,
    orbitalB
  );

  core.group.userData.orbitalsV11 = true;
}

function removeSelectedRouteV11() {
  if (PREMIUM_V11.selectedRoute) {
    app.scene.remove(
      PREMIUM_V11.selectedRoute
    );

    PREMIUM_V11.selectedRoute.geometry?.dispose();
    PREMIUM_V11.selectedRoute.material?.dispose();

    PREMIUM_V11.selectedRoute =
      null;
  }

  if (PREMIUM_V11.selectedRouteGlow) {
    app.scene.remove(
      PREMIUM_V11.selectedRouteGlow
    );

    PREMIUM_V11.selectedRouteGlow.geometry?.dispose();
    PREMIUM_V11.selectedRouteGlow.material?.dispose();

    PREMIUM_V11.selectedRouteGlow =
      null;
  }
}

function updateSelectedRouteV11() {
  const selected =
    app.selected;

  const key =
    selected?.kind === 'token'
      ? `token:${selected.mint}`
      : `module:${selected?.id || 'core'}`;

  if (
    key === PREMIUM_V11.selectedKey
  ) {
    return;
  }

  PREMIUM_V11.selectedKey =
    key;

  removeSelectedRouteV11();

  if (
    selected?.kind !== 'token'
  ) {
    return;
  }

  const item =
    app.tokenMeshes.get(
      selected.mint
    );

  if (
    !item ||
    !item.curve
  ) {
    return;
  }

  const points =
    item.curve.getPoints(110);

  const color =
    premiumColorForStateV11(
      selected.row?.decision?.state
    );

  const geometry =
    new THREE.BufferGeometry()
      .setFromPoints(points);

  PREMIUM_V11.selectedRoute =
    new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88
      })
    );

  const glowGeometry =
    new THREE.BufferGeometry()
      .setFromPoints(points);

  PREMIUM_V11.selectedRouteGlow =
    new THREE.Line(
      glowGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18
      })
    );

  PREMIUM_V11.selectedRouteGlow.scale.set(
    1.003,
    1.003,
    1.003
  );

  app.scene.add(
    PREMIUM_V11.selectedRouteGlow,
    PREMIUM_V11.selectedRoute
  );
}

function premiumCameraV11() {
  if (
    !app.camera ||
    !app.controls
  ) {
    return;
  }

  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  if (!mobile) {
    return;
  }

  app.cameraHome.set(
    0.15,
    5.2,
    21.2
  );

  app.targetHome.set(
    0,
    -0.15,
    0
  );

  app.camera.position.copy(
    app.cameraHome
  );

  app.controls.target.copy(
    app.targetHome
  );

  app.controls.minDistance =
    12.5;

  app.controls.maxDistance =
    31;

  app.controls.enableZoom =
    true;

  app.controls.zoomSpeed =
    1.15;

  app.controls.rotateSpeed =
    0.68;

  app.controls.minAzimuthAngle =
    -0.46;

  app.controls.maxAzimuthAngle =
    0.46;

  app.controls.minPolarAngle =
    Math.PI * 0.27;

  app.controls.maxPolarAngle =
    Math.PI * 0.48;

  app.controls.autoRotate =
    false;

  app.autoRotate =
    false;

  app.controls.update();
}

function premiumAnimationV11() {
  requestAnimationFrame(
    premiumAnimationV11
  );

  if (!app.scene) {
    return;
  }

  const t =
    performance.now() * 0.001;

  updateSelectedRouteV11();

  for (
    let i = 0;
    i < PREMIUM_V11.orbitals.length;
    i++
  ) {
    const ring =
      PREMIUM_V11.orbitals[i];

    ring.rotation.z +=
      i === 0
        ? 0.0016
        : -0.0011;
  }

  for (
    const entry
    of PREMIUM_V11.pads
  ) {
    const selected =
      app.selected?.kind === 'module' &&
      app.selected?.id === entry.id;

    const targetOpacity =
      selected
        ? entry.baseOpacity * 3.1
        : entry.baseOpacity;

    entry.mesh.material.opacity +=
      (
        targetOpacity -
        entry.mesh.material.opacity
      ) * 0.08;
  }

  for (
    const [id, node]
    of app.nodes
  ) {
    const premium =
      node.group.userData.premiumV11;

    if (!premium) {
      continue;
    }

    const selected =
      app.selected?.kind === 'module' &&
      app.selected?.id === id;

    const base =
      id === 'core'
        ? 0.72
        : 0.16;

    const pulse =
      0.5 +
      0.5 *
      Math.sin(
        t * 2.2 +
        node.group.position.x * 0.25
      );

    premium.statusLight.intensity =
      selected
        ? base * 3.6
        : base + pulse * 0.10;

    if (
      node.topPlate?.material &&
      'emissiveIntensity'
        in node.topPlate.material
    ) {
      node.topPlate.material.emissiveIntensity =
        selected
          ? 1.18
          : id === 'core'
            ? 0.82
            : 0.56;
    }
  }

  for (
    const pulse
    of app.edgePulses || []
  ) {
    const curve =
      pulse.userData?.curve;

    const u =
      Number(
        pulse.userData?.t
      );

    if (
      !curve ||
      !Number.isFinite(u)
    ) {
      continue;
    }

    const ahead =
      curve.getPointAt(
        Math.min(
          1,
          u + 0.012
        )
      );

    pulse.lookAt(
      ahead
    );

    pulse.scale.set(
      0.62,
      0.62,
      2.8
    );
  }

  if (
    PREMIUM_V11.selectedRoute
  ) {
    const pulse =
      0.72 +
      Math.sin(t * 4.4) *
      0.18;

    PREMIUM_V11.selectedRoute.material.opacity =
      pulse;
  }
}

function installPremiumDigitalTwinV11() {
  if (
    PREMIUM_V11.running ||
    !app.scene
  ) {
    return;
  }

  PREMIUM_V11.running =
    true;

  createStageV11();
  addNodeHardwareV11();
  addCoreOrbitalsV11();
  premiumCameraV11();

  premiumAnimationV11();

  resize();
}

setTimeout(
  installPremiumDigitalTwinV11,
  260
);

window.addEventListener(
  'resize',
  () => {
    setTimeout(
      premiumCameraV11,
      160
    );
  }
);


/* ===== CINEMATIC SYSTEM SCALE V12 ===== */

const CINEMATIC_V12 = {
  installed: false,
  basePositions: new Map(),
  baseScales: new Map()
};

function installCinematicSystemV12() {
  if (
    !app.scene ||
    !app.camera ||
    !app.controls ||
    CINEMATIC_V12.installed
  ) {
    return;
  }

  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  if (!mobile) {
    return;
  }

  CINEMATIC_V12.installed = true;

  const scaleX = 1.08;
  const scaleY = 1.18;
  const scaleZ = 1.04;

  for (const [id, node] of app.nodes) {
    if (!node?.group) {
      continue;
    }

    CINEMATIC_V12.basePositions.set(
      id,
      node.group.position.clone()
    );

    CINEMATIC_V12.baseScales.set(
      id,
      node.group.scale.clone()
    );

    const p =
      node.group.position;

    p.x *= scaleX;
    p.y =
      (p.y * scaleY) - 0.35;
    p.z *= scaleZ;

    node.group.scale.multiplyScalar(
      id === 'core'
        ? 1.18
        : 1.10
    );
  }

  const core =
    app.nodes.get('core');

  if (core?.group) {
    core.group.position.y += 0.08;

    const coreGlow =
      new THREE.PointLight(
        COLORS.green,
        1.55,
        7.5,
        2
      );

    coreGlow.position.set(
      0,
      1.25,
      0
    );

    core.group.add(
      coreGlow
    );

    core.group.userData.cinematicGlowV12 =
      coreGlow;
  }

  app.cameraHome.set(
    0.1,
    4.65,
    17.8
  );

  app.targetHome.set(
    0,
    -0.35,
    0
  );

  app.camera.position.copy(
    app.cameraHome
  );

  app.controls.target.copy(
    app.targetHome
  );

  app.controls.minDistance =
    9.8;

  app.controls.maxDistance =
    27;

  app.controls.zoomSpeed =
    1.20;

  app.controls.rotateSpeed =
    0.66;

  app.controls.minAzimuthAngle =
    -0.42;

  app.controls.maxAzimuthAngle =
    0.42;

  app.controls.minPolarAngle =
    Math.PI * 0.26;

  app.controls.maxPolarAngle =
    Math.PI * 0.47;

  app.controls.enableZoom =
    true;

  app.controls.enablePan =
    false;

  for (const label of app.labels) {
    label.offsetY =
      label.id === 'core'
        ? 35
        : 29;
  }

  for (const pulse of app.edgePulses || []) {
    if (!pulse?.geometry) {
      continue;
    }

    pulse.scale.set(
      0.45,
      0.45,
      3.8
    );

    if (pulse.material) {
      pulse.material.opacity =
        Math.max(
          0.68,
          Number(
            pulse.material.opacity
          ) || 0
        );
    }
  }

  for (
    const entry
    of FLOW_REALITY_V8?.lines || []
  ) {
    if (!entry?.line?.material) {
      continue;
    }

    entry.line.material.opacity =
      Math.max(
        0.24,
        Number(
          entry.line.material.opacity
        ) || 0
      );
  }

  app.controls.update();
  resize();

  if (
    typeof syncRealitySpeedsV8 ===
    'function'
  ) {
    syncRealitySpeedsV8(true);
  }
}

function reinforceCinematicPulseV12() {
  if (!CINEMATIC_V12.installed) {
    return;
  }

  const t =
    performance.now() * 0.001;

  for (const pulse of app.edgePulses || []) {
    if (!pulse?.material) {
      continue;
    }

    const activity =
      0.78 +
      Math.sin(
        t * 5 +
        (
          Number(
            pulse.userData?.t
          ) || 0
        ) * 8
      ) * 0.18;

    pulse.material.opacity =
      Math.max(
        0.42,
        Math.min(
          1,
          pulse.material.opacity *
          activity
        )
      );

    pulse.scale.x = 0.42;
    pulse.scale.y = 0.42;
    pulse.scale.z = 3.6;
  }

  requestAnimationFrame(
    reinforceCinematicPulseV12
  );
}

setTimeout(
  () => {
    installCinematicSystemV12();
    reinforceCinematicPulseV12();
  },
  620
);


/* ===== CONTROL ROOM DIGITAL TWIN V14 ===== */

const CONTROL_ROOM_V14 = {
  installed: false,
  selectedId: null,
  selectionRing: null,
  routeLine: null,
  routeGlow: null,
  stage: null,
  nodePads: new Map(),
  pulseTrailsInstalled: new WeakSet()
};

const CONTROL_ROOM_LAYOUT_V14 = {
  discovery: [-4.9, 2.65, 0.35],
  bootstrap: [-1.75, 2.65, -0.15],
  core: [1.75, 1.65, 0.20],

  holders: [4.8, 0.70, 0.55],
  market: [-0.10, 0.05, -0.15],
  risk: [-4.55, 0.05, 0.20],

  openai: [-4.35, -2.35, -0.65],
  decision: [0.15, -2.15, 0.05],
  paper: [3.75, -2.25, 0.15],

  execution: [4.35, -4.45, -0.85]
};

const CONTROL_ROOM_SCALE_V14 = {
  discovery: 0.78,
  bootstrap: 0.78,
  core: 0.94,

  holders: 0.78,
  market: 0.78,
  risk: 0.78,

  openai: 0.70,
  decision: 0.80,
  paper: 0.75,

  execution: 0.66
};

function disposeObjectV14(object) {
  if (!object) {
    return;
  }

  if (object.parent) {
    object.parent.remove(object);
  }

  object.geometry?.dispose?.();

  if (Array.isArray(object.material)) {
    for (const material of object.material) {
      material?.dispose?.();
    }
  } else {
    object.material?.dispose?.();
  }
}

function installStageV14() {
  if (!app.scene || CONTROL_ROOM_V14.stage) {
    return;
  }

  const stage = new THREE.Group();
  stage.name = 'ControlRoomStageV14';

  const platform = new THREE.Mesh(
    new THREE.PlaneGeometry(17.2, 11.6),
    new THREE.MeshStandardMaterial({
      color: 0x02080c,
      metalness: 0.48,
      roughness: 0.72,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    })
  );

  platform.rotation.x = -Math.PI / 2;
  platform.position.y = -1.48;

  stage.add(platform);

  const centerGlow = new THREE.Mesh(
    new THREE.CircleGeometry(4.7, 96),
    new THREE.MeshBasicMaterial({
      color: 0x1b6f73,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );

  centerGlow.rotation.x = -Math.PI / 2;
  centerGlow.position.set(0.5, -1.43, 0.1);

  stage.add(centerGlow);

  const rings = [
    { radius: 2.1, color: COLORS.green, opacity: 0.055 },
    { radius: 3.4, color: COLORS.cyan, opacity: 0.035 },
    { radius: 4.8, color: COLORS.blue, opacity: 0.020 }
  ];

  for (const entry of rings) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        entry.radius,
        entry.radius + 0.018,
        128
      ),
      new THREE.MeshBasicMaterial({
        color: entry.color,
        transparent: true,
        opacity: entry.opacity,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0.5, -1.40, 0.1);

    stage.add(ring);
  }

  app.scene.add(stage);

  CONTROL_ROOM_V14.stage = stage;
}

function applyNodeLayoutV14() {
  for (const [id, position] of Object.entries(CONTROL_ROOM_LAYOUT_V14)) {
    const node = app.nodes.get(id);

    if (!node?.group) {
      continue;
    }

    node.group.position.set(
      position[0],
      position[1],
      position[2]
    );

    const scale =
      CONTROL_ROOM_SCALE_V14[id] ?? 0.76;

    node.group.scale.setScalar(scale);
  }
}

function installNodePadsV14() {
  for (const [id, node] of app.nodes) {
    if (!node?.group || CONTROL_ROOM_V14.nodePads.has(id)) {
      continue;
    }

    const width =
      Number(node.cfg?.size?.[0]) || 3.1;

    const depth =
      Number(node.cfg?.size?.[2]) || 1.8;

    const color =
      Number(node.cfg?.color) || COLORS.cyan;

    const group = new THREE.Group();
    group.name = `NodePadV14_${id}`;

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 1.28,
        depth * 1.42
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: id === 'core' ? 0.085 : 0.030,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );

    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.58;

    group.add(glow);

    const frameGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        width * 1.14,
        0.035,
        depth * 1.22
      )
    );

    const frame = new THREE.LineSegments(
      frameGeometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: id === 'core' ? 0.28 : 0.11
      })
    );

    frame.position.y = -0.54;

    group.add(frame);

    node.group.add(group);

    CONTROL_ROOM_V14.nodePads.set(id, {
      group,
      glow,
      frame,
      baseOpacity: id === 'core' ? 0.085 : 0.030
    });
  }
}

function installCoreVisualV14() {
  const core = app.nodes.get('core');

  if (!core?.group || core.group.userData.controlRoomCoreV14) {
    return;
  }

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      1.75,
      0.024,
      10,
      128
    ),
    new THREE.MeshBasicMaterial({
      color: COLORS.green,
      transparent: true,
      opacity: 0.30
    })
  );

  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.83;

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      1.28,
      0.018,
      10,
      128
    ),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.25
    })
  );

  innerRing.rotation.x = Math.PI / 2;
  innerRing.rotation.z = 0.34;
  innerRing.position.y = 0.85;

  const verticalLight = new THREE.PointLight(
    COLORS.green,
    1.15,
    7,
    2
  );

  verticalLight.position.set(0, 1.4, 0);

  core.group.add(
    outerRing,
    innerRing,
    verticalLight
  );

  core.group.userData.controlRoomCoreV14 = {
    outerRing,
    innerRing,
    verticalLight
  };
}

function installSelectionRingV14() {
  if (CONTROL_ROOM_V14.selectionRing) {
    return;
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(
      0.82,
      0.86,
      96
    ),
    new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );

  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.52;

  app.scene.add(ring);

  CONTROL_ROOM_V14.selectionRing = ring;
}

function updateSelectionV14(time) {
  const ring =
    CONTROL_ROOM_V14.selectionRing;

  if (!ring) {
    return;
  }

  const selected =
    app.selected;

  if (selected?.kind === 'module') {
    const node =
      app.nodes.get(selected.id);

    if (!node?.group) {
      ring.material.opacity = 0;
      return;
    }

    const position =
      new THREE.Vector3();

    node.group.getWorldPosition(position);

    ring.position.set(
      position.x,
      -1.37,
      position.z
    );

    const scale =
      selected.id === 'core'
        ? 2.15
        : 1.60;

    ring.scale.setScalar(
      scale *
      (
        1 +
        Math.sin(time * 3.2) * 0.035
      )
    );

    ring.material.color.setHex(
      selected.id === 'core'
        ? COLORS.green
        : COLORS.cyan
    );

    ring.material.opacity =
      0.18 +
      Math.sin(time * 3.2) * 0.04;

    return;
  }

  ring.material.opacity = 0;
}

function removeRouteV14() {
  disposeObjectV14(
    CONTROL_ROOM_V14.routeLine
  );

  disposeObjectV14(
    CONTROL_ROOM_V14.routeGlow
  );

  CONTROL_ROOM_V14.routeLine = null;
  CONTROL_ROOM_V14.routeGlow = null;
}

function updateTokenRouteV14() {
  const selected =
    app.selected;

  const selectedId =
    selected?.kind === 'token'
      ? selected.mint
      : null;

  if (
    selectedId ===
    CONTROL_ROOM_V14.selectedId
  ) {
    return;
  }

  CONTROL_ROOM_V14.selectedId =
    selectedId;

  removeRouteV14();

  if (!selectedId) {
    return;
  }

  const token =
    app.tokenMeshes.get(selectedId);

  if (!token?.curve) {
    return;
  }

  const points =
    token.curve.getPoints(120);

  const color =
    COLORS[
      stateKey(
        selected?.row?.decision?.state
      )
    ] || COLORS.cyan;

  const glowGeometry =
    new THREE.BufferGeometry()
      .setFromPoints(points);

  const lineGeometry =
    new THREE.BufferGeometry()
      .setFromPoints(points);

  const glow = new THREE.Line(
    glowGeometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15
    })
  );

  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.88
    })
  );

  app.scene.add(
    glow,
    line
  );

  CONTROL_ROOM_V14.routeGlow = glow;
  CONTROL_ROOM_V14.routeLine = line;
}

function installPulseTrailsV14() {
  for (const pulse of app.edgePulses || []) {
    if (
      !pulse ||
      CONTROL_ROOM_V14.pulseTrailsInstalled.has(pulse)
    ) {
      continue;
    }

    CONTROL_ROOM_V14.pulseTrailsInstalled.add(pulse);

    const color =
      pulse.material?.color?.getHex?.() ||
      COLORS.cyan;

    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.025,
        0.070,
        0.72,
        10,
        1,
        true
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );

    trail.rotation.x =
      Math.PI / 2;

    trail.position.z =
      -0.34;

    pulse.add(trail);

    pulse.userData.trailV14 =
      trail;
  }
}

function updatePulseTrailsV14(time) {
  installPulseTrailsV14();

  for (const pulse of app.edgePulses || []) {
    const curve =
      pulse.userData?.curve;

    const progress =
      Number(
        pulse.userData?.t
      );

    if (
      !curve ||
      !Number.isFinite(progress)
    ) {
      continue;
    }

    const current =
      curve.getPointAt(
        clamp(progress, 0, 1)
      );

    const next =
      curve.getPointAt(
        clamp(
          progress + 0.008,
          0,
          1
        )
      );

    pulse.position.copy(current);
    pulse.lookAt(next);

    const activity =
      0.82 +
      Math.sin(
        time * 7 +
        progress * 16
      ) * 0.18;

    pulse.scale.set(
      0.60 * activity,
      0.60 * activity,
      1.0
    );

    if (pulse.material) {
      pulse.material.opacity =
        Math.max(
          0.42,
          Number(
            pulse.material.opacity
          ) || 0.42
        );
    }
  }
}

function updateNodeActivityV14(time) {
  for (const [id, node] of app.nodes) {
    const pad =
      CONTROL_ROOM_V14.nodePads.get(id);

    if (!pad) {
      continue;
    }

    const selected =
      app.selected?.kind === 'module' &&
      app.selected?.id === id;

    const targetOpacity =
      selected
        ? pad.baseOpacity * 3.2
        : pad.baseOpacity;

    pad.glow.material.opacity +=
      (
        targetOpacity -
        pad.glow.material.opacity
      ) * 0.07;

    if (node.topPlate?.material) {
      const selectedBoost =
        selected ? 0.40 : 0;

      const coreBoost =
        id === 'core'
          ? 0.24
          : 0;

      const pulse =
        Math.sin(
          time * 2.1 +
          node.group.position.x
        ) * 0.08;

      if (
        'emissiveIntensity'
        in node.topPlate.material
      ) {
        node.topPlate.material.emissiveIntensity =
          0.48 +
          selectedBoost +
          coreBoost +
          pulse;
      }
    }
  }

  const core =
    app.nodes.get('core');

  const visuals =
    core?.group?.userData
      ?.controlRoomCoreV14;

  if (visuals) {
    visuals.outerRing.rotation.z += 0.0020;
    visuals.innerRing.rotation.z -= 0.0013;

    visuals.outerRing.material.opacity =
      0.24 +
      Math.sin(time * 1.8) * 0.045;

    visuals.verticalLight.intensity =
      1.05 +
      Math.sin(time * 2.0) * 0.14;
  }
}

function applyCameraV14() {
  if (
    !app.camera ||
    !app.controls
  ) {
    return;
  }

  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  if (!mobile) {
    return;
  }

  app.cameraHome.set(
    0.3,
    5.15,
    19.2
  );

  app.targetHome.set(
    0.15,
    -0.25,
    0
  );

  app.camera.position.copy(
    app.cameraHome
  );

  app.controls.target.copy(
    app.targetHome
  );

  app.controls.enablePan = false;
  app.controls.enableZoom = true;

  app.controls.minDistance = 10.5;
  app.controls.maxDistance = 28;

  app.controls.zoomSpeed = 1.10;
  app.controls.rotateSpeed = 0.62;

  app.controls.minAzimuthAngle = -0.42;
  app.controls.maxAzimuthAngle = 0.42;

  app.controls.minPolarAngle =
    Math.PI * 0.27;

  app.controls.maxPolarAngle =
    Math.PI * 0.47;

  app.controls.autoRotate = false;
  app.autoRotate = false;

  app.controls.update();
}

function controlRoomLoopV14() {
  requestAnimationFrame(
    controlRoomLoopV14
  );

  if (
    !CONTROL_ROOM_V14.installed
  ) {
    return;
  }

  const time =
    performance.now() * 0.001;

  updateSelectionV14(time);
  updateTokenRouteV14();
  updatePulseTrailsV14(time);
  updateNodeActivityV14(time);

  if (CONTROL_ROOM_V14.routeLine) {
    CONTROL_ROOM_V14.routeLine.material.opacity =
      0.74 +
      Math.sin(time * 4.2) * 0.14;
  }
}

function installControlRoomV14() {
  if (
    CONTROL_ROOM_V14.installed ||
    !app.scene ||
    !app.nodes?.size
  ) {
    return;
  }

  CONTROL_ROOM_V14.installed = true;

  installStageV14();
  applyNodeLayoutV14();
  installNodePadsV14();
  installCoreVisualV14();
  installSelectionRingV14();
  applyCameraV14();

  if (
    typeof syncRealitySpeedsV8 ===
    'function'
  ) {
    syncRealitySpeedsV8(true);
  }

  resize();

  controlRoomLoopV14();
}

setTimeout(
  installControlRoomV14,
  850
);

window.addEventListener(
  'resize',
  () => {
    setTimeout(
      () => {
        applyCameraV14();
        resize();
      },
      180
    );
  }
);


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
    index < 3;
    index++
  ) {
    const packet =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.055,
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
  requestAnimationFrame(
    mf20Animate
  );

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
        0.26 +
        speed * 0.34
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
        ? 0.11
        : id === 'core'
          ? 0.075
          : 0.025;

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

setTimeout(
  mf20Install,
  1250
);

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


/* ===== MEMEFLOW CLEANUP V21 ===== */

const MF21 = {
  installed: false
};

function mf21HideLegacyGeometry() {
  for (const [id, node] of app.nodes) {
    if (!node?.group) {
      continue;
    }

    node.group.traverse(object => {
      if (
        object.name?.startsWith('MF20_') ||
        object.parent?.name?.startsWith('MF20_')
      ) {
        return;
      }

      if (
        object.isLine ||
        object.isLineSegments ||
        object.isPoints
      ) {
        object.visible = false;
      }

      if (
        object.isMesh &&
        !object.parent?.name?.startsWith('MF20_')
      ) {
        if (object.material) {
          const materials =
            Array.isArray(object.material)
              ? object.material
              : [object.material];

          for (const material of materials) {
            material.transparent = true;
            material.opacity = 0;
            material.depthWrite = false;
          }
        }
      }
    });
  }
}

function mf21RefineHardware() {
  if (
    typeof MF20 === 'undefined' ||
    !MF20.hardware
  ) {
    return;
  }

  for (const [id, hardware] of MF20.hardware) {
    if (!hardware?.group) {
      continue;
    }

    const core = id === 'core';

    hardware.group.scale.setScalar(
      core ? 1.09 : 1.05
    );

    if (hardware.underside?.material) {
      hardware.underside.material.opacity =
        core ? 0.055 : 0.018;
    }
  }
}

function mf21RefineCamera(reset = true) {
  if (
    !app.camera ||
    !app.controls
  ) {
    return;
  }

  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  app.camera.fov =
    mobile ? 39 : 37;

  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    0,
    mobile ? 7.35 : 6.85,
    mobile ? 15.9 : 15.0
  );

  app.targetHome.set(
    -0.35,
    -0.35,
    0.85
  );

  if (reset) {
    app.camera.position.copy(
      app.cameraHome
    );

    app.controls.target.copy(
      app.targetHome
    );
  }

  app.controls.minDistance = 9.2;
  app.controls.maxDistance = 25;

  app.controls.update();
}

function mf21CleanLabels() {
  const labels =
    document.querySelectorAll(
      '.node-label'
    );

  labels.forEach(label => {
    label.classList.add(
      'mf21-label'
    );
  });
}

function mf21Install() {
  if (
    MF21.installed ||
    typeof MF20 === 'undefined' ||
    !MF20.installed
  ) {
    return;
  }

  MF21.installed = true;

  mf21HideLegacyGeometry();
  mf21RefineHardware();
  mf21RefineCamera(true);
  mf21CleanLabels();

  resize();
}

setTimeout(
  mf21Install,
  1900
);

window.addEventListener(
  'resize',
  () => {
    if (!MF21.installed) {
      return;
    }

    setTimeout(
      () => {
        mf21HideLegacyGeometry();
        mf21RefineCamera(false);
        resize();
      },
      180
    );
  }
);


/* ===== MEMEFLOW FINAL POLISH V22 ===== */

const MF22 = {
  installed: false,
  lastFrame: performance.now()
};

const MF22_HEIGHT = {
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

function mf22RefineModules() {
  if (
    typeof MF20 === 'undefined' ||
    !MF20.hardware
  ) {
    return;
  }

  for (
    const [id, hardware]
    of MF20.hardware
  ) {
    const node =
      app.nodes.get(id);

    if (!node?.group) {
      continue;
    }

    const position =
      MF20_LAYOUT[id];

    if (position) {
      node.group.position.set(
        position[0],
        MF22_HEIGHT[id] ?? 0,
        position[2]
      );
    }

    if (hardware?.group) {
      hardware.group.scale.setScalar(
        id === 'core'
          ? 1.14
          : 1.03
      );
    }

    if (
      hardware?.underside?.material
    ) {
      hardware.underside.material.opacity =
        id === 'core'
          ? 0.040
          : 0.012;
    }

    if (
      hardware?.display?.material
    ) {
      hardware.display.material.opacity =
        id === 'core'
          ? 1.0
          : 0.94;
    }
  }
}

function mf22RefinePipes() {
  if (
    typeof MF20 === 'undefined'
  ) {
    return;
  }

  for (
    const route
    of MF20.pipes || []
  ) {
    if (
      route?.pipe &&
      route?.curve
    ) {
      route.pipe.geometry?.dispose?.();

      route.pipe.geometry =
        new THREE.TubeGeometry(
          route.curve,
          72,
          0.026,
          8,
          false
        );

      if (route.pipe.material) {
        route.pipe.material.opacity =
          0.78;

        route.pipe.material.emissiveIntensity =
          0.82;

        route.pipe.material.roughness =
          0.24;
      }
    }

    if (
      route?.halo &&
      route?.curve
    ) {
      route.halo.geometry?.dispose?.();

      route.halo.geometry =
        new THREE.TubeGeometry(
          route.curve,
          72,
          0.047,
          8,
          false
        );

      if (route.halo.material) {
        route.halo.material.opacity =
          0.018;
      }
    }
  }
}

function mf22RefinePackets() {
  if (
    typeof MF20 === 'undefined'
  ) {
    return;
  }

  const packets =
    MF20.packets || [];

  packets.forEach(
    (packet, index) => {
      const slot =
        index % 3;

      packet.visible =
        slot !== 2;

      if (
        packet.material
      ) {
        packet.material.opacity =
          0.76;
      }
    }
  );
}

function mf22RefineCore() {
  if (
    typeof MF20 === 'undefined' ||
    !MF20.coreFx
  ) {
    return;
  }

  const fx =
    MF20.coreFx;

  if (fx.orb) {
    fx.orb.scale.setScalar(
      0.78
    );

    if (fx.orb.material) {
      fx.orb.material.opacity =
        0.22;
    }
  }

  if (
    Array.isArray(fx.rings)
  ) {
    const radii =
      [1.04, 1.34, 1.62];

    fx.rings.forEach(
      (ring, index) => {
        if (!ring) {
          return;
        }

        ring.geometry?.dispose?.();

        ring.geometry =
          new THREE.TorusGeometry(
            radii[index] ||
              1.3,
            0.010,
            8,
            96
          );

        if (ring.material) {
          ring.material.opacity =
            [0.14, 0.075, 0.035][index] ||
            0.04;
        }
      }
    );
  }

  if (fx.light) {
    fx.light.intensity =
      0.32;

    fx.light.distance =
      4.0;
  }
}

function mf22Camera(
  reset = true
) {
  if (
    !app.camera ||
    !app.controls
  ) {
    return;
  }

  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  app.camera.fov =
    mobile
      ? 37
      : 35;

  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    0,
    mobile
      ? 6.70
      : 6.35,
    mobile
      ? 15.10
      : 14.45
  );

  app.targetHome.set(
    -0.30,
    -0.22,
    0.78
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
    8.8;

  app.controls.maxDistance =
    24;

  app.controls.zoomSpeed =
    1.02;

  app.controls.rotateSpeed =
    0.50;

  app.controls.minAzimuthAngle =
    -0.46;

  app.controls.maxAzimuthAngle =
    0.46;

  app.controls.minPolarAngle =
    Math.PI * 0.235;

  app.controls.maxPolarAngle =
    Math.PI * 0.455;

  app.controls.autoRotate =
    false;

  app.autoRotate =
    false;

  app.controls.update();
}

function mf22AnimationLoop(now) {
  requestAnimationFrame(
    mf22AnimationLoop
  );

  if (
    !MF22.installed ||
    typeof MF20 === 'undefined'
  ) {
    return;
  }

  const seconds =
    now * 0.001;

  const packets =
    MF20.packets || [];

  packets.forEach(
    (packet, index) => {
      const slot =
        index % 3;

      if (slot === 2) {
        packet.visible =
          false;

        return;
      }

      packet.visible =
        true;

      const data =
        packet.userData?.mf20;

      const phase =
        Number(
          data?.progress || 0
        );

      const pulse =
        0.43 +
        Math.sin(
          seconds * 7 +
          phase * 11
        ) * 0.035;

      packet.scale.setScalar(
        pulse
      );
    }
  );

  if (
    MF20.coreFx?.orb
  ) {
    MF20.coreFx.orb.scale.setScalar(
      0.78 +
      Math.sin(
        seconds * 1.7
      ) * 0.015
    );
  }
}

function mf22Install() {
  if (
    MF22.installed ||
    typeof MF20 === 'undefined' ||
    !MF20.installed
  ) {
    return;
  }

  MF22.installed =
    true;

  mf22RefineModules();
  mf22RefinePipes();
  mf22RefinePackets();
  mf22RefineCore();
  mf22Camera(true);

  resize();

  const resetButton =
    [...document.querySelectorAll(
      'button'
    )]
      .find(
        button =>
          /reset\s*view/i.test(
            button.textContent || ''
          )
      );

  if (resetButton) {
    resetButton.addEventListener(
      'click',
      () => {
        setTimeout(
          () => {
            mf22RefineModules();
            mf22Camera(true);
            resize();
          },
          35
        );
      }
    );
  }

  requestAnimationFrame(
    mf22AnimationLoop
  );
}

setTimeout(
  mf22Install,
  2150
);

window.addEventListener(
  'resize',
  () => {
    if (!MF22.installed) {
      return;
    }

    setTimeout(
      () => {
        mf22RefineModules();
        mf22Camera(false);
        resize();
      },
      180
    );
  }
);


/* ===== MEMEFLOW DATA PULSES V23 ===== */

const MF23 = {
  installed: false,
  pulses: [],
  lastFrame: performance.now()
};

function mf23DisableOldPackets() {
  if (
    typeof MF20 === 'undefined'
  ) {
    return;
  }

  for (
    const packet
    of MF20.packets || []
  ) {
    packet.visible = false;

    packet.scale.setScalar(0.001);

    if (packet.material) {
      packet.material.opacity = 0;
      packet.material.depthWrite = false;
    }
  }
}

function mf23CreatePulse(route, index) {
  const color =
    route?.pipe?.material?.color
      ?.getHex?.() ||
    0x54dfff;

  const group =
    new THREE.Group();

  group.name =
    'MF23_DATA_PULSE';

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.026,
        8,
        6
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending
      })
    );

  group.add(head);

  const trail =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.010,
        0.026,
        0.22,
        7,
        1,
        true
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending
      })
    );

  trail.rotation.x =
    Math.PI / 2;

  trail.position.z =
    -0.105;

  group.add(trail);

  group.userData.mf23 = {
    route,
    progress:
      (
        index * 0.47 +
        Math.random() * 0.12
      ) % 1
  };

  app.scene.add(group);

  MF23.pulses.push(group);
}

function mf23BuildPulses() {
  if (
    typeof MF20 === 'undefined'
  ) {
    return;
  }

  for (
    const route
    of MF20.pipes || []
  ) {
    mf23CreatePulse(
      route,
      0
    );

    /*
      Second pulse only on longer routes.
    */
    const length =
      route.curve
        ?.getLength?.() || 0;

    if (length > 4.5) {
      mf23CreatePulse(
        route,
        1
      );
    }
  }
}

function mf23RouteSpeed(route) {
  const source =
    (app.edgePulses || [])
      .find(pulse => {
        const key =
          String(
            pulse?.userData?.edgeKey ||
            ''
          ).toLowerCase();

        return (
          key.includes(
            route.from
          ) &&
          key.includes(
            route.to
          )
        );
      });

  const raw =
    Number(
      source?.userData?.speed
    );

  if (
    Number.isFinite(raw) &&
    raw > 0
  ) {
    return Math.max(
      0.32,
      Math.min(
        2.20,
        raw
      )
    );
  }

  return 0.72;
}

function mf23RefineCore() {
  if (
    typeof MF20 === 'undefined' ||
    !MF20.coreFx
  ) {
    return;
  }

  const fx =
    MF20.coreFx;

  if (fx.orb) {
    fx.orb.scale.setScalar(
      0.54
    );

    if (fx.orb.material) {
      fx.orb.material.opacity =
        0.17;
    }
  }

  if (fx.light) {
    fx.light.intensity =
      0.24;

    fx.light.distance =
      3.2;
  }

  if (
    Array.isArray(fx.rings)
  ) {
    const opacity =
      [0.11, 0.055, 0.025];

    fx.rings.forEach(
      (ring, index) => {
        if (
          ring?.material
        ) {
          ring.material.opacity =
            opacity[index] ||
            0.025;
        }
      }
    );
  }
}

function mf23RefineCamera(
  reset = true
) {
  if (
    !app.camera ||
    !app.controls
  ) {
    return;
  }

  const mobile =
    window.matchMedia(
      '(max-width: 900px)'
    ).matches;

  app.camera.fov =
    mobile ? 38 : 36;

  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    0,
    mobile ? 7.15 : 6.60,
    mobile ? 15.20 : 14.50
  );

  app.targetHome.set(
    -0.25,
    -0.10,
    0.75
  );

  if (reset) {
    app.camera.position.copy(
      app.cameraHome
    );

    app.controls.target.copy(
      app.targetHome
    );
  }

  app.controls.update();
}

function mf23Animate(now) {
  requestAnimationFrame(
    mf23Animate
  );

  if (!MF23.installed) {
    return;
  }

  /*
    MF20 still owns its old RAF loop.
    Force its spheres invisible every frame.
  */
  mf23DisableOldPackets();

  const delta =
    Math.min(
      0.05,
      Math.max(
        0,
        (now - MF23.lastFrame) /
        1000
      )
    );

  MF23.lastFrame =
    now;

  for (
    const pulse
    of MF23.pulses
  ) {
    const data =
      pulse.userData.mf23;

    const route =
      data.route;

    const speed =
      mf23RouteSpeed(route);

    data.progress +=
      delta *
      (
        0.52 +
        speed * 0.42
      );

    if (
      data.progress >= 1
    ) {
      data.progress -= 1;
    }

    const point =
      route.curve.getPointAt(
        data.progress
      );

    const next =
      route.curve.getPointAt(
        Math.min(
          1,
          data.progress + 0.012
        )
      );

    pulse.position.copy(
      point
    );

    pulse.lookAt(next);
  }
}

function mf23Install() {
  if (
    MF23.installed ||
    typeof MF20 === 'undefined' ||
    !MF20.installed
  ) {
    return;
  }

  MF23.installed = true;

  mf23DisableOldPackets();
  mf23BuildPulses();
  mf23RefineCore();
  mf23RefineCamera(true);

  resize();

  const reset =
    [...document.querySelectorAll(
      'button'
    )]
      .find(
        button =>
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
            mf23RefineCamera(true);
            resize();
          },
          35
        );
      }
    );
  }

  requestAnimationFrame(
    mf23Animate
  );
}

setTimeout(
  mf23Install,
  2400
);


/* ===== LEGACY PARTICLE CLEANUP V26 ===== */

const MF26 = {
  installed: false
};

function mf26HasAncestorName(object, prefix) {
  let current = object;

  while (current) {
    if (
      typeof current.name === 'string' &&
      current.name.includes(prefix)
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function mf26IsProtected(object) {
  return (
    mf26HasAncestorName(
      object,
      'MF23_DATA_PULSE'
    ) ||
    mf26HasAncestorName(
      object,
      'MF20_CORE_FX'
    ) ||
    mf26HasAncestorName(
      object,
      'MF20_HARDWARE_'
    )
  );
}

function mf26HideLegacyParticles() {
  if (!app?.scene) {
    return;
  }

  const legacyGeometryTypes =
    new Set([
      'SphereGeometry',
      'SphereBufferGeometry',
      'OctahedronGeometry',
      'DodecahedronGeometry'
    ]);

  app.scene.traverse(object => {
    if (
      !object ||
      !object.isMesh ||
      mf26IsProtected(object)
    ) {
      return;
    }

    const geometryType =
      object.geometry?.type || '';

    if (
      legacyGeometryTypes.has(
        geometryType
      )
    ) {
      object.visible = false;

      if (object.material) {
        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        for (const material of materials) {
          material.transparent = true;
          material.opacity = 0;
          material.depthWrite = false;
        }
      }
    }
  });
}

function mf26Install() {
  if (MF26.installed) {
    return;
  }

  MF26.installed = true;

  mf26HideLegacyParticles();

  /*
    Old animation loops may recreate or re-enable
    legacy particles. Keep them suppressed.
  */
  setInterval(
    mf26HideLegacyParticles,
    250
  );
}

setTimeout(
  mf26Install,
  2800
);


/* ===== MEMEFLOW CLICKABLE HARDWARE V27 ===== */

const MF27 = {
  installed: false,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  hitTargets: [],
  pointerDown: null,
  selectedId: null
};

function mf27ModuleLabel(id) {
  const labels = {
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

  return labels[id] || id;
}

function mf27AnnotateObject(object, id) {
  if (!object) {
    return;
  }

  object.userData.mf27ModuleId = id;
  object.userData.moduleId = id;
  object.userData.nodeId = id;
  object.userData.kind = 'module';
  object.userData.selectable = true;
}

function mf27RegisterWithExistingLists(hit) {
  const possibleLists = [
    'pickables',
    'clickTargets',
    'raycastTargets',
    'interactables',
    'selectables'
  ];

  for (const key of possibleLists) {
    const list = app?.[key];

    if (
      Array.isArray(list) &&
      !list.includes(hit)
    ) {
      list.push(hit);
    }
  }
}

function mf27CreateHitTarget(id, hardware) {
  const node = app.nodes.get(id);

  if (
    !node?.group ||
    !hardware?.group
  ) {
    return;
  }

  mf27AnnotateObject(
    hardware.group,
    id
  );

  hardware.group.traverse(object => {
    mf27AnnotateObject(
      object,
      id
    );
  });

  const box =
    new THREE.Box3()
      .setFromObject(
        hardware.group
      );

  const size =
    new THREE.Vector3();

  box.getSize(size);

  const width =
    Math.max(
      1.8,
      size.x * 1.06
    );

  const depth =
    Math.max(
      1.25,
      size.z * 1.06
    );

  const hit =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        0.42,
        depth
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.001,
        depthWrite: false,
        colorWrite: false
      })
    );

  hit.name =
    'MF27_HIT_' + id;

  hit.position.y =
    0.03;

  mf27AnnotateObject(
    hit,
    id
  );

  hardware.group.add(hit);

  MF27.hitTargets.push(hit);

  mf27RegisterWithExistingLists(
    hit
  );
}

function mf27PointerFromEvent(event) {
  const canvas =
    app.renderer?.domElement ||
    document.getElementById(
      'systemCanvas'
    );

  if (!canvas) {
    return false;
  }

  const rect =
    canvas.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return false;
  }

  MF27.pointer.x =
    (
      (
        event.clientX -
        rect.left
      ) /
      rect.width
    ) * 2 - 1;

  MF27.pointer.y =
    -(
      (
        event.clientY -
        rect.top
      ) /
      rect.height
    ) * 2 + 1;

  return true;
}

function mf27HitTest(event) {
  if (
    !mf27PointerFromEvent(event) ||
    !app.camera
  ) {
    return null;
  }

  MF27.raycaster.setFromCamera(
    MF27.pointer,
    app.camera
  );

  const hits =
    MF27.raycaster.intersectObjects(
      MF27.hitTargets,
      false
    );

  if (!hits.length) {
    return null;
  }

  const object =
    hits[0].object;

  const id =
    object?.userData?.mf27ModuleId ||
    object?.userData?.moduleId ||
    object?.userData?.nodeId;

  if (!id) {
    return null;
  }

  return {
    id,
    object,
    intersection: hits[0]
  };
}

function mf27FindLabel(id) {
  const expected =
    mf27ModuleLabel(id)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

  return [
    ...document.querySelectorAll(
      '.node-label'
    )
  ].find(label => {
    const datasetId =
      label.dataset?.nodeId ||
      label.dataset?.moduleId ||
      label.dataset?.id;

    if (datasetId === id) {
      return true;
    }

    const text =
      String(
        label.textContent || ''
      )
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    return (
      text === expected ||
      text.includes(expected)
    );
  }) || null;
}

function mf27TryFunction(owner, names, id, node) {
  if (!owner) {
    return false;
  }

  for (const name of names) {
    const fn = owner[name];

    if (
      typeof fn !== 'function'
    ) {
      continue;
    }

    try {
      fn.call(
        owner,
        id,
        node
      );

      return true;
    } catch (error) {
      try {
        fn.call(
          owner,
          node
        );

        return true;
      } catch (_) {}
    }
  }

  return false;
}

function mf27SelectModule(id) {
  const node =
    app.nodes.get(id);

  if (!node) {
    return;
  }

  MF27.selectedId = id;

  /*
    Preserve the selection shape used by the
    current V20/V22 visual layers.
  */
  app.selected = {
    kind: 'module',
    id
  };

  /*
    First use any selector already exposed
    by the existing application.
  */
  const selectorNames = [
    'selectModule',
    'selectNode',
    'setSelectedModule',
    'setSelectedNode',
    'inspectModule',
    'focusModule'
  ];

  const selectedByApp =
    mf27TryFunction(
      app,
      selectorNames,
      id,
      node
    );

  /*
    Existing DOM labels may already contain
    the original selection handler.
  */
  const label =
    mf27FindLabel(id);

  if (
    label &&
    !selectedByApp
  ) {
    try {
      label.click();
    } catch (_) {}
  }

  /*
    Ask any existing inspector renderer to
    redraw immediately.
  */
  const inspectorNames = [
    'renderInspector',
    'updateInspector',
    'refreshInspector',
    'renderLiveInspector',
    'updateLiveInspector',
    'showInspector'
  ];

  mf27TryFunction(
    app,
    inspectorNames,
    id,
    node
  );

  /*
    Broadcast one neutral event as a fallback
    without changing trading logic.
  */
  window.dispatchEvent(
    new CustomEvent(
      'memeflow:module-selected',
      {
        detail: {
          id,
          node
        }
      }
    )
  );

  mf27RefreshVisualSelection();
}

function mf27RefreshVisualSelection() {
  if (
    typeof MF20 === 'undefined' ||
    !MF20.hardware
  ) {
    return;
  }

  for (
    const [id, hardware]
    of MF20.hardware
  ) {
    if (!hardware?.group) {
      continue;
    }

    const active =
      id === MF27.selectedId;

    hardware.group.scale.setScalar(
      id === 'core'
        ? active ? 1.18 : 1.14
        : active ? 1.065 : 1.03
    );

    if (
      hardware.underside?.material
    ) {
      hardware.underside.material.opacity =
        active
          ? 0.105
          : id === 'core'
            ? 0.040
            : 0.012;
    }

    if (
      hardware.display?.material
    ) {
      hardware.display.material.opacity =
        active
          ? 1
          : id === 'core'
            ? 1
            : 0.94;
    }
  }
}

function mf27OnPointerDown(event) {
  MF27.pointerDown = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now()
  };
}

function mf27OnPointerUp(event) {
  if (!MF27.pointerDown) {
    return;
  }

  const dx =
    event.clientX -
    MF27.pointerDown.x;

  const dy =
    event.clientY -
    MF27.pointerDown.y;

  const distance =
    Math.hypot(dx, dy);

  const elapsed =
    performance.now() -
    MF27.pointerDown.time;

  MF27.pointerDown = null;

  /*
    Do not treat camera rotation as a click.
  */
  if (
    distance > 10 ||
    elapsed > 650
  ) {
    return;
  }

  const hit =
    mf27HitTest(event);

  if (!hit) {
    return;
  }

  mf27SelectModule(
    hit.id
  );
}

function mf27OnPointerMove(event) {
  const canvas =
    app.renderer?.domElement ||
    document.getElementById(
      'systemCanvas'
    );

  if (!canvas) {
    return;
  }

  /*
    Do not interfere with touch dragging.
  */
  if (
    event.pointerType === 'touch'
  ) {
    return;
  }

  const hit =
    mf27HitTest(event);

  canvas.style.cursor =
    hit
      ? 'pointer'
      : 'grab';
}

function mf27Install() {
  if (
    MF27.installed ||
    typeof MF20 === 'undefined' ||
    !MF20.installed ||
    !MF20.hardware
  ) {
    return;
  }

  MF27.installed = true;

  for (
    const [id, hardware]
    of MF20.hardware
  ) {
    mf27CreateHitTarget(
      id,
      hardware
    );
  }

  const canvas =
    app.renderer?.domElement ||
    document.getElementById(
      'systemCanvas'
    );

  if (!canvas) {
    console.error(
      '[MF27] Canvas not found'
    );

    return;
  }

  canvas.style.touchAction =
    'none';

  canvas.addEventListener(
    'pointerdown',
    mf27OnPointerDown,
    {
      passive: true
    }
  );

  canvas.addEventListener(
    'pointerup',
    mf27OnPointerUp,
    {
      passive: true
    }
  );

  canvas.addEventListener(
    'pointermove',
    mf27OnPointerMove,
    {
      passive: true
    }
  );

  console.log(
    '[MF27] Clickable modules:',
    MF27.hitTargets.length
  );
}

setTimeout(
  mf27Install,
  3000
);


/* ===== MEMEFLOW INSTANT SELECTION V28 ===== */

const MF28 = {
  installed: false,
  selectedId: null,
  pressedId: null,
  pointerDown: null,
  effects: new Map()
};

function mf28ModuleColor(id, hardware) {
  if (
    hardware?.color !== undefined &&
    hardware?.color !== null
  ) {
    return hardware.color;
  }

  const fallback = {
    discovery: 0x4f83ff,
    bootstrap: 0x4f83ff,
    core: 0x47e5a4,
    risk: 0x54dfff,
    market: 0x4f83ff,
    holders: 0x54dfff,
    openai: 0x54dfff,
    decision: 0x8d67ff,
    paper: 0x4f83ff,
    execution: 0x47e5a4
  };

  return fallback[id] || 0x54dfff;
}

function mf28CreateEffect(id, hardware) {
  if (
    !hardware?.group ||
    MF28.effects.has(id)
  ) {
    return;
  }

  const color =
    mf28ModuleColor(
      id,
      hardware
    );

  const box =
    new THREE.Box3()
      .setFromObject(
        hardware.group
      );

  const size =
    new THREE.Vector3();

  box.getSize(size);

  const width =
    Math.max(
      1.8,
      size.x * 1.12
    );

  const depth =
    Math.max(
      1.25,
      size.z * 1.14
    );

  const glow =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width,
        depth
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending,
        side:
          THREE.DoubleSide
      })
    );

  glow.name =
    'MF28_ACTIVE_GLOW_' + id;

  glow.rotation.x =
    -Math.PI / 2;

  glow.position.y =
    -0.43;

  hardware.group.add(glow);

  const light =
    new THREE.PointLight(
      color,
      0,
      id === 'core' ? 5.0 : 3.8,
      2
    );

  light.name =
    'MF28_ACTIVE_LIGHT_' + id;

  light.position.set(
    0,
    0.55,
    0
  );

  hardware.group.add(light);

  const edgeMaterials = [];
  const bodyMaterials = [];

  hardware.group.traverse(object => {
    if (
      object === glow ||
      object.name?.startsWith(
        'MF27_HIT_'
      )
    ) {
      return;
    }

    const materials =
      object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [];

    for (const material of materials) {
      if (
        object.isLineSegments &&
        material
      ) {
        if (
          material.userData
            .mf28BaseOpacity ===
          undefined
        ) {
          material.userData
            .mf28BaseOpacity =
            Number(
              material.opacity ?? 1
            );
        }

        edgeMaterials.push(
          material
        );
      }

      if (
        object.isMesh &&
        material?.emissive &&
        'emissiveIntensity' in material
      ) {
        if (
          material.userData
            .mf28BaseEmissive ===
          undefined
        ) {
          material.userData
            .mf28BaseEmissive =
            Number(
              material.emissiveIntensity ??
              0
            );
        }

        bodyMaterials.push(
          material
        );
      }
    }
  });

  MF28.effects.set(
    id,
    {
      id,
      color,
      hardware,
      glow,
      light,
      edgeMaterials,
      bodyMaterials,
      level: 0,
      target: 0,
      flash: 0
    }
  );
}

function mf28CreateEffects() {
  if (
    typeof MF20 === 'undefined' ||
    !MF20.hardware
  ) {
    return;
  }

  for (
    const [id, hardware]
    of MF20.hardware
  ) {
    mf28CreateEffect(
      id,
      hardware
    );
  }
}

function mf28SetTargets() {
  for (
    const [id, effect]
    of MF28.effects
  ) {
    if (
      id === MF28.selectedId
    ) {
      effect.target = 1;
    } else if (
      id === MF28.pressedId
    ) {
      effect.target = 0.52;
    } else {
      effect.target = 0;
    }
  }
}

function mf28Pressed(id) {
  MF28.pressedId =
    id || null;

  mf28SetTargets();
}

function mf28CommitVisual(id) {
  MF28.selectedId =
    id;

  MF28.pressedId =
    null;

  const effect =
    MF28.effects.get(id);

  if (effect) {
    effect.flash = 1;
  }

  /*
    This is synchronous.
    Existing animation layers see the new
    selection immediately in the same frame.
  */
  app.selected = {
    kind: 'module',
    id
  };

  mf28SetTargets();
}

function mf28ForwardToInspector(id) {
  const node =
    app.nodes.get(id);

  if (!node) {
    return;
  }

  /*
    Prefer the original DOM module handler.
    It already knows how to populate the
    current Live Inspector.
  */
  let forwarded = false;

  if (
    typeof mf27FindLabel ===
    'function'
  ) {
    const label =
      mf27FindLabel(id);

    if (label) {
      try {
        label.click();
        forwarded = true;
      } catch (_) {}
    }
  }

  /*
    If no original label handler exists,
    call one existing selector only.
    Do not walk through many fallbacks.
  */
  if (!forwarded) {
    const names = [
      'selectModule',
      'selectNode',
      'inspectModule',
      'setSelectedModule',
      'setSelectedNode'
    ];

    for (const name of names) {
      const fn =
        app?.[name];

      if (
        typeof fn !== 'function'
      ) {
        continue;
      }

      try {
        fn.call(
          app,
          id,
          node
        );

        forwarded = true;
        break;
      } catch (_) {
        try {
          fn.call(
            app,
            node
          );

          forwarded = true;
          break;
        } catch (_) {}
      }
    }
  }

  /*
    Always emit the selection immediately
    for any current or future listeners.
  */
  window.dispatchEvent(
    new CustomEvent(
      'memeflow:module-selected',
      {
        detail: {
          id,
          node
        }
      }
    )
  );
}

function mf28Select(id) {
  if (!id) {
    return;
  }

  /*
    Visual reaction first.
    No await, timeout or network dependency.
  */
  mf28CommitVisual(id);

  /*
    Then update the existing Inspector.
    requestAnimationFrame lets the active
    hardware render before heavier UI work.
  */
  requestAnimationFrame(
    () => {
      mf28ForwardToInspector(id);
    }
  );
}

function mf28Hit(event) {
  if (
    typeof mf27HitTest !==
    'function'
  ) {
    return null;
  }

  return mf27HitTest(event);
}

function mf28PointerDown(event) {
  const hit =
    mf28Hit(event);

  MF28.pointerDown = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
    id: hit?.id || null,
    moved: false
  };

  /*
    Immediate press glow.
  */
  if (hit?.id) {
    mf28Pressed(
      hit.id
    );
  }
}

function mf28PointerMove(event) {
  if (!MF28.pointerDown) {
    return;
  }

  const dx =
    event.clientX -
    MF28.pointerDown.x;

  const dy =
    event.clientY -
    MF28.pointerDown.y;

  if (
    Math.hypot(dx, dy) > 9
  ) {
    MF28.pointerDown.moved =
      true;

    /*
      User is rotating the scene,
      so remove the temporary press glow.
    */
    mf28Pressed(null);
  }
}

function mf28PointerCancel() {
  MF28.pointerDown =
    null;

  mf28Pressed(null);
}

function mf28PointerUp(event) {
  const down =
    MF28.pointerDown;

  MF28.pointerDown =
    null;

  if (!down) {
    mf28Pressed(null);
    return;
  }

  const dx =
    event.clientX -
    down.x;

  const dy =
    event.clientY -
    down.y;

  const distance =
    Math.hypot(dx, dy);

  const elapsed =
    performance.now() -
    down.time;

  if (
    down.moved ||
    distance > 10 ||
    elapsed > 700
  ) {
    mf28Pressed(null);
    return;
  }

  const hit =
    mf28Hit(event);

  const id =
    hit?.id ||
    down.id;

  if (!id) {
    mf28Pressed(null);
    return;
  }

  mf28Select(id);
}

function mf28Animate() {
  requestAnimationFrame(
    mf28Animate
  );

  if (!MF28.installed) {
    return;
  }

  for (
    const effect
    of MF28.effects.values()
  ) {
    /*
      Fast attack, slower release.
    */
    const rate =
      effect.target >
      effect.level
        ? 0.34
        : 0.18;

    effect.level +=
      (
        effect.target -
        effect.level
      ) * rate;

    effect.flash *=
      0.84;

    const energy =
      Math.min(
        1.35,
        effect.level +
        effect.flash * 0.48
      );

    const core =
      effect.id === 'core';

    effect.glow.material.opacity =
      energy *
      (
        core
          ? 0.17
          : 0.125
      );

    effect.light.intensity =
      energy *
      (
        core
          ? 1.15
          : 0.72
      );

    for (
      const material
      of effect.edgeMaterials
    ) {
      const base =
        Number(
          material.userData
            .mf28BaseOpacity ??
          0.20
        );

      material.opacity =
        base +
        energy *
        (
          0.78 - base
        );
    }

    for (
      const material
      of effect.bodyMaterials
    ) {
      const base =
        Number(
          material.userData
            .mf28BaseEmissive ??
          0
        );

      material.emissiveIntensity =
        base +
        energy *
        (
          core
            ? 0.56
            : 0.42
        );
    }

    if (
      effect.hardware?.display
        ?.material
    ) {
      effect.hardware
        .display.material.opacity =
        Math.min(
          1,
          0.94 +
          energy * 0.06
        );
    }
  }
}

function mf28Install() {
  if (
    MF28.installed ||
    typeof MF27 === 'undefined' ||
    !MF27.installed ||
    typeof MF20 === 'undefined' ||
    !MF20.installed
  ) {
    return;
  }

  MF28.installed =
    true;

  mf28CreateEffects();

  /*
    Keep the currently selected module,
    if one already exists.
  */
  if (
    app.selected?.kind ===
      'module' &&
    app.selected?.id
  ) {
    MF28.selectedId =
      app.selected.id;
  }

  mf28SetTargets();

  const canvas =
    app.renderer?.domElement ||
    document.getElementById(
      'systemCanvas'
    );

  if (!canvas) {
    console.error(
      '[MF28] Canvas not found'
    );

    return;
  }

  /*
    Remove the slower V27 pointer handlers.
  */
  if (
    typeof mf27OnPointerDown ===
    'function'
  ) {
    canvas.removeEventListener(
      'pointerdown',
      mf27OnPointerDown
    );
  }

  if (
    typeof mf27OnPointerUp ===
    'function'
  ) {
    canvas.removeEventListener(
      'pointerup',
      mf27OnPointerUp
    );
  }

  if (
    typeof mf27OnPointerMove ===
    'function'
  ) {
    canvas.removeEventListener(
      'pointermove',
      mf27OnPointerMove
    );
  }

  canvas.addEventListener(
    'pointerdown',
    mf28PointerDown,
    {
      passive: true
    }
  );

  canvas.addEventListener(
    'pointermove',
    mf28PointerMove,
    {
      passive: true
    }
  );

  canvas.addEventListener(
    'pointerup',
    mf28PointerUp,
    {
      passive: true
    }
  );

  canvas.addEventListener(
    'pointercancel',
    mf28PointerCancel,
    {
      passive: true
    }
  );

  requestAnimationFrame(
    mf28Animate
  );

  console.log(
    '[MF28] Instant selection enabled'
  );
}

setTimeout(
  mf28Install,
  3200
);

