#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
APP="$ROOT/memeflow-app"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run this from the existing Replit workspace root."
  exit 1
fi

echo "=== STEP 1: recover only the failed V215 header cleanup ==="

# Prefer the exact manifest written by the failed V215 script.
if [ -f /tmp/memeflow_header_v215_changed.txt ]; then
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git restore --staged --worktree --source=HEAD -- "$f"
    fi
  done < /tmp/memeflow_header_v215_changed.txt
else
  # Safe fallback: restore tracked HTML files carrying the V215 marker plus the
  # exact CSS files V215 was allowed to edit/delete. Untracked user backups stay untouched.
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if grep -q 'canonical-v215-20260927' "$f" 2>/dev/null; then
      git restore --staged --worktree --source=HEAD -- "$f"
    fi
  done < <(git diff --name-only --diff-filter=ACMRTUXB -- "$APP" '*.html')

  for f in \
    "$APP/memeflow-header.css" \
    "$APP/site-header-unify-v213.css" \
    "$APP/memeflow-header-standard-v37.css" \
    "$APP/memeflow-header-nav-polish-v59.css" \
    "$APP/memeflow-nav-interaction-restore-v59b.css" \
    "$APP/system.css" \
    "$APP/how-it-works.css" \
    "$APP/trading.css" \
    "$APP/system-tokens.css" \
    "$APP/x100.css" \
    "$APP/memeflow-how-it-works-compact-v194.css" \
    "$APP/memeflow-smart-vault-compact-v195.css" \
    "$APP/smart-vault.html" \
    "$APP/memeflow-x-canonical-v186.css"
  do
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git restore --staged --worktree --source=HEAD -- "$f"
    fi
  done
fi

# Do NOT delete or touch unrelated untracked .bak files.
TRACKED_DIRTY="$(git status --porcelain --untracked-files=no -- "$APP" || true)"
if [ -n "$TRACKED_DIRTY" ]; then
  echo "ERROR: tracked changes remain after recovering the failed V215 patch."
  echo "These are not being touched automatically:"
  echo "$TRACKED_DIRTY"
  exit 1
fi

echo "PASS: failed V215 tracked changes recovered; unrelated untracked backups were left alone."

echo
echo "=== STEP 2: apply corrected zero-conflict production header + pure-white LIGHT theme ==="

python3 - "$APP" <<'PY'
from pathlib import Path
import re
import sys

app = Path(sys.argv[1])
changed = set()

PROD_HTML = [
    app / "system.html",
    app / "how-it-works.html",
    app / "smart-vault.html",
    app / "trading.html",
    app / "settings.html",
    app / "system-tokens.html",
    app / "x100.html",
    app / "agent-performance.html",
]

# ----------------------------------------------------------------------
# A. HEADER: use the current V214 canonical header as the ONE live source.
# Old files may remain for historical/test pages, but production pages no
# longer load them, so there is no cascade conflict on the live site.
# ----------------------------------------------------------------------
overlay = app / "site-header-unify-v213.css"
header = app / "memeflow-header.css"

if not overlay.exists():
    raise SystemExit("ERROR: site-header-unify-v213.css missing from current HEAD.")

canonical = overlay.read_text(encoding="utf-8")
canonical = canonical.replace(
    "MEMEFLOW_SITE_HEADER_CANONICAL_V214",
    "MEMEFLOW_SITE_HEADER_CANONICAL_V217"
)
canonical = canonical.replace(
    "/MEMEFLOW_SITE_HEADER_CANONICAL_V214",
    "/MEMEFLOW_SITE_HEADER_CANONICAL_V217"
)
header.write_text(canonical.rstrip() + "\n", encoding="utf-8")
changed.add(header)

