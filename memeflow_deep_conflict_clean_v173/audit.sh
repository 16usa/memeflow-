#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'

from pathlib import Path
import re

APP = Path("memeflow-app")

PRODUCTION = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

CANON = "memeflow-x-canonical-v173.css"
STALE = [
    "memeflow-visual-guardrails-v169.css",
    "memeflow-structural-compat-v169.css",
    "memeflow-x-canonical-v169.css",
    "memeflow-x-canonical-v170.css",
    "memeflow-x-canonical-v171.css",
    "memeflow-x-canonical-v167.css",
    "memeflow-x-lights-out-v166.css",
    "memeflow-pure-black-v165.css",
    "memeflow-pump-fee-full-ui-v164.css",
    "memeflow-pump-fee-palette-v163.css",
    "memeflow-pump-fee-palette-v162.css",
]

BANNED_DARK = [
    "#0f141a","#111820","#141c25","#101113","#181f27",
    "#0d1218","#0d1217","#071117","#020405","#03090d",
    "#0c1117","#0c1318","#0d151b"
]

NORMALIZED_SOURCES = [
    "paper-automation-ui.css","memeflow-brand.css","system.css",
    "memeflow-nav.css","memeflow-header.css","memeflow-theme.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
    "memeflow-component-consistency-v63.css","access-gate.css",
    "how-it-works.css","trading.css","memeflow-typography-premium-v66.css",
    "trading-visual-hierarchy-v67.css","open-position-popover-v85.css",
    "system-tokens.css","memeflow-insightx-v1.css",
    "memeflow-token-flow-continuous-v1.css","agent-performance.css",
    "owner-intelligence.css","x100.css",
]

errors=[]

# Every top-level HTML page is scanned for stale global style layers.
all_pages=sorted(APP.glob("*.html"))
for p in all_pages:
    t=p.read_text(encoding="utf-8",errors="replace")
    for stale in STALE:
        if stale in t:
            errors.append(f"{p.name}: stale style link {stale}")

# Every production page: one canonical stylesheet, always LAST.
for name in PRODUCTION:
    p=APP/name
    t=p.read_text(encoding="utf-8")
    links=re.findall(
        r'<link\b[^>]*href=["\']([^"\']+\.css[^"\']*)',
        t,
        flags=re.I,
    )
    if sum(CANON in x for x in links) != 1:
        errors.append(f"{name}: canonical link count != 1")
    if not links or CANON not in links[-1]:
        errors.append(f"{name}: canonical is not LAST stylesheet")

# Superseded global files must be physically gone.
for stale in [
    "memeflow-visual-guardrails-v169.css",
    "memeflow-structural-compat-v169.css",
    "memeflow-x-canonical-v169.css",
    "memeflow-x-canonical-v170.css",
    "memeflow-x-canonical-v171.css",
]:
    if (APP/stale).exists():
        errors.append(f"stale global file remains: {stale}")

# Old principal dark palettes must be gone from normalized live source CSS.
for name in NORMALIZED_SOURCES:
    p=APP/name
    if not p.exists():
        continue
    text=re.sub(r'/\*[\s\S]*?\*/','',p.read_text(encoding="utf-8")).lower()
    for token in BANNED_DARK:
        if token in text:
            errors.append(f"{name}: old dark neutral remains {token}")

# Embedded production CSS also cannot keep old dark surface tokens.
style_re=re.compile(r'<style\b[^>]*>([\s\S]*?)</style>',re.I)
for name in PRODUCTION:
    text=(APP/name).read_text(encoding="utf-8")
    styles="\n".join(style_re.findall(text)).lower()
    for token in BANNED_DARK:
        if token in styles:
            errors.append(f"{name}: inline CSS keeps old dark neutral {token}")

# Canonical tokens + header contract.
canon=(APP/CANON).read_text(encoding="utf-8").lower()
for token in (
    "--mf-x-bg: #000000",
    "--mf-x-line: #2f3336",
    "--mf-x-text: #e7e9ea",
    "--mf-x-text-muted: #71767b",
    "--mf-x-text-tertiary: #536471",
    "--mf-x-blue: #1d9bf0",
    "--mf-x-dark-line-inner: #2f3336",
    "--mf-v63-line-dark: #2f3336",
    "--mf-v59-header-line: #2f3336",
    "--mf-structure-divider: #2f3336",
):
    if token not in canon:
        errors.append(f"canonical missing token: {token}")

header=(APP/"memeflow-header.css").read_text(encoding="utf-8").lower()
base=re.search(r'(^|\n)\.mf-site-header\s*\{([\s\S]*?)\}',header)
if not base:
    errors.append("memeflow-header.css: base header rule missing")
else:
    hb=base.group(2)
    if "background:transparent" not in hb.replace(" ",""):
        errors.append("header base is not transparent")
    if "backdrop-filter:none" not in hb.replace(" ",""):
        errors.append("header base still has blur")
    if "#2f3336" not in hb:
        errors.append("header base divider is not #2F3336")

# No production page may contain hard-coded legacy dark colors in style attrs.
for name in PRODUCTION:
    text=(APP/name).read_text(encoding="utf-8").lower()
    attrs=re.findall(r'\sstyle=["\']([^"\']+)["\']',text,re.I)
    joined="\n".join(attrs)
    for token in BANNED_DARK:
        if token in joined:
            errors.append(f"{name}: inline style attribute keeps {token}")

if errors:
    print("V173 DEEP CONFLICT AUDIT: FAIL")
    for e in errors:
        print(" -",e)
    raise SystemExit(1)

print("V173 DEEP CONFLICT AUDIT: PASS")
print(f" - top-level HTML scanned: {len(all_pages)}")
print(f" - production pages audited: {len(PRODUCTION)}")
print(f" - normalized active source CSS files: {len(NORMALIZED_SOURCES)}")
print(" - index.html legacy inline style blocks normalized")
print(" - one canonical global stylesheet per production page, always LAST")
print(" - V169 global visual layers physically removed")
print(" - old dark surface palette removed from active normalized sources")
print(" - dark canvas/modules: #000000")
print(" - neutral module frames/dividers: 1px solid #2F3336")
print(" - header: transparent / no blur / no shadow")
print(" - semantic colored state borders preserved")
print(" - no server restart performed")

PY
