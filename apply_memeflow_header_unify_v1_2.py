#!/usr/bin/env python3
# MEMEFLOW canonical header patch v1.2 — transactional repair + apply
# Audited baseline: 283f28e39a40fa4ec9bb2ce4cadd678b56944fdc
#
# Rebuilds ONLY header-related source files from the audited baseline commit,
# so partial v1/v1.1 edits cannot poison the next run.
# Runtime data files are never touched.
# All outputs are validated before installation.

from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

BASELINE = "283f28e39a40fa4ec9bb2ce4cadd678b56944fdc"
BACKUP_BRANCH = "backup/header-unify-before-283f28e"
CSS_NAME = "memeflow-header.css"
CSS_VERSION = "canonical-header-v1-2-20260829"
CSS_LINK = f'<link rel="stylesheet" href="/{CSS_NAME}?v={CSS_VERSION}">'

SOURCE_FILES = [
    "trading.html",
    "system.html",
    "settings.html",
    "system-tokens.html",
    "smart-vault.html",
    "how-it-works.html",
    "memeflow-brand.css",
    "memeflow-nav.js",
]

HEADER_TARGETS = {
    "trading.html": ("topbar", True),
    "system.html": ("brand-block", False),
    "settings.html": ("mf-settings-page-header", False),
    "system-tokens.html": ("flow-header", False),
    "smart-vault.html": ("mf-vault-topbar", False),
    "how-it-works.html": ("mf-hiw-topbar", False),
}


