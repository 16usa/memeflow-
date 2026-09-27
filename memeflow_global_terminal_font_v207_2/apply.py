#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
BACKUP = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 and sys.argv[2] != "-" else None

if not APP.is_dir():
    raise SystemExit("ERROR: memeflow-app not found")

pages = sorted(p for p in APP.glob("*.html") if not p.name.startswith("."))
if not pages:
    raise SystemExit("ERROR: no top-level HTML pages found")

FONT_STACK = '"IBM Plex Mono","SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace'
LOADER = APP / "memeflow-terminal-font-v207-2.css"

ICON_HINTS = (
    "material symbols", "material icons", "font awesome", "fontawesome",
    "bootstrap-icons", "bootstrap icons", "ionicons", "icomoon",
    "remixicon", "remix icon", "phosphor", "symbol font",
    "icon font", "lucide icon"
)
CSS_WIDE = {"inherit","initial","unset","revert","revert-layer"}

def strip_important(value):
    v = value.strip()
    if re.search(r'\s*!important\s*$', v, flags=re.I):
        v = re.sub(r'\s*!important\s*$', '', v, flags=re.I).strip()
        return v, " !important"
    return v, ""

def is_icon_family(value):
    low = value.lower()
    return any(x in low for x in ICON_HINTS)

def normalized_family(value):
    raw, important = strip_important(value)
    low = raw.lower()
    if is_icon_family(raw):
        return raw + important
    if low in CSS_WIDE:
        return raw + important
    return FONT_STACK + important

