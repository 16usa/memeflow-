#!/usr/bin/env python3
from pathlib import Path
import re, sys, colorsys

if len(sys.argv) != 2:
    raise SystemExit('Usage: transform.py <memeflow-app-dir>')
APP=Path(sys.argv[1]); SOURCE=APP/'memeflow-x-canonical-v185.css'; TARGET=APP/'memeflow-x-canonical-v186.css'
PAGES=['index.html','system.html','how-it-works.html','smart-vault.html','trading.html','settings.html','system-tokens.html','x100.html','agent-performance.html','owner-intelligence.html','system-source.html']
if not SOURCE.exists(): raise SystemExit('ERROR: V185 canonical not found')
for page in PAGES:
    if not (APP/page).exists(): raise SystemExit(f'ERROR: production page missing: {page}')

REMOVE={'font','font-family','font-size','font-weight','line-height','letter-spacing','word-spacing'}
COLOR_PROPS={'color','-webkit-text-fill-color'}
DECORATIVE=('::before','::after','icon','glyph','chevron','caret','spinner','hamburger','dot','connector','step-icon','mf-hiw-step-icon')
SEMVAR=re.compile(r'var\(\s*--(?:green|red|yellow|blue|cyan|purple|orange|accent|success|danger|warning|buy|sell|positive|negative|profit|loss|up|down|live|safe|error)[\w-]*',re.I)
SEMHEX={'#4de6a1','#ff6679','#ff98a5','#51e7a8','#54ddff','#4ade80','#22c55e','#ef4444','#f59e0b','#38bdf8'}


def is_decor(sel): return any(x in sel.lower() for x in DECORATIVE)
def sat(r,g,b): return colorsys.rgb_to_hsv(r/255,g/255,b/255)[1]
def semantic_color(v):
    v=re.sub(r'\s*!important\s*$','',v.strip(),flags=re.I).lower()
    if v in ('inherit','currentcolor','transparent','unset','revert','revert-layer'): return True
    if SEMVAR.search(v) or v in {'red','green','blue','yellow','orange','purple','cyan','lime','magenta','tomato','crimson','gold'}: return True
    if any(h in v for h in SEMHEX): return True
    m=re.fullmatch(r'#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})',v)
    if m:
        h=m.group(1)
        if len(h)==3: r,g,b=[int(c*2,16) for c in h]
        else: r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
        return sat(r,g,b)>=.28 and max(r,g,b)-min(r,g,b)>=36
    m=re.match(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)',v)
    if m:
        r,g,b=map(int,m.groups()); return sat(r,g,b)>=.28 and max(r,g,b)-min(r,g,b)>=36
    m=re.match(r'hsla?\(\s*[-\d.]+\s*,\s*([\d.]+)%',v)
    return bool(m and float(m.group(1))>=28)

def control(text,i,chars):
    q=None; esc=False; par=br=0
    while i<len(text):
        if text.startswith('/*',i) and not q:
            j=text.find('*/',i+2)
            if j<0:return len(text),None
            i=j+2; continue
        ch=text[i]
        if q:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==q:q=None
            i+=1;continue
        if ch in "'\"":q=ch
        elif ch=='(':par+=1
        elif ch==')':par=max(0,par-1)
        elif ch=='[':br+=1
        elif ch==']':br=max(0,br-1)
        elif par==0 and br==0 and ch in chars:return i,ch
        i+=1
    return len(text),None

def close_brace(text,o):
    d=1;q=None;esc=False;i=o+1
    while i<len(text):
        if text.startswith('/*',i) and not q:
            j=text.find('*/',i+2)
            if j<0: raise ValueError('unclosed comment')
            i=j+2;continue
        ch=text[i]
        if q:
            if esc:esc=False
            elif ch=='\\':esc=True
            elif ch==q:q=None
            i+=1;continue
        if ch in "'\"":q=ch
        elif ch=='{':d+=1
        elif ch=='}':
            d-=1
            if d==0:return i
        i+=1
    raise ValueError('unclosed block')

