#!/usr/bin/env python3
# MEMEFLOW V30.3.1 - ROBUST 3D LIGHTWEIGHT
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_V30_3_1_3D_LIGHTWEIGHT"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[V30.3.1-3D] {msg}", flush=True)

def find_root() -> Path:
    roots = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]

    for r in roots:
        try:
            r = r.resolve()
        except Exception:
            continue
        if (r / "system.js").is_file():
            return r

    for base in [Path("/home/runner/workspace"), Path.cwd()]:
        if not base.exists():
            continue
        try:
            for p in base.glob("**/system.js"):
                if p.parent.name == "memeflow-app":
                    return p.parent.resolve()
        except Exception:
            pass

    raise RuntimeError("Could not find MEMEFLOW system.js")

ROOT = find_root()
SYSTEM = ROOT / "system.js"
BACKUP_DIR = ROOT / f".v30-3-1-3d-backup-{STAMP}"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
BACKUP = BACKUP_DIR / "system.js"
shutil.copy2(SYSTEM, BACKUP)

def rollback(reason):
    log(f"ERROR: {reason}")
    if BACKUP.exists():
        shutil.copy2(BACKUP, SYSTEM)
        log("ROLLBACK complete - original system.js restored.")
    sys.exit(1)

def find_matching_brace(src: str, open_pos: int) -> int:
    depth = 0
    i = open_pos
    mode = "code"
    quote = None
    escape = False

    while i < len(src):
        ch = src[i]
        nxt = src[i + 1] if i + 1 < len(src) else ""

        if mode == "line_comment":
            if ch == "\n":
                mode = "code"

        elif mode == "block_comment":
            if ch == "*" and nxt == "/":
                mode = "code"
                i += 1

        elif mode == "string":
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                mode = "code"
                quote = None

        elif mode == "template":
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == "`":
                mode = "code"

        else:
            if ch == "/" and nxt == "/":
                mode = "line_comment"
                i += 1
            elif ch == "/" and nxt == "*":
                mode = "block_comment"
                i += 1
            elif ch in ("'", '"'):
                mode = "string"
                quote = ch
            elif ch == "`":
                mode = "template"
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return i

        i += 1

    raise RuntimeError("Unmatched JavaScript brace")

def inject_scheduler(src: str) -> str:
    if PATCH_ID in src:
        return src

    anchor = "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';"
    if anchor not in src:
        raise RuntimeError("Three.js import anchor not found")

    helper = r"""

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
"""
    return src.replace(anchor, anchor + helper, 1)

def optimize_raf_function(src: str, name: str, mobile_fps: int, desktop_fps: int, required=False):
    marker = f"MF_V3031_GATE_{name}"
    if marker in src:
        return src, "already"

    m = re.search(rf"\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", src)
    if not m:
        if required:
            raise RuntimeError(f"Required function not found: {name}")
        return src, "missing"

    open_brace = src.find("{", m.start())
    close_brace = find_matching_brace(src, open_brace)
    body = src[open_brace + 1:close_brace]

    raf_re = re.compile(
        rf"requestAnimationFrame\s*\(\s*{re.escape(name)}\s*\)\s*;?",
        re.S,
    )
    count = len(raf_re.findall(body))

    if count == 0:
        return src, "not-self-raf"

    body = raf_re.sub("", body)

    gate = (
        f"\n  // {marker}\n"
        f"  requestAnimationFrame({name});\n"
        f"  if (!mf3dFrameAllowedV3031('{name}', {mobile_fps}, {desktop_fps})) return;\n"
    )

    new_body = gate + body
    out = src[:open_brace + 1] + new_body + src[close_brace:]
    return out, f"optimized({count} raf)"

def replace_once(src: str, old: str, new: str, label: str, required=False):
    if new in src:
        return src, "already"
    if old not in src:
        if required:
            raise RuntimeError(f"Required target not found: {label}")
        return src, "missing"
    return src.replace(old, new, 1), "changed"

