#!/usr/bin/env python3
from pathlib import Path
import json,re,shutil,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; BACKUP=Path(sys.argv[2]).resolve()
HTML=APP/'settings.html'; CSS=APP/'memeflow-settings-execution-compact-v193.css'; JS=APP/'memeflow-settings-execution-compact-v193.js'
if not HTML.is_file(): raise SystemExit('ERROR: settings.html missing')
BACKUP.mkdir(parents=True,exist_ok=True); manifest=[]
for p in (HTML,CSS,JS):
    if p.exists():
        rel=p.relative_to(ROOT); dest=BACKUP/rel; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,dest); manifest.append(str(rel))
(BACKUP/'manifest.json').write_text(json.dumps({'files':manifest,'css_existed':CSS.exists(),'js_existed':JS.exists()},indent=2))
HERE=Path(__file__).resolve().parent
CSS.write_text((HERE/'v193.css').read_text())
JS.write_text((HERE/'v193.js').read_text())
h=HTML.read_text()
h=re.sub(r'\s*<!-- MEMEFLOW_EXECUTION_COMPACT_V193 -->.*?<!-- /MEMEFLOW_EXECUTION_COMPACT_V193 -->\s*','\n',h,flags=re.S)
block="""<!-- MEMEFLOW_EXECUTION_COMPACT_V193 -->
<link rel="stylesheet" href="/memeflow-settings-execution-compact-v193.css?v=193-20260922">
<script defer src="/memeflow-settings-execution-compact-v193.js?v=193-20260922"></script>
<!-- /MEMEFLOW_EXECUTION_COMPACT_V193 -->"""
if '</head>' not in h: raise SystemExit('ERROR: </head> missing')
HTML.write_text(h.replace('</head>',block+'\n</head>',1))
print('V193 APPLY COMPLETE')