def split_decl(body):
    out=[];start=0;q=None;esc=False;par=br=0;i=0
    while i<len(body):
        if body.startswith('/*',i) and not q:
            j=body.find('*/',i+2); i=(len(body) if j<0 else j+2);continue
        ch=body[i]
        if q:
            if esc:esc=False
            elif ch=='\\':esc=True
            elif ch==q:q=None
            i+=1;continue
        if ch in "'\"":q=ch
        elif ch=='(':par+=1
        elif ch==')':par=max(0,par-1)
        elif ch=='[':br+=1
        elif ch==']':br=max(0,br-1)
        elif ch==';' and par==0 and br==0:
            out.append(body[start:i+1]);start=i+1
        i+=1
    if start<len(body):out.append(body[start:])
    return out

def decl(seg):
    raw=seg.strip(); semi=raw.endswith(';')
    if not raw:return None
    if semi:raw=raw[:-1]
    i,c=control(raw,0,{':'})
    if c!=':':return None
    return raw[:i].strip(),raw[i+1:].strip(),semi

SKIP=('@font-face','@keyframes','@-webkit-keyframes','@property','@page','@counter-style')
removed={'type':0,'neutral':0}
def clean(css):
    out=[];i=0
    while i<len(css):
        if css[i].isspace():
            j=i+1
            while j<len(css) and css[j].isspace():j+=1
            out.append(css[i:j]);i=j;continue
        if css.startswith('/*',i):
            j=css.find('*/',i+2)
            if j<0:out.append(css[i:]);break
            out.append(css[i:j+2]);i=j+2;continue
        ci,cc=control(css,i,{';','{'})
        if cc is None:out.append(css[i:]);break
        head=css[i:ci].strip()
        if cc==';':out.append(css[i:ci+1]);i=ci+1;continue
        end=close_brace(css,ci);inner=css[ci+1:end]
        if head.startswith('@'):
            if any(head.lower().startswith(x) for x in SKIP):out.append(css[i:end+1])
            else:
                sub=clean(inner)
                if sub.strip():out.append(head+'{'+sub+'}')
            i=end+1;continue
        kept=[];decor=is_decor(head)
        for seg in split_decl(inner):
            p=decl(seg)
            if not p:kept.append(seg);continue
            prop,val,_=p;pl=prop.lower();drop=False
            if not decor and pl in REMOVE:drop=True;removed['type']+=1
            elif not decor and pl in COLOR_PROPS and not semantic_color(val):drop=True;removed['neutral']+=1
            if not drop:kept.append(seg)
        body=''.join(kept)
        if body.strip():out.append(head+'{'+body+'}')
        i=end+1
    return ''.join(out)

css=SOURCE.read_text(encoding='utf-8')
css=re.sub(r'/\* MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START \*/[\s\S]*?/\* MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_END \*/','',css)
css=clean(css)

