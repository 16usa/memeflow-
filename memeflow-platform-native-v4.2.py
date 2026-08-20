#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4_2"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print("[PLATFORM-V4.2] " + str(msg), flush=True)

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
BACKUP_DIR = ROOT / (".platform-v4-2-backup-" + STAMP)
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

def parse_functions(text):
    pattern = re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{")
    out = {}

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
                    out[name] = {
                        "start": m.start(),
                        "brace": brace,
                        "end": i,
                        "body": text[brace + 1:i],
                    }
                    break

            i += 1

    return out

def replace_function_body(text, fn, body):
    return text[:fn["brace"] + 1] + body + text[fn["end"]:]

def rollback(reason):
    log("ERROR: " + str(reason))

    if BACKUP.exists():
        shutil.copy2(BACKUP, SYSTEM)
        log("system.js restored")

    log("ROLLBACK COMPLETE")
    sys.exit(1)

try:
    log("root: " + str(ROOT))

    text = SYSTEM.read_text(encoding="utf-8")

    if PATCH_ID in text:
        log("V4.2 already installed")
        sys.exit(0)

    required = [
        "MEMEFLOW_PLATFORM_NATIVE_DIRECT_V4",
        "function mf293Build()",
        "function mf293Open()",
        "function mfPlatformV4Mount()",
        "function mfPlatformV4NativeSelect()",
        "/api/discovery-source",
    ]

    for token in required:
        if token not in text:
            raise RuntimeError("required V4/MF293 anchor missing: " + token)

    for old in [
        "MEMEFLOW_DISCOVERY_SETTINGS_UI_V1",
        "MEMEFLOW_DISCOVERY_PLATFORM_DROPDOWN_V2",
        "MEMEFLOW_DISCOVERY_NATIVE_PLATFORM_V3",
    ]:
        if old in text:
            raise RuntimeError("old UI layer is present again: " + old)

    shutil.copy2(SYSTEM, BACKUP)
    log("backup: " + str(BACKUP))

    # --------------------------------------------------------------
    # 1. Remove every direct mfPlatformV4Mount() invocation from
    #    mf293Build. V4.1 accidentally put it back into the same function.
    # --------------------------------------------------------------
    funcs = parse_functions(text)
    build = funcs.get("mf293Build")
    if not build:
        raise RuntimeError("mf293Build() not found")

    body = build["body"]
    mount_count = body.count("mfPlatformV4Mount();")

    if mount_count:
        body = body.replace("mfPlatformV4Mount();", "")
        text = replace_function_body(text, build, body)
        log("removed " + str(mount_count) + " premature mount call(s) from mf293Build")
    else:
        log("no premature mount remained in mf293Build")

    # --------------------------------------------------------------
    # 2. Make the Platform value ITSELF a visible native select.
    #    No transparent overlay. The user taps the actual <select>.
    # --------------------------------------------------------------
    old_style = """  Object.assign(select.style, {
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

    new_style = """  Object.assign(select.style, {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    margin: '0',
    padding: '0 18px 0 0',
    border: '0',
    outline: '0',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    fontSize: '16px',
    WebkitAppearance: 'none',
    appearance: 'none',
    cursor: 'pointer'
  });"""

    if old_style not in text:
        raise RuntimeError("V4.1 transparent select style block not found")

    text = text.replace(old_style, new_style, 1)

    old_mount = """  const select = mfPlatformV4NativeSelect();

  // Keep the original visible value and put the REAL native select over
  // the whole Platform card. iOS receives the tap directly on <select>.
  card.style.position = 'relative';
  card.appendChild(select);

  MF_PLATFORM_V4.valueNode = valueNode;
  MF_PLATFORM_V4.select = select;
  mfPlatformV4Load();"""

    new_mount = """  const select = mfPlatformV4NativeSelect();

  // Replace the static Pump.fun text with the actual native <select>.
  // This is the same browser control type used by the working settings.
  valueNode.replaceWith(select);

  MF_PLATFORM_V4.valueNode = null;
  MF_PLATFORM_V4.select = select;
  mfPlatformV4Load();"""

    if old_mount not in text:
        raise RuntimeError("V4.1 overlay mount block not found")

    text = text.replace(old_mount, new_mount, 1)

    # --------------------------------------------------------------
    # 3. Mount from mf293Open AFTER mf293Build() has created/showed
    #    the settings DOM. Use one RAF + one short retry; no observer.
    # --------------------------------------------------------------
    funcs = parse_functions(text)
    open_fn = funcs.get("mf293Open")

    if not open_fn:
        raise RuntimeError("mf293Open() not found")

    open_body = open_fn["body"]

    # Remove V4.2 block if somehow partially present.
    if "MF_PLATFORM_V4_2_MOUNT" in open_body:
        raise RuntimeError("V4.2 mount block unexpectedly already present")

    anchor = "mf293Build();"

    if anchor in open_body:
        injection = """mf293Build();

  // MF_PLATFORM_V4_2_MOUNT
  requestAnimationFrame(() => {
    mfPlatformV4Mount();
    setTimeout(() => mfPlatformV4Mount(), 80);
  });"""
        open_body = open_body.replace(anchor, injection, 1)
        log("mounted V4 from mf293Open immediately after mf293Build")
    else:
        # Safe fallback: append at function end, still tied to Settings open.
        open_body = open_body.rstrip() + """
  // MF_PLATFORM_V4_2_MOUNT
  requestAnimationFrame(() => {
    mfPlatformV4Mount();
    setTimeout(() => mfPlatformV4Mount(), 80);
  });
"""
        log("mf293Open had no direct mf293Build(); call; mounted at mf293Open end")

    text = replace_function_body(text, open_fn, open_body)

    # --------------------------------------------------------------
    # 4. Keep the select itself as the displayed current value.
    #    Old valueNode sync code becomes irrelevant but harmless; remove
    #    it to make behavior deterministic.
    # --------------------------------------------------------------
    patterns = [
        """    if (MF_PLATFORM_V4.valueNode) {
      MF_PLATFORM_V4.valueNode.textContent = mfPlatformV4Label(MF_PLATFORM_V4.mode);
    }
""",
        """      if (MF_PLATFORM_V4.valueNode) {
        MF_PLATFORM_V4.valueNode.textContent = mfPlatformV4Label(MF_PLATFORM_V4.mode);
      }
""",
        """      if (MF_PLATFORM_V4.valueNode) {
        MF_PLATFORM_V4.valueNode.textContent = mfPlatformV4Label(previous);
      }
""",
    ]

    for block in patterns:
        text = text.replace(block, "")

    text += "\n// " + PATCH_ID + "\n"

    SYSTEM.write_text(text, encoding="utf-8")
    log("patched system.js")

    rc, output = node_check(SYSTEM)

    if rc != 0:
        raise RuntimeError("system.js syntax check failed:\n" + output)

    final = SYSTEM.read_text(encoding="utf-8")
    funcs = parse_functions(final)

    build_final = funcs["mf293Build"]["body"]
    open_final = funcs["mf293Open"]["body"]

    if "mfPlatformV4Mount();" in build_final:
        raise RuntimeError("premature mount still exists in mf293Build")

    if "MF_PLATFORM_V4_2_MOUNT" not in open_final:
        raise RuntimeError("mf293Open V4.2 mount block missing")

    if "valueNode.replaceWith(select);" not in final:
        raise RuntimeError("Platform static value is not replaced by native select")

    if final.count("// " + PATCH_ID) != 1:
        raise RuntimeError("V4.2 marker count validation failed")

    log("system.js syntax OK")
    log("INSTALL COMPLETE")
    log("Platform mount moved to mf293Open (the actual Settings-open path)")
    log("Pump.fun text is replaced by a visible real native <select>")
    log("one requestAnimationFrame + one 80ms retry; no MutationObserver")
    log("no transparent overlay")
    log("no custom dropdown")
    log("no new CSS layer/file")
    log("options: Pump.fun / DEX / Hybrid")
    log("Close the Settings panel, hard-refresh once, then open Settings again.")

except Exception as exc:
    rollback(exc)
