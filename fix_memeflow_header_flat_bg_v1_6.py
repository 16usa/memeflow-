#!/usr/bin/env python3
from pathlib import Path
import re, shutil, sys
from datetime import datetime

PAGES = [
    "trading.html","system.html","settings.html",
    "system-tokens.html","smart-vault.html","how-it-works.html"
]
NEW_VERSION = "canonical-header-v1-6-20260830"
TARGET = "#0f141a"

def fail(msg):
    print("\nERROR:", msg, file=sys.stderr)
    sys.exit(1)

def find_block(css):
    pat = re.compile(r'(^|\n)[ \t]*\.mf-site-header[ \t]*\{', re.M)
    ms = list(pat.finditer(css))
    if len(ms) != 1:
        fail(f"Expected exactly one .mf-site-header block, found {len(ms)}.")
    m = ms[0]
    brace = css.find("{", m.start())
    depth = 0
    end = None
    for i in range(brace, len(css)):
        if css[i] == "{": depth += 1
        elif css[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        fail("Unbalanced .mf-site-header block.")
    return m.start(), brace, end

def main():
    root = Path.cwd().resolve()
    if not (root / ".git").is_dir():
        fail("Run from repository root.")
    app = root / "memeflow-app"
    css_path = app / "memeflow-header.css"
    if not css_path.is_file():
        fail("memeflow-header.css not found.")

    css = css_path.read_text(encoding="utf-8")
    _, brace, end = find_block(css)
    body = css[brace+1:end-1]

    # Remove any current background/background-color from canonical block only.
    body2 = re.sub(
        r'(?m)^[ \t]*(background|background-color)[ \t]*:[^;]+;[ \t]*\n?',
        '',
        body
    )

    line = f"  background: {TARGET};\n"
    if re.search(r'(?m)^[ \t]*box-shadow[ \t]*:', body2):
        body2 = re.sub(
            r'(?m)^([ \t]*box-shadow[ \t]*:)',
            line + r'\1',
            body2,
            count=1
        )
    else:
        if not body2.endswith("\n"):
            body2 += "\n"
        body2 += line

    css_new = css[:brace+1] + body2 + css[end-1:]

    # Validate before write.
    _, b2, e2 = find_block(css_new)
    chk = css_new[b2+1:e2-1]
    bg_count = len(re.findall(
        r'(?m)^[ \t]*(background|background-color)[ \t]*:[^;]+;', chk
    ))
    if bg_count != 1 or f"background: {TARGET};" not in chk:
        fail("Pre-write validation failed for canonical background.")
    if re.search(r'!\s*important', chk, re.I):
        fail("Canonical header block contains !important.")

    page_new = {}
    old_versions = {}
    for name in PAGES:
        p = app / name
        if not p.is_file():
            fail(f"Missing {name}")
        txt = p.read_text(encoding="utf-8")
        pat = re.compile(r'href="/memeflow-header\.css\?v=([^"]+)"')
        ms = list(pat.finditer(txt))
        if len(ms) != 1:
            fail(f"{name}: expected one memeflow-header.css link, found {len(ms)}.")
        old_versions[name] = ms[0].group(1)
        page_new[name] = pat.sub(
            f'href="/memeflow-header.css?v={NEW_VERSION}"', txt, count=1
        )

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = app / f".header-flat-bg-backup-v1-6-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(css_path, backup / "memeflow-header.css")
    for name in PAGES:
        shutil.copy2(app / name, backup / name)

    css_path.write_text(css_new, encoding="utf-8")
    for name, txt in page_new.items():
        (app / name).write_text(txt, encoding="utf-8")

    print("\nCANONICAL HEADER FLAT BACKGROUND V1.6 APPLIED SUCCESSFULLY")
    print("==========================================================")
    print("Updated only existing .mf-site-header background ->", TARGET)
    print("No new selector added. No !important added.")
    print("Updated cache key on 6 pages.")
    print("Backup:", backup.relative_to(root))
    print("Runtime data was not touched.")

if __name__ == "__main__":
    main()
