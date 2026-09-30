#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-search-cleanup-v232.css"
MARKER = "MEMEFLOW_TOKEN_FLOW_SEARCH_CLEANUP_V232_ASSET"

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

css = r'''/* MEMEFLOW TOKEN FLOW SEARCH CLEANUP V232

   Changes only this area:
   - remove SMART RANK text/block from the age control
   - make ALL / 1H / 6H / 24H a compact frameless control row
   - rebuild Search + Analyze as one precise premium module
   - preserve text size, text color, labels and behavior
   - header and token cards are untouched
*/

body.mf-page-system-tokens{
  --mf-v232-line:#252525;
  --mf-v232-radius:14px;
  --mf-v232-control-radius:10px;
}

/* PERIOD CONTROL */
body.mf-page-system-tokens .mf-time-window-v47c{
  width:max-content !important;
  max-width:100% !important;
  min-height:0 !important;
  margin:0 !important;
  padding:0 !important;
  gap:7px !important;
  justify-self:start !important;
  display:grid !important;
  grid-template-columns:repeat(4,max-content) !important;
  align-items:center !important;
  border:0 !important;
  outline:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens .mf-time-window-v47c::before,
body.mf-page-system-tokens .mf-time-window-v47c::after{
  content:none !important;
  display:none !important;
}

body.mf-page-system-tokens .mf-time-window-v47c > span{
  display:none !important;
}

body.mf-page-system-tokens .mf-time-window-v47c button{
  margin:0 !important;
  flex:none !important;
}

/* SEARCH + ANALYZE */
body.mf-page-system-tokens .flow-toolbar{
  position:sticky !important;
  top:0 !important;
  z-index:70 !important;
  width:100% !important;
  min-width:0 !important;
  min-height:52px !important;
  height:auto !important;
  margin:0 !important;
  padding:5px !important;
  gap:7px !important;
  display:grid !important;
  grid-template-columns:minmax(0,1fr) auto !important;
  align-items:center !important;
  border:0.5px solid var(--mf-v232-line) !important;
  border-radius:var(--mf-v232-radius) !important;
  background:#000 !important;
  background-color:#000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap{
  width:100% !important;
  min-width:0 !important;
  height:42px !important;
  min-height:42px !important;
  max-height:42px !important;
  margin:0 !important;
  padding:0 12px !important;
  gap:8px !important;
  display:flex !important;
  align-items:center !important;
  border:0.5px solid var(--mf-v232-line) !important;
  border-radius:var(--mf-v232-control-radius) !important;
  background:#000 !important;
  background-color:#000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap input{
  width:100% !important;
  min-width:0 !important;
  height:40px !important;
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
}

body.mf-page-system-tokens .flow-toolbar .refresh-info{
  min-width:0 !important;
  width:auto !important;
  height:42px !important;
  margin:0 !important;
  padding:0 !important;
  gap:7px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:flex-end !important;
}

body.mf-page-system-tokens .flow-toolbar #refreshButton{
  min-width:116px !important;
  width:auto !important;
  height:42px !important;
  min-height:42px !important;
  max-height:42px !important;
  margin:0 !important;
  padding:0 16px !important;
  border:0.5px solid var(--mf-v232-line) !important;
  border-radius:var(--mf-v232-control-radius) !important;
  background:#000 !important;
  background-color:#000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap:focus-within{
  border-color:rgba(255,255,255,.24) !important;
}

body.mf-page-system-tokens .flow-toolbar #refreshButton:hover,
body.mf-page-system-tokens .flow-toolbar #refreshButton:focus-visible{
  border-color:rgba(255,255,255,.24) !important;
}

@media(max-width:760px){
  body.mf-page-system-tokens .flow-toolbar{
    min-height:50px !important;
    padding:4px !important;
    gap:6px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .search-wrap{
    height:40px !important;
    min-height:40px !important;
    max-height:40px !important;
    padding-inline:11px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .search-wrap input{
    height:38px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .refresh-info{
    height:40px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .refresh-info > #lastUpdate{
    display:none !important;
  }

  body.mf-page-system-tokens .flow-toolbar #refreshButton{
    min-width:108px !important;
    height:40px !important;
    min-height:40px !important;
    max-height:40px !important;
    padding-inline:14px !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c{
    gap:6px !important;
  }
}

@media(max-width:390px){
  body.mf-page-system-tokens .flow-toolbar{
    grid-template-columns:minmax(0,1fr) 96px !important;
    gap:5px !important;
  }

  body.mf-page-system-tokens .flow-toolbar #refreshButton{
    width:96px !important;
    min-width:96px !important;
    padding-inline:10px !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c{
    gap:5px !important;
  }
}
'''

html = html_path.read_text(encoding="utf-8")
original_html = html
original_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None
changed = False

smart_rank = "<span>SMART RANK</span>"
smart_count = html.count(smart_rank)

if smart_count == 1:
    html = html.replace(smart_rank, "", 1)
    changed = True
elif smart_count > 1:
    fail(f"Expected one SMART RANK span, found {smart_count}")

if original_css != css:
    css_path.write_text(css, encoding="utf-8")
    changed = True

if MARKER not in html:
    block = (
        f'<!-- {MARKER} -->\n'
        f'<link rel="stylesheet" href="/{CSS_NAME}?v=232-20260928">\n'
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
    print("\n[OK] V232 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-token-flow-search-cleanup-v232-backup-{stamp}"
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

print("\n[OK] MEMEFLOW TOKEN FLOW SEARCH CLEANUP V232 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV232:")
print("  • SMART RANK removed from system-tokens.html")
print("  • old full-width Smart Rank/time-window frame removed")
print("  • ALL / 1H / 6H / 24H remain as a compact control row")
print("  • Search + Analyze rebuilt as one clean 0.5px premium module")
print("  • search field and Analyze button use matching borders/radii")
print("  • header, cards, text sizes, text colors, data and logic untouched")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    f'git add memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && '
    'git commit -m "Polish Token Flow search controls and remove Smart Rank" && git push'
)
