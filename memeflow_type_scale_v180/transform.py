#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: transform.py <memeflow-app-dir>")

APP = Path(sys.argv[1])
SOURCE = APP / "memeflow-x-canonical-v179.css"
TARGET = APP / "memeflow-x-canonical-v180.css"
PAGES = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]
if not SOURCE.exists():
    raise SystemExit("ERROR: memeflow-x-canonical-v179.css not found")

SIZE_TOKENS = {11:"--mf-size-11",12:"--mf-size-12",13:"--mf-size-13",14:"--mf-size-14",
               15:"--mf-size-15",17:"--mf-size-17",24:"--mf-size-24",36:"--mf-size-36"}
DECORATIVE = ("icon","logo","avatar","glyph","orb","caret","chevron","::before","::after","pseudo")
HEADING_HINTS = (" h1"," h2"," h3"," h4","title","heading","headline","price","name","strong",
                 "hero","missiontitle","score","balance","stat")

def is_decorative(selector):
    s = selector.lower()
    return any(k in s for k in DECORATIVE)

def token_for_size(n, selector=""):
    n = float(n); s = selector.lower()
    if n <= 11.25: return 11
    if n <= 12.25: return 12
    if n <= 13.25: return 13
    if n <= 14.25: return 14
    if n <= 15.5: return 15
    if n <= 16.5: return 17 if any(h in s for h in HEADING_HINTS) else 15
    if n <= 20.5: return 17
    if n <= 29.5: return 24
    return 36

def choose_font_token(selector, value):
    v = value.strip().lower()
    if v in ("inherit","initial","unset","revert","revert-layer"):
        return value.strip()
    if re.fullmatch(r'var\((--mf-size-(11|12|13|14|15|17|24|36))\)', v):
        return v
    if "micro" in v or "system" in v or "eyebrow" in v:
        return "var(--mf-size-11)"
    if "meta" in v or "caption" in v:
        return "var(--mf-size-12)"
    if "type-ui" in v:
        return "var(--mf-size-13)"
    if "body" in v:
        return "var(--mf-size-14)"
    if "panel" in v or "token" in v:
        return "var(--mf-size-15)"
    if "title" in v or "section" in v or "price" in v:
        return "var(--mf-size-17)"
    px = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)px\b', v)]
    if px:
        return f"var({SIZE_TOKENS[token_for_size(max(px), selector)]})"
    rem = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)(?:rem|em)\b', v)]
    if rem:
        return f"var({SIZE_TOKENS[token_for_size(max(rem)*16, selector)]})"
    keyword = {
        "xx-small":11,"x-small":11,"smaller":11,"small":12,"medium":14,
        "large":17,"larger":17,"x-large":24,"xx-large":36
    }
    if v in keyword:
        return f"var({SIZE_TOKENS[keyword[v]]})"
    return "var(--mf-size-14)"

def normalize_rule(m):
    selector, body = m.group(1), m.group(2)
    if is_decorative(selector):
        return m.group(0)
    body = re.sub(
        r'(font-size\s*:\s*)([^;{}]+)',
        lambda x: x.group(1) + choose_font_token(selector, x.group(2)),
        body, flags=re.I
    )
    def var_sub(vm):
        lead,name,sep,value,semi = vm.groups()
        nl = name.lower()
        if not ("font-size" in nl or nl.startswith("--mf-type-") or nl.startswith("--mf-trading-type-")):
            return vm.group(0)
        return f"{lead}{name}{sep}{choose_font_token(name, value)}{semi}"
    body = re.sub(r'(\s*)(--[\w-]+)(\s*:\s*)([^;{}]+)(;?)', var_sub, body, flags=re.I)
    return selector + "{" + body + "}"

css = SOURCE.read_text(encoding="utf-8")
css = re.sub(r'/\* MEMEFLOW_TYPE_SCALE_V180_START \*/[\s\S]*?/\* MEMEFLOW_TYPE_SCALE_V180_END \*/','',css)
css = re.sub(r'([^{}]+)\{([^{}]*)\}', normalize_rule, css)

SCALE = r"""
/* MEMEFLOW_TYPE_SCALE_V180_START */
:root {
  --mf-size-11: 11px;
  --mf-size-12: 12px;
  --mf-size-13: 13px;
  --mf-size-14: 14px;
  --mf-size-15: 15px;
  --mf-size-17: 17px;
  --mf-size-24: 24px;
  --mf-size-36: 36px;
}
:root {
  --mf-type-system: var(--mf-size-11);
  --mf-type-micro: var(--mf-size-11);
  --mf-type-meta: var(--mf-size-12);
  --mf-type-ui: var(--mf-size-13);
  --mf-type-body: var(--mf-size-14);
  --mf-type-panel: var(--mf-size-15);
  --mf-type-title: var(--mf-size-17);
  --mf-trading-type-micro: var(--mf-size-11);
  --mf-trading-type-eyebrow: var(--mf-size-11);
  --mf-trading-type-meta: var(--mf-size-12);
  --mf-trading-type-body: var(--mf-size-14);
  --mf-trading-type-token: var(--mf-size-15);
  --mf-trading-type-price: var(--mf-size-17);
  --mf-trading-type-section: var(--mf-size-17);
}
/* MEMEFLOW_TYPE_SCALE_V180_END */
"""
css = css.rstrip() + "\n\n" + SCALE.strip() + "\n"
TARGET.write_text(css, encoding="utf-8")

for page in PAGES:
    p = APP / page
    text = p.read_text(encoding="utf-8")
    lines = [line for line in text.splitlines()
             if "memeflow-x-canonical-v179.css" not in line and "memeflow-x-canonical-v180.css" not in line]
    text = "\n".join(lines)
    if "</head>" not in text:
        raise SystemExit(f"ERROR: </head> missing in {p}")
    link = '<link rel="stylesheet" href="/memeflow-x-canonical-v180.css?v=type-scale-v180-20260922">'
    text = text.replace("</head>", f"  {link}\n</head>", 1)
    p.write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")

SOURCE.unlink()
print("CREATED", TARGET)
print("REMOVED", SOURCE)
