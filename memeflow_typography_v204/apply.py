#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / 'memeflow-app'
BACKUP = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 and sys.argv[2] != '-' else None

if not APP.is_dir():
    raise SystemExit('ERROR: memeflow-app not found')

PRODUCTION = [
    'index.html','trading.html','settings.html','smart-vault.html',
    'how-it-works.html','agent-performance.html','owner-intelligence.html',
    'system-source.html','system-tokens.html','system.html','x100.html'
]
pages = [APP / n for n in PRODUCTION if (APP / n).is_file()]
if len(pages) < 6:
    raise SystemExit(f'ERROR: only {len(pages)} expected production pages found; refusing to patch')

SCALE = [8,9,10,11,13,15]

def nearest(v):
    return min(SCALE, key=lambda x: (abs(x-v), x))

KNOWN_VAR = {
    '--mf-type-micro':'8px',
    '--mf-type-meta':'9px',
    '--mf-type-ui':'10px',
    '--mf-type-body':'11px',
    '--mf-type-panel':'13px',
    '--mf-type-title':'15px',
}

ROLE_VAR = {
    'micro':'8px',
    'meta':'9px',
    'ui':'10px',
    'body':'11px',
    'subhead':'13px',
    'section':'13px',
    'page':'15px',
    'display':'15px',
}

def local_href_to_path(page, href):
    href = href.strip()
    if not href or href.startswith(('http://','https://','//','data:')):
        return None
    clean = href.split('?',1)[0].split('#',1)[0]
    if not clean.endswith('.css'):
        return None
    p = (APP / clean.lstrip('/')) if clean.startswith('/') else (page.parent / clean)
    return p.resolve()

def css_import_paths(css_path, text):
    out=[]
    for m in re.finditer(r"@import\s+(?:url\()?[\"']?([^\"')\s;]+)[\"']?\)?\s*;", text, flags=re.I):
        href=m.group(1)
        if href.startswith(('http://','https://','//','data:')):
            continue
        clean=href.split('?',1)[0].split('#',1)[0]
        p=(css_path.parent/clean).resolve()
        if p.suffix.lower()=='.css' and p.is_file():
            out.append(p)
    return out

seed=set()
for page in pages:
    h=page.read_text(encoding='utf-8', errors='ignore')
    for m in re.finditer(r'<link\b[^>]*>', h, flags=re.I):
        tag=m.group(0)
        if not re.search(r"rel\s*=\s*[\"'][^\"']*stylesheet", tag, flags=re.I):
            continue
        hm=re.search(r"href\s*=\s*[\"']([^\"']+)[\"']", tag, flags=re.I)
        if not hm:
            continue
        p=local_href_to_path(page, hm.group(1))
        if p and p.is_file() and APP in p.parents:
            seed.add(p)

reachable=set()
queue=list(seed)
while queue:
    p=queue.pop()
    if p in reachable:
        continue
    reachable.add(p)
    t=p.read_text(encoding='utf-8', errors='ignore')
    for q in css_import_paths(p,t):
        if APP in q.parents and q not in reachable:
            queue.append(q)

TYPE_CSS=APP/'memeflow-typography-v204.css'
reachable.discard(TYPE_CSS)
if not reachable:
    raise SystemExit('ERROR: no local production stylesheets discovered')

def protect_font_face(text):
    blocks=[]
    def repl(m):
        blocks.append(m.group(0))
        return f'/*__MF204_FONTFACE_{len(blocks)-1}__*/'
    return re.sub(r'@font-face\s*\{.*?\}', repl, text, flags=re.S|re.I), blocks

def restore_font_face(text, blocks):
    for i,b in enumerate(blocks):
        text=text.replace(f'/*__MF204_FONTFACE_{i}__*/', b)
    return text

def family_repl(m):
    value=m.group(1)
    low=value.lower()
    if any(x in low for x in ('inter tight','ibm plex mono','openai sans')):
        imp=' !important' if '!important' in low else ''
        return f'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif{imp};'
    return m.group(0)

