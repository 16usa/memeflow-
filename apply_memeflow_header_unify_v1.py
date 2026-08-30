#!/usr/bin/env python3
"""
MEMEFLOW canonical header patch v1
Baseline: 283f28e39a40fa4ec9bb2ce4cadd678b56944fdc

Run from the repository root:
    python3 apply_memeflow_header_unify_v1.py
"""

from __future__ import annotations

from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime

BASELINE = "283f28e39a40fa4ec9bb2ce4cadd678b56944fdc"
PATCH_MARK = "MEMEFLOW_CANONICAL_HEADER_V1"
CSS_LINK = '<link rel="stylesheet" href="/memeflow-header.css?v=canonical-header-v1-20260829">'

def sh(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(args),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )

def die(message: str) -> None:
    print(f"\nERROR: {message}", file=sys.stderr)
    sys.exit(1)

root = Path.cwd().resolve()
if not (root / ".git").exists():
    die("Run this script from the MEMEFLOW repository root (.git not found).")

app = root / "memeflow-app"
if not app.is_dir():
    die("memeflow-app directory not found.")

required = [
    "trading.html",
    "system.html",
    "settings.html",
    "system-tokens.html",
    "smart-vault.html",
    "how-it-works.html",
    "memeflow-brand.css",
    "memeflow-nav.js",
]
for name in required:
    if not (app / name).is_file():
        die(f"Required file missing: memeflow-app/{name}")

head = sh("git", "rev-parse", "HEAD").stdout.strip()
if head != BASELINE:
    die(
        "This patch is pinned to the audited baseline.\n"
        f"Expected HEAD: {BASELINE}\n"
        f"Current HEAD:  {head}\n"
        "Do not force it onto a different source state."
    )

dirty = sh("git", "status", "--porcelain", "--untracked-files=no").stdout.strip()
if dirty:
    die(
        "Tracked files already have local changes. Commit/stash them first so "
        "the header patch cannot mix with unrelated edits."
    )

backup_branch = "backup/header-unify-before-283f28e"
branch_check = sh("git", "show-ref", "--verify", "--quiet", f"refs/heads/{backup_branch}", check=False)
if branch_check.returncode != 0:
    sh("git", "branch", backup_branch, BASELINE)
    print(f"Created local backup branch: {backup_branch}")
else:
    print(f"Backup branch already exists: {backup_branch}")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = app / f".header-unify-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

def backup(path: Path) -> None:
    rel = path.relative_to(app)
    dest = backup_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)

for name in required:
    backup(app / name)

