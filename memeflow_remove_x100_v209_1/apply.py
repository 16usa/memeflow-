#!/usr/bin/env python3
from pathlib import Path
import argparse, json, re, shutil

ROUTE_RE = re.compile(r'''(?ix)(?:href|url|path|route)\s*[:=]\s*["']/?x100(?:\.html)?(?:\?[^"']*)?["']|\bhref\s*=\s*["']/?x100(?:\.html)?(?:\?[^"']*)?["']''')
ANCHOR_RE = re.compile(r'''(?is)<a\b(?=[^>]*\bhref\s*=\s*(["'])(?:/?x100(?:\.html)?(?:\?[^"']*)?(?:#[^"']*)?)\1)[^>]*>.*?</a>''')
NAV_OBJ_RE = re.compile(r'''(?is)\{[^{}]*?\bhref\s*:\s*(["'])/?x100(?:\.html)?(?:\?[^"']*)?\1[^{}]*?\}\s*,?''')
NAV_TUPLE_RE = re.compile(r'''(?is)\[[^\[\]]*?(["'])/?x100(?:\.html)?(?:\?[^"']*)?\1[^\[\]]*?\]\s*,?''')
STAMP = 'remove-x100-v2091-20260922'
TEXT_TOP_EXTS={'.html','.htm','.js','.mjs','.cjs','.json','.xml'}

def read(p):
    return p.read_text(encoding='utf-8',errors='strict')

def is_target_page(p):
    t=read(p).lower()
    markers=['x100 network','one economic system','draft economic model']
    return sum(m in t for m in markers) >= 2

def remove_nav_item(text):
    text,n1=NAV_OBJ_RE.subn('',text)
    text,n2=NAV_TUPLE_RE.subn('',text)
    text,n3=re.subn(r'''(?im)^[ \t]*[^\n{}]*?(?:href|url|path|route)\s*[:=]\s*(["'])/?x100(?:\.html)?(?:\?[^"']*)?\1[^\n{}]*,?[ \t]*\n?''','',text)
    return text,n1+n2+n3

def clean_html(text):
    text=ANCHOR_RE.sub('',text)
    text=re.sub(r'''(/memeflow-nav\.js)(?:\?v=[^"'\s>]+)?''',rf'\1?v={STAMP}',text)
    return text

def clean_manifest(text):
    try:
        obj=json.loads(text)
    except Exception:
        return text
    def hit(v):
        if not isinstance(v,str): return False
        s=v.split('#',1)[0].split('?',1)[0].strip().lstrip('./').lstrip('/')
        return s in {'x100','x100.html'}
    def prune(v):
        if isinstance(v,list):
            out=[]
            for x in v:
                if hit(x):
                    continue
                if isinstance(x,dict) and any(hit(y) for y in x.values()):
                    continue
                out.append(prune(x))
            return out
        if isinstance(v,dict):
            out={}
            for k,val in v.items():
                if hit(k) or hit(val):
                    continue
                if isinstance(val,dict) and any(hit(y) for y in val.values()):
                    continue
                out[k]=prune(val)
            return out
        return v
    new=prune(obj)
    return text if new==obj else json.dumps(new,ensure_ascii=False,indent=2)+'\n'

def collect_plan(app):
    target=app/'x100.html'
    if not target.is_file():
        raise SystemExit('ERROR: memeflow-app/x100.html not found; no changes made')
    if not is_target_page(target):
        raise SystemExit('ERROR: x100.html is not the expected X100 economic-model page; no changes made')
    nav=app/'memeflow-nav.js'
    if not nav.is_file():
        raise SystemExit('ERROR: memeflow-nav.js missing; refusing partial removal')

    changes={}
    nav_old=read(nav)
    nav_new,count=remove_nav_item(nav_old)
    if count==0 and ROUTE_RE.search(nav_old):
        raise SystemExit('ERROR: X100 route exists in memeflow-nav.js but its structure is not safely recognized')
    if ROUTE_RE.search(nav_new):
        raise SystemExit('ERROR: X100 route still remains in memeflow-nav.js after targeted cleanup')
    if nav_new!=nav_old:
        changes[nav]=nav_new

    for p in sorted(app.glob('*.html')):
        if p==target: continue
        old=read(p); new=clean_html(old)
        if new!=old: changes[p]=new

    manifest=app/'brand'/'manifest.json'
    if manifest.is_file():
        old=read(manifest); new=clean_manifest(old)
        if new!=old: changes[manifest]=new

    css=app/'x100.css'
    delete_css=False
    if css.is_file():
        refs=[]
        for p in sorted(app.glob('*')):
            if not p.is_file() or p in {target,css}: continue
            if p.suffix.lower() not in TEXT_TOP_EXTS: continue
            try: t=read(p)
            except Exception: continue
            if re.search(r'''(?i)(?:/|["'])x100\.css(?:\?|["'])''',t): refs.append(p)
        delete_css=not refs
    return target,changes,css if delete_css else None

