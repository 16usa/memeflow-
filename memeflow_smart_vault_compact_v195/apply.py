#!/usr/bin/env python3
from pathlib import Path
import json,re,shutil,sys
ROOT=Path(sys.argv[1]).resolve(); APP=ROOT/'memeflow-app'; BACKUP=Path(sys.argv[2]).resolve()
HTML=APP/'smart-vault.html'; CSS=APP/'memeflow-smart-vault-compact-v195.css'; HERE=Path(__file__).resolve().parent
if not HTML.is_file(): raise SystemExit('ERROR: memeflow-app/smart-vault.html not found')
BACKUP.mkdir(parents=True,exist_ok=True); manifest=[]
for p in (HTML,CSS):
    if p.exists():
        rel=p.relative_to(ROOT); dst=BACKUP/rel; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,dst); manifest.append(str(rel))
(BACKUP/'manifest.json').write_text(json.dumps({'files':manifest,'css_existed':CSS.exists()},indent=2),encoding='utf-8')
CSS.write_text((HERE/'v195.css').read_text(encoding='utf-8'),encoding='utf-8')
h=HTML.read_text(encoding='utf-8')
h=re.sub(r'\s*<!-- MEMEFLOW_SMART_VAULT_COMPACT_V195 -->.*?<!-- /MEMEFLOW_SMART_VAULT_COMPACT_V195 -->\s*','\n',h,flags=re.S)
block='<!-- MEMEFLOW_SMART_VAULT_COMPACT_V195 -->\n<link rel="stylesheet" href="/memeflow-smart-vault-compact-v195.css?v=195-20260922">\n<!-- /MEMEFLOW_SMART_VAULT_COMPACT_V195 -->'
if '</head>' not in h: raise SystemExit('ERROR: </head> missing in smart-vault.html')
HTML.write_text(h.replace('</head>',block+'\n</head>',1),encoding='utf-8')
print('V195 APPLY COMPLETE')