header_link_re = re.compile(
    r'^[ \t]*<link\b[^>]*href=["\']/(?:'
    r'memeflow-header\.css'
    r'|site-header-unify-v213\.css'
    r'|memeflow-header-standard-v37\.css'
    r'|memeflow-header-nav-polish-v59\.css'
    r'|memeflow-nav-interaction-restore-v59b\.css'
    r')[^"\']*["\'][^>]*>\s*$',
    re.I | re.M
)
canonical_link = '<link rel="stylesheet" href="/memeflow-header.css?v=canonical-v217-20260927">'

for path in PROD_HTML:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    text = header_link_re.sub("", old)

    def clean_class(m):
        tokens = [
            x for x in m.group(1).split()
            if x not in {"mf-header-nav-polish-v59", "mf-nav-interaction-restore-v59b"}
        ]
        return 'class="' + " ".join(tokens) + '"'

    text = re.sub(r'class="([^"]*)"', clean_class, text)

    if canonical_link not in text:
        if "</head>" not in text:
            raise SystemExit(f"ERROR: missing </head> in production page {path}")
        text = text.replace("</head>", canonical_link + "\n</head>", 1)

    text = re.sub(r'\n{4,}', '\n\n\n', text).rstrip() + "\n"
    if text != old:
        path.write_text(text, encoding="utf-8")
        changed.add(path)

# Remove only narrowly scoped, old per-page header rules from live page CSS.
def find_matching_brace(s, open_pos):
    depth = 0
    quote = None
    esc = False
    comment = False
    i = open_pos
    while i < len(s):
        ch = s[i]
        nx = s[i+1] if i + 1 < len(s) else ""
        if comment:
            if ch == "*" and nx == "/":
                comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch == "/" and nx == "*":
            comment = True
            i += 2
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def clean_css_blocks(css, selector_needles=None, light_rewriter=None):
    selector_needles = selector_needles or []
    out = []
    pos = 0

    while pos < len(css):
        brace = css.find("{", pos)
        if brace < 0:
            out.append(css[pos:])
            break

        # Split preceding @import/declaration ending in ; away from selector.
        semi = css.rfind(";", pos, brace)
        prev_close = css.rfind("}", pos, brace)
        cut = max(semi, prev_close)
        start = pos if cut < pos else cut + 1

        out.append(css[pos:start])
        prelude = css[start:brace]
        close = find_matching_brace(css, brace)
        if close < 0:
            out.append(css[start:])
            break

        body = css[brace+1:close]
        clean = re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()

        if clean.startswith(("@media", "@supports", "@layer", "@container")):
            body = clean_css_blocks(body, selector_needles, light_rewriter)
            if re.sub(r'/\*.*?\*/|\s+', '', body, flags=re.S):
                out.append(prelude + "{" + body + "}")
        elif clean.startswith("@"):
            out.append(prelude + "{" + body + "}")
        else:
            drop = any(n in clean for n in selector_needles)
            if not drop:
                if light_rewriter is not None:
                    body = light_rewriter(clean, body)
                out.append(prelude + "{" + body + "}")

        pos = close + 1

    return "".join(out)

header_targets = {
    app / "system.css": [
        ".topbar", ".brand-block",
        ".mf-settings-page-header", ".mf-settings-page-header-left",
        ".mf-settings-page-brand-mark", ".mf-settings-page-title",
    ],
    app / "how-it-works.css": [
        ".mf-hiw-topbar", ".mf-hiw-brand", ".mf-hiw-brand-mark", ".mf-hiw-brand-copy",
    ],
    app / "trading.css": [
        ".topbar", ".brand-title", ".brand-sub",
    ],
    app / "system-tokens.css": [
        ".flow-header", ".header-left", ".header-title",
    ],
    app / "x100.css": [
        ".site-header", ".header-inner",
    ],
    app / "memeflow-how-it-works-compact-v194.css": [
        ".mf-hiw-brand", ".mf-hiw-brand-mark", ".mf-hiw-brand-copy",
    ],
    app / "memeflow-smart-vault-compact-v195.css": [
        ".mf-vault-brand", ".mf-vault-brand-mark", ".mf-vault-brand-copy",
    ],
}