ROLE=r'''/* MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START */
:root{
--mf-neutral-text-1:#FFFFFF;--mf-neutral-text-2:#D6D6D6;--mf-neutral-text-3:#A3A3A3;--mf-neutral-text-4:#737373;
--mf-font-sans:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
--mf-font-mono:"SFMono-Regular",ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono",monospace;
--mf-role-display:var(--mf-size-36);--mf-role-page:var(--mf-size-24);--mf-role-section:var(--mf-size-17);--mf-role-subhead:var(--mf-size-15);--mf-role-body:var(--mf-size-14);--mf-role-ui:var(--mf-size-13);--mf-role-meta:var(--mf-size-12);--mf-role-micro:var(--mf-size-11);
}
html[data-theme="light"]{--mf-neutral-text-1:#000000;--mf-neutral-text-2:#303030;--mf-neutral-text-3:#606060;--mf-neutral-text-4:#8A8A8A;}
body{font-family:var(--mf-font-sans);font-size:var(--mf-role-body);font-weight:500;line-height:1.45;letter-spacing:0;color:var(--mf-neutral-text-2);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
button,input,select,textarea{font-family:var(--mf-font-sans);font-size:var(--mf-role-ui);font-weight:600;line-height:1.3;letter-spacing:0;}input,select,textarea{color:var(--mf-neutral-text-1);}input::placeholder,textarea::placeholder{color:var(--mf-neutral-text-4);}a{color:var(--mf-neutral-text-2);}p{font-size:var(--mf-role-body);font-weight:500;line-height:1.45;color:var(--mf-neutral-text-2);}small{font-size:var(--mf-role-meta);font-weight:500;line-height:1.35;color:var(--mf-neutral-text-3);}strong,b{font-weight:700;color:var(--mf-neutral-text-1);}code,pre,kbd,samp,:where(.mono,[class*="mono"],[class*="mint"],[class*="address"]){font-family:var(--mf-font-mono);}
h1{font-size:var(--mf-role-page);font-weight:800;line-height:1.08;letter-spacing:-.025em;color:var(--mf-neutral-text-1);}h2{font-size:var(--mf-role-section);font-weight:700;line-height:1.18;letter-spacing:-.012em;color:var(--mf-neutral-text-1);}h3{font-size:var(--mf-role-subhead);font-weight:700;line-height:1.24;letter-spacing:-.006em;color:var(--mf-neutral-text-1);}h4,h5,h6{font-size:var(--mf-role-ui);font-weight:600;line-height:1.3;color:var(--mf-neutral-text-1);}
:where(.brand-title,.brand,.token-name,.readiness-label,.mfpg-caption-title,.mf-settings-page-title>span,[class*="title"]:not([class*="subtitle"])){color:var(--mf-neutral-text-1);}:where(.hero-sub,.inspector-summary,.brief-copy,.empty,.empty-state,.advanced-intelligence-intro,.ap-note,.mfpg-caption-text){color:var(--mf-neutral-text-2);}:where(.muted,.subtitle,.brand-sub,.sub,.meta,[class*="-meta"],[class*="caption"],[class*="description"],[class*="summary"],[class*="hint"],[class*="note"],[class*="-sub"]){color:var(--mf-neutral-text-3);}:where([aria-disabled="true"],[disabled],.disabled,.is-disabled,[class*="placeholder"],[class*="tertiary"]){color:var(--mf-neutral-text-4);}
:where(.eyebrow,[class*="eyebrow"],.kicker,[class*="kicker"],.nav-label,.mf293-field-label,.mf-theme-appearance-label){font-size:var(--mf-role-micro);font-weight:600;line-height:1.25;letter-spacing:.08em;color:var(--mf-neutral-text-3);text-transform:uppercase;}:where(.score-caption,[class*="caption"],[class*="-meta"],.meta,.muted,.subtitle,.brand-sub,.sub,.mf293-dex-filter-meta,.mf-theme-current){font-size:var(--mf-role-meta);font-weight:500;line-height:1.35;letter-spacing:0;color:var(--mf-neutral-text-3);}
:where(button,.btn,[class*="-btn"],[class*="_btn"],.tool-btn,.wallet-btn,.primary-action,.text-action,.nav-link,.mf-nav-link,.back){font-size:var(--mf-role-ui);font-weight:600;line-height:1.2;letter-spacing:0;}:where(nav a,.nav a,.mf-nav-link,.mobile-nav button,.itab,.mode,.timeframes button,.intervals button){font-size:var(--mf-role-ui);font-weight:600;line-height:1.25;}:where(nav a:not(.active),.nav a:not(.active),.mf-nav-link:not(.active)){color:var(--mf-neutral-text-3);}:where(nav a.active,.nav a.active,.mf-nav-link.active){color:var(--mf-neutral-text-1);}
:where(.chip,[class*="badge"],[class*="pill"],[class*="state"],.tiny-state,.mode-badge,.approval-count,.scanner-status){font-size:var(--mf-role-micro);font-weight:600;line-height:1.15;letter-spacing:.035em;}
:where(.big-score,.token-price,.chart-price,.price,[class*="pnl"],[class*="score"]:not([class*="caption"]),[class*="count"]:not([class*="discount"])){font-variant-numeric:tabular-nums;}.big-score{font-size:var(--mf-role-display);font-weight:800;line-height:1;letter-spacing:-.035em;color:var(--mf-neutral-text-1);}:where(.token-price,.chart-price){font-size:var(--mf-role-page);font-weight:800;line-height:1.05;letter-spacing:-.025em;color:var(--mf-neutral-text-1);}
body.mf-page-index #missionTitle{font-size:var(--mf-role-display);font-weight:800;line-height:1.03;letter-spacing:-.035em;color:var(--mf-neutral-text-1);}body.mf-page-index h2{font-size:var(--mf-role-section);}body.mf-page-index h3{font-size:var(--mf-role-subhead);}body.mf-page-index .token-name{font-size:var(--mf-role-section);font-weight:700;line-height:1.15;color:var(--mf-neutral-text-1);}body.mf-page-index :where(.ai-data-val,.readiness-label){font-size:var(--mf-role-subhead);font-weight:700;color:var(--mf-neutral-text-1);}
body.mf-page-how-it-works h1{font-size:var(--mf-role-display);font-weight:800;line-height:1.02;letter-spacing:-.04em;}body.mf-page-how-it-works h2{font-size:var(--mf-role-page);font-weight:700;line-height:1.08;letter-spacing:-.025em;}body.mf-page-how-it-works h3{font-size:var(--mf-role-section);font-weight:700;}body.mf-page-how-it-works p{color:var(--mf-neutral-text-2);}
body.mf-page-smart-vault h1{font-size:var(--mf-role-display);font-weight:800;line-height:1.03;letter-spacing:-.035em;}body.mf-page-smart-vault h2{font-size:var(--mf-role-section);}body.mf-page-smart-vault :where(.mf-vault-mono,strong){font-size:var(--mf-role-subhead);line-height:1.3;}body.mf-page-smart-vault .mf-vault-eyebrow{font-size:var(--mf-role-micro);font-weight:700;letter-spacing:.08em;color:var(--mf-neutral-text-3);}
body.mf-page-trading .brand-title{font-size:var(--mf-role-subhead);font-weight:700;line-height:1.1;}body.mf-page-trading .brand-sub{font-size:var(--mf-role-micro);}body.mf-page-trading h1#tokenName{font-size:var(--mf-role-section);font-weight:700;line-height:1.12;letter-spacing:-.015em;}body.mf-page-trading h2{font-size:var(--mf-role-section);}body.mf-page-trading .token-price{font-size:var(--mf-role-page);font-weight:800;}body.mf-page-trading .token-market{font-size:var(--mf-role-meta);color:var(--mf-neutral-text-3);}body.mf-page-trading #paperPnl{font-size:var(--mf-role-section);font-weight:700;}
body.mf-page-settings .mf-settings-page-title>span{font-size:var(--mf-role-page);font-weight:800;line-height:1.08;letter-spacing:-.025em;}body.mf-page-settings .mf-settings-page-title>strong{font-size:var(--mf-role-meta);font-weight:500;color:var(--mf-neutral-text-3);}body.mf-page-settings .mf293-settings-head h2{font-size:var(--mf-role-section);font-weight:700;}body.mf-page-settings .mf293-settings-group summary strong{font-size:var(--mf-role-subhead);font-weight:700;}body.mf-page-settings :where(.mf293-field input:not([type="checkbox"]),.mf293-field select,.mf293-field textarea){font-size:var(--mf-role-body);font-weight:500;color:var(--mf-neutral-text-1);}
body.mf-page-system-tokens h1{font-size:var(--mf-role-page);font-weight:800;}body.mf-page-system-tokens :where(#visibleCount,#countAll,#countReady,#countWatch,#countWaiting,#countBlocked,#pageNumber,#pageTotal){font-size:var(--mf-role-section);font-weight:700;color:var(--mf-neutral-text-1);font-variant-numeric:tabular-nums;}
body.mf-page-system .brand{font-size:var(--mf-role-subhead);font-weight:700;}body.mf-page-system .subtitle{font-size:var(--mf-role-micro);}body.mf-page-system :where(#inspectorTitle,.mfpg-caption-title){font-size:var(--mf-role-section);font-weight:700;}body.mf-page-system .scene-hint{font-size:var(--mf-role-meta);color:var(--mf-neutral-text-3);}
body.mf-page-x100 h1{font-size:var(--mf-role-display);font-weight:800;line-height:1.03;letter-spacing:-.035em;}body.mf-page-x100 h2{font-size:var(--mf-role-page);font-weight:700;line-height:1.1;letter-spacing:-.025em;}body.mf-page-x100 h3{font-size:var(--mf-role-section);font-weight:700;}body.mf-page-x100 .kicker{font-size:var(--mf-role-micro);font-weight:700;letter-spacing:.09em;color:var(--mf-neutral-text-3);}
body.mf-page-agent-performance h1{font-size:var(--mf-role-page);font-weight:800;}body.mf-page-agent-performance h2{font-size:var(--mf-role-section);font-weight:700;}body.mf-page-agent-performance .ap-eyebrow{font-size:var(--mf-role-micro);font-weight:700;letter-spacing:.08em;color:var(--mf-neutral-text-3);}
body.mf-page-owner-intelligence h1{font-size:var(--mf-role-page);font-weight:800;line-height:1.05;}body.mf-page-owner-intelligence h2{font-size:var(--mf-role-section);font-weight:700;}body.mf-page-owner-intelligence h3{font-size:var(--mf-role-subhead);font-weight:700;}body.mf-page-owner-intelligence :where(.oi-eyebrow,.oi-kicker){font-size:var(--mf-role-micro);font-weight:700;letter-spacing:.08em;color:var(--mf-neutral-text-3);}body.mf-page-owner-intelligence .oi-promotion-blocker{font-size:var(--mf-role-ui);font-weight:500;line-height:1.4;color:var(--mf-neutral-text-3);}
body.mf-page-system-source h1{font-size:var(--mf-role-page);font-weight:800;}body.mf-page-system-source .brand{font-size:var(--mf-role-subhead);font-weight:700;}body.mf-page-system-source :where(.sub,.k){font-size:var(--mf-role-meta);color:var(--mf-neutral-text-3);}body.mf-page-system-source .mode{font-size:var(--mf-role-ui);font-weight:700;}
#mf-final-chart-host .name{font-size:var(--mf-role-section);font-weight:700;line-height:1.1;letter-spacing:-.015em;color:var(--mf-neutral-text-1);}#mf-final-chart-host .price{font-size:var(--mf-role-page);font-weight:800;line-height:1;letter-spacing:-.03em;color:var(--mf-neutral-text-1);}#mf-final-chart-host :where(.meta,.source,.age,.footer,.empty){font-size:var(--mf-role-micro);color:var(--mf-neutral-text-3);}#mf-final-chart-host .label b{font-size:var(--mf-role-ui);font-weight:700;color:var(--mf-neutral-text-1);}
@media(max-width:560px){body.mf-page-how-it-works h1,body.mf-page-smart-vault h1,body.mf-page-x100 h1,body.mf-page-index #missionTitle{font-size:var(--mf-role-page);line-height:1.05;}body.mf-page-how-it-works h2,body.mf-page-x100 h2{font-size:var(--mf-role-section);}}
/* MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_END */'''

css=css.rstrip()+'\n\n'+ROLE+'\n'
css=css.replace('MEMEFLOW_TEXT_CANONICAL_V185_START','MEMEFLOW_TEXT_CANONICAL_V186_START').replace('MEMEFLOW_TEXT_CANONICAL_V185_END','MEMEFLOW_TEXT_CANONICAL_V186_END')
TARGET.write_text(css,encoding='utf-8'); SOURCE.unlink()
for page in PAGES:
    p=APP/page; h=p.read_text(encoding='utf-8')
    h=re.sub(r'/memeflow-x-canonical-v185\.css(?:\?[^"\']*)?','/memeflow-x-canonical-v186.css?v=typography-role-system-v186-20260922',h)
    if 'memeflow-x-canonical-v186.css' not in h: raise SystemExit(f'ERROR: V186 link not created in {page}')
    p.write_text(h,encoding='utf-8')
print('V186 TYPOGRAPHY TRANSFORM COMPLETE')
print(' - old typography declarations removed:',removed['type'])
print(' - old neutral color declarations removed:',removed['neutral'])
print(' - semantic colors preserved')
