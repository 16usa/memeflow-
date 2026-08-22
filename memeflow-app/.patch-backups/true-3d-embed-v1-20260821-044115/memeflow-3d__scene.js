import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.166.1/examples/jsm/controls/OrbitControls.js';
import { NODES, ROUTES } from './layout.js';
import { createModule } from './modules.js';
import { createRoute, animateRoutes } from './routes.js';

export function bootMemeflowTrue3D(rootId='app') {
  const mount = document.getElementById(rootId);
  if (!mount) throw new Error('Mount element not found: ' + rootId);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.id = 'memeflowTrue3DCanvas';
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 1.06;
  controls.minDistance = 5.5;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.34;
  controls.maxPolarAngle = Math.PI / 2.05;

  const ambient = new THREE.AmbientLight(0x9ec6ff, 0.50);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.10);
  key.position.set(5, 10, 4);
  scene.add(key);

  const rim = new THREE.PointLight(0x7deaff, 15, 30, 2);
  rim.position.set(-8, 4, 8);
  scene.add(rim);

  const green = new THREE.PointLight(0x65f0a5, 14, 24, 2);
  green.position.set(4.5, 4, -3.8);
  scene.add(green);

  const floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 24),
    new THREE.MeshBasicMaterial({
      color: 0x08111a,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = -1.30;
  scene.add(floorGlow);

  const modules = new Map();
  for (const node of NODES) {
    const built = createModule(node);
    scene.add(built.group);
    modules.set(node.id, built);
  }

  const routes = [];
  for (const [from, to, color] of ROUTES) {
    const a = NODES.find(n => n.id === from);
    const b = NODES.find(n => n.id === to);
    const built = createRoute(a.pos, b.pos, color);
    scene.add(built.group);
    routes.push(built);
  }

  const homeCam = new THREE.Vector3(0, 10.8, 6.6);
  const homeTarget = new THREE.Vector3(0, 0.05, 0.2);

  function resetView() {
    camera.position.copy(homeCam);
    controls.target.copy(homeTarget);
    controls.update();
  }

  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const resetButton = document.getElementById('resetView');
  if (resetButton) resetButton.addEventListener('click', resetView);

  resetView();
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    const core = modules.get('core');
    const decision = modules.get('decision');
    const execution = modules.get('execution');

    if (core?.rings) core.rings.rotation.y += 0.0025;
    if (core?.inner?.material) core.inner.material.opacity = 0.19 + Math.sin(t * 2.0) * 0.03;
    if (decision?.inner?.material) decision.inner.material.opacity = 0.12 + Math.sin(t * 2.3 + 1.3) * 0.02;
    if (execution?.inner?.material) execution.inner.material.opacity = 0.14 + Math.sin(t * 2.3 + 2.1) * 0.02;

    animateRoutes(routes, t);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}
