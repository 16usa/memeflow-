#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-search-refinement-v234.css"
MARKER = "MEMEFLOW_TOKEN_FLOW_SEARCH_REFINEMENT_V234_ASSET"

CSS = r'''/* MEMEFLOW TOKEN FLOW SEARCH REFINEMENT V234
   - search field has no inner fill
   - clean 0.5px module-style outline
   - readable placeholder and input text
   - cleaner icon sizing/alignment
   - analyze button visually matches search field
*/

body.mf-page-system-tokens{
  --mf-v234-line:#252525;
  --mf-v234-line-strong:rgba(255,255,255,.20);
  --mf-v234-line-focus:rgba(255,255,255,.28);
  --mf-v234-text:rgba(255,255,255,.92);
  --mf-v234-text-dim:rgba(255,255,255,.40);
  --mf-v234-radius:18px;
}

body.mf-page-system-tokens .flow-toolbar{
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  border:0 !important;
  outline:0 !important;
  padding:0 !important;
  gap:12px !important;
  display:grid !important;
  grid-template-columns:minmax(0,1fr) 132px !important;
  align-items:stretch !important;
}

body.mf-page-system-tokens .flow-toolbar::before,
body.mf-page-system-tokens .flow-toolbar::after{
  content:none !important;
  display:none !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap{
  height:56px !important;
  min-height:56px !important;
  max-height:56px !important;
  width:100% !important;
  min-width:0 !important;
  display:flex !important;
  align-items:center !important;
  gap:10px !important;
  padding:0 18px !important;
  border:0.5px solid var(--mf-v234-line) !important;
  border-radius:var(--mf-v234-radius) !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  outline:0 !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap:hover,
body.mf-page-system-tokens .flow-toolbar .search-wrap:focus-within{
  border-color:var(--mf-v234-line-focus) !important;
  background:transparent !important;
  background-color:transparent !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v233,
body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v234{
  width:18px !important;
  height:18px !important;
  min-width:18px !important;
  min-height:18px !important;
  flex:0 0 18px !important;
  display:grid !important;
  place-items:center !important;
  color:rgba(255,255,255,.78) !important;
  opacity:1 !important;
}

body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v233 svg,
body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v234 svg{
  width:18px !important;
  height:18px !important;
  display:block !important;
  fill:none !important;
  stroke:currentColor !important;
  stroke-width:1.8 !important;
  stroke-linecap:round !important;
  stroke-linejoin:round !important;
}

body.mf-page-system-tokens .flow-toolbar #tokenSearch,
body.mf-page-system-tokens .flow-toolbar input[type="search"]{
  flex:1 1 auto !important;
  width:100% !important;
  min-width:0 !important;
  height:54px !important;
  min-height:0 !important;
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  outline:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  appearance:none !important;
  -webkit-appearance:none !important;
  color:var(--mf-v234-text) !important;
  caret-color:#ffffff !important;
  font-size:13px !important;
  font-weight:500 !important;
  line-height:1.2 !important;
  letter-spacing:0 !important;
  text-shadow:none !important;
  opacity:1 !important;
}

body.mf-page-system-tokens .flow-toolbar #tokenSearch::placeholder,
body.mf-page-system-tokens .flow-toolbar input[type="search"]::placeholder{
  color:var(--mf-v234-text-dim) !important;
  opacity:1 !important;
  font-size:13px !important;
  font-weight:500 !important;
  letter-spacing:0 !important;
}

body.mf-page-system-tokens .flow-toolbar .refresh-info{
  width:132px !important;
  min-width:132px !important;
  height:56px !important;
  min-height:56px !important;
  display:block !important;
}

body.mf-page-system-tokens .flow-toolbar .refresh-info > #lastUpdate{
  display:none !important;
}

body.mf-page-system-tokens .flow-toolbar #refreshButton{
  width:132px !important;
  min-width:132px !important;
  height:56px !important;
  min-height:56px !important;
  max-height:56px !important;
  padding:0 18px !important;
  border:0.5px solid var(--mf-v234-line) !important;
  border-radius:var(--mf-v234-radius) !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  outline:0 !important;
  color:rgba(255,255,255,.92) !important;
}

body.mf-page-system-tokens .flow-toolbar #refreshButton:hover,
body.mf-page-system-tokens .flow-toolbar #refreshButton:focus-visible,
body.mf-page-system-tokens .flow-toolbar #refreshButton:disabled{
  border-color:var(--mf-v234-line-focus) !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

@media (max-width:760px){
  body.mf-page-system-tokens .flow-toolbar{
    grid-template-columns:minmax(0,1fr) 122px !important;
    gap:10px !important;
  }
  body.mf-page-system-tokens .flow-toolbar .search-wrap{
    height:54px !important;
    min-height:54px !important;
    max-height:54px !important;
    padding:0 16px !important;
    gap:9px !important;
  }
  body.mf-page-system-tokens .flow-toolbar #tokenSearch,
  body.mf-page-system-tokens .flow-toolbar input[type="search"]{
    height:52px !important;
    font-size:12.5px !important;
  }
  body.mf-page-system-tokens .flow-toolbar #tokenSearch::placeholder,
  body.mf-page-system-tokens .flow-toolbar input[type="search"]::placeholder{
    font-size:12.5px !important;
  }
  body.mf-page-system-tokens .flow-toolbar .refresh-info,
  body.mf-page-system-tokens .flow-toolbar #refreshButton{
    width:122px !important;
    min-width:122px !important;
    height:54px !important;
    min-height:54px !important;
    max-height:54px !important;
  }
}
'''


