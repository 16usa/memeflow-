#!/usr/bin/env python3
from pathlib import Path
import re
import sys
import colorsys

if len(sys.argv) != 2:
    raise SystemExit("Usage: transform.py <memeflow-app-dir>")

APP = Path(sys.argv[1])

PAGES = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

SOURCE = APP / "memeflow-x-canonical-v176.css"
if not SOURCE.exists():
    raise SystemExit("ERROR: V176 canonical missing before V177 transform")

SEMANTIC_WORDS = (
    "ready","watch","waiting","blocked","danger","error","success",
    "positive","negative","profit","loss","pnl","buy","sell","approve",
    "reject","open-position","decision","status","state-","live","warning",
    "accent","link","cyan","green","red","blue","purple","yellow","amber",
    "chart","series","marker","legend-swatch",
)

DECORATIVE_WORDS = (
    "logo","avatar","icon","glyph","dot","orb","caret","chevron",
)

STRONG_WORDS = (
    " h1"," h2"," h3"," h4","h1","h2","h3","h4",
    "title","heading","strong"," value","price","symbol","name","brand-title",
)

SECONDARY_WORDS = (
    "muted","meta","subtitle","sub","caption","hint","label","note","time",
    "description","supporting","secondary","small","foot","helper",
)

FAINT_WORDS = (
    "faint","tertiary","disabled","placeholder","deemphas","quiet",
)

NEUTRAL_VAR_TIERS = {
    "--mf-x-text-strong": 1,
    "--mf-x-text": 2,
    "--mf-x-text-muted": 3,
    "--mf-x-text-tertiary": 4,
    "--mf-x-text-faint": 4,
    "--text": 2,
    "--text-2": 3,
    "--text-3": 4,
    "--muted": 3,
    "--faint": 4,
    "--mf-app-text": 2,
    "--mf-app-muted": 3,
    "--mf-nav-text": 2,
    "--mf-nav-muted": 3,
    "--hiw-text": 2,
    "--hiw-muted": 3,
    "--hiw-muted-2": 4,
    "--v-text": 2,
    "--v-muted": 3,
    "--v-muted2": 4,
    "--mf-text-primary": 2,
    "--mf-text-secondary": 3,
    "--mf-text-tertiary": 4,
    "--ds-text": 2,
    "--ds-muted": 3,
    "--mf-icon-muted": 3,
}

def is_semantic_selector(selector):
    s = selector.lower()
    return any(word in s for word in SEMANTIC_WORDS)

def is_decorative_selector(selector):
    s = selector.lower()
    return any(word in s for word in DECORATIVE_WORDS)

def is_light_selector(selector):
    s = selector.lower().replace("'", '"')
    return 'data-theme="light"' in s

def parse_color(value):
    v = value.strip().lower()

    m = re.fullmatch(r'#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})', v)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        if len(h) == 8:
            h = h[:6]
        return tuple(int(h[i:i+2], 16) for i in (0,2,4))

    m = re.fullmatch(
        r'rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*[\d.]+)?\s*\)',
        v,
    )
    if m:
        return tuple(int(float(x)) for x in m.groups())

    m = re.fullmatch(
        r'hsl\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)',
        v,
    )
    if m:
        h = (float(m.group(1)) % 360) / 360
        s = float(m.group(2)) / 100
        l = float(m.group(3)) / 100
        r,g,b = colorsys.hls_to_rgb(h,l,s)
        return tuple(round(x * 255) for x in (r,g,b))

    return None

def saturation(rgb):
    if rgb is None:
        return None
    r,g,b = [x/255 for x in rgb]
    return colorsys.rgb_to_hls(r,g,b)[2]

def luminance(rgb):
    if rgb is None:
        return None
    return sum(rgb) / (3 * 255)

def role_tier(selector, rgb=None, light=False):
    s = " " + selector.lower()

    if any(word in s for word in FAINT_WORDS):
        return 4
    if any(word in s for word in SECONDARY_WORDS):
        return 3
    if any(word in s for word in STRONG_WORDS):
        return 1

    if rgb is not None:
        l = luminance(rgb)
        if light:
            if l <= 0.08:
                return 1
            if l <= 0.28:
                return 2
            if l <= 0.55:
                return 3
            return 4
        if l >= 0.94:
            return 1
        if l >= 0.76:
            return 2
        if l >= 0.42:
            return 3
        return 4

    return 2

def map_color_value(selector, value):
    raw = value.strip()
    low = raw.lower()

    if is_semantic_selector(selector):
        return raw

    if low in ("inherit","initial","unset","revert","revert-layer","currentcolor","transparent"):
        return raw

    if re.fullmatch(r'var\(--mf-neutral-text-[1-4]\)', low):
        return raw

    m = re.fullmatch(r'var\((--[\w-]+)(?:\s*,[^)]*)?\)', low)
    if m:
        var = m.group(1)
        if var in NEUTRAL_VAR_TIERS:
            return f"var(--mf-neutral-text-{NEUTRAL_VAR_TIERS[var]})"
        if any(x in var for x in (
            "green","red","cyan","blue","purple","yellow","amber","accent",
            "positive","negative","danger","success","warning"
        )):
            return raw
        return raw

    rgb = parse_color(low)
    if rgb is None:
        return raw

    sat = saturation(rgb)
    if sat is not None and sat > 0.34:
        return raw

    tier = role_tier(selector, rgb, is_light_selector(selector))
    return f"var(--mf-neutral-text-{tier})"

