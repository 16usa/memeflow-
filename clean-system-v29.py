from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime

JS_START_MARKER = "/* ===== MOBILE PORTRAIT DIGITAL TWIN V7 ===== */"
JS_KEEP_MARKER = "/* ===== MEMEFLOW CLEAN HARDWARE V20 ===== */"
JS_END_KEEP_MARKER = "/* ===== MEMEFLOW CLEANUP V21 ===== */"
CSS_CLEAN_MARKER = "/* ===== MOBILE SINGLE-SCREEN LAYOUT V2 ===== */"

FINAL_JS = r'''

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

  app.camera.fov = mobile ? 37 : 35;
  app.camera.updateProjectionMatrix();

  app.cameraHome.set(
    0,
    mobile ? 6.70 : 6.35,
    mobile ? 15.10 : 14.45
  );

  app.targetHome.set(-0.30, -0.22, 0.78);

  if (reset) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.enablePan = false;
  app.controls.enableZoom = true;
  app.controls.minDistance = 8.8;
  app.controls.maxDistance = 24;
  app.controls.zoomSpeed = 1.02;
  app.controls.rotateSpeed = 0.50;
  app.controls.minAzimuthAngle = -0.46;
  app.controls.maxAzimuthAngle = 0.46;
  app.controls.minPolarAngle = Math.PI * 0.235;
  app.controls.maxPolarAngle = Math.PI * 0.455;
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
'''

FINAL_CSS = r'''

/* ===== MEMEFLOW CLEAN SYSTEM V29 ===== */

html,
body {
  background: #020507;
}

.viewport-wrap {
  background:
    radial-gradient(ellipse at 50% 37%, rgba(22, 91, 90, .055), transparent 34%),
    linear-gradient(180deg, #02070a 0%, #010507 64%, #010405 100%);
  box-shadow: inset 0 0 72px rgba(0, 0, 0, .46);
}

.viewport-wrap::after {
  opacity: .06;
}

#systemCanvas {
  cursor: grab;
  filter: contrast(1.12) saturate(1.01) brightness(1.035);
  -webkit-tap-highlight-color: transparent;
}

#systemCanvas:active {
  cursor: grabbing;
}

.scene-labels {
  display: none;
}

.node-label {
  display: none;
}

@media (max-width: 900px) {
  html,
  body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
  }

  body {
    min-height: 100dvh;
  }

  .system-shell {
    width: 100%;
    height: 100dvh;
    min-height: 0;
    padding: 6px;
    display: grid;
    grid-template-rows: 54px minmax(0, 1fr) 122px;
    gap: 6px;
    overflow: hidden;
  }

  .topbar {
    height: 54px;
    min-height: 54px;
    margin: 0;
    padding: 7px 10px;
    border-radius: 13px;
    grid-template-columns: 1fr auto;
  }

  .brand-block {
    gap: 8px;
  }

  .brand {
    font-size: 12px;
  }

  .subtitle,
  .system-chips,
  .top-actions .tool-btn:first-child {
    display: none;
  }

  .back {
    width: 34px;
    height: 34px;
  }

  .brand-mark {
    width: 30px;
    height: 30px;
  }

  .tool-btn {
    height: 34px;
    padding: 0 11px;
    font-size: 9px;
  }

  .viewport-wrap {
    height: auto;
    min-height: 0;
    margin: 0;
    border-radius: 15px;
    overflow: hidden;
  }

  .scene-title {
    left: 9px;
    right: 9px;
    top: 8px;
    width: auto;
    padding: 7px 9px;
    border-radius: 10px;
  }

  .scene-title .eyebrow {
    font-size: 5px;
    letter-spacing: .17em;
  }

  .scene-title h1 {
    margin: 3px 0 0;
    font-size: 13px;
    line-height: 1.05;
  }

  .scene-title p {
    display: none;
  }

  .legend {
    left: 9px;
    top: 61px;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 8px;
  }

  .legend span {
    font-size: 5px;
    gap: 4px;
  }

  .legend-dot {
    width: 5px;
    height: 5px;
  }

  .scene-hint {
    display: none;
  }

  .inspector {
    left: 10px;
    right: 10px;
    top: auto;
    bottom: 78px;
    width: auto;
    max-height: 205px;
    padding: 9px;
    border-radius: 13px;
    overflow: hidden;
  }

  .inspector h2 {
    margin-top: 3px;
    font-size: 13px;
  }

  .inspector .eyebrow {
    font-size: 5px;
  }

  .inspector-summary,
  .gate-list,
  .inspector-foot {
    display: none;
  }

  .metric-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 5px;
    margin-top: 6px;
  }

  .metric-card {
    min-width: 0;
    padding: 6px;
    border-radius: 8px;
  }

  .metric-card span {
    font-size: 5px;
  }

  .metric-card strong {
    margin-top: 3px;
    font-size: 9px;
  }

  .reason-block {
    margin-top: 6px;
    padding: 6px 7px;
  }

  .reason-block span {
    font-size: 5px;
  }

  .reason-block p {
    margin-top: 3px;
    font-size: 7px;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .state-pill {
    font-size: 6px;
    padding: 4px 6px;
  }

  .telemetry {
    left: 10px;
    right: 10px;
    bottom: 8px;
    height: 62px;
    padding: 6px;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    border-radius: 11px;
  }

  .telemetry-item {
    min-width: 0;
    padding: 2px 7px;
  }

  .telemetry-item:nth-child(n + 4) {
    display: none;
  }

  .telemetry-item span {
    font-size: 5px;
  }

  .telemetry-item strong {
    margin-top: 3px;
    font-size: 11px;
  }

  .telemetry-item small {
    font-size: 5px;
    margin-left: 3px;
  }

  .activity-panel {
    min-height: 0;
    height: 122px;
    margin: 0;
    padding: 8px 10px;
    border-radius: 13px;
    overflow: hidden;
  }

  .activity-head h2 {
    font-size: 10px;
  }

  .activity-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .flow-view-all {
    padding: 6px 9px;
    border: 1px solid rgba(85, 217, 255, .26);
    border-radius: 8px;
    color: #9fdff3;
    text-decoration: none;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .token-rail {
    height: 76px;
    gap: 7px;
    padding-top: 7px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .token-card {
    flex: 0 0 154px;
    min-height: 68px;
    padding: 7px 8px;
    border-radius: 9px;
  }

  .token-symbol {
    font-size: 9px;
  }

  .token-state {
    font-size: 6px;
  }

  .token-card-meta {
    gap: 4px;
    margin-top: 5px;
  }

  .token-card-meta span {
    font-size: 6px;
  }

  .token-card-meta b {
    font-size: 7px;
  }
}
'''


