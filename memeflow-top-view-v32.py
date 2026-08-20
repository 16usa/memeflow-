#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TOP_VIEW_V32"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[TOP-VIEW-V32] {msg}", flush=True)

def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    for root in candidates:
        try:
            root = root.resolve()
        except Exception:
            continue
        if (root / "system.js").is_file() and (root / "system.css").is_file():
            return root
    raise RuntimeError("MEMEFLOW project root not found")

ROOT = find_root()
JS = ROOT / "system.js"
CSS = ROOT / "system.css"
BACK = ROOT / f".top-view-v32-backup-{STAMP}"
BACK.mkdir(parents=True, exist_ok=True)

def backup(path):
    shutil.copy2(path, BACK / path.name)

def rollback(reason):
    log(f"ERROR: {reason}")
    for path in (JS, CSS):
        src = BACK / path.name
        if src.exists():
            shutil.copy2(src, path)
            log(f"restored {path.name}")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def node_check(path):
    r = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True
    )
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip())

try:
    log(f"root: {ROOT}")
    backup(JS)
    backup(CSS)

    js = JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    if PATCH_ID in js:
        log("already installed")
        sys.exit(0)

    mobile_layout = """const WEB_LAYOUT_MOBILE_V31 = {
  discovery: { pos:[-3.75, 0.08, -3.70], scale:0.67 },
  bootstrap: { pos:[ 0.00, 0.08, -3.70], scale:0.67 },
  core:      { pos:[ 3.75, 0.12, -3.70], scale:0.72 },

  risk:      { pos:[-3.75, 0.05, -0.70], scale:0.65 },
  market:    { pos:[ 0.00, 0.05, -0.70], scale:0.65 },
  holders:   { pos:[ 3.75, 0.05, -0.70], scale:0.65 },

  openai:    { pos:[-3.75, 0.03,  2.30], scale:0.63 },
  decision:  { pos:[ 0.00, 0.03,  2.30], scale:0.65 },
  paper:     { pos:[ 3.75, 0.03,  2.30], scale:0.63 },

  execution: { pos:[ 0.00, 0.03,  5.20], scale:0.64 }
};"""

    desktop_layout = """const WEB_LAYOUT_DESKTOP_V31 = {
  discovery: { pos:[-4.65, 0.08, -3.85], scale:0.78 },
  bootstrap: { pos:[ 0.00, 0.08, -3.85], scale:0.78 },
  core:      { pos:[ 4.65, 0.13, -3.85], scale:0.84 },

  risk:      { pos:[-4.65, 0.05, -0.55], scale:0.76 },
  market:    { pos:[ 0.00, 0.05, -0.55], scale:0.76 },
  holders:   { pos:[ 4.65, 0.05, -0.55], scale:0.76 },

  openai:    { pos:[-4.65, 0.03,  2.75], scale:0.74 },
  decision:  { pos:[ 0.00, 0.03,  2.75], scale:0.77 },
  paper:     { pos:[ 4.65, 0.03,  2.75], scale:0.75 },

  execution: { pos:[ 0.00, 0.03,  5.95], scale:0.74 }
};"""

    js, n1 = re.subn(
        r"const WEB_LAYOUT_MOBILE_V31 = \{.*?\n\};",
        mobile_layout,
        js,
        count=1,
        flags=re.S
    )
    js, n2 = re.subn(
        r"const WEB_LAYOUT_DESKTOP_V31 = \{.*?\n\};",
        desktop_layout,
        js,
        count=1,
        flags=re.S
    )
    if n1 != 1 or n2 != 1:
        raise RuntimeError(f"layout anchors not found cleanly: mobile={n1}, desktop={n2}")

    camera_fn = r"""function applyWebLayoutV31(forceHome = false) {
  if (!app.scene || !app.camera || !app.controls || !app.nodes?.size) return false;

  const mobile = webMobileV31();
  const layout = mobile ? WEB_LAYOUT_MOBILE_V31 : WEB_LAYOUT_DESKTOP_V31;

  for (const [id, cfg] of Object.entries(layout)) {
    const node = webNodeV31(id);
    if (!node?.group) continue;

    node.group.position.set(...cfg.pos);
    node.group.scale.setScalar(cfg.scale);
  }

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
      : (mobile ? 2.0 : 1.6);

  app.camera.fov = mobile ? 40 : 38;
  app.camera.updateProjectionMatrix();

  const fov = THREE.MathUtils.degToRad(app.camera.fov);
  const tanHalf = Math.tan(fov / 2);

  const halfX = Math.max(4.0, size.x * 0.5);
  const halfZ = Math.max(4.4, size.z * 0.5);

  const forWidth = halfX / Math.max(0.01, tanHalf * aspect);
  const forDepth = halfZ / Math.max(0.01, tanHalf);

  const distance =
    Math.max(forWidth, forDepth) *
    (mobile ? 1.28 : 1.18);

  const topTilt = mobile ? 0.095 : 0.11;

  app.cameraHome.set(
    center.x,
    center.y + distance,
    center.z + distance * topTilt
  );

  app.targetHome.set(
    center.x,
    center.y - 0.08,
    center.z
  );

  app.controls.enableZoom = true;
  app.controls.enableRotate = false;
  app.controls.enablePan = false;
  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.055;
  app.controls.zoomSpeed = 1.08;
  app.controls.autoRotate = false;
  app.autoRotate = false;

  app.controls.minDistance = distance * 0.72;
  app.controls.maxDistance = distance * 1.80;

  if (app.controls.touches) {
    app.controls.touches.ONE = THREE.TOUCH.ROTATE;
    app.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  if (forceHome) {
    app.camera.position.copy(app.cameraHome);
    app.controls.target.copy(app.targetHome);
  }

  app.controls.update();
  resize();
  updateLabels();
  return true;
}"""

    js, n3 = re.subn(
        r"function applyWebLayoutV31\(forceHome = false\) \{.*?\n\}",
        camera_fn,
        js,
        count=1,
        flags=re.S
    )
    if n3 != 1:
        raise RuntimeError(f"applyWebLayoutV31 anchor count={n3}")

    old_label_line = "    const y = (-v.y * 0.5 + 0.5) * h - label.offsetY;"
    new_label_line = """    const mobileLabel = window.matchMedia('(max-width: 900px)').matches;
    const y = (-v.y * 0.5 + 0.5) * h + (mobileLabel ? 18 : 22);"""
    if old_label_line not in js:
        raise RuntimeError("updateLabels y-position anchor not found")
    js = js.replace(old_label_line, new_label_line, 1)

    old_font = """  ctx.font =
    id === 'core'
      ? '700 53px Arial'
      : '700 44px Arial';"""
    new_font = """  ctx.font =
    id === 'core'
      ? '700 66px Arial'
      : '700 56px Arial';"""
    if old_font in js:
        js = js.replace(old_font, new_font, 1)

    old_mf20_resize = """        mf20Camera(false);
        resize();"""
    new_mf20_resize = """        if (typeof REAL_WEB_V31 !== 'undefined' && REAL_WEB_V31.installed) {
          return;
        }
        mf20Camera(false);
        resize();"""
    if old_mf20_resize in js:
        js = js.replace(old_mf20_resize, new_mf20_resize, 1)

    old_mf29_resize = """  mf29Camera(false);
  resize();"""
    new_mf29_resize = """  if (typeof REAL_WEB_V31 !== 'undefined' && REAL_WEB_V31.installed) {
    return;
  }
  mf29Camera(false);
  resize();"""
    if old_mf29_resize in js:
        js = js.replace(old_mf29_resize, new_mf29_resize, 1)

    old_reset = """          () => {
            mf20Camera(true);
            resize();
          },"""
    new_reset = """          () => {
            if (typeof REAL_WEB_V31 !== 'undefined' && REAL_WEB_V31.installed) {
              applyWebLayoutV31(true);
              return;
            }
            mf20Camera(true);
            resize();
          },"""
    if old_reset in js:
        js = js.replace(old_reset, new_reset, 1)

    kill_rule = """.scene-labels,
.node-label {
  display: none;
}"""
    if kill_rule not in css:
        raise RuntimeError("CSS label kill-switch not found")
    css = css.replace(
        kill_rule,
        """.scene-labels {
  display: block;
}

.node-label {
  display: block;
}""",
        1
    )

    css += """

/* ===== MEMEFLOW TOP VIEW V32 ===== */
.scene-labels {
  display: block !important;
  overflow: hidden;
}

.node-label {
  display: block !important;
  padding: 4px 7px;
  border-color: rgba(126, 180, 202, .20);
  background: rgba(2, 8, 12, .88);
  box-shadow: 0 5px 18px rgba(0, 0, 0, .28);
}

.node-label strong {
  font-size: 8px;
  line-height: 1;
  letter-spacing: .055em;
}

.node-label small {
  display: none;
}

@media (max-width: 900px) {
  .node-label {
    padding: 3px 5px;
    border-radius: 6px;
    background: rgba(2, 8, 12, .90);
  }

  .node-label strong {
    font-size: 6px;
    letter-spacing: .045em;
  }
}
"""

    js = js.rstrip() + f"\n\n// {PATCH_ID}\n"

    JS.write_text(js, encoding="utf-8")
    CSS.write_text(css, encoding="utf-8")

    node_check(JS)

    final_js = JS.read_text(encoding="utf-8")
    final_css = CSS.read_text(encoding="utf-8")

    checks = {
        "top-view marker": PATCH_ID in final_js,
        "mobile X/Z layout": "discovery: { pos:[-3.75, 0.08, -3.70]" in final_js,
        "rotation locked": "app.controls.enableRotate = false;" in final_js,
        "fitted hardware box": "box.expandByObject(hardware.group)" in final_js,
        "labels enabled": ".scene-labels {\n  display: block !important;" in final_css,
        "old label kill removed": ".scene-labels,\n.node-label {\n  display: none;" not in final_css,
    }
    failed = [k for k, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError("validation failed: " + ", ".join(failed))

    log("system.js syntax OK")
    log("INSTALL COMPLETE")
    log("V31 is now the single final camera/layout owner")
    log("default camera = fitted near-top view")
    log("all 10 modules use one X/Z plane")
    log("all module labels are visible")
    log("module texture names enlarged")
    log("MF20/MF29 resize/reset camera conflicts neutralized")
    log(f"backup: {BACK}")
    log("Restart the Replit app/workflow and reload System View.")

except Exception as exc:
    rollback(exc)