def parse_clamp(value):
    m=re.fullmatch(
        r'clamp\(\s*([0-9]+(?:\.[0-9]+)?)px\s*,\s*[^,]+\s*,\s*([0-9]+(?:\.[0-9]+)?)px\s*\)',
        value.strip(), flags=re.I
    )
    if not m:
        return None
    lo=float(m.group(1)); hi=float(m.group(2))
    return f'{nearest((lo+hi)/2)}px'

def convert_size(raw):
    low=raw.strip().lower().replace(' ','')
    for var,px in KNOWN_VAR.items():
        if low==f'var({var})' or low.startswith(f'var({var},'):
            return px
    m=re.fullmatch(r'var\(--mf-size-([0-9]+)(?:,[^)]*)?\)', low)
    if m:
        return f'{nearest(float(m.group(1)))}px'
    m=re.fullmatch(r'var\(--mf-role-([a-z0-9_-]+)(?:,[^)]*)?\)', low)
    if m and m.group(1) in ROLE_VAR:
        return ROLE_VAR[m.group(1)]
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)px', low)
    if m:
        return f'{nearest(float(m.group(1)))}px'
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)rem', low)
    if m:
        return f'{nearest(float(m.group(1))*16)}px'
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)em', low)
    if m:
        return f'{nearest(float(m.group(1))*11)}px'
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)vw', low)
    if m:
        return f'{nearest(float(m.group(1))*3.9)}px'
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)vmin', low)
    if m:
        return f'{nearest(float(m.group(1))*3.9)}px'
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)vh', low)
    if m:
        return f'{nearest(float(m.group(1))*8.44)}px'
    c=parse_clamp(raw)
    if c:
        return c
    return None

def transform_css(text):
    protected, faces=protect_font_face(text)
    protected=re.sub(r'font-family\s*:\s*([^;]+);', family_repl, protected, flags=re.I)
    unresolved=[]
    def fs_repl(m):
        raw=m.group(1)
        imp=m.group(2) or ''
        val=convert_size(raw)
        if val is None:
            unresolved.append(raw.strip())
            return m.group(0)
        return f'font-size:{val}{imp};'
    protected=re.sub(r'font-size\s*:\s*([^;{}]+?)(\s*!important)?\s*;', fs_repl, protected, flags=re.I)
    for var,px in KNOWN_VAR.items():
        protected=re.sub(rf'var\(\s*{re.escape(var)}(?:\s*,[^)]*)?\)', px, protected, flags=re.I)
    protected=re.sub(
        r'var\(\s*--mf-size-([0-9]+)(?:\s*,[^)]*)?\)',
        lambda m: f'{nearest(float(m.group(1)))}px',
        protected,
        flags=re.I
    )
    protected=re.sub(
        r'var\(\s*--mf-role-([a-z0-9_-]+)(?:\s*,[^)]*)?\)',
        lambda m: ROLE_VAR.get(m.group(1).lower(), m.group(0)),
        protected,
        flags=re.I
    )
    protected=re.sub(r'^\s*--mf-type-(?:micro|meta|ui|body|panel|title)\s*:\s*[^;]+;\s*$', '', protected, flags=re.M|re.I)
    return restore_font_face(protected,faces), unresolved

targets=list(sorted(reachable))+pages
if TYPE_CSS.exists():
    targets.append(TYPE_CSS)
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
    (BACKUP/'manifest.json').write_text(json.dumps({'files':manifest,'type_css_existed':TYPE_CSS.exists()},indent=2),encoding='utf-8')

unresolved=[]
changed_css=0
for p in sorted(reachable):
    old=p.read_text(encoding='utf-8')
    new,bad=transform_css(old)
    unresolved.extend(f'{p.relative_to(APP)} -> {x}' for x in bad)
    if new!=old:
        p.write_text(new,encoding='utf-8')
        changed_css+=1

