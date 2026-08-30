#!/usr/bin/env python3
# MEMEFLOW Settings header fix v1.3
# Purpose: make System Settings header use the same canonical geometry
# already working on Token Flow, without adding another CSS override layer.
#
# It removes only the two legacy high-specificity standalone Settings header
# blocks from system.css, then bumps the system.css cache key in settings.html.
# It does NOT touch trading logic, settings logic, runtime data, or other pages.

from pathlib import Path
import shutil
import sys
from datetime import datetime

SELECTOR = "body.mf-settings-standalone .mf-settings-page-header"
NEW_SYSTEM_CSS_HREF = "/system.css?v=settings-header-tokenflow-v1-3-20260829"


def fail(msg):
    print("\nERROR:", msg, file=sys.stderr)
    sys.exit(1)


def remove_exact_css_blocks(text, selector):
    """
    Remove declaration blocks for an exact selector, even when one occurrence
    is nested inside @media. Does not remove the surrounding @media block.
    """
    removed = 0
    pos = 0
    chunks = []

    while True:
        idx = text.find(selector, pos)
        if idx < 0:
            chunks.append(text[pos:])
            break

        # Ensure this occurrence really opens a declaration block.
        brace = text.find("{", idx + len(selector))
        if brace < 0:
            fail(f"Found selector without opening brace: {selector}")

        between = text[idx + len(selector):brace]
        if between.strip():
            # Not the exact standalone selector occurrence.
            chunks.append(text[pos:idx + len(selector)])
            pos = idx + len(selector)
            continue

        depth = 0
        end = None
        i = brace
        while i < len(text):
            ch = text[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
            i += 1

        if end is None:
            fail(f"Unbalanced CSS while removing: {selector}")

        # Preserve preceding content and one clean newline.
        chunks.append(text[pos:idx].rstrip())
        chunks.append("\n")
        pos = end
        removed += 1

    return "".join(chunks), removed


def replace_system_css_href(html):
    marker = 'href="/system.css?v='
    start = html.find(marker)
    if start < 0:
        fail("settings.html: system.css stylesheet link not found.")

    value_start = start + len('href="')
    value_end = html.find('"', value_start)
    if value_end < 0:
        fail("settings.html: malformed system.css href.")

    old_href = html[value_start:value_end]
    if not old_href.startswith("/system.css?v="):
        fail("settings.html: unexpected system.css href.")

    new_html = html[:value_start] + NEW_SYSTEM_CSS_HREF + html[value_end:]
    return new_html, old_href


def main():
    root = Path.cwd().resolve()
    if not (root / ".git").is_dir():
        fail("Run this from the repository root (.git not found).")

    app = root / "memeflow-app"
    system_css = app / "system.css"
    settings_html = app / "settings.html"

    if not system_css.is_file():
        fail("memeflow-app/system.css not found.")
    if not settings_html.is_file():
        fail("memeflow-app/settings.html not found.")

    css_before = system_css.read_text(encoding="utf-8")
    html_before = settings_html.read_text(encoding="utf-8")

    # Verify v1.2 is really present before touching anything.
    if "mf-site-header" not in html_before:
        fail("settings.html does not contain the canonical mf-site-header class.")
    if "/memeflow-header.css?v=canonical-header-v1-2-20260829" not in html_before:
        fail("settings.html does not contain the expected v1.2 canonical header stylesheet.")

    # The bug source should exist exactly twice:
    # desktop standalone rule + mobile standalone rule.
    occurrences = css_before.count(SELECTOR)
    if occurrences != 2:
        fail(
            f"Expected exactly 2 legacy standalone Settings header blocks, found {occurrences}. "
            "Stopped instead of guessing."
        )

    css_after, removed = remove_exact_css_blocks(css_before, SELECTOR)
    if removed != 2:
        fail(f"Internal validation: expected to remove 2 blocks, removed {removed}.")

    html_after, old_href = replace_system_css_href(html_before)

    # Pre-write validation.
    if SELECTOR in css_after:
        fail("Pre-write validation failed: legacy Settings header selector remains.")
    if NEW_SYSTEM_CSS_HREF not in html_after:
        fail("Pre-write validation failed: new system.css cache key missing.")
    if "mf-site-header" not in html_after:
        fail("Pre-write validation failed: canonical header class disappeared.")
    if css_after.count("{") != css_before.count("{") - 2:
        fail("Pre-write validation failed: unexpected CSS opening-brace count.")
    if css_after.count("}") != css_before.count("}") - 2:
        fail("Pre-write validation failed: unexpected CSS closing-brace count.")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = app / f".settings-header-fix-backup-v1-3-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copy2(system_css, backup_dir / "system.css")
    shutil.copy2(settings_html, backup_dir / "settings.html")

    # Write only after validation and backup.
    system_css.write_text(css_after, encoding="utf-8")
    settings_html.write_text(html_after, encoding="utf-8")

    # Post-write validation.
    css_check = system_css.read_text(encoding="utf-8")
    html_check = settings_html.read_text(encoding="utf-8")

    if SELECTOR in css_check:
        fail("Post-write validation failed: selector still present.")
    if NEW_SYSTEM_CSS_HREF not in html_check:
        fail("Post-write validation failed: cache key missing.")

    print("\nSETTINGS HEADER FIX V1.3 APPLIED SUCCESSFULLY")
    print("=============================================")
    print("Removed legacy high-specificity Settings header blocks:", removed)
    print("Old system.css href:", old_href)
    print("New system.css href:", NEW_SYSTEM_CSS_HREF)
    print("Backup:", backup_dir.relative_to(root))
    print("")
    print("Result:")
    print("  System Settings now inherits the same canonical header geometry as Token Flow.")
    print("  No new CSS override layer was added.")
    print("  Runtime data was not touched.")
    print("")
    print("Rollback:")
    print(f"  cp {backup_dir.relative_to(root)}/system.css memeflow-app/system.css")
    print(f"  cp {backup_dir.relative_to(root)}/settings.html memeflow-app/settings.html")


if __name__ == "__main__":
    main()