def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)


def main():
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

    original_html = html_path.read_text(encoding="utf-8")
    html = original_html
    original_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None
    changed = False

    if original_css != CSS:
        css_path.write_text(CSS, encoding="utf-8")
        changed = True

    # Make placeholder text explicitly readable if the existing text is too long or dim.
    replacements = [
        ('placeholder="Paste Pump.fun URL or mint"', 'placeholder="Search token or paste Pump.fun mint"'),
        ("placeholder='Paste Pump.fun URL or mint'", "placeholder='Search token or paste Pump.fun mint'"),
    ]
    for old, new in replacements:
        if old in html:
            html = html.replace(old, new)
            changed = True

    if MARKER not in html:
        block = (
            f'<!-- {MARKER} -->\n'
            f'<link rel="stylesheet" href="/{CSS_NAME}?v=234-20260928">\n'
            f'<!-- /{MARKER} -->\n'
        )
        idx = html.lower().rfind("</head>")
        if idx < 0:
            fail("</head> not found in system-tokens.html")
        html = html[:idx] + block + html[idx:]
        changed = True

    if html != original_html:
        html_path.write_text(html, encoding="utf-8")

    if not changed:
        print("\n[OK] V234 is already installed. No files changed.")
        return

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = root / f".memeflow-token-flow-search-refinement-v234-backup-{stamp}"
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
                f"memeflow-app/{CSS_NAME}",
            ],
            cwd=root,
            check=True,
        )
    except Exception:
        print("[WARN] git diff --check could not run.")

    print("\n[OK] MEMEFLOW TOKEN FLOW SEARCH REFINEMENT V234 installed.")
    print(f"[BACKUP] {backup_dir}")
    print("\nV234 fixes:")
    print("  • Search field has no inner fill")
    print("  • Search field gets a clean 0.5px module-style outline")
    print("  • Search text and placeholder become clearly readable")
    print("  • Search icon size/alignment is corrected")
    print("  • Analyze matches the same outline style")
    print("  • Token cards / counters / header untouched")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        f'git add memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && '
        'git commit -m "Polish Token Flow search and analyze controls" && git push'
    )


if __name__ == "__main__":
    main()
