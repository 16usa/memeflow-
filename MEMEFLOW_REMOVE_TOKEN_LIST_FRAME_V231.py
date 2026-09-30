#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-remove-token-list-frame-v231.css"
MARKER = "MEMEFLOW_REMOVE_TOKEN_LIST_FRAME_V231_ASSET"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root

if not app.is_dir():
    fail("memeflow-app not found. Run from the existing Replit workspace Shell.")

try:
    origin = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    origin = ""

if origin and EXPECTED_REPO_FRAGMENT not in origin:
    fail(f"Unexpected git origin: {origin}")

html_path = app / "system-tokens.html"
css_path = app / CSS_NAME

if not html_path.is_file():
    fail(f"Missing required file: {html_path}")

css = r'''/* MEMEFLOW REMOVE TOKEN LIST OUTER FRAME V231
   Removes ONLY the old large frame around the whole token stack.
   Individual V230 token cards remain unchanged.
*/

body.mf-page-system-tokens .token-list{
  border:0 !important;
  outline:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;

  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;

  overflow:visible !important;
}

body.mf-page-system-tokens .token-list::before,
body.mf-page-system-tokens .token-list::after{
  content:none !important;
  display:none !important;
}

/* Make sure no wrapper around the stack recreates the big rectangle. */
body.mf-page-system-tokens :where(
  .token-list-wrap,
  .token-list-shell,
  .tokens-list-wrap,
  .tokens-list-shell
){
  border:0 !important;
  outline:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;
  background:transparent !important;
  background-image:none !important;
}

/* Preserve the separate premium cards themselves. */
body.mf-page-system-tokens .token-list > .flow-token{
  border-width:0.5px !important;
  border-style:solid !important;
  border-radius:14px !important;
}
'''

html = html_path.read_text(encoding="utf-8")
original_html = html
original_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None
changed = False

if original_css != css:
    css_path.write_text(css, encoding="utf-8")
    changed = True

if MARKER not in html:
    block = (
        f'<!-- {MARKER} -->\n'
        f'<link rel="stylesheet" href="/{CSS_NAME}?v=231-20260928">\n'
        f'<!-- /{MARKER} -->\n'
    )
    idx = html.lower().rfind("</head>")
    if idx < 0:
        fail("</head> not found in system-tokens.html")
    html = html[:idx] + block + html[idx:]
    html_path.write_text(html, encoding="utf-8")
    changed = True

if not changed:
    print("\n[OK] V231 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-remove-token-list-frame-v231-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

backup_html = backup_dir / html_path.relative_to(root)
backup_html.parent.mkdir(parents=True, exist_ok=True)
backup_html.write_text(original_html, encoding="utf-8")

if original_css is not None:
    backup_css = backup_dir / css_path.relative_to(root)
    backup_css.parent.mkdir(parents=True, exist_ok=True)
    backup_css.write_text(original_css, encoding="utf-8")

try:
    subprocess.run(
        [
            "git", "diff", "--check", "--",
            "memeflow-app/system-tokens.html",
            f"memeflow-app/{CSS_NAME}"
        ],
        cwd=root,
        check=True
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW REMOVE TOKEN LIST FRAME V231 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV231:")
print("  • removes the old large outer rectangle around the token list")
print("  • keeps every V230 token as its own separate card")
print("  • keeps each individual card border at 0.5px")
print("  • keeps card radius and status tint/rail")
print("  • does not touch header, text, data or logic")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    f'git add memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && '
    'git commit -m "Remove Token Flow outer list frame" && git push'
)
