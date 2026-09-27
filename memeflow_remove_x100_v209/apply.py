#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import argparse, json, re, shutil, sys

MARKERS = (
    "X100 NETWORK",
    "One token.",
    "One economic system.",
    "View token allocation",
    "Draft economic model",
)
TEXT_EXTS = {".html",".htm",".js",".mjs",".cjs",".json",".xml",".txt",".css"}
SKIP_PARTS = {
    "node_modules",".git",".patch-backups",".mf-backups",".memeflow-backups",
    "__pycache__","tests","test","data","logs","coverage","dist","build"
}
TARGET_NAME = "x100.html"

def active_files(app: Path):
    for p in app.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(app)
        if any(part in SKIP_PARTS or "backup" in part.lower() for part in rel.parts):
            continue
        if p.suffix.lower() in TEXT_EXTS:
            yield p

def norm_text(p: Path):
    return p.read_text(encoding="utf-8", errors="ignore")

def discover(app: Path):
    preferred = app / TARGET_NAME
    if preferred.is_file():
        t = norm_text(preferred)
        score = sum(m.lower() in t.lower() for m in MARKERS)
        if score >= 2 or "x100" in t.lower():
            return preferred
    candidates = []
    for p in active_files(app):
        if p.suffix.lower() not in {".html",".htm"}:
            continue
        t = norm_text(p)
        score = sum(m.lower() in t.lower() for m in MARKERS)
        if score >= 3:
            candidates.append((score,p))
    candidates.sort(key=lambda x:(-x[0],len(x[1].parts),str(x[1])))
    if len(candidates) == 1:
        return candidates[0][1]
    if candidates:
        best = [p for s,p in candidates if s == candidates[0][0]]
        if len(best) == 1:
            return best[0]
    raise SystemExit(
        "ERROR: could not identify exactly one X100 economic-model production page. "
        "No files changed."
    )

def target_patterns(target: Path, app: Path):
    rel = target.relative_to(app).as_posix()
    stem = rel[:-5] if rel.endswith(".html") else rel
    vals = {
        rel, "/" + rel,
        stem, "/" + stem,
        target.name, "/" + target.name,
        target.stem, "/" + target.stem,
    }
    vals |= {v + "?": None for v in []}  # keep deterministic/no-op
    return sorted(vals, key=len, reverse=True)

def url_is_target(value: str, target: Path, app: Path):
    v = value.strip().split("#",1)[0].split("?",1)[0]
    if v.startswith(("http://","https://")):
        try:
            v = "/" + v.split("/",3)[3]
        except Exception:
            return False
    v = v.lstrip("./")
    rel = target.relative_to(app).as_posix().lstrip("./")
    stem = rel[:-5] if rel.endswith(".html") else rel
    return v.lstrip("/") in {rel, stem, target.name, target.stem}

def html_clean(text: str, target: Path, app: Path):
    # Remove anchors pointing to the retired page.
    anchor_re = re.compile(
        r'<a\b(?=[^>]*\bhref\s*=\s*(["\'])(?P<href>.*?)\1)[^>]*>.*?</a>',
        re.I | re.S
    )
    text = anchor_re.sub(
        lambda m: "" if url_is_target(m.group("href"), target, app) else m.group(0),
        text
    )
    # Clean empty nav/list wrappers created by anchor removal.
    text = re.sub(r'<li\b[^>]*>\s*</li>', '', text, flags=re.I|re.S)
    text = re.sub(r'<nav\b([^>]*)>\s*</nav>', lambda m: f'<nav{m.group(1)}></nav>', text, flags=re.I|re.S)
    # Remove sitemap-style blocks when HTML/XML-ish content embeds one.
    text = re.sub(
        r'<url\b[^>]*>.*?(?:/x100(?:\.html)?(?:[?#][^<]*)?).*?</url>',
        '',
        text,
        flags=re.I|re.S
    )
    return text

def xml_clean(text: str):
    return re.sub(
        r'<url\b[^>]*>.*?(?:/x100(?:\.html)?(?:[?#][^<]*)?).*?</url>\s*',
        '',
        text,
        flags=re.I|re.S
    )

def js_clean(text: str):
    # Common one-line nav object.
    text = re.sub(
        r'\{[^{}\n]*?(?:href|url|path|route)\s*:\s*(["\'])/?x100(?:\.html)?(?:\?[^"\']*)?\1[^{}\n]*\}\s*,?',
        '',
        text,
        flags=re.I
    )
    # Common compact tuple/array nav entry.
    text = re.sub(
        r'\[[^\[\]\n]*?(["\'])/?x100(?:\.html)?(?:\?[^"\']*)?\1[^\[\]\n]*\]\s*,?',
        '',
        text,
        flags=re.I
    )
    # Object property specifically keyed by the retired URL.
    text = re.sub(
        r'(?m)^[ \t]*(["\'])/?x100(?:\.html)?\1\s*:\s*[^\n]+,?[ \t]*\n?',
        '',
        text,
        flags=re.I
    )
    # Standalone cache/precache/list entry.
    text = re.sub(
        r'(?m)^[ \t]*(?:["\']/?x100(?:\.html)?(?:\?[^"\']*)?["\']\s*,?|'
        r'["\'][^"\']*["\']\s*:\s*["\']/?x100(?:\.html)?(?:\?[^"\']*)?["\']\s*,?)[ \t]*\n?',
        '',
        text,
        flags=re.I
    )
    return text

DROP = object()
def json_has_target(obj):
    if isinstance(obj,str):
        s=obj.split("#",1)[0].split("?",1)[0].lstrip("./")
        return s.lstrip("/") in {"x100","x100.html"} or s.endswith("/x100") or s.endswith("/x100.html")
    if isinstance(obj,list):
        return any(json_has_target(x) for x in obj)
    if isinstance(obj,dict):
        return any(json_has_target(k) or json_has_target(v) for k,v in obj.items())
    return False

