import * as THREE from '/vendor/three.module.js';

const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));

function mat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function shapeMesh(parent, points, material, order) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = order;
  parent.add(mesh);
  return { mesh, geometry };
}

export function createRocketRide2D({ rideRoot, backdropParent } = {}) {
  if (!rideRoot) throw new Error('[ROCKET RIDE V33] rideRoot is required');

  const dispose = [];
  const rocketRoot = new THREE.Group();
  rocketRoot.name = 'RocketArtworkV33';
  rocketRoot.position.set(0, -1.18, -0.4);
  rocketRoot.scale.setScalar(1.05);
  rideRoot.add(rocketRoot);

  const backdrop = new THREE.Group();
  backdrop.name = 'RocketBackdropV33';
  (backdropParent || rideRoot).add(backdrop);

  const gunmetal = mat(0x27323a);
  const panel = mat(0x52616b);
  const red = mat(0xff4f42);
  const rim = mat(0xff624f);
  const glass = mat(0x071b2b);
  const nozzleMat = mat(0x151b20);
  const flameOuterMat = mat(0xff4c22, 0.90);
  const flameMidMat = mat(0xffa125, 0.95);
  const flameCoreMat = mat(0xfff4bd, 0.98);
  const streakBase = mat(0xcdfaff, 0.12);
  dispose.push(gunmetal, panel, red, rim, glass, nozzleMat, flameOuterMat, flameMidMat, flameCoreMat, streakBase);

  const body = shapeMesh(rocketRoot, [
    [0, 0.92], [0.28, 0.58], [0.36, -0.36], [0.22, -0.70],
    [-0.22, -0.70], [-0.36, -0.36], [-0.28, 0.58]
  ], gunmetal, 4);
  dispose.push(body.geometry);

  const nose = shapeMesh(rocketRoot, [[0, 1.06], [0.26, 0.65], [-0.26, 0.65]], red, 5);
  const finL = shapeMesh(rocketRoot, [[-0.24, -0.20], [-0.58, -0.64], [-0.20, -0.52]], red, 4);
  const finR = shapeMesh(rocketRoot, [[0.24, -0.20], [0.58, -0.64], [0.20, -0.52]], red, 4);
  dispose.push(nose.geometry, finL.geometry, finR.geometry);

  const panelGeo = new THREE.PlaneGeometry(0.34, 0.58);
  const panelMesh = new THREE.Mesh(panelGeo, panel);
  panelMesh.position.set(0, -0.08, 0);
  panelMesh.renderOrder = 5;
  rocketRoot.add(panelMesh);
  dispose.push(panelGeo);

  const rimGeo = new THREE.RingGeometry(0.105, 0.155, 28);
  const rimMesh = new THREE.Mesh(rimGeo, rim);
  rimMesh.position.set(0, 0.35, 0);
  rimMesh.renderOrder = 6;
  rocketRoot.add(rimMesh);
  dispose.push(rimGeo);

  const glassGeo = new THREE.CircleGeometry(0.102, 28);
  const glassMesh = new THREE.Mesh(glassGeo, glass);
  glassMesh.position.set(0, 0.35, 0);
  glassMesh.renderOrder = 6;
  rocketRoot.add(glassMesh);
  dispose.push(glassGeo);

  const nozzleGeo = new THREE.PlaneGeometry(0.27, 0.18);
  const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle.position.set(0, -0.78, 0);
  nozzle.renderOrder = 6;
  rocketRoot.add(nozzle);
  dispose.push(nozzleGeo);

  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, -0.86, 0);
  rocketRoot.add(flameGroup);

  const outer = shapeMesh(flameGroup, [[-0.17, 0], [0.17, 0], [0.11, -0.62], [0, -1.03], [-0.11, -0.62]], flameOuterMat, 2);
  const mid = shapeMesh(flameGroup, [[-0.11, 0], [0.11, 0], [0.07, -0.46], [0, -0.78], [-0.07, -0.46]], flameMidMat, 3);
  const core = shapeMesh(flameGroup, [[-0.055, 0], [0.055, 0], [0.025, -0.32], [0, -0.54], [-0.025, -0.32]], flameCoreMat, 4);
  dispose.push(outer.geometry, mid.geometry, core.geometry);

  const lines = [];
  for (let i = 0; i < 24; i += 1) {
    const geometry = new THREE.PlaneGeometry(0.010 + (i % 3) * 0.005, 0.18 + (i % 5) * 0.07);
    const material = streakBase.clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -10;
    mesh.position.x = -1.5 + ((i * 43) % 100) / 100 * 3;
    backdrop.add(mesh);
    lines.push({ mesh, material, phase: i / 24 });
    dispose.push(geometry, material);
  }

  function update(t, dt, state = {}) {
    const direction = Math.min(1, Math.max(-1, Number(state.direction) || 0));
    const speed = clamp01(state.speed);
    const thrust = clamp01(state.thrust);
    const volatility = clamp01(state.volatility);
    const boost = clamp01(state.boost);
    const power = clamp01(thrust * 0.70 + speed * 0.22 + boost * 0.30);

    const bob = Math.sin(t * (1.55 + speed * 1.1)) * (0.012 + power * 0.025);
    const turbulence = Math.sin(t * 13.0) * volatility * 0.012;
    rideRoot.position.x = -direction * 0.05 + turbulence;
    rideRoot.position.y = 0.04 + direction * 0.05 + bob;
    rideRoot.rotation.z = -direction * 0.055 + Math.sin(t * 1.3) * 0.006 + turbulence * 0.4;

    const pulse = 1 + Math.sin(t * (10 + thrust * 10)) * (0.05 + volatility * 0.08);
    flameGroup.scale.x = 0.86 + power * 0.34 + boost * 0.18;
    flameGroup.scale.y = (0.48 + thrust * 0.92 + speed * 0.22 + boost * 0.70) * pulse;
    flameOuterMat.opacity = 0.36 + power * 0.60;
    flameMidMat.opacity = 0.50 + power * 0.48;
    flameCoreMat.opacity = 0.62 + power * 0.36;

    const linePower = clamp01(speed * 0.72 + thrust * 0.22 + boost * 0.55);
    for (const line of lines) {
      const phase = (t * (0.12 + linePower * 2.4) + line.phase) % 1;
      line.mesh.position.y = 2.55 - phase * 5.1;
      line.mesh.scale.y = 0.45 + linePower * 2.0;
      line.material.opacity = linePower * (0.025 + boost * 0.11) * (0.55 + 0.45 * Math.sin((phase + 0.25) * Math.PI));
      line.mesh.position.x += direction * dt * (0.02 + speed * 0.04);
      if (line.mesh.position.x > 1.55) line.mesh.position.x = -1.55;
      if (line.mesh.position.x < -1.55) line.mesh.position.x = 1.55;
    }
  }

  function resetPoseForFit() {
    rideRoot.position.set(0, 0.04, 0);
    rideRoot.rotation.set(0, 0, 0);
    flameGroup.scale.set(1, 0.72, 1);
  }

  function destroy() {
    rocketRoot.removeFromParent();
    backdrop.removeFromParent();
    for (const item of dispose) item.dispose?.();
  }

  return { root: rocketRoot, backdrop, flameGroup, update, resetPoseForFit, destroy };
}
