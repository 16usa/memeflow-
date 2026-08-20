#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print("[PLATFORM-CLEAN-DIAG] " + str(msg), flush=True)

def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace"),
        Path("/home/runner/workspace/memeflow-app"),
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
        for p in base.glob("**/system.js"):
            if p.is_file():
                return p.parent.resolve()

    raise RuntimeError("Could not locate memeflow-app/system.js")

ROOT = find_root()
SYSTEM = ROOT / "system.js"

# The first UI patch created this backup BEFORE any of V1/V2/V3 was installed.
backups = sorted(
    p for p in ROOT.glob(".discovery-settings-ui-v1-backup-*")
    if (p / "system.js").is_file()
)

if not backups:
    raise RuntimeError(
        "Clean pre-V1 backup not found. Expected "
        ".discovery-settings-ui-v1-backup-*/system.js"
    )

# Earliest backup is the cleanest pre-platform-UI version.
CLEAN_BACKUP = backups[0] / "system.js"

SAFETY = ROOT / (".platform-before-clean-restore-" + STAMP)
SAFETY.mkdir(parents=True, exist_ok=True)
CURRENT_COPY = SAFETY / "system.js"
REPORT = ROOT / "platform-native-diagnostic.txt"

def node_check(path):
    r = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True
    )
    return r.returncode, (r.stderr or r.stdout or "").strip()

def excerpt(text, needle, radius=1800):
    low = text.lower()
    pos = low.find(needle.lower())
    if pos < 0:
        return f"[NOT FOUND] {needle}\n"
    start = max(0, pos - radius)
    end = min(len(text), pos + len(needle) + radius)
    return (
        f"\n===== {needle} @ {pos} =====\n"
        + text[start:end]
        + "\n===== END =====\n"
    )

try:
    log("root: " + str(ROOT))
    log("clean backup: " + str(CLEAN_BACKUP))

    current = SYSTEM.read_text(encoding="utf-8")
    current_markers = [
        "MEMEFLOW_DISCOVERY_SETTINGS_UI_V1",
        "MEMEFLOW_DISCOVERY_PLATFORM_DROPDOWN_V2",
        "MEMEFLOW_DISCOVERY_NATIVE_PLATFORM_V3",
    ]

    log("current platform UI markers:")
    for marker in current_markers:
        log(f"  {marker}: {current.count(marker)}")

    # Preserve current broken state before restoring anything.
    shutil.copy2(SYSTEM, CURRENT_COPY)
    log("safety copy: " + str(CURRENT_COPY))

    # Validate the clean backup before replacing the live file.
    rc, out = node_check(CLEAN_BACKUP)
    if rc != 0:
        raise RuntimeError("clean backup node --check failed:\n" + out)

    clean = CLEAN_BACKUP.read_text(encoding="utf-8")

    for marker in current_markers:
        if marker in clean:
            raise RuntimeError(
                "selected backup is not clean; found marker " + marker
            )

    shutil.copy2(CLEAN_BACKUP, SYSTEM)

    rc, out = node_check(SYSTEM)
    if rc != 0:
        shutil.copy2(CURRENT_COPY, SYSTEM)
        raise RuntimeError(
            "restored system.js failed syntax check; current file restored:\n" + out
        )

    log("CLEAN system.js restored")
    log("system.js syntax OK")
    log("V1/V2/V3 UI layers removed")

    restored = SYSTEM.read_text(encoding="utf-8")

    needles = [
        "System settings",
        "Operating mode",
        "Trading environment",
        "Profile",
        "Platform",
        "Restore defaults",
        "Save settings",
        "<select",
        "createElement('select')",
        'createElement("select")',
    ]

    parts = []
    parts.append("MEMEFLOW PLATFORM NATIVE SELECT DIAGNOSTIC\n")
    parts.append("ROOT: " + str(ROOT) + "\n")
    parts.append("SYSTEM: " + str(SYSTEM) + "\n")
    parts.append("CLEAN_BACKUP: " + str(CLEAN_BACKUP) + "\n")
    parts.append("SAFETY_COPY: " + str(CURRENT_COPY) + "\n")
    parts.append("\nCOUNTS\n")
    for marker in current_markers:
        parts.append(f"{marker}: {restored.count(marker)}\n")

    for needle in needles:
        parts.append(excerpt(restored, needle))

    REPORT.write_text("".join(parts), encoding="utf-8")

    log("diagnostic report: " + str(REPORT))
    log("")
    log("IMPORTANT:")
    log("The System settings page is now back to the clean pre-platform-patch UI.")
    log("Do NOT install V1/V2/V3 again.")
    log("")
    log("Now run this ONE command and send me the output:")
    log(
        "python3 - <<'PY'\n"
        "from pathlib import Path\n"
        "p=Path('/home/runner/workspace/memeflow-app/platform-native-diagnostic.txt')\n"
        "print(p.read_text() if p.exists() else 'REPORT NOT FOUND')\n"
        "PY"
    )

except Exception as e:
    log("ERROR: " + str(e))
    sys.exit(1)
