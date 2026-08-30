#!/usr/bin/env bash
set -euo pipefail

echo "MEMEFLOW Clean Typography Source Migration"
echo "=========================================="

if [ -d "memeflow-app" ] && [ -f "memeflow-app/memeflow-brand.css" ]; then
  APP_DIR="memeflow-app"
elif [ -f "memeflow-brand.css" ]; then
  APP_DIR="."
else
  echo "ERROR: memeflow-app/memeflow-brand.css not found."
  echo "Run this script from the MEMEFLOW repository root."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/.typography-clean-source-backup-$STAMP"
mkdir -p "$BACKUP_DIR"

python3 - "$APP_DIR" "$BACKUP_DIR" <<'PY'
from pathlib import Path
import re
import shutil
import sys

app = Path(sys.argv[1]).resolve()
backup = Path(sys.argv[2]).resolve()
brand = app / "memeflow-brand.css"

FOUNDATION_START = "/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */"
FOUNDATION_END   = "/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */"

foundation = r'''
/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_START ===== */
/*
  MEMEFLOW typography foundation.
  Single source of truth for shared text sizes.
  Page CSS owns component layout; it must not create sub-8px UI text.
*/
:root{
  --mf-type-micro:8px;
  --mf-type-meta:9px;
  --mf-type-ui:10px;
  --mf-type-body:11px;
  --mf-type-panel:13px;
  --mf-type-title:15px;
}

/* Shared semantic roles live here once, not on every page. */
.eyebrow{
  font-size:var(--mf-type-micro);
}
.panel-head h2,
.execution-head h2,
.wallet-dialog-head h2,
.sheet-top h2{
  font-size:var(--mf-type-panel);
  line-height:1.2;
}
.btn{
  font-size:var(--mf-type-body);
}
/* ===== MEMEFLOW_TYPOGRAPHY_FOUNDATION_END ===== */
'''.strip()

LEGACY_BLOCKS = [
    (
        "/* ===== MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_START ===== */",
        "/* ===== MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_END ===== */",
    ),
    (
        "/* ===== MEMEFLOW_TYPOGRAPHY_POLISH_V2_START ===== */",
        "/* ===== MEMEFLOW_TYPOGRAPHY_POLISH_V2_END ===== */",
    ),
    (FOUNDATION_START, FOUNDATION_END),
]

EXCLUDED_DIR_NAMES = {
    ".git", "node_modules", "dist", "build", ".cache", ".next",
}
EXCLUDED_FILES = {"memeflow-nav.css"}

SIZE_TOKEN = {
    8.0: "var(--mf-type-micro)",
    9.0: "var(--mf-type-meta)",
    10.0: "var(--mf-type-ui)",
    11.0: "var(--mf-type-body)",
    13.0: "var(--mf-type-panel)",
    15.0: "var(--mf-type-title)",
}

stats = {
    "legacy_blocks_removed": 0,
    "sub8_fixed": 0,
    "small_important_removed": 0,
    "tokenized": 0,
    "shared_local_sizes_removed": 0,
    "files_changed": 0,
}
changed_paths = []

def rel(p: Path):
    try:
        return p.relative_to(app)
    except Exception:
        return p.name

def is_excluded_path(p: Path):
    if p.name in EXCLUDED_FILES:
        return True
    try:
        parts = p.relative_to(app).parts
    except Exception:
        parts = p.parts
    for part in parts:
        if part in EXCLUDED_DIR_NAMES:
            return True
        if part.startswith(".typography-") or part.startswith(".typography_"):
            return True
    return False

def backup_file(p: Path):
    rp = rel(p)
    dest = backup / rp
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)

def remove_marked_blocks(text: str):
    for start, end in LEGACY_BLOCKS:
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
        text, n = pattern.subn("", text)
        stats["legacy_blocks_removed"] += n
    return text

def strip_shared_role_font_sizes(css: str):
    shared_headers = [
        r"\.eyebrow",
        r"\.panel-head\s+h2",
        r"\.btn",
    ]
    for header_pat in shared_headers:
        rule = re.compile(
            r"(?P<head>(?<![\w-])" + header_pat + r"\s*\{)"
            r"(?P<body>[^{}]*)"
            r"(?P<tail>\})",
            re.S,
        )
        def repl(m):
            body = m.group("body")
            new_body, n = re.subn(
                r"(?<![-\w])font-size\s*:\s*[^;{}]+;?",
                "",
                body,
                flags=re.I,
            )
            if n:
                stats["shared_local_sizes_removed"] += n
            return m.group("head") + new_body + m.group("tail")
        css = rule.sub(repl, css)
    return css

font_size_re = re.compile(
    r"(?P<prefix>(?<![-\w])font-size\s*:\s*)"
    r"(?P<num>\d+(?:\.\d+)?)px"
    r"(?P<important>\s*!important)?",
    re.I,
)

def normalize_font_sizes(css: str):
    def repl(m):
        num = float(m.group("num"))
        important = m.group("important") or ""

        # Preserve intentional hidden text/icon helpers.
        if num == 0:
            return m.group(0)

        if 0 < num < 8:
            num = 8.0
            stats["sub8_fixed"] += 1

        # Ordinary small UI typography should not need cascade forcing.
        # Preserve >15px !important for icons/display-specific rendering.
        if important and num <= 15:
            important = ""
            stats["small_important_removed"] += 1

        token = SIZE_TOKEN.get(num)
        if token:
            stats["tokenized"] += 1
            return m.group("prefix") + token + important

        shown = str(int(num)) if num.is_integer() else str(num)
        return m.group("prefix") + shown + "px" + important

    return font_size_re.sub(repl, css)