def locate_files():
    here = Path.cwd()
    candidates = [
        here,
        here / "memeflow-app",
        here.parent / "memeflow-app"
    ]

    for root in candidates:
        if (root.joinpath("system.js").is_file() and root.joinpath("system.css").is_file() and root.joinpath("system.html").is_file()):
            return root.resolve()

    raise SystemExit("ERROR: system.js, system.css and system.html were not found")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def run_check(path):
    result = subprocess.run(
        ["node", "--check", str(path)],
        text=True,
        capture_output=True
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "node --check failed")


def main():
    root = locate_files()
    js_path = root / "system.js"
    css_path = root / "system.css"
    html_path = root / "system.html"

    js = js_path.read_text(encoding="utf-8")
    css = css_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")

    for marker in (JS_START_MARKER, JS_KEEP_MARKER, JS_END_KEEP_MARKER):
        if marker not in js:
            raise RuntimeError(f"Missing JS marker: {marker}")

    if CSS_CLEAN_MARKER not in css:
        raise RuntimeError(f"Missing CSS marker: {CSS_CLEAN_MARKER}")

    start = js.index(JS_START_MARKER)
    keep_start = js.index(JS_KEEP_MARKER)
    keep_end = js.index(JS_END_KEEP_MARKER)

    if not (start < keep_start < keep_end):
        raise RuntimeError("Unexpected JS patch order")

    base = js[:start].rstrip() + "\n\n"
    mf20 = js[keep_start:keep_end].rstrip() + "\n"

    base = replace_once(
        base,
        "  EDGES.forEach(createFlowLine);",
        "  /* Legacy flow geometry is disabled by CLEAN V29. */",
        "disable legacy flow"
    )

    base = replace_once(
        base,
        "  canvas.addEventListener('pointerup', pick);",
        "  /* CLEAN V29 owns module picking. */",
        "disable legacy picker"
    )

    base = replace_once(
        base,
        "  syncTokenMeshes(ranked);",
        "  /* CLEAN V29 keeps token telemetry in the rail only. */",
        "disable legacy token meshes"
    )

    base = replace_once(
        base,
        "  app.selected = data;",
        "  app.selected = data;\n  window.__mf29SyncSelection?.();",
        "selection hook"
    )

    mf20 = replace_once(
        mf20,
        "    let index = 0;\n    index < 3;",
        "    let index = 0;\n    index < 2;",
        "packet count"
    )

    mf20 = replace_once(
        mf20,
        "          0.055,",
        "          0.028,",
        "packet size"
    )

    mf20 = replace_once(
        mf20,
        "        0.26 +\n        speed * 0.34",
        "        0.95 +\n        speed * 0.65",
        "packet speed"
    )

    mf20 = replace_once(
        mf20,
        "        ? 0.11\n        : id === 'core'\n          ? 0.075\n          : 0.025;",
        "        ? 0.14\n        : id === 'core'\n          ? 0.04\n          : 0.012;",
        "selection underside"
    )

    mf20 = replace_once(
        mf20,
        "setTimeout(\n  mf20Install,\n  1250\n);",
        "mf20Install();",
        "install delay"
    )

    new_js = base + mf20 + FINAL_JS.strip() + "\n"

    css_start = css.index(CSS_CLEAN_MARKER)
    new_css = css[:css_start].rstrip() + "\n" + FINAL_CSS.strip() + "\n"

    new_html = re.sub(
        r'href="/system\.css(?:\?[^\"]*)?"',
        'href="/system.css?v=clean-v29"',
        html,
        count=1
    )
    new_html = re.sub(
        r'src="/system\.js(?:\?[^\"]*)?"',
        'src="/system.js?v=clean-v29"',
        new_html,
        count=1
    )

    if new_html == html:
        raise RuntimeError("HTML cache version was not updated")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backups = {
        js_path: js_path.with_name(f"system.js.before-clean-v29-{stamp}"),
        css_path: css_path.with_name(f"system.css.before-clean-v29-{stamp}"),
        html_path: html_path.with_name(f"system.html.before-clean-v29-{stamp}")
    }

    for source, backup in backups.items():
        shutil.copy2(source, backup)

    try:
        js_path.write_text(new_js, encoding="utf-8")
        css_path.write_text(new_css, encoding="utf-8")
        html_path.write_text(new_html, encoding="utf-8")

        run_check(js_path)

        if new_js.count(JS_KEEP_MARKER) != 1:
            raise RuntimeError("V20 hardware layer count is invalid")

        if new_js.count("MEMEFLOW CLEAN SYSTEM V29") != 1:
            raise RuntimeError("V29 layer count is invalid")

        forbidden = [
            "MOBILE PORTRAIT DIGITAL TWIN V7",
            "LIVE FLOW REALITY V8",
            "CENTERED MOBILE SCENE + VISUAL POLISH V9",
            "PREMIUM DIGITAL TWIN V11",
            "CINEMATIC SYSTEM SCALE V12",
            "CONTROL ROOM DIGITAL TWIN V14",
            "MEMEFLOW CLEANUP V21",
            "MEMEFLOW FINAL POLISH V22",
            "MEMEFLOW DATA PULSES V23",
            "LEGACY PARTICLE CLEANUP V26",
            "MEMEFLOW CLICKABLE HARDWARE V27",
            "MEMEFLOW INSTANT SELECTION V28"
        ]

        remaining = [name for name in forbidden if name in new_js]
        if remaining:
            raise RuntimeError("Legacy layers remain: " + ", ".join(remaining))

    except Exception:
        for target, backup in backups.items():
            shutil.copy2(backup, target)
        raise

    print("CLEAN V29 INSTALLED")
    print(f"Project: {root}")
    print("JavaScript: base telemetry + V20 hardware + V29 interaction")
    print("CSS: one final responsive layer after the original base")
    print("Legacy V7-V28 overlay stack removed")
    print("Direct module selection enabled")
    print("Syntax check passed")
    print("DONE")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
