#!/usr/bin/env python3
from pathlib import Path
import json, re, shutil, sys

ROOT = Path(sys.argv[1]).resolve()
APP = ROOT / "memeflow-app"
BACKUP = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 and sys.argv[2] != "-" else None

if not APP.is_dir():
    raise SystemExit("ERROR: memeflow-app not found")

BRAND = APP / "memeflow-brand.css"
FONT = APP / "assets/fonts/inter/InterVariable.woff2"
if not BRAND.is_file():
    raise SystemExit("ERROR: canonical memeflow-brand.css not found")
if not FONT.is_file():
    raise SystemExit("ERROR: local Inter font missing: memeflow-app/assets/fonts/inter/InterVariable.woff2")

START = "/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */"
END = "/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */"

brand_text = BRAND.read_text(encoding="utf-8")
if brand_text.count(START) != 1 or brand_text.count(END) != 1:
    raise SystemExit("ERROR: expected exactly one canonical typography foundation block; no changes made")

old_vars = (
    "--mf-type-micro","--mf-type-meta","--mf-type-ui",
    "--mf-type-body","--mf-type-panel","--mf-type-title"
)
js_hits = []
for ext in ("*.js","*.mjs"):
    for p in APP.rglob(ext):
        try:
            rel = p.relative_to(APP)
        except Exception:
            continue
        if any(x.startswith(".") or x in {"node_modules","dist","build"} for x in rel.parts):
            continue
        t = p.read_text(encoding="utf-8", errors="ignore")
        if any(v in t for v in old_vars):
            js_hits.append(str(p.relative_to(ROOT)))
if js_hits:
    raise SystemExit("ERROR: typography size vars are referenced by JS; safe migration stopped: " + ", ".join(js_hits[:10]))

SCALE = [8,9,10,11,13,15]
def nearest(v):
    return min(SCALE, key=lambda x: (abs(x-v), x))

VAR_MAP = {
    "micro":"8px","meta":"9px","ui":"10px",
    "body":"11px","panel":"13px","title":"15px",
}

def is_type_owner(p, text):
    n = p.name.lower()
    markers = (
        "pixel-typography-v192",
        "how-it-works-compact-v194",
        "smart-vault-compact-v195",
        "settings-compact-v196",
        "agent-performance-compact-v197",
        "technical-hierarchy",
        "typography",
    )
    return p == BRAND or any(x in n for x in markers)

def strip_font_face(text):
    blocks=[]
    def repl(m):
        blocks.append(m.group(0))
        return "/*__MF_FONT_FACE_%d__*/" % (len(blocks)-1)
    return re.sub(r'@font-face\s*\{.*?\}', repl, text, flags=re.S|re.I), blocks

def restore_font_face(text, blocks):
    for i,b in enumerate(blocks):
        text=text.replace("/*__MF_FONT_FACE_%d__*/" % i, b)
    return text

def normalize_css(path, text):
    stats={"family":0,"var":0,"size":0,"defs":0}
    stripped, ff = strip_font_face(text)

    for key,px in VAR_MAP.items():
        pat = rf'var\(\s*--mf-type-{key}(?:\s*,[^)]*)?\)'
        stripped,n = re.subn(pat, px, stripped, flags=re.I)
        stats["var"] += n

    stripped,n = re.subn(
        r'^\s*--mf-type-(?:micro|meta|ui|body|panel|title)\s*:\s*[^;]+;\s*$',
        '', stripped, flags=re.M|re.I
    )
    stats["defs"] += n

    def fam_repl(m):
        value=m.group(1)
        low=value.lower()
        if "inter tight" in low or "ibm plex mono" in low or "openai sans" in low:
            stats["family"] += 1
            important = " !important" if "!important" in low else ""
            return 'font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif%s;' % important
        return m.group(0)
    stripped = re.sub(r'font-family\s*:\s*([^;]+);', fam_repl, stripped, flags=re.I)

    if is_type_owner(path, text):
        def size_repl(m):
            raw=float(m.group(1))
            mapped=nearest(raw)
            if raw != mapped:
                stats["size"] += 1
            important=m.group(2) or ""
            return f"font-size:{mapped}px{important};"
        stripped = re.sub(
            r'font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px(\s*!important)?(?=\s*[;}])',
            size_repl, stripped, flags=re.I
        )

    return restore_font_face(stripped, ff), stats

