#!/usr/bin/env python3
from pathlib import Path
import shutil
import subprocess
import sys
import time

PATCH_ID = "MEMEFLOW_BRAND_ICONS_V27"

def log(msg):
    print(f"[ICONS-V27] {msg}", flush=True)

def find_root():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
        Path.home() / "workspace" / "memeflow-app",
    ]
    for p in candidates:
        try:
            p = p.resolve()
        except Exception:
            continue
        if (p / "system-tokens.js").is_file() and (p / "system-tokens.css").is_file():
            return p
    raise RuntimeError("MEMEFLOW project root not found")

ROOT = find_root()
JS = ROOT / "system-tokens.js"
CSS = ROOT / "system-tokens.css"

stamp = time.strftime("%Y%m%d-%H%M%S")
backup_dir = ROOT / f".icons-v27-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=True)

try:
    shutil.copy2(JS, backup_dir / JS.name)
    shutil.copy2(CSS, backup_dir / CSS.name)

    js = JS.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")

    if PATCH_ID in js:
        log("already installed")
        sys.exit(0)

    dex_old = '''<svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="5.1"></circle>
          <path d="M13.8 13.8L19 19"></path>
          <path d="M7.2 11.2L9.2 9.1L10.8 10.2L13 7.5"></path>
        </svg>'''

    dex_new = '''<svg
          class="brand-icon brand-icon-dex"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <path
            class="dex-owl"
            d="M16 2.6c-3 0-5.5 1-7.3 2.6L3.4 3l1.7 6.3c-.4 1.2-.6 2.5-.6 3.8 0 5 3.5 9.2 8.5 10.5L16 29l3-5.4c5-1.3 8.5-5.5 8.5-10.5 0-1.3-.2-2.6-.6-3.8L28.6 3l-5.3 2.2C21.5 3.6 19 2.6 16 2.6Z"
          ></path>
          <path
            class="dex-eye"
            d="M7.2 11.1c2.7-.4 5 .4 6.7 2.5-1 1.5-2.5 2.4-4.4 2.4-1.3 0-2.4-.4-3.3-1.1.1-1.6.4-2.9 1-3.8Zm17.6 0c-2.7-.4-5 .4-6.7 2.5 1 1.5 2.5 2.4 4.4 2.4 1.3 0 2.4-.4 3.3-1.1-.1-1.6-.4-2.9-1-3.8Z"
          ></path>
          <path
            class="dex-beak"
            d="M16 15.5 19.6 20 16 26.3 12.4 20 16 15.5Z"
          ></path>
        </svg>'''

    pump_old = '''<svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M6 16V8h7.2a3.8 3.8 0 010 7.6H9.7"></path>
          <path d="M16.8 8.7H20v3.2"></path>
          <path d="M19.7 9l-3.8 3.8"></path>
        </svg>'''

    pump_new = '''<svg
          class="brand-icon brand-icon-pump"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <g transform="rotate(-45 16 16)">
            <rect
              class="pump-capsule-outline"
              x="8"
              y="2.5"
              width="16"
              height="27"
              rx="8"
            ></rect>
            <path
              class="pump-capsule-fill"
              d="M8 15.8h16v5.7a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8v-5.7Z"
            ></path>
            <path
              class="pump-capsule-split"
              d="M8 15.8h16"
            ></path>
            <path
              class="pump-highlight"
              d="M11.5 20.2v2.7"
            ></path>
          </g>
        </svg>'''

    if js.count(dex_old) != 1:
        raise RuntimeError(
            f"temporary DexScreener icon expected once, found {js.count(dex_old)}"
        )
    if js.count(pump_old) != 1:
        raise RuntimeError(
            f"temporary Pump.fun icon expected once, found {js.count(pump_old)}"
        )

    js = js.replace(dex_old, dex_new, 1)
    js = js.replace(pump_old, pump_new, 1)

    css += '''

/* ===== MEMEFLOW BRAND ICONS V27 ===== */

.token-source-link .brand-icon {
  width: 15px !important;
  height: 15px !important;
  overflow: visible;
}

.token-source-link.dex .brand-icon-dex {
  fill: currentColor;
  stroke: none;
}

.token-source-link.dex .dex-owl {
  opacity: .98;
}

.token-source-link.dex .dex-eye,
.token-source-link.dex .dex-beak {
  fill: #061016;
}

.token-source-link.pump .brand-icon-pump {
  overflow: visible;
}

.token-source-link.pump .pump-capsule-outline {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.8;
}

.token-source-link.pump .pump-capsule-fill {
  fill: currentColor;
  stroke: none;
  opacity: .98;
}

.token-source-link.pump .pump-capsule-split {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
}

.token-source-link.pump .pump-highlight {
  fill: none;
  stroke: #061016;
  stroke-width: 1.6;
  stroke-linecap: round;
  opacity: .7;
}

.token-source-link.dex {
  color: #58d9ff !important;
}

.token-source-link.pump {
  color: #5ce09a !important;
}

@media (max-width: 760px) {
  .token-source-link .brand-icon {
    width: 14px !important;
    height: 14px !important;
  }
}
'''

    js = js.rstrip() + f"\n\n// {PATCH_ID}\n"

    JS.write_text(js, encoding="utf-8")
    CSS.write_text(css, encoding="utf-8")

    result = subprocess.run(
        ["node", "--check", str(JS)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)

    log("DexScreener magnifier replaced with owl mark")
    log("Pump.fun flag-like icon replaced with capsule mark")
    log("link logic untouched")
    log(f"backup: {backup_dir}")
    log("DONE — restart/reload the page")

except Exception as exc:
    log(f"ERROR: {exc}")
    for p in (JS, CSS):
        b = backup_dir / p.name
        if b.exists():
            shutil.copy2(b, p)
    log("ROLLBACK COMPLETE")
    sys.exit(1)
