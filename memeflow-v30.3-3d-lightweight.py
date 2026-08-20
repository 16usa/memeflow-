#!/usr/bin/env python3
# MEMEFLOW V30.3 - 3D LIGHTWEIGHT
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_V30_3_3D_LIGHTWEIGHT"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(message):
    print(f"[V30.3-3D] {message}", flush=True)

def find_root() -> Path:
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
        Path("/workspace"),
        Path("/workspace/memeflow-app"),
    ]
    for root in candidates:
        try:
            root = root.resolve()
        except Exception:
            continue
        if (root / "system.js").is_file():
            return root

    for base in [Path("/home/runner/workspace"), Path.cwd()]:
        if not base.exists():
            continue
        try:
            for p in base.glob("**/system.js"):
                if p.parent.name == "memeflow-app":
                    return p.parent.resolve()
        except Exception:
            pass

    raise RuntimeError("MEMEFLOW system.js was not found.")

ROOT = find_root()
SYSTEM = ROOT / "system.js"
BACKUP_DIR = ROOT / f".v30-3-3d-backup-{STAMP}"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
BACKUP = BACKUP_DIR / "system.js"
shutil.copy2(SYSTEM, BACKUP)

def rollback(error):
    log(f"ERROR: {error}")
    if BACKUP.exists():
        shutil.copy2(BACKUP, SYSTEM)
        log("ROLLBACK complete - original system.js restored.")
    sys.exit(1)

def add_runtime_budget(text: str) -> str:
    if PATCH_ID in text:
        return text

    anchor = "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';"
    if anchor not in text:
        raise RuntimeError("Could not find Three.js import anchor.")

    helper = r'''

/* MEMEFLOW_V30_3_3D_LIGHTWEIGHT
   Performance scheduler only. Visual topology and interaction semantics stay unchanged. */
const MF3D_MOBILE_QUERY_V303 = window.matchMedia('(max-width: 900px)');
const MF3D_FRAME_V303 = new Map();

function mf3dIsMobileV303() {
  return MF3D_MOBILE_QUERY_V303.matches;
}

function mf3dFrameBudgetV303(key, mobileFps = 30, desktopFps = 45) {
  if (document.hidden) return false;

  const now = performance.now();
  const fps = mf3dIsMobileV303() ? mobileFps : desktopFps;
  const minDelta = 1000 / Math.max(1, fps);
  const last = MF3D_FRAME_V303.get(key) || 0;

  if (now - last < minDelta) return false;

  MF3D_FRAME_V303.set(key, now);
  return true;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    MF3D_FRAME_V303.clear();
  }
});
'''
    return text.replace(anchor, anchor + helper, 1)

def gate_self_scheduling_loop(text: str, name: str, mobile_fps: int, desktop_fps: int):
    marker = f"MF_V303_GATE_{name}"
    if marker in text:
        return text, False

    pattern = re.compile(
        rf"(function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{\s*"
        rf"requestAnimationFrame\(\s*{re.escape(name)}\s*\);\s*)",
        re.S,
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"Could not locate self-scheduling RAF loop: {name}")

    gate = (
        match.group(1)
        + f"\n  // {marker}\n"
        + f"  if (!mf3dFrameBudgetV303('{name}', {mobile_fps}, {desktop_fps})) return;\n"
    )
    return text[:match.start()] + gate + text[match.end():], True

def gate_end_scheduling_loop(text: str, name: str, mobile_fps: int, desktop_fps: int):
    marker = f"MF_V303_GATE_{name}"
    if marker in text:
        return text, False

    start_token = f"function {name}("
    start = text.find(start_token)
    if start < 0:
        raise RuntimeError(f"Could not locate function: {name}")

    next_timeout = text.find("\nsetTimeout(", start)
    if next_timeout < 0:
        raise RuntimeError(f"Could not locate end boundary for: {name}")

    block = text[start:next_timeout]
    raf_pattern = re.compile(
        rf"\n\s*requestAnimationFrame\(\s*{re.escape(name)}\s*\);\s*",
        re.S,
    )
    block_without_raf, n = raf_pattern.subn("\n", block)
    if n < 1:
        raise RuntimeError(f"Could not locate end RAF call in: {name}")

    open_brace = block_without_raf.find("{")
    if open_brace < 0:
        raise RuntimeError(f"Malformed function block: {name}")

    injected = (
        block_without_raf[:open_brace + 1]
        + f"\n  // {marker}\n"
        + f"  requestAnimationFrame({name});\n"
        + f"  if (!mf3dFrameBudgetV303('{name}', {mobile_fps}, {desktop_fps})) return;\n"
        + block_without_raf[open_brace + 1:]
    )

    return text[:start] + injected + text[next_timeout:], True