def split_declarations(body):
    parts=[]
    start=0
    quote=None
    esc=False
    par=0
    i=0
    while i < len(body):
        ch=body[i]
        if quote:
            if esc:
                esc=False
            elif ch=="\\":
                esc=True
            elif ch==quote:
                quote=None
            i+=1
            continue
        if ch in ("'", '"'):
            quote=ch
        elif ch=="(":
            par+=1
        elif ch==")":
            par=max(0,par-1)
        elif ch==";" and par==0:
            parts.append(body[start:i+1])
            start=i+1
        i+=1
    if start<len(body):
        parts.append(body[start:])
    return parts

def normalize_rule(m):
    selector=m.group(1)
    body=m.group(2)

    if is_decorative_selector(selector):
        return m.group(0)

    out=[]
    for seg in split_declarations(body):
        dm=re.match(r'(\s*)(--[\w-]+|color)(\s*:\s*)([^;{}]+)(;?)', seg, re.I|re.S)
        if not dm:
            out.append(seg)
            continue

        lead, prop, sep, value, semi = dm.groups()
        pl=prop.lower()

        if pl == "color":
            new = map_color_value(selector, value)
            out.append(f"{lead}{prop}{sep}{new}{semi}")
            continue

        if pl in NEUTRAL_VAR_TIERS:
            tier=NEUTRAL_VAR_TIERS[pl]
            out.append(f"{lead}{prop}{sep}var(--mf-neutral-text-{tier}){semi}")
            continue

        out.append(seg)

    return selector + "{" + "".join(out) + "}"

def normalize_css(css):
    return re.sub(r'([^{}]+)\{([^{}]*)\}', normalize_rule, css)

active_css=set()
for name in PAGES:
    text=(APP/name).read_text(encoding="utf-8")
    for href in re.findall(
        r'<link\b[^>]*href=["\']([^"\']+\.css(?:\?[^"\']*)?)',
        text,re.I
    ):
        css_name=href.split("?",1)[0].lstrip("/")
        if (APP/css_name).exists():
            active_css.add(css_name)

for name in sorted(active_css):
    p=APP/name
    text=p.read_text(encoding="utf-8")
    p.write_text(normalize_css(text),encoding="utf-8")
    print("TEXT COLOR NORMALIZED",p)

style_re=re.compile(r'(<style\b[^>]*>)([\s\S]*?)(</style>)',re.I)
attr_re=re.compile(r'(\sstyle=["\'])([^"\']*)(["\'])',re.I)

for name in PAGES:
    p=APP/name
    text=p.read_text(encoding="utf-8")

    text=style_re.sub(
        lambda m: m.group(1)+normalize_css(m.group(2))+m.group(3),
        text,
    )

    def attr_sub(m):
        style=m.group(2)
        parts=[]
        for seg in split_declarations(style):
            dm=re.match(r'(\s*)(color)(\s*:\s*)([^;{}]+)(;?)',seg,re.I|re.S)
            if dm:
                lead,prop,sep,value,semi=dm.groups()
                rgb=parse_color(value.strip().lower())
                if rgb is not None and saturation(rgb) <= 0.34:
                    seg=f"{lead}{prop}{sep}var(--mf-neutral-text-2){semi}"
            parts.append(seg)
        return m.group(1)+"".join(parts)+m.group(3)

    text=attr_re.sub(attr_sub,text)
    p.write_text(text,encoding="utf-8")

source=APP/"memeflow-x-canonical-v176.css"
css=source.read_text(encoding="utf-8")

css=re.sub(
    r'/\* MEMEFLOW_NEUTRAL_TEXT_V177_START \*/[\s\S]*?'
    r'/\* MEMEFLOW_NEUTRAL_TEXT_V177_END \*/',
    '',
    css,
)

PALETTE = r'''
/* MEMEFLOW_NEUTRAL_TEXT_V177_START */

/*
  PURE GRAYSCALE TYPOGRAPHY - NO COLOR CAST

  DARK
  1 #FFFFFF
  2 #D6D6D6
  3 #A3A3A3
  4 #737373

  LIGHT
  1 #000000
  2 #303030
  3 #606060
  4 #8A8A8A
*/

:root,
html:not([data-theme="light"]) {
  --mf-neutral-text-1: #ffffff;
  --mf-neutral-text-2: #d6d6d6;
  --mf-neutral-text-3: #a3a3a3;
  --mf-neutral-text-4: #737373;
}

html[data-theme="light"] {
  --mf-neutral-text-1: #000000;
  --mf-neutral-text-2: #303030;
  --mf-neutral-text-3: #606060;
  --mf-neutral-text-4: #8a8a8a;
}

:root {
  --mf-text-strong: var(--mf-neutral-text-1);
  --mf-text-primary: var(--mf-neutral-text-2);
  --mf-text-secondary: var(--mf-neutral-text-3);
  --mf-text-tertiary: var(--mf-neutral-text-4);
}

/* MEMEFLOW_NEUTRAL_TEXT_V177_END */
'''

css=css.rstrip()+"\n\n"+PALETTE.strip()+"\n"

target=APP/"memeflow-x-canonical-v177.css"
target.write_text(css,encoding="utf-8")

for name in PAGES:
    p=APP/name
    text=p.read_text(encoding="utf-8")
    lines=[]
    for line in text.splitlines():
        if "memeflow-x-canonical-v176.css" in line:
            continue
        if "memeflow-x-canonical-v177.css" in line:
            continue
        lines.append(line)
    text="\n".join(lines)
    if "</head>" not in text:
        raise SystemExit(f"ERROR: </head> missing in {p}")
    link='<link rel="stylesheet" href="/memeflow-x-canonical-v177.css?v=pure-neutral-text-v177-20260922">'
    text=text.replace("</head>",f"  {link}\n</head>",1)
    p.write_text(text+("\n" if not text.endswith("\n") else ""),encoding="utf-8")

source.unlink()
print("CREATED",target)
