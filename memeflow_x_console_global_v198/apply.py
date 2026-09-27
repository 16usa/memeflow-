#!/usr/bin/env python3
from pathlib import Path
import json,re,shutil,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; BACKUP=Path(sys.argv[2]).resolve(); CSS=APP/'memeflow-x-console-global-v198.css'; HERE=Path(__file__).resolve().parent
if not APP.is_dir(): raise SystemExit('ERROR: memeflow-app not found')
pages=sorted(APP.glob('*.html'))
if not pages: raise SystemExit('ERROR: no top-level HTML pages found')
BACKUP.mkdir(parents=True,exist_ok=True); manifest=[]
def backup(p):
    rel=p.relative_to(ROOT); dst=BACKUP/rel; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,dst); manifest.append(str(rel))
for p in pages: backup(p)
if CSS.exists(): backup(CSS)
(BACKUP/'manifest.json').write_text(json.dumps({'files':manifest,'css_existed':CSS.exists(),'pages':[p.name for p in pages]},indent=2),encoding='utf-8')
CSS.write_text((HERE/'v198.css').read_text(encoding='utf-8'),encoding='utf-8')
font_block='\n'.join([
'<!-- MEMEFLOW_X_CONSOLE_FONT_V198 -->',
'<link rel="preconnect" href="https://fonts.googleapis.com">',
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap">',
'<!-- /MEMEFLOW_X_CONSOLE_FONT_V198 -->'])
style_block='\n'.join([
'<!-- MEMEFLOW_X_CONSOLE_GLOBAL_V198 -->',
'<link rel="stylesheet" href="/memeflow-x-console-global-v198.css?v=198-20260922">',
'<!-- /MEMEFLOW_X_CONSOLE_GLOBAL_V198 -->'])
for page in pages:
    s=page.read_text(encoding='utf-8')
    s=re.sub(r'\s*<!-- MEMEFLOW_X_CONSOLE_FONT_V198 -->.*?<!-- /MEMEFLOW_X_CONSOLE_FONT_V198 -->\s*','\n',s,flags=re.S)
    s=re.sub(r'\s*<!-- MEMEFLOW_X_CONSOLE_GLOBAL_V198 -->.*?<!-- /MEMEFLOW_X_CONSOLE_GLOBAL_V198 -->\s*','\n',s,flags=re.S)
    s=re.sub(r'\s*<link[^>]+href=["\']/memeflow-x-console-global-v198\.css[^"\']*["\'][^>]*>\s*','\n',s,flags=re.I)
    s=re.sub(r'\s*<!-- MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->.*?<!-- /MEMEFLOW_PIXEL_TYPOGRAPHY_FONTS_V192 -->\s*','\n',s,flags=re.S)
    s=re.sub(r'\s*<link[^>]+href=["\']/memeflow-pixel-typography-v192\.css[^"\']*["\'][^>]*>\s*','\n',s,flags=re.I)
    if '</head>' not in s: raise SystemExit(f'ERROR: </head> missing in {page.name}')
    s=s.replace('</head>',font_block+'\n'+style_block+'\n</head>',1)
    m=re.search(r'<body\b([^>]*)>',s,flags=re.I)
    if not m: raise SystemExit(f'ERROR: <body> missing in {page.name}')
    full=m.group(0); attrs=m.group(1); cm=re.search(r'class=(["\'])(.*?)\1',attrs,flags=re.I|re.S)
    if cm:
        classes=[x for x in cm.group(2).split() if x!='mf-pixel-type-v192']
        if 'mf-x-console-v198' not in classes: classes.append('mf-x-console-v198')
        newclass='class="'+' '.join(classes)+'"'; newfull=full[:cm.start()]+newclass+full[cm.end():]
    else: newfull='<body class="mf-x-console-v198"'+attrs+'>'
    s=s.replace(full,newfull,1); page.write_text(s,encoding='utf-8')
print(f'V198 APPLY COMPLETE — {len(pages)} pages')
