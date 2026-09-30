#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-controls-final-v233.css"
MARKER = "MEMEFLOW_TOKEN_FLOW_CONTROLS_FINAL_V233_ASSET"

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

css = r'''/* MEMEFLOW TOKEN FLOW CONTROLS FINAL V233

   User-requested final cleanup:
   - REMOVE the whole ALL / 1H / 6H / 24H row entirely
   - Search and Analyze have NO gray/internal fill
   - Search and Analyze use only a clean 0.5px outline
   - Search icon is a proper 16px SVG
   - Search placeholder/input gets a readable normal size
   - Header, counters and token cards are untouched
*/

body.mf-page-system-tokens{
  --mf-v233-line:#252525;
  --mf-v233-line-focus:rgba(255,255,255,.28);
  --mf-v233-radius:14px;
}

/* Old age-window control is physically removed from HTML by the installer.
   Hide defensively in case a stale fragment is ever injected. */
body.mf-page-system-tokens .mf-time-window-v47c{
  display:none !important;
}

/* ================================================================
   SEARCH + ANALYZE
   No outer slab. No inner fill. Just two precise outlined controls.
   ================================================================ */

body.mf-page-system-tokens .flow-toolbar{
  position:sticky !important;
  top:0 !important;
  z-index:70 !important;

  width:100% !important;
  min-width:0 !important;
  min-height:48px !important;
  height:auto !important;

  margin:0 !important;
  padding:0 !important;
  gap:8px !important;

  display:grid !important;
  grid-template-columns:minmax(0,1fr) 126px !important;
  align-items:center !important;

  border:0 !important;
  outline:0 !important;
  border-radius:0 !important;

  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}

body.mf-page-system-tokens .flow-toolbar::before,
body.mf-page-system-tokens .flow-toolbar::after{
  content:none !important;
  display:none !important;
}

/* Search control: same restrained outline language as page modules. */
body.mf-page-system-tokens .flow-toolbar .search-wrap{
  width:100% !important;
  min-width:0 !important;
  height:48px !important;
  min-height:48px !important;
  max-height:48px !important;

  margin:0 !important;
  padding:0 14px !important;
  gap:10px !important;

  display:flex !important;
  align-items:center !important;

  border:0.5px solid var(--mf-v233-line) !important;
  outline:0 !important;
  border-radius:var(--mf-v233-radius) !important;

  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* Proper magnifying-glass icon. */
body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v233{
  width:16px !important;
  height:16px !important;
  min-width:16px !important;
  min-height:16px !important;

  display:grid !important;
  place-items:center !important;
  flex:0 0 16px !important;

  margin:0 !important;
  padding:0 !important;
  opacity:.84 !important;
}

body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v233 svg{
  width:16px !important;
  height:16px !important;
  display:block !important;
  fill:none !important;
  stroke:currentColor !important;
  stroke-width:1.8 !important;
  stroke-linecap:round !important;
  stroke-linejoin:round !important;
}

/* Search text only: user explicitly requested a normal readable size. */
body.mf-page-system-tokens .flow-toolbar #tokenSearch{
  width:100% !important;
  min-width:0 !important;
  height:46px !important;
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

  font-size:13px !important;
  line-height:1.25 !important;
  letter-spacing:0 !important;
}

body.mf-page-system-tokens .flow-toolbar #tokenSearch::placeholder{
  opacity:.62 !important;
}

/* Remove the old telemetry text from this compact control area. */
body.mf-page-system-tokens .flow-toolbar .refresh-info{
  width:126px !important;
  min-width:126px !important;
  height:48px !important;

  margin:0 !important;
  padding:0 !important;

  display:block !important;
}

body.mf-page-system-tokens .flow-toolbar .refresh-info > #lastUpdate{
  display:none !important;
}

/* Analyze: no fill, same 0.5px frame and radius as Search. */
body.mf-page-system-tokens .flow-toolbar #refreshButton{
  width:126px !important;
  min-width:126px !important;
  height:48px !important;
  min-height:48px !important;
  max-height:48px !important;

  margin:0 !important;
  padding:0 15px !important;

  border:0.5px solid var(--mf-v233-line) !important;
  outline:0 !important;
  border-radius:var(--mf-v233-radius) !important;

  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* Quiet interaction; no filled hover state. */
body.mf-page-system-tokens .flow-toolbar .search-wrap:focus-within,
body.mf-page-system-tokens .flow-toolbar #refreshButton:hover,
body.mf-page-system-tokens .flow-toolbar #refreshButton:focus-visible{
  border-color:var(--mf-v233-line-focus) !important;
  background:transparent !important;
  background-color:transparent !important;
  box-shadow:none !important;
}

/* Disabled/scanning must also stay transparent. */
body.mf-page-system-tokens .flow-toolbar #refreshButton:disabled{
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* Mobile refinement. */
@media(max-width:760px){
  body.mf-page-system-tokens .flow-toolbar{
    grid-template-columns:minmax(0,1fr) 118px !important;
    gap:7px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .search-wrap{
    height:46px !important;
    min-height:46px !important;
    max-height:46px !important;
    padding-inline:13px !important;
    gap:9px !important;
  }

  body.mf-page-system-tokens .flow-toolbar #tokenSearch{
    height:44px !important;
    font-size:13px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .refresh-info,
  body.mf-page-system-tokens .flow-toolbar #refreshButton{
    width:118px !important;
    min-width:118px !important;
    height:46px !important;
    min-height:46px !important;
    max-height:46px !important;
  }
}

@media(max-width:390px){
  body.mf-page-system-tokens .flow-toolbar{
    grid-template-columns:minmax(0,1fr) 104px !important;
    gap:6px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .search-wrap{
    padding-inline:11px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v233,
  body.mf-page-system-tokens .flow-toolbar .mf-search-icon-v233 svg{
    width:15px !important;
    height:15px !important;
    min-width:15px !important;
    min-height:15px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .refresh-info,
  body.mf-page-system-tokens .flow-toolbar #refreshButton{
    width:104px !important;
    min-width:104px !important;
  }
}
'''

