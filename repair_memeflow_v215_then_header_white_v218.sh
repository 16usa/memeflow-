#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
APP="$ROOT/memeflow-app"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run this from the existing Replit workspace root."
  exit 1
fi

python3 - "$APP" <<'PY'
from pathlib import Path
import re
import subprocess
import sys

app = Path(sys.argv[1]).resolve()
repo = app.parent
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

def rel(path: Path) -> str:
    return str(path.resolve().relative_to(repo)).replace("\\", "/")

def git_head_text(path: Path):
    try:
        return subprocess.check_output(
            ["git", "show", f"HEAD:{rel(path)}"],
            cwd=repo,
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return None

def tracked(path: Path) -> bool:
    return subprocess.run(
        ["git", "ls-files", "--error-unmatch", rel(path)],
        cwd=repo,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0

# --------------------------------------------------------------------
# STEP 1 — SAFELY undo only files that exactly match the failed V215
# transformation applied to HEAD. Anything with other local edits stays.
# --------------------------------------------------------------------

header_link_re_v215 = re.compile(
    r'^[ \t]*<link\b[^>]*href=["\']/(?:'
    r'memeflow-header\.css'
    r'|site-header-unify-v213\.css'
    r'|memeflow-header-standard-v37\.css'
    r'|memeflow-header-nav-polish-v59\.css'
    r'|memeflow-nav-interaction-restore-v59b\.css'
    r')[^"\']*["\'][^>]*>\s*$',
    re.I | re.M
)
v215_link = '<link rel="stylesheet" href="/memeflow-header.css?v=canonical-v215-20260927">'

def v215_html_transform(text: str) -> str:
    text = header_link_re_v215.sub("", text)

    def clean_class_attr(m):
        tokens = [
            token for token in m.group(1).split()
            if token not in {"mf-header-nav-polish-v59", "mf-nav-interaction-restore-v59b"}
        ]
        return 'class="' + " ".join(tokens) + '"'

    text = re.sub(r'class="([^"]*)"', clean_class_attr, text)
    if v215_link not in text and "</head>" in text:
        text = text.replace("</head>", v215_link + "\n</head>", 1)
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    return text.rstrip() + "\n"

def find_matching_brace(s, open_pos):
    depth = 0
    in_str = None
    esc = False
    in_comment = False
    i = open_pos
    while i < len(s):
        ch = s[i]
        nxt = s[i+1] if i + 1 < len(s) else ""
        if in_comment:
            if ch == "*" and nxt == "/":
                in_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch == "/" and nxt == "*":
            in_comment = True
            i += 2
            continue
        if ch in ("'", '"'):
            in_str = ch
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

def strip_rules(css, selector_needles):
    out = []
    pos = 0
    n = len(css)

    while pos < n:
        brace = css.find("{", pos)
        if brace < 0:
            out.append(css[pos:])
            break

        pre_start = max(css.rfind("}", pos, brace), css.rfind(";", pos, brace))
        pre_start = pos if pre_start < pos else pre_start + 1
        out.append(css[pos:pre_start])

        prelude = css[pre_start:brace]
        close = find_matching_brace(css, brace)
        if close < 0:
            out.append(css[pre_start:])
            break

        body = css[brace+1:close]
        clean_pre = re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()

        if clean_pre.startswith(("@media", "@supports", "@layer", "@container")):
            inner = strip_rules(body, selector_needles)
            if re.sub(r'/\*.*?\*/|\s+', '', inner, flags=re.S):
                out.append(prelude + "{" + inner + "}")
        elif clean_pre.startswith("@"):
            out.append(prelude + "{" + body + "}")
        else:
            if not any(needle in clean_pre for needle in selector_needles):
                out.append(prelude + "{" + body + "}")

        pos = close + 1

    return "".join(out)

v215_css_targets = {
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

def v215_xcanon_transform(text: str) -> str:
    patterns = [
        r'body\.mf-page-trading\s+\.brand-title\s*\{[^{}]*\}',
        r'body\.mf-page-trading\s+\.brand-sub\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title>span\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title>strong\s*\{[^{}]*\}',
        r'body\.mf-page-system\s+\.brand\s*\{[^{}]*\}',
        r'body\.mf-page-system\s+\.subtitle\s*\{[^{}]*\}',
        r'body\.mf-page-system\s+\.mf-settings-page-title\s+strong\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title\s+strong\s*\{[^{}]*\}',
        r'body\.mf-page-system-tokens\s+\.header-title\s+strong\s*\{[^{}]*\}',
    ]
    out = text
    for pattern in patterns:
        out = re.sub(pattern, "", out, flags=re.S)
    out = re.sub(
        r'html\[data-theme="dark"\]\s+body\s+\.mf-site-header,\s*'
        r'html\[data-theme="dark"\]\s+body\s+\.mf-site-header:not\(\.mf-site-header--sticky\),\s*'
        r'html\[data-theme="dark"\]\s+body\s+\.mf-site-header\.mf-site-header--sticky\s*'
        r'\{[^{}]*\}',
        "",
        out,
        flags=re.S,
    )
    return re.sub(r'\n{4,}', '\n\n\n', out).rstrip() + "\n"

recovered = []

# Broad HTML damage from V215: recover only exact deterministic matches.
for path in app.rglob("*.html"):
    if not tracked(path) or not path.exists():
        continue
    head = git_head_text(path)
    if head is None:
        continue
    current = path.read_text(encoding="utf-8", errors="ignore")
    if current == v215_html_transform(head):
        path.write_text(head, encoding="utf-8")
        recovered.append(path)

# Known V215 CSS transforms.
for path, needles in v215_css_targets.items():
    if not tracked(path) or not path.exists():
        continue
    head = git_head_text(path)
    if head is None:
        continue
    current = path.read_text(encoding="utf-8", errors="ignore")
    expected = strip_rules(head, needles).rstrip() + "\n"
    if current == expected:
        path.write_text(head, encoding="utf-8")
        recovered.append(path)

xcanon = app / "memeflow-x-canonical-v186.css"
if tracked(xcanon) and xcanon.exists():
    head = git_head_text(xcanon)
    if head is not None:
        current = xcanon.read_text(encoding="utf-8", errors="ignore")
        if current == v215_xcanon_transform(head):
            xcanon.write_text(head, encoding="utf-8")
            recovered.append(xcanon)

# V215 deleted these tracked files. Restore only if currently missing.
for name in (
    "site-header-unify-v213.css",
    "memeflow-header-standard-v37.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
):
    path = app / name
    head = git_head_text(path)
    if head is not None and not path.exists():
        path.write_text(head, encoding="utf-8")
        recovered.append(path)

print(f"Recovered exact V215 casualties: {len(recovered)}")
for p in recovered:
    print(" RECOVERED", p.relative_to(repo))

# If the active production/core files still have unrelated local edits, stop
# before touching them. Backup/test files may remain dirty and are ignored.
CORE = set(PROD_HTML) | set(v215_css_targets.keys()) | {
    app / "memeflow-theme.css",
    app / "memeflow-header.css",
    app / "site-header-unify-v213.css",
    app / "memeflow-x-canonical-v186.css",
    app / "memeflow-settings-compact-v196.css",
}

unsafe = []
for path in sorted(CORE):
    if not path.exists() or not tracked(path):
        continue
    head = git_head_text(path)
    if head is None:
        continue
    current = path.read_text(encoding="utf-8", errors="ignore")
    if current != head:
        unsafe.append(path)

if unsafe:
    print("\nERROR: these active production/core files still contain local edits not proven to be V215-only:")
    for p in unsafe:
        print(" ", p.relative_to(repo))
    print("They were NOT overwritten. Commit/stash/review those files first.")
    raise SystemExit(2)

# --------------------------------------------------------------------
# STEP 2 — Correct production-only single-source header.
# No backup/test page is modified.
# --------------------------------------------------------------------

overlay = app / "site-header-unify-v213.css"
header = app / "memeflow-header.css"

canonical = overlay.read_text(encoding="utf-8")
canonical = canonical.replace(
    "MEMEFLOW_SITE_HEADER_CANONICAL_V214",
    "MEMEFLOW_SITE_HEADER_CANONICAL_V218"
)
canonical = canonical.replace(
    "/MEMEFLOW_SITE_HEADER_CANONICAL_V214",
    "/MEMEFLOW_SITE_HEADER_CANONICAL_V218"
)
header.write_text(canonical.rstrip() + "\n", encoding="utf-8")
changed.add(header)

prod_header_link_re = re.compile(
    r'^[ \t]*<link\b[^>]*href=["\']/(?:'
    r'memeflow-header\.css'
    r'|site-header-unify-v213\.css'
    r'|memeflow-header-standard-v37\.css'
    r'|memeflow-header-nav-polish-v59\.css'
    r'|memeflow-nav-interaction-restore-v59b\.css'
    r')[^"\']*["\'][^>]*>\s*$',
    re.I | re.M
)
canonical_link = '<link rel="stylesheet" href="/memeflow-header.css?v=canonical-v218-20260927">'

for path in PROD_HTML:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    text = prod_header_link_re.sub("", old)

    def clean_class(m):
        tokens = [
            x for x in m.group(1).split()
            if x not in {"mf-header-nav-polish-v59", "mf-nav-interaction-restore-v59b"}
        ]
        return 'class="' + " ".join(tokens) + '"'

    text = re.sub(r'class="([^"]*)"', clean_class, text)

    if canonical_link not in text:
        if "</head>" not in text:
            raise SystemExit(f"ERROR: missing </head> in {path}")
        text = text.replace("</head>", canonical_link + "\n</head>", 1)

    text = re.sub(r'\n{4,}', '\n\n\n', text).rstrip() + "\n"
    if text != old:
        path.write_text(text, encoding="utf-8")
        changed.add(path)

# Remove old page-specific header ownership only from active production CSS.
for path, needles in v215_css_targets.items():
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    new = strip_rules(old, needles).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# Smart Vault has legacy header CSS inline.
sv = app / "smart-vault.html"
if sv.exists():
    old = sv.read_text(encoding="utf-8")
    def clean_style(m):
        inner = strip_rules(
            m.group(2),
            [
                ".mf-vault-topbar", ".mf-vault-brand",
                ".mf-vault-brand-mark", ".mf-vault-brand-copy",
            ],
        )
        return m.group(1) + inner + m.group(3)
    new = re.sub(r'(<style\b[^>]*>)(.*?)(</style>)', clean_style, old, flags=re.I|re.S)
    new = new.rstrip() + "\n"
    if new != old:
        sv.write_text(new, encoding="utf-8")
        changed.add(sv)

# Remove only direct header typography rules from x-canonical.
if xcanon.exists():
    old = xcanon.read_text(encoding="utf-8")
    new = old
    for pattern in [
        r'body\.mf-page-trading\s+\.brand-title\s*\{[^{}]*\}',
        r'body\.mf-page-trading\s+\.brand-sub\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title>span\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title>strong\s*\{[^{}]*\}',
        r'body\.mf-page-system\s+\.mf-settings-page-title\s+strong\s*\{[^{}]*\}',
        r'body\.mf-page-settings\s+\.mf-settings-page-title\s+strong\s*\{[^{}]*\}',
        r'body\.mf-page-system-tokens\s+\.header-title\s+strong\s*\{[^{}]*\}',
    ]:
        new = re.sub(pattern, "", new, flags=re.S)
    new = re.sub(r'\n{4,}', '\n\n\n', new).rstrip() + "\n"
    if new != old:
        xcanon.write_text(new, encoding="utf-8")
        changed.add(xcanon)

# --------------------------------------------------------------------
# STEP 3 — Pure white LIGHT theme in existing active CSS.
# No new override stylesheet is created.
# --------------------------------------------------------------------

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

    body = surface_var_re.sub(
        lambda m: f'{m.group("name")}: #FFFFFF !important;',
        body
    )

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

def rewrite_light(css):
    out = []
    pos = 0
    while pos < len(css):
        brace = css.find("{", pos)
        if brace < 0:
            out.append(css[pos:])
            break

        pre_start = max(css.rfind("}", pos, brace), css.rfind(";", pos, brace))
        pre_start = pos if pre_start < pos else pre_start + 1
        out.append(css[pos:pre_start])

        prelude = css[pre_start:brace]
        close = find_matching_brace(css, brace)
        if close < 0:
            out.append(css[pre_start:])
            break

        body = css[brace+1:close]
        clean = re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()

        if clean.startswith(("@media", "@supports", "@layer", "@container")):
            body = rewrite_light(body)
            out.append(prelude + "{" + body + "}")
        elif clean.startswith("@"):
            out.append(prelude + "{" + body + "}")
        else:
            out.append(prelude + "{" + white_light_rule(clean, body) + "}")

        pos = close + 1
    return "".join(out)

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
    if 'data-theme="light"' not in old and "data-theme='light'" not in old:
        continue
    new = rewrite_light(old).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# Inline LIGHT rules on production pages only.
for path in PROD_HTML:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    def light_style(m):
        return m.group(1) + rewrite_light(m.group(2)) + m.group(3)
    new = re.sub(r'(<style\b[^>]*>)(.*?)(</style>)', light_style, old, flags=re.I|re.S)
    new = new.rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# --------------------------------------------------------------------
# STEP 4 — Validate only live production pages; backup/test files are ignored.
# --------------------------------------------------------------------
legacy_names = (
    "site-header-unify-v213.css",
    "memeflow-header-standard-v37.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
)

bad = []
for path in PROD_HTML:
    if not path.exists():
        continue
    t = path.read_text(encoding="utf-8")
    count = t.count('/memeflow-header.css?v=canonical-v218-20260927')
    legacy = [x for x in legacy_names if x in t]
    if count != 1 or legacy:
        bad.append((path.name, count, legacy))

if bad:
    print("ERROR: production header validation failed:")
    for row in bad:
        print(row)
    raise SystemExit(3)

h = header.read_text(encoding="utf-8")
if "MEMEFLOW_SITE_HEADER_CANONICAL_V218" not in h:
    raise SystemExit("ERROR: V218 canonical header marker missing.")

theme = (app / "memeflow-theme.css").read_text(encoding="utf-8")
if "--bg: #FFFFFF !important;" not in theme:
    raise SystemExit("ERROR: LIGHT --bg is not #FFFFFF.")
if "--mf-app-bg: #FFFFFF !important;" not in theme:
    raise SystemExit("ERROR: LIGHT --mf-app-bg is not #FFFFFF.")

manifest = Path("/tmp/memeflow_v218_changed.txt")
manifest.write_text(
    "\n".join(sorted(rel(p) for p in changed)) + "\n",
    encoding="utf-8",
)

print("\nPASS: V215 accidental edits were recovered only where exact-match safe.")
print("PASS: production pages load exactly one canonical header stylesheet.")
print("PASS: old header layers are not loaded by production pages.")
print("PASS: LIGHT neutral page/app background palette is #FFFFFF.")
print(f"V218 files to stage: {len(changed)}")
PY

echo
echo "=== Stage only V218 files ==="
while IFS= read -r f; do
  [ -n "$f" ] || continue
  git add -- "$f"
done < /tmp/memeflow_v218_changed.txt

git diff --cached --check

echo
git diff --cached --stat
echo

if git diff --cached --quiet; then
  echo "No V218 changes to commit."
else
  git commit -m "Repair header cascade and pure-white light theme"
  git push
fi

echo
echo "DONE V218."
echo "Unrelated local/backup/test files were not staged."
echo "No server/process restart was performed."