def replace_exact(text: str, old: str, new: str, label: str, required=False):
    if new in text:
        return text, False
    if old not in text:
        if required:
            raise RuntimeError(f"Target not found: {label}")
        log(f"{label}: pattern not present, skipped.")
        return text, False
    return text.replace(old, new, 1), True

try:
    original = SYSTEM.read_text(encoding="utf-8")
    text = original

    text = add_runtime_budget(text)

    text, _ = gate_self_scheduling_loop(text, "animate", 30, 45)

    loop_budgets = [
        ("premiumAnimationV11", 20, 30),
        ("controlRoomLoopV14", 20, 30),
        ("mf20Animate", 18, 24),
        ("mf22AnimationLoop", 18, 24),
        ("mf23Animate", 18, 24),
        ("mf28Animate", 30, 45),
    ]
    for name, mobile, desktop in loop_budgets:
        text, _ = gate_self_scheduling_loop(text, name, mobile, desktop)

    text, _ = gate_end_scheduling_loop(
        text,
        "reinforceCinematicPulseV12",
        20,
        30,
    )

    text, _ = replace_exact(
        text,
        "app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));",
        "app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mf3dIsMobileV303() ? 1.5 : 1.8));",
        "mobile pixel ratio cap",
        required=True,
    )

    text, _ = replace_exact(
        text,
        "setInterval(refreshTelemetry, 2500);",
        "setInterval(refreshTelemetry, 4000);",
        "telemetry polling",
        required=True,
    )

    text, _ = replace_exact(
        text,
        """setInterval(
  () => {
    syncRealitySpeedsV8(false);
  },
  900
);""",
        """setInterval(
  () => {
    if (!document.hidden) syncRealitySpeedsV8(false);
  },
  1500
);""",
        "reality speed polling",
        required=True,
    )

    text, _ = replace_exact(
        text,
        """setInterval(
    mf26HideLegacyParticles,
    250
  );""",
        """setInterval(
    mf26HideLegacyParticles,
    500
  );""",
        "legacy particle cleanup",
        required=False,
    )

    if text == original:
        log("Nothing to change - patch is already installed.")
        sys.exit(0)

    SYSTEM.write_text(text, encoding="utf-8")

    check = subprocess.run(
        ["node", "--check", str(SYSTEM)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if check.returncode != 0:
        raise RuntimeError(check.stderr or check.stdout or "node --check failed")

    expected = [
        "MF_V303_GATE_animate",
        "MF_V303_GATE_premiumAnimationV11",
        "MF_V303_GATE_reinforceCinematicPulseV12",
        "MF_V303_GATE_controlRoomLoopV14",
        "MF_V303_GATE_mf20Animate",
        "MF_V303_GATE_mf22AnimationLoop",
        "MF_V303_GATE_mf23Animate",
        "MF_V303_GATE_mf28Animate",
    ]
    current = SYSTEM.read_text(encoding="utf-8")
    missing = [x for x in expected if current.count(x) != 1]
    if missing:
        raise RuntimeError("Frame-gate validation failed: " + ", ".join(missing))

    log("INSTALL COMPLETE")
    log(f"Project: {ROOT}")
    log(f"Backup:  {BACKUP}")
    log("3D topology/colors/layout untouched.")
    log("Main mobile render budget: 30 FPS; desktop: 45 FPS.")
    log("Secondary visual loops: 18-30 FPS.")
    log("Hidden tab: expensive animation work pauses.")
    log("Restart the Replit app/workflow and hard-refresh Safari.")

except Exception as exc:
    rollback(exc)