def save_backup(app,backup,files,deleted):
    backup.mkdir(parents=True,exist_ok=True)
    rec={'files':[]}
    for p in sorted(set(files)|set(deleted),key=lambda x:str(x)):
        if not p.exists(): continue
        rel=p.relative_to(app).as_posix()
        dst=backup/'files'/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dst)
        rec['files'].append(rel)
    (backup/'manifest.json').write_text(json.dumps(rec,indent=2),encoding='utf-8')

def audit(app):
    errors=[]
    if (app/'x100.html').exists(): errors.append('x100.html still exists')
    if (app/'x100.css').exists():
        refs=[]
        for p in app.glob('*'):
            if p.is_file() and p.suffix.lower() in TEXT_TOP_EXTS and p.name!='x100.html':
                try:
                    if 'x100.css' in read(p): refs.append(p.name)
                except Exception: pass
        if not refs: errors.append('orphan x100.css still exists')
    nav=app/'memeflow-nav.js'
    if nav.is_file() and ROUTE_RE.search(read(nav)):
        errors.append('X100 route/link remains in memeflow-nav.js')
    for p in sorted(app.glob('*.html')):
        try: t=read(p)
        except Exception: continue
        if re.search(r'''(?i)\bhref\s*=\s*["']/?x100(?:\.html)?(?:[?#][^"']*)?["']''',t):
            errors.append(f'X100 href remains in {p.name}')
    manifest=app/'brand'/'manifest.json'
    if manifest.is_file() and re.search(r'''(?i)["']/?x100(?:\.html)?(?:[?#][^"']*)?["']''',read(manifest)):
        errors.append('X100 page route remains in brand/manifest.json')
    if errors:
        print('V209.1 AUDIT FAILED')
        for e in errors: print(' -',e)
        return False
    print('V209.1 X100 REMOVAL AUDIT: PASS')
    print(' - x100.html removed')
    print(' - global nav route removed')
    print(' - top-level page links removed')
    print(' - x100.css removed when unshared')
    print(' - Smart Vault/devnet/game state data untouched')
    return True

def apply(root,backup=None,dry=False):
    app=root/'memeflow-app'
    if not app.is_dir(): raise SystemExit('ERROR: memeflow-app not found')
    target,changes,css=collect_plan(app)
    print('TARGET:',target.relative_to(root))
    print('FILES TO MODIFY:',len(changes))
    for p in changes: print(' -',p.relative_to(root))
    print('FILES TO DELETE:',1+(1 if css else 0))
    print(' -',target.relative_to(root))
    if css: print(' -',css.relative_to(root))
    if dry: return
    if backup is None: raise SystemExit('ERROR: backup required')
    deleted=[target]+([css] if css else [])
    save_backup(app,backup,[*changes.keys(),*deleted],deleted)
    for p,new in changes.items(): p.write_text(new,encoding='utf-8')
    target.unlink()
    if css and css.exists(): css.unlink()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('root')
    ap.add_argument('--backup')
    ap.add_argument('--dry-run',action='store_true')
    ap.add_argument('--audit',action='store_true')
    ns=ap.parse_args()
    root=Path(ns.root).resolve(); app=root/'memeflow-app'
    if ns.audit:
        raise SystemExit(0 if audit(app) else 1)
    apply(root,Path(ns.backup).resolve() if ns.backup else None,ns.dry_run)

if __name__=='__main__': main()