try:
    original = SYSTEM.read_text(encoding="utf-8")

    if "MEMEFLOW_V30_3_3D_LIGHTWEIGHT" in original and PATCH_ID not in original:
        raise RuntimeError(
            "Previous V30.3 marker still exists in system.js. "
            "Restore the clean rollback before installing V30.3.1."
        )

    src = inject_scheduler(original)

    targets = [
        ("animate", 30, 45, True),
        ("premiumAnimationV11", 20, 30, False),
        ("reinforceCinematicPulseV12", 20, 30, False),
        ("controlRoomLoopV14", 20, 30, False),
        ("mf20Animate", 18, 24, False),
        ("mf22AnimationLoop", 18, 24, False),
        ("mf23Animate", 18, 24, False),
        ("mf28Animate", 30, 45, False),
    ]

    optimized = 0

    for name, mobile, desktop, required in targets:
        src, status = optimize_raf_function(
            src, name, mobile, desktop, required=required
        )
        log(f"{name}: {status}")
        if status.startswith("optimized"):
            optimized += 1

    src, status = replace_once(
        src,
        "app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));",
        "app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mf3dMobileV3031() ? 1.5 : 1.8));",
        "mobile renderer pixel ratio",
        required=False,
    )
    log(f"pixel ratio: {status}")

    src, status = replace_once(
        src,
        "setInterval(refreshTelemetry, 2500);",
        "setInterval(refreshTelemetry, 4000);",
        "refreshTelemetry interval",
        required=False,
    )
    log(f"telemetry interval: {status}")

    old_reality = """setInterval(
  () => {
    syncRealitySpeedsV8(false);
  },
  900
);"""
    new_reality = """setInterval(
  () => {
    if (!document.hidden) syncRealitySpeedsV8(false);
  },
  1500
);"""

    src, status = replace_once(
        src, old_reality, new_reality, "reality interval", required=False
    )
    log(f"reality interval: {status}")

    old_cleanup = """setInterval(
    mf26HideLegacyParticles,
    250
  );"""
    new_cleanup = """setInterval(
    mf26HideLegacyParticles,
    500
  );"""

    src, status = replace_once(
        src, old_cleanup, new_cleanup, "legacy particle cleanup interval", required=False
    )
    log(f"legacy cleanup interval: {status}")

    if optimized < 1:
        raise RuntimeError("No animation loop was optimized")

    SYSTEM.write_text(src, encoding="utf-8")

    check = subprocess.run(
        ["node", "--check", str(SYSTEM)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    if check.returncode != 0:
        raise RuntimeError("node --check failed:\n" + (check.stderr or check.stdout))

    final = SYSTEM.read_text(encoding="utf-8")

    if final.count("MF_V3031_GATE_animate") != 1:
        raise RuntimeError("Main animation gate validation failed")

    for name, *_ in targets:
        marker = f"MF_V3031_GATE_{name}"
        if marker not in final:
            continue

        m = re.search(rf"\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", final)
        if not m:
            raise RuntimeError(f"Post-check function missing: {name}")

        ob = final.find("{", m.start())
        cb = find_matching_brace(final, ob)
        body = final[ob + 1:cb]

        raf_count = len(re.findall(
            rf"requestAnimationFrame\s*\(\s*{re.escape(name)}\s*\)", body
        ))

        if raf_count != 1:
            raise RuntimeError(
                f"{name}: expected exactly 1 self RAF after patch, got {raf_count}"
            )

    log("INSTALL COMPLETE")
    log(f"Project: {ROOT}")
    log(f"Backup:  {BACKUP}")
    log(f"RAF loops optimized: {optimized}")
    log("Mobile main render budget: 30 FPS")
    log("Desktop main render budget: 45 FPS")
    log("No 3D layout/colors/routes were intentionally changed.")
    log("Restart Replit app/workflow, then hard-refresh Safari.")

except Exception as exc:
    rollback(exc)
