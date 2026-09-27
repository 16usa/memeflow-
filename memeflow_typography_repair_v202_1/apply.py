#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
BACKUP = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 and sys.argv[2] != "-" else None
BRAND = APP / "memeflow-brand.css"
LOCAL_FONT = APP / "assets/fonts/inter/InterVariable.woff2"

if not APP.is_dir():
    raise SystemExit("ERROR: memeflow-app not found")
if not BRAND.is_file():
    raise SystemExit("ERROR: memeflow-brand.css not found")

START = "/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */"
END = "/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */"
brand0 = BRAND.read_text(encoding="utf-8")
if brand0.count(START) != 1 or brand0.count(END) != 1:
    raise SystemExit("ERROR: expected exactly one canonical typography foundation block; no changes made")

OLD_VARS = (
    "--mf-type-micro","--mf-type-meta","--mf-type-ui",
    "--mf-type-body","--mf-type-panel","--mf-type-title"
)
for ext in ("*.js","*.mjs"):
    for p in APP.rglob(ext):
        rel=p.relative_to(APP)
        if any(x.startswith(".") or x in {"node_modules","dist","build"} for x in rel.parts):
            continue
        t=p.read_text(encoding="utf-8",errors="ignore")
        if any(v in t for v in OLD_VARS):
            raise SystemExit(f"ERROR: typography size vars referenced by JS: {p.relative_to(ROOT)}")

SCALE=[8,9,10,11,13,15]
VMAP={"micro":"8px","meta":"9px","ui":"10px","body":"11px","panel":"13px","title":"15px"}

def nearest(v):
    return min(SCALE,key=lambda x:(abs(x-v),x))

def is_owner(p):
    n=p.name.lower()
    return p==BRAND or any(k in n for k in (
        "pixel-typography-v192","how-it-works-compact-v194","smart-vault-compact-v195",
        "settings-compact-v196","agent-performance-compact-v197","technical-hierarchy","typography"
    ))

def protect_font_faces(text):
    blocks=[]
    def repl(m):
        blocks.append(m.group(0))
        return f"/*__FONTFACE_{len(blocks)-1}__*/"
    return re.sub(r'@font-face\s*\{.*?\}',repl,text,flags=re.S|re.I),blocks

def restore_font_faces(text,blocks):
    for i,b in enumerate(blocks):
        text=text.replace(f"/*__FONTFACE_{i}__*/",b)
    return text

def normalize_css(p,text):
    s,faces=protect_font_faces(text)
    for k,px in VMAP.items():
        s=re.sub(rf'var\(\s*--mf-type-{k}(?:\s*,[^)]*)?\)',px,s,flags=re.I)
    s=re.sub(
        r'^\s*--mf-type-(?:micro|meta|ui|body|panel|title)\s*:\s*[^;]+;\s*$',
        '',s,flags=re.M|re.I
    )
    for old in ('"Inter Tight"',"'Inter Tight'",'"IBM Plex Mono"',"'IBM Plex Mono'",'"OpenAI Sans"',"'OpenAI Sans'"):
        s=s.replace(old,'"Inter"')
    if is_owner(p):
        def repl(m):
            v=float(m.group(1)); imp=m.group(2) or ""
            return f"font-size:{nearest(v)}px{imp};"
        s=re.sub(r'font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px(\s*!important)?(?=\s*[;}])',repl,s,flags=re.I)
    return restore_font_faces(s,faces)

FOUNDATION = """/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */
/* MEMEFLOW Canonical Inter Pixel Typography V202.1
   Direct pixel scale only: 8 / 9 / 10 / 11 / 13 / 15 px.
   No global body-star selector. No pseudo-element font override.
*/
:root{
  --mf-font-sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
html,
body,
button,
input,
select,
textarea,
option,
optgroup{
  font-family:var(--mf-font-sans)!important;
  font-kerning:normal;
  font-synthesis:none;
}
body{
  font-size:11px!important;
  font-variant-numeric:tabular-nums lining-nums;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility;
}
h1,
.page-title,
.hero-title,
.settings-hero h1,
.flow-hero h1,
.ap-hero h1,
.mf-vault-hero h1,
.mf-hiw-hero h1,
.mf-settings-page-title>span{
  font-family:var(--mf-font-sans)!important;
  font-size:15px!important;
}
h2,
h3,
.panel-head h2,
.execution-head h2,
.activity-head h2,
.inspector-head h2,
.wallet-dialog-head h2,
.sheet-top h2,
.mf-vault-card-head h2,
.mf-hiw-section-head h2,
.ap-head h2,
.token-name,
.candidate-name,
.position-token-name,
.trade-token-name{
  font-family:var(--mf-font-sans)!important;
  font-size:13px!important;
}
p,
li,
dd,
dt,
td,
.body-copy,
.description,
.subtitle,
.settings-context{
  font-size:11px!important;
}
button,
input,
select,
textarea,
.btn,
.ghost-btn,
.tool-btn,
.mf-vault-btn,
.mf-hiw-btn,
.mf293-primary,
.mf293-secondary{
  font-size:10px!important;
}
label,
.token-meta,
.token-market,
.candidate-meta,
.candidate-bottom,
.position-bottomline,
.trade-log-bottomline,
.trade-log-time,
.chart-time,
.mf293-field-label,
.mf-theme-meta-label{
  font-size:9px!important;
}
small,
.eyebrow,
.brand-sub,
.chart-axis,
.chart-axis-label,
.axis-label,
.axis-value,
.system-micro,
.technical-micro,
[data-micro="true"]{
  font-size:8px!important;
}
/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */"""

