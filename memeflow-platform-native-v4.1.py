#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4_1"
V4_MARKER = "MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print("[PLATFORM-V4.1] " + str(msg), flush=True)

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
        if (root / "system.js").is_file() and (root / "app-server.mjs").is_file():
            return root

    for base in [Path("/home/runner/workspace"), Path.cwd()]:
        if not base.exists():
            continue
        for p in base.glob("**/system.js"):
            if (p.parent / "app-server.mjs").is_file():
                return p.parent.resolve()

    raise RuntimeError("MEMEFLOW root not found")

ROOT = find_root()
SYSTEM = ROOT / "system.js"
BACKUP_DIR = ROOT / (".platform-v4-1-backup-" + STAMP)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
BACKUP = BACKUP_DIR / "system.js"

def node_check(path):
    r = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True
    )
    return r.returncode, (r.stderr or r.stdout or "").strip()

def rollback(reason):
    log("ERROR: " + str(reason))
    if BACKUP.exists():
        shutil.copy2(BACKUP, SYSTEM)
        log("system.js restored")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def parse_named_functions(text):
    pattern = re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{")
    funcs = []

    for m in pattern.finditer(text):
        name = m.group(1)
        brace = text.find("{", m.start())
        depth = 0
        quote = None
        escape = False
        i = brace

        while i < len(text):
            ch = text[i]

            if quote:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == quote:
                    quote = None
                i += 1
                continue

            if ch in ("'", '"', "`"):
                quote = ch
                i += 1
                continue

            if ch == "/" and i + 1 < len(text):
                nxt = text[i + 1]
                if nxt == "/":
                    j = text.find("\n", i + 2)
                    i = len(text) if j < 0 else j
                    continue
                if nxt == "*":
                    j = text.find("*/", i + 2)
                    if j < 0:
                        raise RuntimeError("unterminated comment in " + name)
                    i = j + 2
                    continue

            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    funcs.append({
                        "name": name,
                        "start": m.start(),
                        "brace": brace,
                        "end": i,
                        "body": text[brace + 1:i],
                    })
                    break
            i += 1

    return funcs

try:
    log("root: " + str(ROOT))

    text = SYSTEM.read_text(encoding="utf-8")

    if PATCH_ID in text:
        log("V4.1 already installed")
        sys.exit(0)

    if V4_MARKER not in text:
        raise RuntimeError("V4 is not installed; V4.1 expects the clean V4 base")

    old_markers = [
        "MEMEFLOW_DISCOVERY_SETTINGS_UI_V1",
        "MEMEFLOW_DISCOVERY_PLATFORM_DROPDOWN_V2",
        "MEMEFLOW_DISCOVERY_NATIVE_PLATFORM_V3",
    ]
    present_old = [m for m in old_markers if m in text]
    if present_old:
        raise RuntimeError("old UI layers reappeared: " + ", ".join(present_old))

    shutil.copy2(SYSTEM, BACKUP)
    log("backup: " + str(BACKUP))

    # 1) Remove the too-early mount call from mf293Build only.
    funcs = parse_named_functions(text)
    build = next((f for f in funcs if f["name"] == "mf293Build"), None)
    if not build:
        raise RuntimeError("mf293Build() not found")

    build_body = build["body"]
    count_in_build = build_body.count("mfPlatformV4Mount();")
    if count_in_build != 1:
        raise RuntimeError(
            "expected exactly one V4 mount in mf293Build, found "
            + str(count_in_build)
        )

    new_build_body = build_body.replace("mfPlatformV4Mount();", "", 1)
    text = text[:build["brace"] + 1] + new_build_body + text[build["end"]:]

    # 2) Convert the V4 native select into a full-card native tap target.
    old_style = """  Object.assign(select.style, {
    width: '100%',
    maxWidth: '100%',
    margin: '0',
    padding: '0 22px 0 0',
    border: '0',
    outline: '0',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    WebkitAppearance: 'none',
    appearance: 'none',
    cursor: 'pointer'
  });"""

    new_style = """  Object.assign(select.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '5',
    width: '100%',
    height: '100%',
    margin: '0',
    padding: '0',
    border: '0',
    borderRadius: 'inherit',
    background: 'transparent',
    color: 'transparent',
    opacity: '0.001',
    fontSize: '16px',
    WebkitAppearance: 'menulist',
    appearance: 'auto',
    cursor: 'pointer'
  });"""

    if text.count(old_style) != 1:
        raise RuntimeError(
            "V4 select style anchor changed; refusing blind replacement"
        )
    text = text.replace(old_style, new_style, 1)

    old_mount = """  const select = mfPlatformV4NativeSelect();

  // Replace the static Pump.fun text at build-time.
  valueNode.replaceWith(select);

  MF_PLATFORM_V4.select = select;
  mfPlatformV4Load();"""

    new_mount = """  const select = mfPlatformV4NativeSelect();

  // Keep the original visible value and put the REAL native select over
  // the whole Platform card. iOS receives the tap directly on <select>.
  card.style.position = 'relative';
  card.appendChild(select);

  MF_PLATFORM_V4.valueNode = valueNode;
  MF_PLATFORM_V4.select = select;
  mfPlatformV4Load();"""

    if text.count(old_mount) != 1:
        raise RuntimeError(
            "V4 mount anchor changed; refusing blind replacement"
        )
    text = text.replace(old_mount, new_mount, 1)

    # Keep the visible Pump.fun/DEX/Hybrid text synchronized.
    old_load = """    if (MF_PLATFORM_V4.select) {
      MF_PLATFORM_V4.select.value = MF_PLATFORM_V4.mode;
    }

    mfPlatformV4ApplyCompatibility(MF_PLATFORM_V4.mode);"""

    new_load = """    if (MF_PLATFORM_V4.select) {
      MF_PLATFORM_V4.select.value = MF_PLATFORM_V4.mode;
    }
    if (MF_PLATFORM_V4.valueNode) {
      MF_PLATFORM_V4.valueNode.textContent = mfPlatformV4Label(MF_PLATFORM_V4.mode);
    }

    mfPlatformV4ApplyCompatibility(MF_PLATFORM_V4.mode);"""

    if text.count(old_load) != 1:
        raise RuntimeError("V4 load anchor changed")
    text = text.replace(old_load, new_load, 1)

    old_success = """      MF_PLATFORM_V4.mode = String(body?.source?.mode || next).toLowerCase();
      select.value = MF_PLATFORM_V4.mode;
      mfPlatformV4ApplyCompatibility(MF_PLATFORM_V4.mode);"""

    new_success = """      MF_PLATFORM_V4.mode = String(body?.source?.mode || next).toLowerCase();
      select.value = MF_PLATFORM_V4.mode;
      if (MF_PLATFORM_V4.valueNode) {
        MF_PLATFORM_V4.valueNode.textContent = mfPlatformV4Label(MF_PLATFORM_V4.mode);
      }
      mfPlatformV4ApplyCompatibility(MF_PLATFORM_V4.mode);"""

    if text.count(old_success) != 1:
        raise RuntimeError("V4 success anchor changed")
    text = text.replace(old_success, new_success, 1)

    old_catch = """      MF_PLATFORM_V4.mode = previous;
      select.value = previous;"""

    new_catch = """      MF_PLATFORM_V4.mode = previous;
      select.value = previous;
      if (MF_PLATFORM_V4.valueNode) {
        MF_PLATFORM_V4.valueNode.textContent = mfPlatformV4Label(previous);
      }"""

    if text.count(old_catch) != 1:
        raise RuntimeError("V4 catch anchor changed")
    text = text.replace(old_catch, new_catch, 1)

    # 3) Find the REAL function that renders the top summary cards.
    funcs = parse_named_functions(text)
    scored = []

    anchors = [
        ("Platform", 7),
        ("Pump.fun", 7),
        ("AI policy", 5),
        ("Propose only", 4),
        ("Kill switch", 5),
        ("Off", 2),
    ]

    for f in funcs:
        body = f["body"]
        score = sum(weight for token, weight in anchors if token in body)
        if "Platform" in body and "Pump.fun" in body:
            scored.append((score, f))

    if not scored:
        raise RuntimeError(
            "could not find the function that renders Platform/Pump.fun"
        )

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score = scored[0][0]
    best = [f for score, f in scored if score == best_score]

    if len(best) != 1:
        names = ", ".join(f["name"] for f in best)
        raise RuntimeError(
            "Platform render function is ambiguous: " + names
        )

    render = best[0]
    log(
        "Platform render function: "
        + render["name"]
        + " (score=" + str(best_score) + ")"
    )

    # Insert after its DOM work completes, immediately before function return.
    body = render["body"]
    if "mfPlatformV4Mount();" in body:
        raise RuntimeError(
            "render function already contains a V4 mount unexpectedly"
        )

    new_body = body.rstrip() + "\n  mfPlatformV4Mount();\n"
    text = text[:render["brace"] + 1] + new_body + text[render["end"]:]

    # Add a distinct V4.1 marker without adding a new runtime layer.
    text += "\n// " + PATCH_ID + "\n"

    SYSTEM.write_text(text, encoding="utf-8")
    log("patched system.js")

    rc, output = node_check(SYSTEM)
    if rc != 0:
        raise RuntimeError("system.js syntax check failed:\n" + output)

    final = SYSTEM.read_text(encoding="utf-8")

    if final.count("mfPlatformV4Mount();") != 1:
        raise RuntimeError(
            "expected exactly one V4 mount after patch; found "
            + str(final.count("mfPlatformV4Mount();"))
        )

    if final.count("// " + PATCH_ID) != 1:
        raise RuntimeError("V4.1 marker validation failed")

    log("system.js syntax OK")
    log("INSTALL COMPLETE")
    log("early mf293Build mount removed")
    log("native select now mounts after the real Platform cards render")
    log("the entire PLATFORM card is the native <select> tap target")
    log("no MutationObserver")
    log("no custom dropdown")
    log("no new CSS layer/file")
    log("Hard-refresh System settings.")

except Exception as exc:
    rollback(exc)
