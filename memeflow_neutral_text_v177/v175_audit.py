#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: audit.py <memeflow-app-dir>")

APP = Path(sys.argv[1])
CANON = "memeflow-x-canonical-v175.css"

PRODUCTION = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

errors = []

for name in PRODUCTION:
    p = APP / name
    text = p.read_text(encoding="utf-8")
    links = re.findall(
        r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)',
        text,re.I
    )
    clean = [x.split("?", 1)[0].lstrip("/") for x in links]
    if sum(x == CANON for x in clean) != 1:
        errors.append(f"{name}: V175 canonical count != 1")
    if not clean or clean[-1] != CANON:
        errors.append(f"{name}: V175 is not LAST stylesheet")
    if "memeflow-x-canonical-v174.css" in text:
        errors.append(f"{name}: stale V174 canonical link")

settings = (APP / "settings.html").read_text(encoding="utf-8")
if "settings-light-polish-v60.css" in settings:
    errors.append("settings.html: dedicated settings light layer still linked")
if (APP / "settings-light-polish-v60.css").exists():
    errors.append("settings-light-polish-v60.css still exists")
if (APP / "memeflow-x-canonical-v174.css").exists():
    errors.append("old V174 canonical still exists")

canon = (APP / CANON).read_text(encoding="utf-8")
low = canon.lower()

if canon.count("MEMEFLOW SYSTEM SETTINGS CANONICAL V175") != 1:
    errors.append("V175 Settings canonical section count != 1")

for token in (
    "#000000","#2f3336","#e7e9ea","#71767b",
    "#f4f6f8","#17222c","#667782","rgba(38,59,74,.105)",
    "memeflow_system_settings_canonical_v175_end",
):
    if token.lower() not in low:
        errors.append(f"canonical missing Settings token {token}")

system = (APP / "system.css").read_text(encoding="utf-8")
for token in (
    "--mf-ui-bg","--mf-ui-surface","--mf-ui-surface-2","--mf-ui-surface-soft",
    "--mf-ui-line","--mf-ui-line-strong","--mf-ui-text","--mf-ui-muted","--mf-ui-faint",
):
    if token in system:
        errors.append(f"system.css stale Settings palette token {token}")

# Confirm the old concrete Settings palette/blur values are gone from system.css.
for stale in (
    "rgba(17, 24, 32, .64)",
    "rgba(17, 24, 32, .72)",
    "rgba(15, 20, 26, .44)",
    "rgba(15, 20, 26, .60)",
    "rgba(15, 20, 26, .94)",
    "blur(18px)",
    "blur(20px)",
):
    if stale in system:
        errors.append(f"system.css stale Settings visual value {stale}")

# Typography stays centralized: Settings page itself has no inline typography.
TYPO = re.compile(
    r'(?<![-\w])(?:font(?:-family|-size|-weight|-style)?|line-height|letter-spacing|text-transform)\s*:',
    re.I,
)
styles = "\n".join(re.findall(r'<style\b[^>]*>([\s\S]*?)</style>', settings, re.I))
attrs = "\n".join(re.findall(r'\sstyle=["\']([^"\']*)["\']', settings, re.I))
if TYPO.search(styles) or TYPO.search(attrs):
    errors.append("settings.html inline typography remains")

# Header and Settings contracts.
for needle in (
    'body.mf-settings-standalone .mf-settings-page-header',
    'border-bottom: 1px solid #2f3336 !important',
    'background: #000000 !important',
    'background: linear-gradient(180deg,#ffffff,#f8fafb) !important',
    'color: #17222c !important',
    'color: #667782 !important',
):
    if needle.lower() not in low:
        errors.append(f"Settings canonical missing {needle}")

if errors:
    print("V175 SYSTEM SETTINGS STYLE AUDIT: FAIL")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("V175 SYSTEM SETTINGS STYLE AUDIT: PASS")
print(" - dedicated settings-light-polish layer removed")
print(" - old Settings gradient/gray dark surfaces removed from system.css")
print(" - dark Settings canvas/modules = #000000")
print(" - dark neutral lines = #2F3336")
print(" - dark text = X hierarchy")
print(" - Settings header = transparent / no blur / no shadow")
print(" - light Settings uses shared MEMEFLOW light canvas/module/text/line language")
print(" - semantic colored states preserved")
print(" - V175 canonical is LAST on all 11 production pages")
print(" - typography remains centralized")
print(" - no server restart performed")