foundation = '''/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */
/*
  MEMEFLOW Canonical Inter Pixel Typography V202
  Direct pixel scale only: 8 / 9 / 10 / 11 / 13 / 15 px
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
/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */'''

css_files=[]
for p in APP.rglob("*.css"):
    rel=p.relative_to(APP)
    if any(x.startswith(".") or x in {"node_modules","dist","build"} for x in rel.parts):
        continue
    css_files.append(p)

html_files=sorted(APP.glob("*.html"))
targets=list(css_files)+html_files

if BACKUP:
    BACKUP.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for p in targets:
        rel=p.relative_to(ROOT)
        dst=BACKUP/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dst)
        manifest.append(str(rel))
    (BACKUP/"manifest.json").write_text(json.dumps({"files":manifest},indent=2),encoding="utf-8")

totals={"family":0,"var":0,"size":0,"defs":0,"css_changed":0,"html_changed":0}

for p in css_files:
    old=p.read_text(encoding="utf-8")
    new,st=normalize_css(p,old)

    new = re.sub(
        r'\n?/\* ===== MF_INTER_GLOBAL_LOCK_V1_START ===== \*/.*?'
        r'/\* ===== MF_INTER_GLOBAL_LOCK_V1_END ===== \*/\n?',
        '\n', new, flags=re.S
    )

    if p == BRAND:
        pattern=re.escape(START)+r'.*?'+re.escape(END)
        new,n=re.subn(pattern,foundation,new,count=1,flags=re.S)
        if n != 1:
            raise SystemExit("ERROR: canonical foundation replacement failed")

        face_start="/* ===== MEMEFLOW_INTER_LOCAL_V202_START ===== */"
        face_end="/* ===== MEMEFLOW_INTER_LOCAL_V202_END ===== */"
        new=re.sub(re.escape(face_start)+r'.*?'+re.escape(face_end),'',new,flags=re.S)
        face='''/* ===== MEMEFLOW_INTER_LOCAL_V202_START ===== */
@font-face{
  font-family:"Inter";
  src:url("/assets/fonts/inter/InterVariable.woff2") format("woff2");
  font-style:normal;
  font-weight:100 900;
  font-display:swap;
}
/* ===== MEMEFLOW_INTER_LOCAL_V202_END ===== */

'''
        new=new.replace(START,face+START,1)

    for k,v in st.items():
        totals[k]+=v
    if new != old:
        p.write_text(new,encoding="utf-8")
        totals["css_changed"]+=1

for p in html_files:
    old=p.read_text(encoding="utf-8")
    new=old
    pairs=[
        ("MEMEFLOW_INTER_ONLY_V199","/MEMEFLOW_INTER_ONLY_V199"),
        ("MEMEFLOW_INTER_ONLY_FONT_V199","/MEMEFLOW_INTER_ONLY_FONT_V199"),
        ("MEMEFLOW_PIXEL_SCALE_V200","/MEMEFLOW_PIXEL_SCALE_V200"),
        ("MEMEFLOW_INTER_PIXEL_V201","/MEMEFLOW_INTER_PIXEL_V201"),
    ]
    for a,b in pairs:
        new=re.sub(rf'\s*<!-- {re.escape(a)} -->.*?<!-- {re.escape(b)} -->\s*','\n',new,flags=re.S)
    new=re.sub(
        r'\s*<link[^>]+href=["\']/memeflow-(?:inter-only-v199|pixel-scale-v200|inter-pixel-v201)\.css[^"\']*["\'][^>]*>\s*',
        '\n',new,flags=re.I
    )
    new=re.sub(r'\s+(?:mf-inter-only-v199|mf-pixel-scale-v200|mf-inter-pixel-v201)(?=[\s"])','',new)

    if new != old:
        p.write_text(new,encoding="utf-8")
        totals["html_changed"]+=1

print(json.dumps(totals,indent=2))
