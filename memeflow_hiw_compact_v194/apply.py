#!/usr/bin/env python3
from pathlib import Path
import json,re,shutil,sys
ROOT=Path(sys.argv[1]).resolve()
APP=ROOT/"memeflow-app"
BACKUP=Path(sys.argv[2]).resolve()
HTML=APP/"how-it-works.html"
CSS=APP/"memeflow-how-it-works-compact-v194.css"
HERE=Path(__file__).resolve().parent
if not HTML.is_file():
    raise SystemExit("ERROR: memeflow-app/how-it-works.html not found")
BACKUP.mkdir(parents=True,exist_ok=True)
manifest=[]
for p in (HTML,CSS):
    if p.exists():
        rel=p.relative_to(ROOT)
        dst=BACKUP/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dst)
        manifest.append(str(rel))
(BACKUP/"manifest.json").write_text(json.dumps({"files":manifest,"css_existed":CSS.exists()},indent=2),encoding="utf-8")
CSS.write_text((HERE/"v194.css").read_text(encoding="utf-8"),encoding="utf-8")
h=HTML.read_text(encoding="utf-8")
h=re.sub(r'\s*<!-- MEMEFLOW_HIW_COMPACT_V194 -->.*?<!-- /MEMEFLOW_HIW_COMPACT_V194 -->\s*','\n',h,flags=re.S)
block = '<!-- MEMEFLOW_HIW_COMPACT_V194 -->\n<link rel="stylesheet" href="/memeflow-how-it-works-compact-v194.css?v=194-20260922">\n<!-- /MEMEFLOW_HIW_COMPACT_V194 -->'
if "</head>" not in h:
    raise SystemExit("ERROR: </head> missing in how-it-works.html")
HTML.write_text(h.replace("</head>",block+"\n</head>",1),encoding="utf-8")
print("V194 APPLY COMPLETE")
