#!/usr/bin/env python3
# MEMEFLOW Settings header fix v1.4
# Removes ONLY geometry/visual declarations from every high-specificity
# standalone Settings header block so the existing canonical header stylesheet
# can control the header exactly like Token Flow.
#
# No new CSS override layer is added.
# Runtime data and page logic are untouched.

from pathlib import Path
import re
import shutil
import sys
from datetime import datetime

SELECTOR = "body.mf-settings-standalone .mf-settings-page-header"
CANONICAL_LINK = "/memeflow-header.css?v=canonical-header-v1-2-20260829"
NEW_SYSTEM_CSS_HREF = "/system.css?v=settings-header-clean-v1-4-20260829"

# Only declarations that conflict with canonical header geometry/appearance.
REMOVE_PROPS = {
    "position",
    "top",
    "z-index",
    "width",
    "max-width",
    "min-height",
    "height",
    "margin",
    "margin-left",
    "margin-right",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-color",
    "border-radius",
    "background",
    "background-color",
    "background-image",
    "box-shadow",
    "backdrop-filter",
    "-webkit-backdrop-filter",
}

def fail(msg):
    print("\nERROR:", msg, file=sys.stderr)
    sys.exit(1)

def find_exact_blocks(text, selector):
    blocks = []
    pos = 0
    while True:
        idx = text.find(selector, pos)
        if idx < 0:
            break

        brace = text.find("{", idx + len(selector))
        if brace < 0:
            fail("Found selector without opening brace.")

        between = text[idx + len(selector):brace]
        if between.strip():
            pos = idx + len(selector)
            continue

        depth = 0
        end = None
        i = brace
        while i < len(text):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
            i += 1

        if end is None:
            fail("Unbalanced CSS around Settings header selector.")

        blocks.append((idx, brace, end))
        pos = end

    return blocks

def clean_declarations(body):
    # Split only on semicolons at this simple declaration level.
    # These audited blocks contain normal CSS declarations, not nested rules.
    kept = []
    removed = []

    for raw in body.split(";"):
        item = raw.strip()
        if not item:
            continue

        if ":" not in item:
            kept.append(item)
            continue

        prop, value = item.split(":", 1)
        prop_name = prop.strip().lower()

        if prop_name in REMOVE_PROPS:
            removed.append(prop_name)
        else:
            kept.append(prop.strip() + ": " + value.strip())

    return kept, removed

def clean_all_exact_blocks(text):
    blocks = find_exact_blocks(text, SELECTOR)
    if not blocks:
        fail("No standalone Settings header blocks found.")

    out = []
    cursor = 0
    total_removed = []
    cleaned_blocks = 0

    for start, brace, end in blocks:
        out.append(text[cursor:start])

        selector_text = text[start:brace].rstrip()
        body = text[brace + 1:end - 1]
        kept, removed = clean_declarations(body)

        if removed:
            cleaned_blocks += 1
            total_removed.extend(removed)

        if kept:
            out.append(selector_text + " {\n")
            for decl in kept:
                out.append("  " + decl + ";\n")
            out.append("}")
        else:
            # Entire block was only conflicting geometry; remove it completely.
            pass

        cursor = end

    out.append(text[cursor:])
    return "".join(out), blocks, cleaned_blocks, total_removed

def bump_system_css(html):
    if CANONICAL_LINK not in html:
        fail("settings.html is missing expected canonical v1.2 header stylesheet.")

    m = re.search(r'href="(/system\.css\?v=[^"]+)"', html)
    if not m:
        fail("settings.html system.css link not found.")

    old = m.group(1)
    new_html = html[:m.start(1)] + NEW_SYSTEM_CSS_HREF + html[m.end(1):]
    return new_html, old

def main():
    root = Path.cwd().resolve()
    if not (root / ".git").is_dir():
        fail("Run this from repository root (.git not found).")

    app = root / "memeflow-app"
    css_path = app / "system.css"
    html_path = app / "settings.html"

    if not css_path.is_file() or not html_path.is_file():
        fail("Required system.css/settings.html files not found.")

    css_before = css_path.read_text(encoding="utf-8")
    html_before = html_path.read_text(encoding="utf-8")

    if "mf-site-header" not in html_before:
        fail("settings.html does not contain mf-site-header; v1.2 is not present.")

    css_after, blocks, cleaned_blocks, removed_props = clean_all_exact_blocks(css_before)
    html_after, old_href = bump_system_css(html_before)

    # Validation before write.
    remaining_blocks = find_exact_blocks(css_after, SELECTOR)
    for start, brace, end in remaining_blocks:
        body = css_after[brace + 1:end - 1].lower()
        for prop in REMOVE_PROPS:
            if re.search(r'(^|[;\s])' + re.escape(prop) + r'\s*:', body):
                fail(f"Pre-write validation: conflicting property {prop} still remains.")

    if NEW_SYSTEM_CSS_HREF not in html_after:
        fail("Pre-write validation: new system.css cache key missing.")

    if cleaned_blocks == 0 or not removed_props:
        fail("No conflicting Settings header geometry was removed.")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = app / f".settings-header-fix-backup-v1-4-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(css_path, backup / "system.css")
    shutil.copy2(html_path, backup / "settings.html")

    css_path.write_text(css_after, encoding="utf-8")
    html_path.write_text(html_after, encoding="utf-8")

    # Post-write validation.
    css_check = css_path.read_text(encoding="utf-8")
    html_check = html_path.read_text(encoding="utf-8")

    for start, brace, end in find_exact_blocks(css_check, SELECTOR):
        body = css_check[brace + 1:end - 1].lower()
        for prop in REMOVE_PROPS:
            if re.search(r'(^|[;\s])' + re.escape(prop) + r'\s*:', body):
                fail(f"Post-write validation: conflicting property {prop} remains.")

    if NEW_SYSTEM_CSS_HREF not in html_check:
        fail("Post-write validation: cache key not installed.")

    print("\nSETTINGS HEADER FIX V1.4 APPLIED SUCCESSFULLY")
    print("=============================================")
    print("Standalone Settings header blocks found:", len(blocks))
    print("Blocks with conflicting geometry cleaned:", cleaned_blocks)
    print("Conflicting declarations removed:", len(removed_props))
    print("Old system.css href:", old_href)
    print("New system.css href:", NEW_SYSTEM_CSS_HREF)
    print("Backup:", backup.relative_to(root))
    print("")
    print("No new CSS override layer was added.")
    print("Canonical memeflow-header.css remains the header source of truth.")
    print("Runtime data was not touched.")
    print("")
    print("Rollback:")
    print(f"cp {backup.relative_to(root)}/system.css memeflow-app/system.css")
    print(f"cp {backup.relative_to(root)}/settings.html memeflow-app/settings.html")

if __name__ == "__main__":
    main()