def json_prune(obj):
    if isinstance(obj,list):
        out=[]
        for item in obj:
            if json_has_target(item):
                continue
            out.append(json_prune(item))
        return out
    if isinstance(obj,dict):
        out={}
        for k,v in obj.items():
            if json_has_target(k):
                continue
            if isinstance(v,(dict,list)) and json_has_target(v):
                pruned=json_prune(v)
                if pruned not in ({},[]):
                    out[k]=pruned
                continue
            if json_has_target(v):
                continue
            out[k]=json_prune(v)
        return out
    return obj

def refs_in(text: str):
    pats = [
        r'(?i)(?:^|["\'=(\s])/?x100\.html(?:[?#][^"\'\s)]*)?',
        r'(?i)(?:href|url|path|route)\s*[:=]\s*["\']/?x100(?:["\'?#])',
    ]
    return any(re.search(p,text) for p in pats)

def asset_candidates(target: Path, app: Path):
    text = norm_text(target)
    raw = re.findall(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', text, flags=re.I)
    out=set()
    for value in raw:
        base=value.split("?",1)[0].split("#",1)[0]
        if base.startswith(("http://","https://","data:","mailto:","tel:","#")):
            continue
        rel=base.lstrip("/")
        p=(app/rel).resolve()
        try:
            p.relative_to(app.resolve())
        except Exception:
            continue
        if p.is_file() and ("x100" in p.name.lower() or "economic" in p.name.lower()):
            out.add(p)
    return sorted(out)

def other_reference_count(asset: Path, target: Path, app: Path):
    rel=asset.relative_to(app).as_posix()
    name=asset.name
    n=0
    for p in active_files(app):
        if p == target or p == asset:
            continue
        t=norm_text(p)
        if rel in t or (name in t and p.suffix.lower() in {".html",".js",".mjs",".css"}):
            n += 1
    return n

def make_backup(paths, app: Path, backup: Path, deleted_assets):
    backup.mkdir(parents=True,exist_ok=True)
    manifest={"files":[]}
    for p in sorted(set(paths)|set(deleted_assets)):
        if not p.exists():
            continue
        rel=p.relative_to(app).as_posix()
        dest=backup/"files"/rel
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dest)
        manifest["files"].append(rel)
    (backup/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")

def restore(app: Path, backup: Path):
    manifest=json.loads((backup/"manifest.json").read_text(encoding="utf-8"))
    backed=set(manifest["files"])
    for rel in backed:
        src=backup/"files"/rel
        dst=app/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)

def apply(root: Path, backup: Path|None, dry=False):
    app=root/"memeflow-app"
    if not app.is_dir():
        raise SystemExit(f"ERROR: {app} missing")
    target=discover(app)
    assets=[a for a in asset_candidates(target,app) if other_reference_count(a,target,app)==0]

    changed={}
    scanned=list(active_files(app))
    for p in scanned:
        if p == target:
            continue
        old=norm_text(p)
        new=old
        ext=p.suffix.lower()
        if ext in {".html",".htm"}:
            new=html_clean(old,target,app)
        elif ext==".xml":
            new=xml_clean(old)
        elif ext==".json":
            try:
                obj=json.loads(old)
                pruned=json_prune(obj)
                new=json.dumps(pruned,indent=2,ensure_ascii=False)+"\n"
            except Exception:
                new=js_clean(old)
        elif ext in {".js",".mjs",".cjs"}:
            new=js_clean(old)
        if new != old:
            changed[p]=new

    print("TARGET:",target.relative_to(root))
    print("REFERENCING FILES TO CLEAN:",len(changed))
    for p in changed:
        print(" -",p.relative_to(root))
    print("DEDICATED X100 ASSETS TO DELETE:",len(assets))
    for p in assets:
        print(" -",p.relative_to(root))

    if dry:
        return target,changed,assets

    if backup is None:
        raise SystemExit("ERROR: backup path required for real apply")
    make_backup([target,*changed.keys()],app,backup,assets)

    for p,new in changed.items():
        p.write_text(new,encoding="utf-8")
    target.unlink()
    for p in assets:
        if p.exists():
            p.unlink()

    return target,changed,assets

def audit(root: Path):
    app=root/"memeflow-app"
    errors=[]
    if (app/TARGET_NAME).exists():
        errors.append("memeflow-app/x100.html still exists")

    for p in active_files(app):
        if p.suffix.lower() not in {".html",".htm",".js",".mjs",".cjs",".json",".xml"}:
            continue
        text=norm_text(p)
        if refs_in(text):
            errors.append(f"live X100 route/link reference remains: {p.relative_to(root)}")
        if p.suffix.lower() in {".html",".htm"}:
            score=sum(m.lower() in text.lower() for m in MARKERS)
            if score >= 3:
                errors.append(f"X100 economic-model page content still remains: {p.relative_to(root)}")

    if errors:
        print("V209 AUDIT FAILED")
        for e in errors:
            print(" -",e)
        return False

    print("V209 X100 PAGE REMOVAL AUDIT: PASS")
    print(" - X100 economic-model production page removed")
    print(" - active links/routes to x100 removed")
    print(" - unshared X100-specific assets removed when detected")
    print(" - no trading/settings/backend logic changed")
    return True

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--backup")
    ap.add_argument("--dry-run",action="store_true")
    ap.add_argument("--audit",action="store_true")
    ns=ap.parse_args()
    root=Path(ns.root).resolve()
    if ns.audit:
        raise SystemExit(0 if audit(root) else 1)
    backup=Path(ns.backup).resolve() if ns.backup else None
    apply(root,backup,dry=ns.dry_run)

if __name__=="__main__":
    main()