html = html_path.read_text(encoding="utf-8")
original_html = html
original_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None
changed = False

# ------------------------------------------------------------------
# 1. Remove the ENTIRE age-window row: ALL / 1H / 6H / 24H / SMART RANK.
# Robust whether V232 already removed SMART RANK text or not.
# ------------------------------------------------------------------
age_pattern = re.compile(
    r'\n\s*<section\s+class="mf-time-window-v47c"\s+aria-label="Token age window"\s*>'
    r'.*?</section>\s*\n',
    re.S
)
html, removed = age_pattern.subn('\n', html, count=1)

if removed == 1:
    changed = True
elif 'mf-time-window-v47c' in html:
    fail("Could not safely remove the Token age window section.")

# ------------------------------------------------------------------
# 2. Replace the old odd search glyph with a proper inline SVG.
# ------------------------------------------------------------------
old_icon_patterns = [
    '<span>⌕</span>',
    '<span>🔍</span>',
]

new_icon = '''<span class="mf-search-icon-v233" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="M16 16l4 4"></path>
          </svg>
        </span>'''

icon_replaced = False
if 'mf-search-icon-v233' not in html:
    for old in old_icon_patterns:
        if old in html:
            html = html.replace(old, new_icon, 1)
            icon_replaced = True
            changed = True
            break

    if not icon_replaced:
        fail("Search icon anchor not found in system-tokens.html")

# ------------------------------------------------------------------
# 3. Write/load final CSS LAST.
# ------------------------------------------------------------------
if original_css != css:
    css_path.write_text(css, encoding="utf-8")
    changed = True

if MARKER not in html:
    block = (
        f'<!-- {MARKER} -->\n'
        f'<link rel="stylesheet" href="/{CSS_NAME}?v=233-20260928">\n'
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
    print("\n[OK] V233 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-token-flow-controls-final-v233-backup-{stamp}"
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

print("\n[OK] MEMEFLOW TOKEN FLOW CONTROLS FINAL V233 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV233 fixes exactly the requested area:")
print("  • ENTIRE ALL / 1H / 6H / 24H row removed from HTML")
print("  • no SMART RANK / no white or black period squares remain")
print("  • Search and Analyze have transparent interiors")
print("  • only clean 0.5px outlines remain")
print("  • Search uses a proper 16px magnifying-glass SVG")
print("  • Search input/placeholder is readable at 13px")
print("  • old telemetry text is hidden from the toolbar")
print("  • header / counters / token cards / data / logic untouched")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    f'git add memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && '
    'git commit -m "Remove Token Flow period row and polish search controls" && git push'
)