for path, needles in header_targets.items():
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    new = clean_css_blocks(old, selector_needles=needles).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# Smart Vault owns some historical header geometry in an inline stylesheet.
sv = app / "smart-vault.html"
if sv.exists():
    old = sv.read_text(encoding="utf-8")
    def clean_style(m):
        inner = clean_css_blocks(
            m.group(2),
            selector_needles=[
                ".mf-vault-topbar", ".mf-vault-brand",
                ".mf-vault-brand-mark", ".mf-vault-brand-copy"
            ]
        )
        return m.group(1) + inner + m.group(3)
    new = re.sub(r'(<style\b[^>]*>)(.*?)(</style>)', clean_style, old, flags=re.I|re.S)
    new = new.rstrip() + "\n"
    if new != old:
        sv.write_text(new, encoding="utf-8")
        changed.add(sv)

# Remove direct legacy header typography overrides from the big canonical visual file.
xcanon = app / "memeflow-x-canonical-v186.css"
if xcanon.exists():
    old = xcanon.read_text(encoding="utf-8")
    new = old
    patterns = [
        r'body\.mf-page-trading\s+\.brand-title\s*\{[^{}]*\}',
        r'body\.mf-page-trading\s+\.brand-sub\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title>span\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title>strong\s*\{[^{}]*\}',
        r'body\.mf-page-system\s+\.mf-settings-page-title\s+strong\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title\s+strong\s*\{[^{}]*\}',
        r'body\.mf-page-system-tokens\s+\.header-title\s+strong\s*\{[^{}]*\}',
    ]
    for pat in patterns:
        new = re.sub(pat, "", new, flags=re.S)
    new = re.sub(r'\n{4,}', '\n\n\n', new).rstrip() + "\n"
    if new != old:
        xcanon.write_text(new, encoding="utf-8")
        changed.add(xcanon)

# ----------------------------------------------------------------------
# B. LIGHT THEME: page backgrounds + neutral cards/blocks = pure white.
# Edit existing active styles directly; do not add another override file.
# Preserve interaction colors, disabled states, nav dimming and black 3D view.
# ----------------------------------------------------------------------
STATE_RE = re.compile(
    r'(:hover|:focus|:active|\.active\b|\.selected\b|\.is-active\b|'
    r'\.is-ready\b|\.primary\b|\.warning\b|\.error\b|\.blocked\b|'
    r':disabled|\[aria-pressed|\[data-state=)',
    re.I,
)
CONTROL_RE = re.compile(
    r'(button\b|\.btn\b|[-_]btn\b|input\b|select\b|textarea\b|'
    r'\.switch\b|[-_]switch\b|\.toggle\b|[-_]toggle\b|'
    r'\.segmented\b|[-_]segmented\b)',
    re.I,
)
SPECIAL_RE = re.compile(
    r'(mf-nav-backdrop|mf-true3d|memeflowTrue3D|systemCanvas|'
    r'\.track\b|[-_]track\b|progress\b|\.donut\b|[-_]donut\b|'
    r'::before|::after)',
    re.I,
)
surface_var_re = re.compile(
    r'(?P<name>--[A-Za-z0-9_-]*(?:bg|panel|surface)[A-Za-z0-9_-]*)'
    r'\s*:\s*(?P<value>[^;{}]+)(?P<semi>;?)',
    re.I,
)
bg_re = re.compile(
    r'(?P<prop>background(?:-color|-image)?)\s*:\s*(?P<value>[^;{}]+)(?P<semi>;?)',
    re.I,
)