def process_css_text(text: str, *, strip_shared=True):
    text = remove_marked_blocks(text)
    if strip_shared:
        text = strip_shared_role_font_sizes(text)
    text = normalize_font_sizes(text)
    return text

style_block_re = re.compile(
    r"(?P<open><style\b[^>]*>)(?P<body>.*?)(?P<close></style>)",
    re.I | re.S,
)

def process_html(text: str):
    def repl(m):
        body = process_css_text(m.group("body"), strip_shared=True)
        return m.group("open") + body + m.group("close")
    return style_block_re.sub(repl, text)

css_files = []
html_files = []
for p in app.rglob("*"):
    if not p.is_file() or is_excluded_path(p):
        continue
    if p.suffix.lower() == ".css":
        css_files.append(p)
    elif p.suffix.lower() == ".html":
        html_files.append(p)

# Brand: remove old corrective layers, normalize source, then add one foundation.
original = brand.read_text(encoding="utf-8", errors="replace")
clean_brand = process_css_text(original, strip_shared=True).rstrip() + "\n\n" + foundation + "\n"
if clean_brand != original:
    backup_file(brand)
    brand.write_text(clean_brand, encoding="utf-8")
    stats["files_changed"] += 1
    changed_paths.append(brand)

for p in css_files:
    if p.resolve() == brand.resolve():
        continue
    original = p.read_text(encoding="utf-8", errors="replace")
    cleaned = process_css_text(original, strip_shared=True)
    if cleaned != original:
        backup_file(p)
        p.write_text(cleaned, encoding="utf-8")
        stats["files_changed"] += 1
        changed_paths.append(p)

for p in html_files:
    original = p.read_text(encoding="utf-8", errors="replace")
    cleaned = process_html(original)

    # Only the brand stylesheet cache-buster is changed in markup.
    cleaned = re.sub(
        r'(memeflow-brand\.css\?v=)[^"\'\s>]+',
        r'\1typography-clean-source-v1-20260830',
        cleaned,
    )

    if cleaned != original:
        backup_file(p)
        p.write_text(cleaned, encoding="utf-8")
        stats["files_changed"] += 1
        changed_paths.append(p)

# Verification.
problems = []

def scan_css_fragment(text: str, source: str):
    for marker in (
        "MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_START",
        "MEMEFLOW_TYPOGRAPHY_POLISH_V2_START",
    ):
        if marker in text:
            problems.append(f"{source}: legacy marker remains: {marker}")

    for m in font_size_re.finditer(text):
        num = float(m.group("num"))
        if 0 < num < 8:
            problems.append(f"{source}: sub-8 font-size remains: {m.group(0).strip()}")
        if 0 < num <= 15 and m.group("important"):
            problems.append(f"{source}: small font-size still uses !important: {m.group(0).strip()}")

for p in css_files:
    if p.name in EXCLUDED_FILES:
        continue
    text = p.read_text(encoding="utf-8", errors="replace")
    scan_css_fragment(text, str(rel(p)))

for p in html_files:
    text = p.read_text(encoding="utf-8", errors="replace")
    for i, m in enumerate(style_block_re.finditer(text), start=1):
        scan_css_fragment(m.group("body"), f"{rel(p)}::<style#{i}>")

brand_text = brand.read_text(encoding="utf-8", errors="replace")
if brand_text.count(FOUNDATION_START) != 1 or brand_text.count(FOUNDATION_END) != 1:
    problems.append("memeflow-brand.css: expected exactly one typography foundation")

print()
print("CLEANUP SUMMARY")
print("------------------------------")
print("Files changed                  :", stats["files_changed"])
print("Legacy V1/V2 blocks removed    :", stats["legacy_blocks_removed"])
print("Sub-8px declarations fixed     :", stats["sub8_fixed"])
print("Small !important flags removed :", stats["small_important_removed"])
print("Sizes converted to tokens      :", stats["tokenized"])
print("Local shared sizes removed     :", stats["shared_local_sizes_removed"])

print()
print("Changed files:")
for p in changed_paths:
    print("  -", rel(p))

print()
print("Verification:")
if problems:
    for problem in problems[:80]:
        print("  FAIL:", problem)
    if len(problems) > 80:
        print(f"  ... plus {len(problems)-80} more")
    raise SystemExit("ERROR: typography cleanup verification failed.")
else:
    print("  PASS: no V1/V2 corrective typography layers remain")
    print("  PASS: no direct readable font-size below 8px remains")
    print("  PASS: no <=15px direct font-size depends on !important")
    print("  PASS: exactly one canonical typography foundation exists")
    print("  PASS: memeflow-nav.css was not modified")

print()
print("Backup:", backup)
print("DONE: clean source typography migration installed.")
PY

echo
echo "Quick marker check:"
grep -n "MEMEFLOW_TYPOGRAPHY_FOUNDATION_START" "$APP_DIR/memeflow-brand.css"
echo
echo "DONE."
