#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / 'memeflow-app'
BACKUP = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 and sys.argv[2] != '-' else None

if not APP.is_dir():
    raise SystemExit('ERROR: memeflow-app not found')

SCALE = [8, 9, 10, 11, 13, 15]
KNOWN_VAR = {
    '--mf-type-micro': '8px',
    '--mf-type-meta': '9px',
    '--mf-type-ui': '10px',
    '--mf-type-body': '11px',
    '--mf-type-panel': '13px',
    '--mf-type-title': '15px',
}

def nearest(v):
    return min(SCALE, key=lambda x: (abs(x-v), x))

def protect_font_faces(text):
    blocks=[]
    def repl(m):
        blocks.append(m.group(0))
        return f'/*__MF_V2022_FONTFACE_{len(blocks)-1}__*/'
    return re.sub(r'@font-face\s*\{.*?\}', repl, text, flags=re.S|re.I), blocks

def restore_font_faces(text, blocks):
    for i,b in enumerate(blocks):
        text=text.replace(f'/*__MF_V2022_FONTFACE_{i}__*/', b)
    return text

def replace_family(m):
    value=m.group(1)
    low=value.lower()
    if any(x in low for x in ('inter tight','ibm plex mono','openai sans')):
        imp=' !important' if '!important' in low else ''
        return 'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif%s;' % imp
    return m.group(0)

def convert_size(raw):
    low=raw.strip().lower().replace(' ','')
    for var,px in KNOWN_VAR.items():
        if low == f'var({var})' or low.startswith(f'var({var},'):
            return px
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)px', low)
    if m:
        return f'{nearest(float(m.group(1)))}px'
    m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)rem', low)
    if m:
        return f'{nearest(float(m.group(1))*16)}px'
    return None

def transform_css(text):
    stripped, faces = protect_font_faces(text)
    stripped = re.sub(r'font-family\s*:\s*([^;]+);', replace_family, stripped, flags=re.I)
    unresolved=[]
    def fs_repl(m):
        raw=m.group(1)
        important=m.group(2) or ''
        converted=convert_size(raw)
        if converted is None:
            unresolved.append(raw.strip())
            return m.group(0)
        return f'font-size:{converted}{important};'
    stripped = re.sub(r'font-size\s*:\s*([^;{}]+?)(\s*!important)?\s*;', fs_repl, stripped, flags=re.I)
    for var,px in KNOWN_VAR.items():
        stripped = re.sub(rf'var\(\s*{re.escape(var)}(?:\s*,[^)]*)?\)', px, stripped, flags=re.I)
    stripped = re.sub(r'^\s*--mf-type-(?:micro|meta|ui|body|panel|title)\s*:\s*[^;]+;\s*$', '', stripped, flags=re.M|re.I)
    return restore_font_faces(stripped, faces), unresolved

css_files=[]
for p in APP.rglob('*.css'):
    rel=p.relative_to(APP)
    if any(x.startswith('.') or x in {'node_modules','dist','build','data'} for x in rel.parts):
        continue
    css_files.append(p)

html_files=sorted(APP.glob('*.html'))
if not html_files:
    raise SystemExit('ERROR: no top-level HTML pages found')

TYPE_CSS=APP/'memeflow-typography-v2022.css'
targets=list(css_files)+html_files
if TYPE_CSS.exists() and TYPE_CSS not in targets:
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
for p in css_files:
    old=p.read_text(encoding='utf-8',errors='strict')
    new,bad=transform_css(old)
    unresolved.extend(f'{p.relative_to(APP)} -> {x}' for x in bad)
    if new!=old:
        p.write_text(new,encoding='utf-8')
        changed_css+=1

