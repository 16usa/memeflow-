#!/usr/bin/env python3
from pathlib import Path
import json,re,shutil,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; BACKUP=Path(sys.argv[2]).resolve()
HTML=APP/'settings.html'; CSS=APP/'memeflow-settings-compact-v196.css'; JS=APP/'memeflow-settings-compact-v196.js'; HERE=Path(__file__).resolve().parent
if not HTML.is_file(): raise SystemExit('ERROR: memeflow-app/settings.html not found')
BACKUP.mkdir(parents=True,exist_ok=True); manifest=[]
for p in (HTML,CSS,JS):
    if p.exists():
        rel=p.relative_to(ROOT); dst=BACKUP/rel; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,dst); manifest.append(str(rel))
(BACKUP/'manifest.json').write_text(json.dumps({'files':manifest,'css_existed':CSS.exists(),'js_existed':JS.exists()},indent=2),encoding='utf-8')
CSS.write_text((HERE/'v196.css').read_text(encoding='utf-8'),encoding='utf-8')
JS.write_text((HERE/'v196.js').read_text(encoding='utf-8'),encoding='utf-8')
h=HTML.read_text(encoding='utf-8')
h=re.sub(r'\s*<!-- MEMEFLOW_EXECUTION_COMPACT_V193 -->.*?<!-- /MEMEFLOW_EXECUTION_COMPACT_V193 -->\s*','\n',h,flags=re.S)
h=re.sub(r"\s*<link[^>]+href=['\"]?/memeflow-settings-execution-compact-v193\.css[^>]*>\s*",'\n',h,flags=re.I)
h=re.sub(r"\s*<script[^>]+src=['\"]?/memeflow-settings-execution-compact-v193\.js[^>]*>\s*</script>\s*",'\n',h,flags=re.I)
h=re.sub(r'\s*<!-- MEMEFLOW_SETTINGS_COMPACT_V196 -->.*?<!-- /MEMEFLOW_SETTINGS_COMPACT_V196 -->\s*','\n',h,flags=re.S)
block='''<!-- MEMEFLOW_SETTINGS_COMPACT_V196 -->
<link rel="stylesheet" href="/memeflow-settings-compact-v196.css?v=196-20260922">
<script defer src="/memeflow-settings-compact-v196.js?v=196-20260922"></script>
<!-- /MEMEFLOW_SETTINGS_COMPACT_V196 -->'''
if '</head>' not in h: raise SystemExit('ERROR: </head> missing in settings.html')
HTML.write_text(h.replace('</head>',block+'\n</head>',1),encoding='utf-8')
print('V196 APPLY COMPLETE')
print('  - V193 visual adapter retired')
print('  - original Execution label/value pairing restored on reload')
print('  - V196 compact Settings layer linked')