changed_html=0
for p in pages:
    old=p.read_text(encoding='utf-8')
    new=old
    def style_block(m):
        body,bad=transform_css(m.group(1))
        unresolved.extend(f'{p.name}<style> -> {x}' for x in bad)
        return '<style>'+body+'</style>'
    new=re.sub(r'<style>(.*?)</style>', style_block, new, flags=re.S|re.I)

    def attr(m):
        q=m.group(1); value=m.group(2)
        def fs(x):
            v=convert_size(x.group(1))
            if v is None:
                unresolved.append(f'{p.name} style= -> {x.group(1).strip()}')
                return x.group(0)
            return 'font-size:'+v
        value=re.sub(r"font-size\s*:\s*([^;\"']+)", fs, value, flags=re.I)
        def fam(x):
            raw=x.group(1)
            if any(z in raw.lower() for z in ('inter tight','ibm plex mono','openai sans')):
                return 'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
            return x.group(0)
        value=re.sub(r'font-family\s*:\s*([^;]+)', fam, value, flags=re.I)
        return f'style={q}{value}{q}'
    new=re.sub(r"style=([\"'])(.*?)\1", attr, new, flags=re.S|re.I)

    for marker in ('MEMEFLOW_INTER_ONLY_V199','MEMEFLOW_INTER_ONLY_FONT_V199','MEMEFLOW_PIXEL_SCALE_V200','MEMEFLOW_INTER_PIXEL_V201','MEMEFLOW_TYPOGRAPHY_V2022','MEMEFLOW_TYPOGRAPHY_V204'):
        new=re.sub(rf'\s*<!-- {marker} -->.*?<!-- /{marker} -->\s*','\n',new,flags=re.S)
    new=re.sub(r"\s*<link[^>]+href=[\"']/memeflow-(?:inter-only-v199|pixel-scale-v200|inter-pixel-v201|typography-v2022|typography-v203|typography-v204)\.css[^\"']*[\"'][^>]*>\s*",'\n',new,flags=re.I)
    new=re.sub(r'\s+(?:mf-inter-only-v199|mf-pixel-scale-v200|mf-inter-pixel-v201)(?=[\s\"])','',new)

    if '</head>' not in new:
        raise SystemExit(f'ERROR: </head> missing in {p.name}')
    block='''<!-- MEMEFLOW_TYPOGRAPHY_V204 -->
<link rel="stylesheet" href="/memeflow-typography-v204.css?v=204-20260922">
<!-- /MEMEFLOW_TYPOGRAPHY_V204 -->'''
    new=new.replace('</head>',block+'\n</head>',1)
    if new!=old:
        p.write_text(new,encoding='utf-8')
        changed_html+=1

if unresolved:
    raise SystemExit('ERROR: unresolved font-size expressions remain inside PRODUCTION stylesheet graph:\n - '+'\n - '.join(unresolved[:40]))

local_font=APP/'assets/fonts/inter/InterVariable.woff2'
if local_font.is_file():
    loader='''@font-face{\n  font-family:"Inter";\n  src:url("/assets/fonts/inter/InterVariable.woff2") format("woff2");\n  font-style:normal;\n  font-weight:100 900;\n  font-display:swap;\n}\n'''
else:
    loader='''@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");\n'''
TYPE_CSS.write_text(loader+'''/* MEMEFLOW PRODUCTION TYPOGRAPHY V204\n   Inter + six direct-pixel sizes.\n   No universal selector / pseudo-elements / SVG override.\n*/\nhtml,body,button,input,select,textarea,option,optgroup{\n  font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important;\n}\nbody{\n  font-size:11px!important;\n  font-variant-numeric:tabular-nums lining-nums;\n  -webkit-font-smoothing:antialiased;\n  -moz-osx-font-smoothing:grayscale;\n}\n''',encoding='utf-8')

print(json.dumps({
    'production_pages':[p.name for p in pages],
    'production_css_count':len(reachable),
    'production_css':[str(p.relative_to(APP)) for p in sorted(reachable)],
    'changed_css':changed_css,
    'changed_html':changed_html,
    'inter_source':'local' if local_font.is_file() else 'google'
},indent=2))