def discover_css():
    seed=set()
    for page in pages:
        h=page.read_text(encoding="utf-8",errors="ignore")
        for m in re.finditer(r'<link\b[^>]*>', h, flags=re.I):
            tag=m.group(0)
            if not re.search(r'rel\s*=\s*["\'][^"\']*stylesheet', tag, flags=re.I):
                continue
            hm=re.search(r'href\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
            if not hm:
                continue
            href=hm.group(1)
            if href.startswith(("http://","https://","//","data:")):
                continue
            clean=href.split("?",1)[0].split("#",1)[0]
            if not clean.endswith(".css"):
                continue
            p=(APP/clean.lstrip("/")).resolve() if clean.startswith("/") else (page.parent/clean).resolve()
            if p.is_file() and APP in p.parents and p != LOADER:
                seed.add(p)

    out=set()
    queue=list(seed)
    while queue:
        p=queue.pop()
        if p in out:
            continue
        out.add(p)
        t=p.read_text(encoding="utf-8",errors="ignore")
        for m in re.finditer(r'@import\s+(?:url\()?["\']?([^"\'\)\s;]+)', t, flags=re.I):
            href=m.group(1)
            if href.startswith(("http://","https://","//","data:")):
                continue
            clean=href.split("?",1)[0].split("#",1)[0]
            q=(p.parent/clean).resolve()
            if q.is_file() and q.suffix.lower()==".css" and APP in q.parents and q != LOADER:
                queue.append(q)
    return out

def discover_js():
    out=set()
    for page in pages:
        h=page.read_text(encoding="utf-8",errors="ignore")
        for m in re.finditer(r'<script\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\'][^>]*>', h, flags=re.I):
            src=m.group(1)
            if src.startswith(("http://","https://","//","data:")):
                continue
            clean=src.split("?",1)[0].split("#",1)[0]
            if not clean.endswith((".js",".mjs")):
                continue
            p=(APP/clean.lstrip("/")).resolve() if clean.startswith("/") else (page.parent/clean).resolve()
            if p.is_file() and APP in p.parents:
                out.add(p)
    return out

css_files=discover_css()
js_files=discover_js()

def protect_font_faces(text):
    blocks=[]
    def repl(m):
        blocks.append(m.group(0))
        return f"/*__MF2071_FONTFACE_{len(blocks)-1}__*/"
    return re.sub(r'@font-face\s*\{.*?\}', repl, text, flags=re.S|re.I), blocks

def restore_font_faces(text, blocks):
    for i,b in enumerate(blocks):
        text=text.replace(f"/*__MF2071_FONTFACE_{i}__*/", b)
    return text

def transform_css(text):
    protected,faces=protect_font_faces(text)

    def fam(m):
        return "font-family:" + normalized_family(m.group(1)) + ";"
    protected=re.sub(r'font-family\s*:\s*([^;{}]+);', fam, protected, flags=re.I)

    def custom(m):
        name=m.group(1)
        raw=m.group(2)
        base, important = strip_important(raw)
        low_name=name.lower()
        if "icon" in low_name or "symbol" in low_name or is_icon_family(base):
            return m.group(0)
        if base.lower() in CSS_WIDE:
            return f"{name}:{base}{important};"
        return f"{name}:{FONT_STACK}{important};"

    protected=re.sub(
        r'(--[A-Za-z0-9_-]*(?:font|typeface|family)[A-Za-z0-9_-]*)\s*:\s*([^;{}]+);',
        custom, protected, flags=re.I
    )
    return restore_font_faces(protected,faces)

def transform_html(html):
    html=re.sub(
        r'<style>(.*?)</style>',
        lambda m: "<style>"+transform_css(m.group(1))+"</style>",
        html, flags=re.S|re.I
    )

    def style_attr(m):
        q=m.group(1)
        value=m.group(2)
        value=re.sub(
            r'font-family\s*:\s*([^;"\']+)',
            lambda x: "font-family:"+normalized_family(x.group(1)),
            value, flags=re.I
        )
        return f"style={q}{value}{q}"
    html=re.sub(r'style=(["\'])(.*?)\1', style_attr, html, flags=re.S|re.I)

    html=re.sub(
        r'font-family=(["\'])(.*?)\1',
        lambda m: f'font-family={m.group(1)}{normalized_family(m.group(2))}{m.group(1)}',
        html, flags=re.S|re.I
    )

    for marker in ("MEMEFLOW_GLOBAL_TERMINAL_FONT_V207","MEMEFLOW_GLOBAL_TERMINAL_FONT_V207_1","MEMEFLOW_GLOBAL_TERMINAL_FONT_V207_2"):
        html=re.sub(rf'\s*<!-- {marker} -->.*?<!-- /{marker} -->\s*','\n',html,flags=re.S)

    html=re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-terminal-font-v207(?:-[12])?\.css[^"\']*["\'][^>]*>\s*',
        '\n', html, flags=re.I
    )

    if "</head>" not in html:
        raise RuntimeError("HTML page has no </head>")

    block=(
        '<!-- MEMEFLOW_GLOBAL_TERMINAL_FONT_V207_2 -->\n'
        '<link rel="stylesheet" href="/memeflow-terminal-font-v207-2.css?v=2072-20260922">\n'
        '<!-- /MEMEFLOW_GLOBAL_TERMINAL_FONT_V207_2 -->'
    )
    return html.replace("</head>", block+"\n</head>", 1)

def transform_js(text):
    def prop(m):
        prefix=m.group(1); q=m.group(2); raw=m.group(3)
        if is_icon_family(raw):
            return m.group(0)
        return prefix+q+"IBM Plex Mono"+q
    return re.sub(r'(\bfontFamily\s*[:=]\s*)(["\'])(.*?)\2', prop, text, flags=re.I)

targets=list(sorted(css_files))+list(sorted(js_files))+pages
for extra in (APP/"memeflow-terminal-font-v207.css", APP/"memeflow-terminal-font-v207-1.css", LOADER):
    if extra.exists():
        targets.append(extra)

if BACKUP:
    BACKUP.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for p in targets:
        if p.exists():
            rel=p.relative_to(ROOT)
            dst=BACKUP/rel
            dst.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(p,dst)
            manifest.append(str(rel))
    (BACKUP/"manifest.json").write_text(json.dumps({
        "files":manifest,
        "v207_loader_existed":(APP/"memeflow-terminal-font-v207.css").exists(),
        "v2071_loader_existed":(APP/"memeflow-terminal-font-v207-1.css").exists(),
        "v2072_loader_existed":LOADER.exists()
    },indent=2),encoding="utf-8")

for p in sorted(css_files):
    old=p.read_text(encoding="utf-8")
    new=transform_css(old)
    if new != old:
        p.write_text(new,encoding="utf-8")

for p in sorted(js_files):
    old=p.read_text(encoding="utf-8")
    new=transform_js(old)
    if new != old:
        p.write_text(new,encoding="utf-8")

for p in pages:
    old=p.read_text(encoding="utf-8")
    new=transform_html(old)
    if new != old:
        p.write_text(new,encoding="utf-8")

for old_loader in (APP/"memeflow-terminal-font-v207.css", APP/"memeflow-terminal-font-v207-1.css"):
    if old_loader.exists():
        old_loader.unlink()

local_candidates=[]
for p in APP.rglob("*.woff2"):
    low=p.name.lower().replace("-","").replace("_","")
    if "ibmplexmono" in low:
        local_candidates.append(p)

if local_candidates:
    f=sorted(local_candidates)[0]
    rel="/"+str(f.relative_to(APP)).replace("\\","/")
    source=(
        '@font-face{\n'
        '  font-family:"IBM Plex Mono";\n'
        f'  src:url("{rel}") format("woff2");\n'
        '  font-style:normal;\n'
        '  font-weight:100 700;\n'
        '  font-display:swap;\n'
        '}\n'
    )
    source_kind="local"
else:
    source='@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap");\n'
    source_kind="google"

loader = source + f'''
/* MEMEFLOW GLOBAL TERMINAL FONT V207.2
   Family only. No sizes, spacing, colors, geometry, pseudo-elements or SVG ownership.
*/
:root{{
  --mf-terminal-font:{FONT_STACK};
}}
html,
body,
button,
input,
select,
textarea,
option,
optgroup{{
  font-family:var(--mf-terminal-font)!important;
}}
'''
LOADER.write_text(loader,encoding="utf-8")

print(json.dumps({
    "pages":len(pages),
    "reachable_css":len(css_files),
    "reachable_js":len(js_files),
    "font":"IBM Plex Mono",
    "source":source_kind
},indent=2))