def white_light_rule(selector, body):
    if 'data-theme="light"' not in selector and "data-theme='light'" not in selector:
        return body

    if SPECIAL_RE.search(selector):
        return body

    # Root/palette neutral surface variables become white.
    body = surface_var_re.sub(
        lambda m: f'{m.group("name")}: #FFFFFF !important;',
        body
    )

    # Keep deliberate interaction/control fills.
    if STATE_RE.search(selector) or CONTROL_RE.search(selector):
        return body

    def repl_bg(m):
        prop = m.group("prop").lower()
        value = m.group("value").strip()
        if re.match(r'^(transparent|none)\b', value, re.I):
            return m.group(0)
        if prop == "background-image":
            return "background-image: none !important;"
        if prop == "background-color":
            return "background-color: #FFFFFF !important;"
        return "background: #FFFFFF !important;"

    return bg_re.sub(repl_bg, body)

white_css = [
    app / "memeflow-theme.css",
    app / "memeflow-x-canonical-v186.css",
    app / "how-it-works.css",
    app / "memeflow-how-it-works-compact-v194.css",
    app / "memeflow-smart-vault-compact-v195.css",
    app / "memeflow-settings-compact-v196.css",
    app / "trading.css",
    app / "system.css",
    app / "system-tokens.css",
]

for path in white_css:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    new = clean_css_blocks(old, light_rewriter=white_light_rule).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# Inline LIGHT rules on production pages only.
for path in PROD_HTML:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    def light_style(m):
        inner = clean_css_blocks(m.group(2), light_rewriter=white_light_rule)
        return m.group(1) + inner + m.group(3)
    new = re.sub(r'(<style\b[^>]*>)(.*?)(</style>)', light_style, old, flags=re.I|re.S)
    new = new.rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

manifest = Path("/tmp/memeflow_v217_changed.txt")
manifest.write_text("\n".join(sorted(str(p) for p in changed)) + "\n", encoding="utf-8")

print(f"Production pages handled: {len(PROD_HTML)}")
print(f"Files changed: {len(changed)}")
for p in sorted(changed):
    print(" -", p.relative_to(app))
PY

echo
echo "=== STEP 3: validate ==="

python3 - "$APP" <<'PY'
from pathlib import Path
import sys

app = Path(sys.argv[1])
prod = [
    "system.html","how-it-works.html","smart-vault.html","trading.html",
    "settings.html","system-tokens.html","x100.html","agent-performance.html"
]
legacy = (
    "site-header-unify-v213.css",
    "memeflow-header-standard-v37.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
)

bad = []
for name in prod:
    p = app / name
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    count = t.count('/memeflow-header.css?v=canonical-v217-20260927')
    linked_legacy = [x for x in legacy if x in t]
    if count != 1 or linked_legacy:
        bad.append((name, count, linked_legacy))

if bad:
    print("ERROR: production header ownership validation failed:")
    for x in bad:
        print(x)
    raise SystemExit(1)

h = (app / "memeflow-header.css").read_text(encoding="utf-8")
if "MEMEFLOW_SITE_HEADER_CANONICAL_V217" not in h:
    raise SystemExit("ERROR: canonical V217 header marker missing.")

theme = (app / "memeflow-theme.css").read_text(encoding="utf-8")
if "--bg: #FFFFFF !important;" not in theme:
    raise SystemExit("ERROR: LIGHT root background is not pure white.")
if "--mf-app-bg: #FFFFFF !important;" not in theme:
    raise SystemExit("ERROR: LIGHT app background is not pure white.")

print("PASS: live production pages load one canonical header stylesheet.")
print("PASS: old header layers are not loaded by production pages.")
print("PASS: LIGHT root/app neutral background palette is pure #FFFFFF.")
PY

# Stage only V217 files, never unrelated/untracked backups.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  git add -- "$f"
done < /tmp/memeflow_v217_changed.txt

git diff --cached --check

echo
git diff --cached --stat
echo

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "Clean header cascade and make light surfaces pure white"
  git push
fi

echo
echo "DONE V217."
echo "No server/process restart was performed."
echo "Unrelated untracked backup files were left untouched."
