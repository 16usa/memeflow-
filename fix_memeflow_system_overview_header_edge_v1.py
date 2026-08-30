#!/usr/bin/env python3
# MEMEFLOW System Overview header edge fix v1
#
# Audited against commit:
#   d9d224c
#
# Root cause confirmed in current code:
#   system.css contains:
#     .system-shell.mf-system-page-flow-v2 > .topbar {
#       margin: 0 !important;
#     }
#
# The canonical header intentionally uses:
#   width: 100vw;
#   margin-left: calc(50% - 50vw);
#   margin-right: calc(50% - 50vw);
#
# to escape the padded page shell and make the bottom separator reach both
# viewport edges. The System Overview !important margin reset blocks that.
#
# This patch REMOVES that one conflicting rule. It adds no CSS layer,
# no !important, and changes no page/content/runtime logic.
# It also bumps only system.css's cache key in system.html.
#
# Backup is created before any write.

from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime

EXPECTED_HEAD_PREFIX = "d9d224c"
RULE_PATTERN = re.compile(
    r'\n?'
    r'\.system-shell\.mf-system-page-flow-v2\s*>\s*\.topbar\s*\{\s*'
    r'margin\s*:\s*0\s*!important\s*;\s*'
    r'\}\s*',
    flags=re.S
)

NEW_SYSTEM_CSS_VERSION = "gallery-five-header-fullbleed-v1-20260830"


def fail(message):
    print("\nERROR:", message, file=sys.stderr)
    sys.exit(1)


def run(*args):
    p = subprocess.run(
        list(args),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if p.returncode != 0:
        fail(
            "Command failed: " + " ".join(args) + "\n" +
            (p.stderr.strip() or p.stdout.strip())
        )
    return p.stdout.strip()


def main():
    root = Path.cwd().resolve()

    if not (root / ".git").is_dir():
        fail("Run this from the repository root (.git not found).")

    head = run("git", "rev-parse", "HEAD")
    if not head.startswith(EXPECTED_HEAD_PREFIX):
        fail(
            "Repository HEAD changed since the audit.\n"
            f"Expected prefix: {EXPECTED_HEAD_PREFIX}\n"
            f"Current HEAD:     {head}\n"
            "Stopped instead of guessing against different source."
        )

    app = root / "memeflow-app"
    css_path = app / "system.css"
    html_path = app / "system.html"

    if not css_path.is_file():
        fail("memeflow-app/system.css not found.")
    if not html_path.is_file():
        fail("memeflow-app/system.html not found.")

    css_before = css_path.read_text(encoding="utf-8")
    html_before = html_path.read_text(encoding="utf-8")

    # Confirm current canonical-header integration is present.
    if 'class="topbar glass mf-site-header"' not in html_before:
        fail("system.html does not contain the audited canonical System Overview header.")
    if '/memeflow-header.css?v=' not in html_before:
        fail("system.html does not load memeflow-header.css.")

    matches = list(RULE_PATTERN.finditer(css_before))
    if len(matches) != 1:
        fail(
            "Expected exactly one conflicting System Overview topbar margin rule, "
            f"found {len(matches)}."
        )

    css_after = RULE_PATTERN.sub("\n", css_before, count=1)

    # Bump current system.css cache key, regardless of its previous version.
    link_pattern = re.compile(r'href="(/system\.css\?v=[^"]+)"')
    links = list(link_pattern.finditer(html_before))
    if len(links) != 1:
        fail(
            "system.html: expected exactly one system.css stylesheet link, "
            f"found {len(links)}."
        )

    old_href = links[0].group(1)
    new_href = f"/system.css?v={NEW_SYSTEM_CSS_VERSION}"
    html_after = (
        html_before[:links[0].start(1)] +
        new_href +
        html_before[links[0].end(1):]
    )

    # Pre-write validation.
    if RULE_PATTERN.search(css_after):
        fail("Pre-write validation: conflicting topbar margin rule still exists.")

    # The canonical full-bleed geometry must still exist in the shared header file.
    canonical_path = app / "memeflow-header.css"
    if not canonical_path.is_file():
        fail("memeflow-app/memeflow-header.css not found.")

    canonical = canonical_path.read_text(encoding="utf-8")
    required = [
        "width: 100vw;",
        "margin-left: calc(50% - 50vw);",
        "margin-right: calc(50% - 50vw);",
        "border-bottom: 1px solid",
    ]
    missing = [item for item in required if item not in canonical]
    if missing:
        fail(
            "Canonical header no longer contains expected full-bleed geometry: "
            + ", ".join(missing)
        )

    if new_href not in html_after:
        fail("Pre-write validation: new system.css cache key missing.")

    # Backup before write.
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = app / f".system-overview-header-edge-backup-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)

    shutil.copy2(css_path, backup_dir / "system.css")
    shutil.copy2(html_path, backup_dir / "system.html")

    # Write only the two audited files.
    css_path.write_text(css_after, encoding="utf-8")
    html_path.write_text(html_after, encoding="utf-8")

    # Post-write validation.
    installed_css = css_path.read_text(encoding="utf-8")
    installed_html = html_path.read_text(encoding="utf-8")

    if RULE_PATTERN.search(installed_css):
        fail("Post-write validation failed: conflicting margin rule remains.")
    if installed_html.count(new_href) != 1:
        fail("Post-write validation failed: new system.css cache key count is not 1.")

    print("\nSYSTEM OVERVIEW HEADER EDGE FIX APPLIED SUCCESSFULLY")
    print("====================================================")
    print("Removed conflicting rule:")
    print("  .system-shell.mf-system-page-flow-v2 > .topbar { margin: 0 !important; }")
    print("")
    print("Canonical full-width header margins are now allowed to work.")
    print("Old system.css href:", old_href)
    print("New system.css href:", new_href)
    print("Backup:", backup_dir.relative_to(root))
    print("")
    print("No new CSS selector was added.")
    print("No !important was added.")
    print("No other page was changed.")
    print("Runtime data was not touched.")
    print("")
    print("Rollback:")
    print(f"cp {backup_dir.relative_to(root)}/system.css memeflow-app/system.css")
    print(f"cp {backup_dir.relative_to(root)}/system.html memeflow-app/system.html")


if __name__ == "__main__":
    main()
