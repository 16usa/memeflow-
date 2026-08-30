#!/usr/bin/env python3
# MEMEFLOW System Settings top-gap fix v1.8
#
# Exact visual bug:
# Settings has a 7px mobile / 10px desktop TOP padding on its page shell.
# On iPhone that 7 CSS px becomes ~21 physical px, exposing the page's radial
# background above the canonical header. That is the "glow/bleed" still visible.
#
# This patch edits ONLY existing Settings shell padding declarations:
#   .mf-settings-page-shell
#   body.mf-settings-standalone .mf-settings-page-shell
# It changes only their TOP padding to 0 and preserves horizontal/bottom padding.
#
# No new selector. No !important. No header overlay layer.
# Creates backup before writing and bumps system.css cache key in settings.html.

from pathlib import Path
import re
import shutil
import sys
from datetime import datetime

TARGET_SELECTORS = (
    ".mf-settings-page-shell",
    "body.mf-settings-standalone .mf-settings-page-shell",
)

NEW_SYSTEM_VERSION = "settings-shell-top-gap-fix-v1-8-20260830"

def fail(msg):
    print("\nERROR:", msg, file=sys.stderr)
    sys.exit(1)

def exact_blocks(css, selector):
    pat = re.compile(
        r'(^|\n)([ \t]*)' + re.escape(selector) + r'[ \t]*\{',
        re.M
    )
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
            fail(f"Unbalanced CSS in selector: {selector}")

        result.append((m.start(), brace, end))

    return result

def zero_top_padding_in_body(body):
    # Match:
    # padding: max(7px, env(safe-area-inset-top)) 7px 0;
    # including multiline whitespace.
    pat = re.compile(
        r'padding\s*:\s*'
        r'max\(\s*[^,]+,\s*env\(\s*safe-area-inset-top\s*\)\s*\)'
        r'(?P<rest>\s+[^;]+);',
        re.I | re.S
    )

    changed = 0
    old_values = []

    def repl(m):
        nonlocal changed
        changed += 1
        old_values.append(m.group(0).strip())
        rest = re.sub(r'\s+', ' ', m.group("rest").strip())
        return f"padding: 0 {rest};"

    return pat.sub(repl, body), changed, old_values

def main():
    root = Path.cwd().resolve()

    if not (root / ".git").is_dir():
        fail("Run this from repository root (.git not found).")

    app = root / "memeflow-app"
    css_path = app / "system.css"
    html_path = app / "settings.html"

    if not css_path.is_file():
        fail("memeflow-app/system.css not found.")
    if not html_path.is_file():
        fail("memeflow-app/settings.html not found.")

    css_before = css_path.read_text(encoding="utf-8")
    html_before = html_path.read_text(encoding="utf-8")

    # Collect every exact target block first.
    all_blocks = []
    for selector in TARGET_SELECTORS:
        for start, brace, end in exact_blocks(css_before, selector):
            all_blocks.append((start, brace, end, selector))

    if not all_blocks:
        fail("No Settings page-shell blocks found.")

    # Process from end to start so offsets remain valid.
    all_blocks.sort(key=lambda x: x[0], reverse=True)

    css_after = css_before
    total_changed = 0
    details = []

    for start, brace, end, selector in all_blocks:
        # Re-locate end safely in the CURRENT text because previous edits are later
        # in the file and therefore do not change this block's start/brace.
        depth = 0
        current_end = None
        for i in range(brace, len(css_after)):
            if css_after[i] == "{":
                depth += 1
            elif css_after[i] == "}":
                depth -= 1
                if depth == 0:
                    current_end = i + 1
                    break

        if current_end is None:
            fail(f"Could not re-locate block end for {selector}")

        body = css_after[brace + 1:current_end - 1]
        new_body, changed, old_values = zero_top_padding_in_body(body)

        if changed:
            css_after = (
                css_after[:brace + 1] +
                new_body +
                css_after[current_end - 1:]
            )
            total_changed += changed
            for old in old_values:
                details.append((selector, old))

    if total_changed < 1:
        fail(
            "Found Settings shell blocks, but no safe-area top-padding declaration "
            "was found. Stopped instead of guessing."
        )

    # Pre-write validation:
    # No target shell block may still expose safe-area-inset-top through padding.
    for selector in TARGET_SELECTORS:
        for start, brace, end in exact_blocks(css_after, selector):
            body = css_after[brace + 1:end - 1]
            if re.search(
                r'padding\s*:[^;]*safe-area-inset-top',
                body,
                flags=re.I | re.S
            ):
                fail(
                    f"Pre-write validation: top safe-area padding still remains "
                    f"in {selector}."
                )

    if css_after.count("{") != css_after.count("}"):
        fail("Pre-write validation: system.css braces are unbalanced.")

    # Bump only the existing system.css href on Settings.
    link_pat = re.compile(r'href="(/system\.css\?v=[^"]+)"')
    links = list(link_pat.finditer(html_before))

    if len(links) != 1:
        fail(
            f"settings.html: expected exactly one system.css link, found {len(links)}."
        )

    old_href = links[0].group(1)
    new_href = f"/system.css?v={NEW_SYSTEM_VERSION}"

    html_after = (
        html_before[:links[0].start(1)] +
        new_href +
        html_before[links[0].end(1):]
    )

    # Backup before writing.
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = app / f".settings-shell-top-gap-backup-v1-8-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)

    shutil.copy2(css_path, backup / "system.css")
    shutil.copy2(html_path, backup / "settings.html")

    # Write.
    css_path.write_text(css_after, encoding="utf-8")
    html_path.write_text(html_after, encoding="utf-8")

    # Post-write validation.
    installed_css = css_path.read_text(encoding="utf-8")
    installed_html = html_path.read_text(encoding="utf-8")

    for selector in TARGET_SELECTORS:
        for start, brace, end in exact_blocks(installed_css, selector):
            body = installed_css[brace + 1:end - 1]
            if re.search(
                r'padding\s*:[^;]*safe-area-inset-top',
                body,
                flags=re.I | re.S
            ):
                fail(f"Post-write validation failed in {selector}.")

    if new_href not in installed_html:
        fail("Post-write validation: new system.css cache key missing.")

    print("\nSYSTEM SETTINGS TOP GAP FIX V1.8 APPLIED SUCCESSFULLY")
    print("====================================================")
    print("Settings shell top-padding declarations changed:", total_changed)
    print("Old system.css href:", old_href)
    print("New system.css href:", new_href)
    print("Backup:", backup.relative_to(root))
    print("")
    print("Changed existing Settings shell padding only.")
    print("No new selector added.")
    print("No !important added.")
    print("Canonical header CSS was not changed.")
    print("Runtime data was not touched.")
    print("")
    print("Removed top-padding declarations:")
    for selector, old in details:
        print(" ", selector, "->", old)

if __name__ == "__main__":
    main()