def run(*args, check=True):
    p = subprocess.run(
        list(args),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and p.returncode != 0:
        raise RuntimeError(
            "Command failed: " + " ".join(args) + "\n" +
            (p.stderr.strip() or p.stdout.strip())
        )
    return p


def fail(message, code=1):
    print("\nERROR: " + message, file=sys.stderr)
    sys.exit(code)


def baseline_text(name):
    return run("git", "show", f"{BASELINE}:memeflow-app/{name}").stdout


def find_header_opening(html, token, label):
    # Normal case: target token appears in opening <header>.
    found = []
    for m in re.finditer(r"<header\b[^>]*>", html, flags=re.I | re.S):
        if token in m.group(0):
            found.append((m.start(), m.end(), m.group(0)))

    # System Overview: "brand-block" lives inside the header body.
    if not found and label == "system.html":
        for m in re.finditer(r"<header\b[^>]*>.*?</header>", html, flags=re.I | re.S):
            block = m.group(0)
            if "brand-block" in block:
                o = re.match(r"<header\b[^>]*>", block, flags=re.I | re.S)
                if o:
                    found.append(
                        (m.start() + o.start(), m.start() + o.end(), o.group(0))
                    )
                break

    if len(found) != 1:
        fail(f"{label}: expected exactly one target header, found {len(found)}.")
    return found[0]


def add_header_classes(html, token, sticky, label):
    start, end, tag = find_header_opening(html, token, label)

    cm = re.search(r'class\s*=\s*(["\'])(.*?)\1', tag, flags=re.I | re.S)
    if not cm:
        fail(f"{label}: target header has no class attribute.")

    classes = cm.group(2).split()

    if "mf-site-header" not in classes:
        classes.append("mf-site-header")

    if sticky:
        if "mf-site-header--sticky" not in classes:
            classes.append("mf-site-header--sticky")
    else:
        classes = [x for x in classes if x != "mf-site-header--sticky"]

    quote = cm.group(1)
    new_attr = "class=" + quote + " ".join(classes) + quote
    new_tag = tag[:cm.start()] + new_attr + tag[cm.end():]

    return html[:start] + new_tag + html[end:]


def install_css_link(html, label):
    # Remove any partial v1/v1.1 canonical-header link line first.
    html = re.sub(
        r"[^\n]*memeflow-header\.css[^\n]*\n?",
        "",
        html,
        flags=re.I,
    )
    if html.count("</head>") != 1:
        fail(f"{label}: expected exactly one </head>.")
    return html.replace("</head>", "  " + CSS_LINK + "\n</head>", 1)


def clean_system_inline_header_styles(html):
    for style_id in ("memeflow-header-tagline-v1", "memeflow-main-tagline-v1"):
        pattern = re.compile(
            r"\s*<style\s+id=[\"']" + re.escape(style_id) + r"[\"'][^>]*>.*?</style>",
            flags=re.I | re.S,
        )
        html, count = pattern.subn("\n", html, count=1)
        if count != 1:
            fail(
                f"system.html: expected inline style #{style_id} once in baseline, "
                f"found {count}."
            )
    return html


def clean_brand_global_topbar(css):
    pattern = re.compile(
        r"\n\.topbar\{\s*"
        r"background:rgba\(15,20,26,.90\)!important;\s*"
        r"border-color:var\(--mf-app-line\)!important;\s*"
        r"box-shadow:inset 0 1px 0 rgba\(255,255,255,.022\)!important;\s*"
        r"backdrop-filter:blur\(24px\) saturate\(130%\)!important;\s*"
        r"-webkit-backdrop-filter:blur\(24px\) saturate\(130%\)!important;\s*"
        r"\}\n",
        flags=re.S,
    )
    css, count = pattern.subn("\n", css, count=1)
    if count != 1:
        fail(
            "memeflow-brand.css: audited global .topbar !important block "
            f"was expected once, found {count}."
        )
    return css


def update_nav(js):
    pattern = re.compile(
        r"  function resolveHeaderHost\(\) \{\n.*?\n  \}\n\n  function makeToggle\(\) \{",
        flags=re.S,
    )

    replacement = """  function resolveHeaderHost() {
    const unifiedHeader = document.querySelector('.mf-site-header');

    if (unifiedHeader) {
      return (
        unifiedHeader.querySelector('.top-actions') ||
        unifiedHeader
      );
    }

    /* Legacy fallback for any page not migrated yet. */
    return (
      document.querySelector('.topbar .top-actions') ||
      document.querySelector('.mf-settings-page-header') ||
      document.querySelector('.flow-header') ||
      document.querySelector('.mf-vault-topbar .top-actions') ||
      document.querySelector('.mf-hiw-topbar .top-actions')
    );
  }

  function makeToggle() {"""

    js, count = pattern.subn(replacement, js, count=1)
    if count != 1:
        fail(
            "memeflow-nav.js: expected resolveHeaderHost() once in baseline, "
            f"found {count}."
        )
    return js


HEADER_CSS = """/* ===== MEMEFLOW_CANONICAL_HEADER_V1_2 =====
   Trading Terminal is the visual source of truth for the site header.
   Only Trading Terminal stays sticky while scrolling.
   All other pages use the same geometry in normal document flow.
*/

.mf-site-header {
  position: relative;
  top: auto;
  z-index: 30;

  width: 100vw;
  max-width: 100vw;
  min-height: 62px;
  height: 62px;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);

  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;

  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));

  border: 0;
  border-bottom: 1px solid rgba(111, 154, 172, .055);
  border-radius: 0;

  background: rgba(15, 20, 26, .94);
  box-shadow: none;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.mf-site-header--sticky {
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.mf-site-header > .brand,
.mf-site-header > .brand-block,
.mf-site-header > .header-left,
.mf-site-header > .mf-settings-page-header-left,
.mf-site-header > .mf-vault-brand,
.mf-site-header > .mf-hiw-brand {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.mf-site-header:not(.mf-site-header--sticky) > .brand,
.mf-site-header:not(.mf-site-header--sticky) > .brand-block,
.mf-site-header:not(.mf-site-header--sticky) > .header-left,
.mf-site-header:not(.mf-site-header--sticky) > .mf-settings-page-header-left,
.mf-site-header:not(.mf-site-header--sticky) > .mf-vault-brand,
.mf-site-header:not(.mf-site-header--sticky) > .mf-hiw-brand {
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
  filter: drop-shadow(0 3px 8px rgba(0,229,240,.18));
}

.mf-site-header .brand-title,
.mf-site-header .brand-block .brand,
.mf-site-header .header-title > span,
.mf-site-header .mf-settings-page-title > span,
.mf-site-header .mf-vault-brand-copy > strong,
.mf-site-header .mf-hiw-brand-copy > strong {
  display: block;
  margin: 0;
  color: #edf5f8;
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
  color: #718894;
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
  border: 1px solid rgba(111, 154, 172, .055);
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

@media (max-width: 820px) {
  .mf-site-header {
    width: 100vw;
    max-width: 100vw;
    height: auto;
    min-height: 56px;
    padding-top: 8px;
    padding-bottom: 8px;
    padding-left: max(9px, env(safe-area-inset-left));
    padding-right: max(9px, env(safe-area-inset-right));
    gap: 7px;
  }

  .mf-site-header--sticky {
    grid-template-columns: minmax(0, 1fr) auto;
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
    font-size: 12px;
  }

  .mf-site-header .brand-sub,
  .mf-site-header .brand-block .subtitle,
  .mf-site-header .header-title > strong,
  .mf-site-header .mf-settings-page-title > strong,
  .mf-site-header .mf-vault-brand-copy > small,
  .mf-site-header .mf-hiw-brand-copy > small {
    display: block;
    font-size: 8px;
    letter-spacing: .12em;
  }
}

/* ===== /MEMEFLOW_CANONICAL_HEADER_V1_2 ===== */
"""


def validate(outputs):
    errors = []

    for name in HEADER_TARGETS:
        text = outputs[name]
        if "mf-site-header" not in text:
            errors.append(f"{name}: unified header class missing")
        if text.count(f"/{CSS_NAME}?v={CSS_VERSION}") != 1:
            errors.append(f"{name}: canonical stylesheet link count is not 1")

    if outputs["trading.html"].count("mf-site-header--sticky") != 1:
        errors.append("trading.html: sticky modifier count is not 1")

    for name in HEADER_TARGETS:
        if name != "trading.html" and "mf-site-header--sticky" in outputs[name]:
            errors.append(f"{name}: must not contain sticky modifier")

    if "memeflow-header-tagline-v1" in outputs["system.html"]:
        errors.append("system.html: first duplicate inline header style remains")

    if "memeflow-main-tagline-v1" in outputs["system.html"]:
        errors.append("system.html: second duplicate inline header style remains")

    if re.search(
        r"\.topbar\s*\{[^}]*background:rgba\(15,20,26,.90\)!important",
        outputs["memeflow-brand.css"],
        flags=re.S,
    ):
        errors.append("memeflow-brand.css: global topbar priority block remains")

    if "document.querySelector('.mf-site-header')" not in outputs["memeflow-nav.js"]:
        errors.append("memeflow-nav.js: unified resolver missing")

    if re.search(r"!\s*important", outputs[CSS_NAME], flags=re.I):
        errors.append("memeflow-header.css: canonical layer contains !important")

    if outputs[CSS_NAME].count("{") != outputs[CSS_NAME].count("}"):
        errors.append("memeflow-header.css: CSS braces are unbalanced")

    if errors:
        fail("Validation failed before write:\n  - " + "\n  - ".join(errors), 2)


def main():
    root = Path.cwd().resolve()

    if not (root / ".git").is_dir():
        fail("Run this file from repository root (.git not found).")

    app = root / "memeflow-app"
    if not app.is_dir():
        fail("memeflow-app directory not found.")

    head = run("git", "rev-parse", "HEAD").stdout.strip()
    if head != BASELINE:
        fail(
            "Repository commit changed since audit.\n"
            f"Expected: {BASELINE}\n"
            f"Current:  {head}\n"
            "Stopped instead of applying against unknown code."
        )

    backup_exists = run(
        "git",
        "show-ref",
        "--verify",
        "--quiet",
        f"refs/heads/{BACKUP_BRANCH}",
        check=False,
    )

    if backup_exists.returncode != 0:
        run("git", "branch", BACKUP_BRANCH, BASELINE)
        print("Created local backup branch:", BACKUP_BRANCH)
    else:
        print("Backup branch already exists:", BACKUP_BRANCH)

    print("Building clean header patch from baseline 283f28e in memory...")

    # Deliberately ignore half-applied working-tree source edits from v1/v1.1.
    outputs = {name: baseline_text(name) for name in SOURCE_FILES}

    for name, (token, sticky) in HEADER_TARGETS.items():
        outputs[name] = add_header_classes(outputs[name], token, sticky, name)
        outputs[name] = install_css_link(outputs[name], name)

    outputs["system.html"] = clean_system_inline_header_styles(outputs["system.html"])
    outputs["memeflow-brand.css"] = clean_brand_global_topbar(
        outputs["memeflow-brand.css"]
    )
    outputs["memeflow-nav.js"] = update_nav(outputs["memeflow-nav.js"])
    outputs[CSS_NAME] = HEADER_CSS

    # Nothing has been written yet.
    validate(outputs)
    print("Pre-write validation: PASS")

    # Save current source state, even if it contains partial v1/v1.1 edits.
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = app / f".header-unify-backup-v1-2-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)

    for name in SOURCE_FILES + [CSS_NAME]:
        src = app / name
        if src.exists():
            shutil.copy2(src, backup_dir / name)

    # Write every complete output to temp files first.
    temp_dir = Path(tempfile.mkdtemp(prefix=".mf-header-v1-2-", dir=app))

    try:
        for name, content in outputs.items():
            (temp_dir / name).write_text(content, encoding="utf-8")

        staged = {
            name: (temp_dir / name).read_text(encoding="utf-8")
            for name in outputs
        }
        validate(staged)

        # Replace targets only after the staged set passes validation.
        for name in outputs:
            os.replace(temp_dir / name, app / name)

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    print("\nPATCH V1.2 APPLIED SUCCESSFULLY")
    print("================================")
    print("Baseline:     ", BASELINE)
    print("Backup branch:", BACKUP_BRANCH)
    print("Backup files: ", backup_dir.relative_to(root))
    print("Canonical CSS:", f"memeflow-app/{CSS_NAME}")
    print("")
    print("Trading Terminal    -> sticky")
    print("System Overview     -> normal scroll")
    print("System Settings     -> normal scroll")
    print("Real-Time Pipeline  -> normal scroll")
    print("Smart Vault         -> normal scroll")
    print("How It Works        -> normal scroll")
    print("")
    print("Runtime data was not touched.")
    print("")
    print("Rollback:")
    print(
        "git restore --source=" + BACKUP_BRANCH + " -- " +
        " ".join("memeflow-app/" + n for n in SOURCE_FILES)
    )
    print("rm -f memeflow-app/" + CSS_NAME)


if __name__ == "__main__":
    main()
