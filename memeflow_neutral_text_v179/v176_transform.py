#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: transform.py <memeflow-app-dir>")

APP = Path(sys.argv[1])

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

SOURCE_CANDIDATES = [
    "memeflow-x-canonical-v175.css",
    "memeflow-x-canonical-v174.css",
]

source = None
for name in SOURCE_CANDIDATES:
    p = APP / name
    if p.exists():
        source = p
        break

if source is None:
    raise SystemExit("ERROR: neither V175 nor V174 canonical file exists")

css = source.read_text(encoding="utf-8")

css = re.sub(
    r'/\* MEMEFLOW_READABILITY_SCALE_V176_START \*/[\s\S]*?'
    r'/\* MEMEFLOW_READABILITY_SCALE_V176_END \*/',
    '',
    css,
)

TOKEN_VALUES = {
    "--mf-type-system": "11px",
    "--mf-type-micro": "11px",
    "--mf-type-meta": "12px",
    "--mf-type-ui": "13px",
    "--mf-type-body": "14px",
    "--mf-type-panel": "15px",
    "--mf-type-title": "17px",

    "--mf-trading-type-section": "17px",
    "--mf-trading-type-token": "15px",
    "--mf-trading-type-price": "16px",
    "--mf-trading-type-body": "14px",
    "--mf-trading-type-meta": "12px",
    "--mf-trading-type-micro": "11px",
    "--mf-trading-type-eyebrow": "11px",

    "--mf-primary-v21-cap-font-size": "11px",
    "--mf-primary-v21-cap-font-weight": "500",
}

for name, value in TOKEN_VALUES.items():
    css = re.sub(
        rf'({re.escape(name)}\s*:)\s*[^;}}]+;',
        rf'\g<1>{value};',
        css,
        flags=re.I,
    )

DECORATIVE = (
    "icon",
    "logo",
    "avatar",
    "mark",
    "dot",
    "orb",
    "caret",
    "chevron",
    "::before",
    "::after",
    "pseudo",
)

def floor_px_values(value):
    def repl(m):
        num = float(m.group(1))
        return "11px" if num < 11 else m.group(0)
    return re.sub(r'(?<![\w.-])(\d+(?:\.\d+)?)px\b', repl, value)

def normalize_rule(m):
    selector = m.group(1)
    body = m.group(2)
    low_sel = selector.lower()

    if any(k in low_sel for k in DECORATIVE):
        return m.group(0)

    body = re.sub(
        r'(font-size\s*:\s*)([^;{}]+)',
        lambda x: x.group(1) + floor_px_values(x.group(2)),
        body,
        flags=re.I,
    )

    fs = re.search(r'font-size\s*:\s*([^;{}]+)', body, re.I)
    small = False
    if fs:
        v = fs.group(1).lower()
        if any(t in v for t in (
            "--mf-type-system",
            "--mf-type-micro",
            "--mf-type-meta",
            "--mf-type-ui",
            "--mf-type-body",
            "--mf-trading-type-meta",
            "--mf-trading-type-micro",
            "--mf-trading-type-body",
            "--mf-trading-type-eyebrow",
        )):
            small = True
        nums = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)px', v)]
        if nums and max(nums) <= 14:
            small = True

    if small:
        body = re.sub(
            r'(font-weight\s*:\s*)(?:normal|[1-4]00|450)\b',
            r'\g<1>500',
            body,
            flags=re.I,
        )

    return selector + "{" + body + "}"

css = re.sub(r'([^{}]+)\{([^{}]*)\}', normalize_rule, css)

READABILITY = r'''
/* MEMEFLOW_READABILITY_SCALE_V176_START */

/* Base UI copy */
body {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
}

/* Native controls inherit the same readable weight. */
button,
input,
select,
textarea {
  font-weight: 500;
}

/* HTML small text is metadata, never microscopic. */
small {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

/* Common muted labels keep the X tone but gain readable weight/leading. */
:where(
  .muted,
  .brand-sub,
  .subtitle,
  .mf-nav-link-sub,
  .mf-settings-page-title > strong,
  .mf293-field-label,
  .mf-theme-appearance-label,
  .mf-theme-current
) {
  font-weight: 500;
  line-height: 1.4;
}

/* MEMEFLOW_READABILITY_SCALE_V176_END */
'''

css = css.rstrip() + "\n\n" + READABILITY.strip() + "\n"

target = APP / "memeflow-x-canonical-v176.css"
target.write_text(css, encoding="utf-8")

for name in PAGES:
    p = APP / name
    text = p.read_text(encoding="utf-8")

    lines = []
    for line in text.splitlines():
        if "memeflow-x-canonical-v174.css" in line:
            continue
        if "memeflow-x-canonical-v175.css" in line:
            continue
        if "memeflow-x-canonical-v176.css" in line:
            continue
        lines.append(line)

    text = "\n".join(lines)
    if "</head>" not in text:
        raise SystemExit(f"ERROR: </head> missing in {p}")

    link = '<link rel="stylesheet" href="/memeflow-x-canonical-v176.css?v=readability-v176-20260922">'
    text = text.replace("</head>", f"  {link}\n</head>", 1)
    p.write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")

for old in (
    APP / "memeflow-x-canonical-v174.css",
    APP / "memeflow-x-canonical-v175.css",
):
    if old.exists():
        old.unlink()

print("CREATED", target)
print("SOURCE", source.name)