header_css = r'''/* ===== MEMEFLOW_CANONICAL_HEADER_V1 =====
   One header geometry for application pages.
   Trading Terminal is the only sticky header.
   No priority overrides are used in this layer.
*/

:root {
  --mf-header-height: 62px;
  --mf-header-mobile-height: 58px;
  --mf-header-bg: rgba(15, 20, 26, .94);
  --mf-header-line: rgba(111, 154, 172, .075);
  --mf-header-text: #edf5f8;
  --mf-header-muted: #718894;
}

.mf-site-header {
  position: relative;
  top: auto;
  z-index: 50;

  width: 100vw;
  max-width: 100vw;
  min-height: var(--mf-header-height);
  height: var(--mf-header-height);
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);

  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;

  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));

  border: 0;
  border-bottom: 1px solid var(--mf-header-line);
  border-radius: 0;

  background: var(--mf-header-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .018);

  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.mf-site-header--sticky {
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.mf-site-header .brand,
.mf-site-header .brand-block,
.mf-site-header .header-left,
.mf-site-header .mf-settings-page-header-left,
.mf-site-header .mf-vault-brand,
.mf-site-header .mf-hiw-brand {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.mf-site-header:not(.mf-site-header--sticky) .brand,
.mf-site-header:not(.mf-site-header--sticky) .brand-block,
.mf-site-header:not(.mf-site-header--sticky) .header-left,
.mf-site-header:not(.mf-site-header--sticky) .mf-settings-page-header-left,
.mf-site-header:not(.mf-site-header--sticky) .mf-vault-brand,
.mf-site-header:not(.mf-site-header--sticky) .mf-hiw-brand {
  margin-right: auto;
}

.mf-site-header .mf-settings-page-brand-mark,
.mf-site-header .mf-vault-brand-mark,
.mf-site-header .mf-hiw-brand-mark {
  width: 58px;
  height: 42px;
  min-width: 58px;
  flex: 0 0 58px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}

.mf-site-header .mf-settings-page-brand-mark img,
.mf-site-header .mf-vault-brand-mark img,
.mf-site-header .mf-hiw-brand-mark img {
  width: 56px;
  height: 38px;
  display: block;
  object-fit: contain;
}

.mf-site-header .brand-title,
.mf-site-header .brand-block .brand,
.mf-site-header .header-title > span,
.mf-site-header .mf-settings-page-title > span,
.mf-site-header .mf-vault-brand-copy > strong,
.mf-site-header .mf-hiw-brand-copy > strong {
  display: block;
  margin: 0;
  color: var(--mf-header-text);
  font-size: 12px;
  line-height: 1;
  font-weight: 820;
  letter-spacing: .08em;
}

.mf-site-header .brand-sub,
.mf-site-header .brand-block .subtitle,
.mf-site-header .header-title > strong,
.mf-site-header .mf-settings-page-title > strong,
.mf-site-header .mf-vault-brand-copy > small,
.mf-site-header .mf-hiw-brand-copy > small {
  display: block;
  margin: 2px 0 0;
  color: var(--mf-header-muted);
  font-size: 8px;
  line-height: 1.2;
  font-weight: 720;
  letter-spacing: .12em;
  white-space: nowrap;
}

.mf-site-header .top-actions {
  min-width: 0;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.mf-site-header--sticky .top-actions {
  margin-left: 0;
}

.mf-site-header > .mf-nav-host {
  margin-left: 8px;
}

.mf-site-header .live-status,
.mf-site-header .mf-settings-page-live {
  min-height: 28px;
  height: 28px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--mf-header-line);
  border-radius: 999px;
  background: rgba(17, 24, 32, .78);
  color: #9eb2bc;
  font-size: 8px;
  line-height: 1;
  font-weight: 760;
  letter-spacing: .08em;
}

.mf-site-header .engine-strip,
.mf-site-header .system-chips {
  flex: 0 1 auto;
}

.mf-site-header .back {
  display: none;
}

@media (max-width: 760px) {
  .mf-site-header {
    min-height: var(--mf-header-mobile-height);
    height: var(--mf-header-mobile-height);
    gap: 8px;
    padding-left: max(10px, env(safe-area-inset-left));
    padding-right: max(10px, env(safe-area-inset-right));
  }

  .mf-site-header .mf-settings-page-brand-mark,
  .mf-site-header .mf-vault-brand-mark,
  .mf-site-header .mf-hiw-brand-mark {
    width: 54px;
    height: 40px;
    min-width: 54px;
    flex-basis: 54px;
  }

  .mf-site-header .mf-settings-page-brand-mark img,
  .mf-site-header .mf-vault-brand-mark img,
  .mf-site-header .mf-hiw-brand-mark img {
    width: 52px;
    height: 36px;
  }

  .mf-site-header .brand-title,
  .mf-site-header .brand-block .brand,
  .mf-site-header .header-title > span,
  .mf-site-header .mf-settings-page-title > span,
  .mf-site-header .mf-vault-brand-copy > strong,
  .mf-site-header .mf-hiw-brand-copy > strong {
    font-size: 11px;
  }

  .mf-site-header .brand-sub,
  .mf-site-header .brand-block .subtitle,
  .mf-site-header .header-title > strong,
  .mf-site-header .mf-settings-page-title > strong,
  .mf-site-header .mf-vault-brand-copy > small,
  .mf-site-header .mf-hiw-brand-copy > small {
    font-size: 8px;
    letter-spacing: .10em;
  }
}

/* ===== /MEMEFLOW_CANONICAL_HEADER_V1 ===== */
'''

(app / "memeflow-header.css").write_text(header_css, encoding="utf-8")

def read(name: str) -> str:
    return (app / name).read_text(encoding="utf-8")

def write(name: str, text: str) -> None:
    (app / name).write_text(text, encoding="utf-8")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        die(f"{label}: expected exactly 1 source match, found {count}.")
    return text.replace(old, new, 1)

def ensure_link(text: str, label: str) -> str:
    if CSS_LINK in text:
        return text
    if "</head>" not in text:
        die(f"{label}: </head> not found.")
    return text.replace("</head>", f"  {CSS_LINK}\n</head>", 1)

page_replacements = {
    "trading.html": (
        '<header class="topbar">',
        '<header class="topbar mf-site-header mf-site-header--sticky">',
    ),
    "system.html": (
        '<header class="topbar glass">',
        '<header class="topbar glass mf-site-header">',
    ),
    "settings.html": (
        '<header class="mf-settings-page-header">',
        '<header class="mf-settings-page-header mf-site-header">',
    ),
    "system-tokens.html": (
        '<header class="flow-header">',
        '<header class="flow-header mf-site-header">',
    ),
    "smart-vault.html": (
        '<header class="mf-vault-topbar">',
        '<header class="mf-vault-topbar mf-site-header">',
    ),
    "how-it-works.html": (
        '<header class="topbar mf-hiw-topbar" aria-label="MEMEFLOW header">',
        '<header class="topbar mf-hiw-topbar mf-site-header" aria-label="MEMEFLOW header">',
    ),
}

for name, (old, new) in page_replacements.items():
    text = read(name)
    if new not in text:
        text = replace_once(text, old, new, f"{name} header")
    text = ensure_link(text, name)
    write(name, text)