changed_html=0
for p in html_files:
    old=p.read_text(encoding='utf-8')
    new=old

    def style_block_repl(m):
        body2,bad=transform_css(m.group(1))
        unresolved.extend(f'{p.name}<style> -> {x}' for x in bad)
        return '<style>'+body2+'</style>'
    new=re.sub(r'<style>(.*?)</style>', style_block_repl, new, flags=re.S|re.I)

    def style_attr_repl(m):
        quote,val=m.group(1),m.group(2)
        def one_fs(x):
            converted=convert_size(x.group(1))
            if converted is None:
                unresolved.append(f'{p.name} style -> {x.group(1).strip()}')
                return x.group(0)
            return f'font-size:{converted}'
        val2=re.sub(r'font-size\s*:\s*([^;"\']+)', one_fs, val, flags=re.I)
        def one_family(x):
            v=x.group(1)
            if any(z in v.lower() for z in ('inter tight','ibm plex mono','openai sans')):
                return 'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
            return x.group(0)
        val2=re.sub(r'font-family\s*:\s*([^;]+)', one_family, val2, flags=re.I)
        return f'style={quote}{val2}{quote}'
    new=re.sub(r'style=(["\'])(.*?)\1', style_attr_repl, new, flags=re.S|re.I)

    for marker in ('MEMEFLOW_INTER_ONLY_V199','MEMEFLOW_INTER_ONLY_FONT_V199','MEMEFLOW_PIXEL_SCALE_V200','MEMEFLOW_INTER_PIXEL_V201'):
        new=re.sub(rf'\s*<!-- {marker} -->.*?<!-- /{marker} -->\s*','\n',new,flags=re.S)
    new=re.sub(r'\s*<link[^>]+href=["\']/memeflow-(?:inter-only-v199|pixel-scale-v200|inter-pixel-v201)\.css[^"\']*["\'][^>]*>\s*','\n',new,flags=re.I)
    new=re.sub(r'\s+(?:mf-inter-only-v199|mf-pixel-scale-v200|mf-inter-pixel-v201)(?=[\s"])','',new)

    new=re.sub(r'\s*<!-- MEMEFLOW_TYPOGRAPHY_V2022 -->.*?<!-- /MEMEFLOW_TYPOGRAPHY_V2022 -->\s*','\n',new,flags=re.S)
    new=re.sub(r'\s*<link[^>]+href=["\']/memeflow-typography-v2022\.css[^"\']*["\'][^>]*>\s*','\n',new,flags=re.I)

    if '</head>' not in new:
        raise SystemExit(f'ERROR: </head> missing in {p.name}')
    block='''<!-- MEMEFLOW_TYPOGRAPHY_V2022 -->
<link rel="stylesheet" href="/memeflow-typography-v2022.css?v=2022-20260922">
<!-- /MEMEFLOW_TYPOGRAPHY_V2022 -->'''
    new=new.replace('</head>',block+'\n</head>',1)
    if new!=old:
        p.write_text(new,encoding='utf-8')
        changed_html+=1

if unresolved:
    raise SystemExit('ERROR: unsupported font-size expressions found; shadow patch rejected:\n - ' + '\n - '.join(unresolved[:40]))

local_font=APP/'assets/fonts/inter/InterVariable.woff2'
if local_font.is_file():
    font_source='''@font-face{
  font-family:"Inter";
  src:url("/assets/fonts/inter/InterVariable.woff2") format("woff2");
  font-style:normal;
  font-weight:100 900;
  font-display:swap;
}
'''
else:
    font_source='''@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
'''

type_css=font_source+'''/* MEMEFLOW TYPOGRAPHY V202.2 */
html,
body,
button,
input,
select,
textarea,
option,
optgroup{
  font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important;
}
body{
  font-size:11px!important;
  font-variant-numeric:tabular-nums lining-nums;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
'''
TYPE_CSS.write_text(type_css,encoding='utf-8')

print(json.dumps({'css_files_scanned':len(css_files),'css_files_changed':changed_css,'html_pages':len(html_files),'html_pages_changed':changed_html,'inter_source':'local' if local_font.is_file() else 'google'},indent=2))
