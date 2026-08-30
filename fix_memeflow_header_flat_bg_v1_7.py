#!/usr/bin/env python3
# MEMEFLOW canonical header flat-background fix v1.7
#
# Robust fix for the actual canonical CSS structure:
# .mf-site-header appears twice (base + mobile @media).
# This patch scans ALL exact .mf-site-header blocks and changes ONLY the one
# that owns a background/background-color declaration.
#
# No new selector. No !important. No page-specific Settings override.
# Runtime/trading/settings data is untouched.

from pathlib import Path
import re
import shutil
import sys
from datetime import datetime

PAGES = [
    "trading.html",
    "system.html",
    "settings.html",
    "system-tokens.html",
    "smart-vault.html",
    "how-it-works.html",
]

NEW_VERSION = "canonical-header-v1-7-20260830"
TARGET = "#0f141a"

def fail(msg):
    print("\nERROR:", msg, file=sys.stderr)
    sys.exit(1)

def exact_blocks(css, selector=".mf-site-header"):
    pat = re.compile(r'(^|\n)([ \t]*)' + re.escape(selector) + r'[ \t]*\{', re.M)
    result = []

    for m in pat.finditer(css):
        brace = css.find("{", m.start())
        depth = 0
        end = None
        for i in range(brace, len(css)):
            if css[i] == "{":
                depth += 1
            elif css[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end is None:
            fail(f"Unbalanced CSS in {selector} block.")
        result.append((m.start(), brace, end))

    return result

def background_declarations(body):
    return list(re.finditer(
        r'(?m)^[ \t]*(background|background-color)[ \t]*:[^;]+;[ \t]*$',
        body
    ))

def main():
    root = Path.cwd().resolve()
    if not (root / ".git").is_dir():
        fail("Run this from repository root (.git not found).")

    app = root / "memeflow-app"
    css_path = app / "memeflow-header.css"

    if not css_path.is_file():
        fail("memeflow-app/memeflow-header.css not found.")

    css_before = css_path.read_text(encoding="utf-8")
    blocks = exact_blocks(css_before)

    if len(blocks) < 1:
        fail("No exact .mf-site-header blocks found.")

    owners = []
    for idx, (start, brace, end) in enumerate(blocks):
        body = css_before[brace + 1:end - 1]
        decls = background_declarations(body)
        if decls:
            owners.append((idx, start, brace, end, body, decls))

    if len(owners) != 1:
        fail(
            "Expected exactly one .mf-site-header block to own background, "
            f"found {len(owners)}. Stopped instead of guessing."
        )

    idx, start, brace, end, body, decls = owners[0]

    if len(decls) != 1:
        fail(
            "Expected exactly one background declaration in the owning block, "
            f"found {len(decls)}."
        )

    d = decls[0]
    old_decl = d.group(0).strip()
    indent_match = re.match(r'([ \t]*)', d.group(0))
    indent = indent_match.group(1) if indent_match else "  "
    new_decl = f"{indent}background: {TARGET};"

    new_body = body[:d.start()] + new_decl + body[d.end():]
    css_after = css_before[:brace + 1] + new_body + css_before[end - 1:]

    # Validate before write.
    blocks_after = exact_blocks(css_after)
    owners_after = []
    for bidx, (s, br, en) in enumerate(blocks_after):
        b = css_after[br + 1:en - 1]
        ds = background_declarations(b)
        if ds:
            owners_after.append((bidx, b, ds))

    if len(owners_after) != 1:
        fail("Pre-write validation failed: background owner count changed.")

    _, check_body, check_decls = owners_after[0]
    if len(check_decls) != 1:
        fail("Pre-write validation failed: background declaration count is not 1.")

    if f"background: {TARGET};" not in check_body:
        fail("Pre-write validation failed: opaque background not installed.")

    if re.search(r'!\s*important', check_body, flags=re.I):
        fail("Pre-write validation failed: target block contains !important.")

    if css_after.count("{") != css_after.count("}"):
        fail("Pre-write validation failed: CSS braces are unbalanced.")

    # Update whatever current canonical cache version exists on all migrated pages.
    page_after = {}
    old_versions = {}

    link_pat = re.compile(r'href="/memeflow-header\.css\?v=([^"]+)"')

    for name in PAGES:
        path = app / name
        if not path.is_file():
            fail(f"Missing page: memeflow-app/{name}")

        text = path.read_text(encoding="utf-8")
        matches = list(link_pat.finditer(text))

        if len(matches) != 1:
            fail(
                f"{name}: expected exactly one memeflow-header.css link, "
                f"found {len(matches)}."
            )

        old_versions[name] = matches[0].group(1)
        page_after[name] = link_pat.sub(
            f'href="/memeflow-header.css?v={NEW_VERSION}"',
            text,
            count=1
        )

    # Backup before write.
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = app / f".header-flat-bg-backup-v1-7-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)

    shutil.copy2(css_path, backup / "memeflow-header.css")
    for name in PAGES:
        shutil.copy2(app / name, backup / name)

    # Write.
    css_path.write_text(css_after, encoding="utf-8")
    for name, text in page_after.items():
        (app / name).write_text(text, encoding="utf-8")

    # Post-write validation.
    installed = css_path.read_text(encoding="utf-8")
    installed_blocks = exact_blocks(installed)
    installed_owners = []

    for bidx, (s, br, en) in enumerate(installed_blocks):
        b = installed[br + 1:en - 1]
        ds = background_declarations(b)
        if ds:
            installed_owners.append((bidx, b, ds))

    if len(installed_owners) != 1:
        fail("Post-write validation failed: background owner count is not 1.")

    if f"background: {TARGET};" not in installed_owners[0][1]:
        fail("Post-write validation failed: target background missing.")

    print("\nCANONICAL HEADER FLAT BACKGROUND V1.7 APPLIED SUCCESSFULLY")
    print("==========================================================")
    print("Exact .mf-site-header blocks found:", len(blocks))
    print("Background-owning block:", idx + 1)
    print("Old declaration:", old_decl)
    print("New declaration:", f"background: {TARGET};")
    print("No new selector added.")
    print("No !important added.")
    print("Updated cache key on 6 migrated pages.")
    print("Backup:", backup.relative_to(root))
    print("Runtime data was not touched.")

if __name__ == "__main__":
    main()