css_files=[]
for p in APP.rglob("*.css"):
    rel=p.relative_to(APP)
    if any(x.startswith(".") or x in {"node_modules","dist","build"} for x in rel.parts):
        continue
    css_files.append(p)
html_files=sorted(APP.glob("*.html"))

if BACKUP:
    BACKUP.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for p in css_files+html_files:
        rel=p.relative_to(ROOT)
        dst=BACKUP/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dst)
        manifest.append(str(rel))
    (BACKUP/"manifest.json").write_text(json.dumps({"files":manifest},indent=2),encoding="utf-8")

for p in css_files:
    old=p.read_text(encoding="utf-8")
    new=normalize_css(p,old)
    new=re.sub(
        r'\n?/\* ===== MF_INTER_GLOBAL_LOCK_V1_START ===== \*/.*?/\* ===== MF_INTER_GLOBAL_LOCK_V1_END ===== \*/\n?',
        '\n',new,flags=re.S
    )
    if p==BRAND:
        new=re.sub(
            r'\n?/\* ===== MEMEFLOW_INTER_SOURCE_V202_1_START ===== \*/.*?/\* ===== MEMEFLOW_INTER_SOURCE_V202_1_END ===== \*/\n?',
            '\n',new,flags=re.S
        )
        new,n=re.subn(re.escape(START)+r'.*?'+re.escape(END),FOUNDATION,new,count=1,flags=re.S)
        if n!=1:
            raise SystemExit("ERROR: canonical foundation replacement failed")
        if LOCAL_FONT.is_file():
            source="""/* ===== MEMEFLOW_INTER_SOURCE_V202_1_START ===== */
@font-face{
  font-family:"Inter";
  src:url("/assets/fonts/inter/InterVariable.woff2") format("woff2");
  font-style:normal;
  font-weight:100 900;
  font-display:swap;
}
/* ===== MEMEFLOW_INTER_SOURCE_V202_1_END ===== */

"""
            new=new.replace(START,source+START,1)
        else:
            source="""/* ===== MEMEFLOW_INTER_SOURCE_V202_1_START ===== */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
/* ===== MEMEFLOW_INTER_SOURCE_V202_1_END ===== */
"""
            m=re.match(r'(\s*@charset\s+[^;]+;\s*)',new,flags=re.I)
            if m:
                new=new[:m.end()]+source+new[m.end():]
            else:
                new=source+"\n"+new
    if new!=old:
        p.write_text(new,encoding="utf-8")

for p in html_files:
    old=p.read_text(encoding="utf-8")
    new=old
    for a,b in (
        ("MEMEFLOW_INTER_ONLY_V199","/MEMEFLOW_INTER_ONLY_V199"),
        ("MEMEFLOW_INTER_ONLY_FONT_V199","/MEMEFLOW_INTER_ONLY_FONT_V199"),
        ("MEMEFLOW_PIXEL_SCALE_V200","/MEMEFLOW_PIXEL_SCALE_V200"),
        ("MEMEFLOW_INTER_PIXEL_V201","/MEMEFLOW_INTER_PIXEL_V201"),
    ):
        new=re.sub(rf'\s*<!-- {re.escape(a)} -->.*?<!-- {re.escape(b)} -->\s*','\n',new,flags=re.S)
    new=re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-(?:inter-only-v199|pixel-scale-v200|inter-pixel-v201)\.css[^"\']*["\'][^>]*>\s*',
        '\n',new,flags=re.I
    )
    for cls in ('mf-inter-only-v199','mf-pixel-scale-v200','mf-inter-pixel-v201'):
        new=new.replace(cls,'')
    new=re.sub(r'class=(["\'])\s+',r'class=\1',new)
    new=re.sub(r'\s{2,}', ' ', new)
    if new!=old:
        p.write_text(new,encoding="utf-8")

print("V202.1 APPLY COMPLETE")
