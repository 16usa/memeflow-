#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: audit.py <memeflow-app-dir>")

APP = Path(sys.argv[1])
CANON = "memeflow-x-canonical-v176.css"

PAGES = [
    "index.html",
    "system.html",
    "how-it-works.html",
    "smart-vault.html",
    "trading.html",
    "settings.html",
    "system-tokens.html",
    "x100.html",
    "agent-performance.html",
    "owner-intelligence.html",
    "system-source.html",
]

errors = []

for name in PAGES:
    text = (APP / name).read_text(encoding="utf-8")
    links = re.findall(
        r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)',
        text,
        re.I,
    )
    clean = [x.split("?", 1)[0].lstrip("/") for x in links]

    if sum(x == CANON for x in clean) != 1:
        errors.append(f"{name}: V176 canonical count != 1")
    if not clean or clean[-1] != CANON:
        errors.append(f"{name}: V176 is not LAST stylesheet")

    for old in ("memeflow-x-canonical-v174.css", "memeflow-x-canonical-v175.css"):
        if old in text:
            errors.append(f"{name}: stale canonical link {old}")

for old in ("memeflow-x-canonical-v174.css", "memeflow-x-canonical-v175.css"):
    if (APP / old).exists():
        errors.append(f"stale canonical file remains: {old}")

canon = (APP / CANON).read_text(encoding="utf-8")
low = canon.lower()

required_tokens = {
    "--mf-type-system": "11px",
    "--mf-type-micro": "11px",
    "--mf-type-meta": "12px",
    "--mf-type-ui": "13px",
    "--mf-type-body": "14px",
    "--mf-type-panel": "15px",
    "--mf-type-title": "17px",
    "--mf-trading-type-body": "14px",
    "--mf-trading-type-meta": "12px",
    "--mf-trading-type-micro": "11px",
    "--mf-trading-type-eyebrow": "11px",
    "--mf-primary-v21-cap-font-size": "11px",
    "--mf-primary-v21-cap-font-weight": "500",
}

for var, value in required_tokens.items():
    vals = re.findall(
        rf'{re.escape(var)}\s*:\s*([^;}}]+)',
        canon,
        re.I,
    )
    if not vals:
        errors.append(f"missing token {var}")
        continue

    unique = {
        v.strip().lower().replace("!important", "").strip()
        for v in vals
    }
    if unique != {value.lower()}:
        errors.append(f"{var}: conflicting values {sorted(unique)}")

if "memeflow_readability_scale_v176_start" not in low:
    errors.append("V176 readability section missing")

for needle in (
    "font-size: 14px",
    "font-weight: 500",
    "line-height: 1.45",
    "font-size: 12px",
    "line-height: 1.4",
):
    if needle not in low:
        errors.append(f"readability contract missing {needle}")

DECORATIVE = (
    "icon","logo","avatar","mark","dot","orb","caret","chevron","::before","::after","pseudo"
)

for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', canon):
    sel = m.group(1).lower()
    body = m.group(2)
    if any(k in sel for k in DECORATIVE):
        continue

    for fs in re.findall(r'font-size\s*:\s*([^;{}]+)', body, re.I):
        for num in re.findall(r'(\d+(?:\.\d+)?)px', fs):
            if float(num) < 11:
                errors.append(f"font-size below 11px: {sel[:120]} => {fs.strip()}")

for token in ("#000000", "#2f3336", "#e7e9ea", "#71767b", "#536471", "#1d9bf0"):
    if token not in low:
        errors.append(f"visual token missing {token}")

for family in (
    "inter",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "blinkmacsystemfont",
    '"segoe ui"',
    "sans-serif",
):
    if family not in low:
        errors.append(f"font stack missing {family}")

if errors:
    print("V176 READABILITY AUDIT: FAIL")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("V176 READABILITY AUDIT: PASS")
print(" - production pages audited: 11")
print(" - one canonical typography/style owner: V176")
print(" - micro/system text: 11px")
print(" - metadata: 12px")
print(" - small UI: 13px")
print(" - body: 14px")
print(" - panel text: 15px")
print(" - base weight: 500")
print(" - small/meta line-height: 1.4")
print(" - body line-height: 1.45")
print(" - no non-decorative text below 11px")
print(" - X muted color #71767B preserved")
print(" - Inter/system font stack preserved")
print(" - no server restart performed")
