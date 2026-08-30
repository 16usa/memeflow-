#!/usr/bin/env python3
# MEMEFLOW canonical header flat-background fix v1.5
#
# Root cause:
# System Settings uses a radial page background. The canonical header uses
# rgba(..., .94), so that page gradient bleeds through slightly and makes the
# Settings header look highlighted compared with How It Works / Token Flow.
#
# Fix:
# Make the ONE canonical header background opaque (#0f141a).
# No new selector, no !important, no page-specific override.
# Bump the existing canonical stylesheet cache key on all migrated pages.

from pathlib import Path
import shutil
import sys
from datetime import datetime

OLD_BG = "background: rgba(15, 20, 26, .94);"
NEW_BG = "background: #0f141a;"

OLD_VERSION = "canonical-header-v1-2-20260829"
NEW_VERSION = "canonical-header-v1-5-20260829"

PAGES = [
    "trading.html",
    "system.html",
    "settings.html",
    "system-tokens.html",
    "smart-vault.html",
    "how-it-works.html",
]

def fail(msg):
    print("\nERROR:", msg, file=sys.stderr)
    sys.exit(1)

def main():
    root = Path.cwd().resolve()
    if not (root / ".git").is_dir():
        fail("Run this from the repository root (.git not found).")

    app = root / "memeflow-app"
    css = app / "memeflow-header.css"

    if not css.is_file():
        fail("memeflow-app/memeflow-header.css not found.")

    css_before = css.read_text(encoding="utf-8")

    if css_before.count(OLD_BG) != 1:
        fail(
            f"Expected exactly one canonical translucent background declaration, "
            f"found {css_before.count(OLD_BG)}. Stopped instead of guessing."
        )

    if "mf-site-header" not in css_before:
        fail("Canonical header stylesheet does not look like the installed v1.2 source.")

    page_before = {}
    for name in PAGES:
        path = app / name
        if not path.is_file():
            fail(f"Missing page: memeflow-app/{name}")
        text = path.read_text(encoding="utf-8")
        if f"/memeflow-header.css?v={OLD_VERSION}" not in text:
            fail(
                f"{name}: expected current canonical cache key {OLD_VERSION} not found."
            )
        page_before[name] = text

    css_after = css_before.replace(OLD_BG, NEW_BG, 1)

    page_after = {
        name: text.replace(OLD_VERSION, NEW_VERSION, 1)
        for name, text in page_before.items()
    }

    # Pre-write validation.
    if OLD_BG in css_after:
        fail("Pre-write validation: translucent canonical background still present.")
    if css_after.count(NEW_BG) != 1:
        fail("Pre-write validation: opaque canonical background count is not 1.")
    if "!important" in css_after:
        fail("Pre-write validation: canonical header file contains !important.")
    if css_after.count("{") != css_after.count("}"):
        fail("Pre-write validation: CSS braces are unbalanced.")

    for name, text in page_after.items():
        if text.count(f"/memeflow-header.css?v={NEW_VERSION}") != 1:
            fail(f"{name}: new canonical cache key count is not 1.")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = app / f".header-flat-bg-backup-v1-5-{stamp}"
    backup.mkdir(parents=True, exist_ok=False)

    shutil.copy2(css, backup / "memeflow-header.css")
    for name in PAGES:
        shutil.copy2(app / name, backup / name)

    # Write only after full validation + backup.
    css.write_text(css_after, encoding="utf-8")
    for name, text in page_after.items():
        (app / name).write_text(text, encoding="utf-8")

    # Post-write validation.
    installed = css.read_text(encoding="utf-8")
    if OLD_BG in installed or installed.count(NEW_BG) != 1:
        fail("Post-write validation failed for canonical header background.")

    print("\nCANONICAL HEADER FLAT BACKGROUND V1.5 APPLIED SUCCESSFULLY")
    print("==========================================================")
    print("Changed one existing canonical declaration:")
    print("  rgba(15, 20, 26, .94)  ->  #0f141a")
    print("Updated canonical CSS cache key on 6 migrated pages.")
    print("Backup:", backup.relative_to(root))
    print("")
    print("No new CSS selector was added.")
    print("No !important rule was added.")
    print("System Settings page CSS was not modified.")
    print("Runtime data was not touched.")
    print("")
    print("Rollback:")
    print(f"cp {backup.relative_to(root)}/memeflow-header.css memeflow-app/memeflow-header.css")
    for name in PAGES:
        print(f"cp {backup.relative_to(root)}/{name} memeflow-app/{name}")

if __name__ == "__main__":
    main()