system_path = app / "system.html"
system_text = system_path.read_text(encoding="utf-8")
for style_id in ("memeflow-header-tagline-v1", "memeflow-main-tagline-v1"):
    pattern = re.compile(
        rf'\n?<style id="{re.escape(style_id)}">.*?</style>\n?',
        re.S,
    )
    system_text, n = pattern.subn("\n", system_text, count=1)
    if n != 1:
        die(f"system.html: expected inline style #{style_id} exactly once, found {n}.")
system_path.write_text(system_text, encoding="utf-8")

brand_path = app / "memeflow-brand.css"
brand_text = brand_path.read_text(encoding="utf-8")
topbar_override = re.compile(
    r'\n\.topbar\{\n'
    r'  background:rgba\(15,20,26,.90\)!important;\n'
    r'  border-color:var\(--mf-app-line\)!important;\n'
    r'  box-shadow:inset 0 1px 0 rgba\(255,255,255,.022\)!important;\n'
    r'  backdrop-filter:blur\(24px\) saturate\(130%\)!important;\n'
    r'  -webkit-backdrop-filter:blur\(24px\) saturate\(130%\)!important;\n'
    r'\}\n'
)
brand_text, n = topbar_override.subn("\n", brand_text, count=1)
if n != 1:
    die("memeflow-brand.css: audited global .topbar !important block was not found exactly once.")
brand_path.write_text(brand_text, encoding="utf-8")

nav_path = app / "memeflow-nav.js"
nav_text = nav_path.read_text(encoding="utf-8")
nav_function = re.compile(
    r'  function resolveHeaderHost\(\) \{\n.*?\n  \}\n\n  function makeToggle\(\) \{',
    re.S,
)
new_nav = r'''  function resolveHeaderHost() {
    const unifiedHeader = document.querySelector('.mf-site-header');

    if (unifiedHeader) {
      return (
        unifiedHeader.querySelector('.top-actions') ||
        unifiedHeader
      );
    }

    return (
      document.querySelector('.topbar .top-actions') ||
      document.querySelector('.mf-settings-page-header') ||
      document.querySelector('.flow-header') ||
      document.querySelector('.mf-vault-topbar .top-actions') ||
      document.querySelector('.mf-hiw-topbar .top-actions')
    );
  }

  function makeToggle() {'''
nav_text, n = nav_function.subn(new_nav, nav_text, count=1)
if n != 1:
    die("memeflow-nav.js: resolveHeaderHost() did not match the audited source exactly once.")
nav_path.write_text(nav_text, encoding="utf-8")

errors = []

for name in page_replacements:
    text = read(name)
    if CSS_LINK not in text:
        errors.append(f"{name}: canonical CSS link missing")
    if "mf-site-header" not in text:
        errors.append(f"{name}: canonical header class missing")

if read("trading.html").count("mf-site-header--sticky") != 1:
    errors.append("trading.html: expected exactly one sticky canonical header")

for name in page_replacements:
    if name != "trading.html" and "mf-site-header--sticky" in read(name):
        errors.append(f"{name}: must not be sticky")

if "memeflow-header-tagline-v1" in read("system.html"):
    errors.append("system.html: duplicate inline header override still present")
if "memeflow-main-tagline-v1" in read("system.html"):
    errors.append("system.html: duplicate inline header override still present")

if re.search(r'\.topbar\s*\{\s*background:rgba\(15,20,26,.90\)!important', read("memeflow-brand.css")):
    errors.append("memeflow-brand.css: shared !important topbar override still present")

if "const unifiedHeader = document.querySelector('.mf-site-header');" not in read("memeflow-nav.js"):
    errors.append("memeflow-nav.js: unified header resolver missing")

if "!important" in read("memeflow-header.css"):
    errors.append("memeflow-header.css: canonical layer must not add !important rules")

if errors:
    print("\nVALIDATION FAILED:")
    for err in errors:
        print(f"  - {err}")
    print(f"\nBackups are in: {backup_dir.relative_to(root)}")
    sys.exit(2)

print("\nPATCH APPLIED SUCCESSFULLY")
print("==========================")
print(f"Baseline:      {BASELINE[:7]}")
print(f"Backup branch: {backup_branch}")
print(f"Backup files:  {backup_dir.relative_to(root)}")
print("Canonical CSS: memeflow-app/memeflow-header.css")
print("\nBehavior:")
print("  Trading Terminal   -> sticky header")
print("  System Overview    -> normal scrolling header")
print("  System Settings    -> normal scrolling header")
print("  Real-Time Pipeline -> normal scrolling header")
print("  Smart Vault        -> normal scrolling header")
print("  How It Works       -> normal scrolling header")
print("\nReview changes with:")
print("  git diff -- memeflow-app")
print("\nThen restart the project and hard-refresh the browser.")
