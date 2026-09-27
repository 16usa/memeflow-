#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
APP="$ROOT/memeflow-app"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run from the existing Replit workspace root."
  exit 1
fi

DIRTY="$(git status --porcelain -- "$APP" | grep -vE '^\?\? .*install_memeflow_|^\?\? .*\.zip$' || true)"
if [ -n "$DIRTY" ]; then
  echo "ERROR: tracked/unrelated changes already exist in memeflow-app."
  echo "Commit/stash them first so this cleanup cannot mix with other work:"
  echo "$DIRTY"
  exit 1
fi

python3 - "$APP" <<'PY'
from pathlib import Path
import re, sys

app = Path(sys.argv[1])
canonical_overlay = app / "site-header-unify-v213.css"
canonical_target = app / "memeflow-header.css"
changed = set()

if not canonical_overlay.exists():
    raise SystemExit("ERROR: site-header-unify-v213.css is missing. v214 must be installed first.")

canonical = canonical_overlay.read_text(encoding="utf-8")
if "MEMEFLOW_SITE_HEADER_CANONICAL_V214" not in canonical and "MEMEFLOW_SITE_HEADER_CANONICAL_V215" not in canonical:
    raise SystemExit("ERROR: expected v214 canonical header CSS was not found.")

canonical = canonical.replace("MEMEFLOW_SITE_HEADER_CANONICAL_V214", "MEMEFLOW_SITE_HEADER_CANONICAL_V215")
canonical = canonical.replace("/MEMEFLOW_SITE_HEADER_CANONICAL_V214", "/MEMEFLOW_SITE_HEADER_CANONICAL_V215")
canonical = canonical.rstrip() + "\n"

canonical_target.write_text(canonical, encoding="utf-8")
changed.add(canonical_target)

legacy_header_files = [
    app / "site-header-unify-v213.css",
    app / "memeflow-header-standard-v37.css",
    app / "memeflow-header-nav-polish-v59.css",
    app / "memeflow-nav-interaction-restore-v59b.css",
]

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

canonical_link = '<link rel="stylesheet" href="/memeflow-header.css?v=canonical-v215-20260927">'

for path in app.rglob("*.html"):
    text = path.read_text(encoding="utf-8")
    original = text

    text = header_link_re.sub("", text)

    def clean_class_attr(m):
        tokens = [
            token for token in m.group(1).split()
            if token not in {"mf-header-nav-polish-v59", "mf-nav-interaction-restore-v59b"}
        ]
        return 'class="' + " ".join(tokens) + '"'

    text = re.sub(r'class="([^"]*)"', clean_class_attr, text)

    if canonical_link not in text and "</head>" in text:
        text = text.replace("</head>", canonical_link + "\n</head>", 1)

    text = re.sub(r'\n{4,}', '\n\n\n', text)
    text = text.rstrip() + "\n"

    if text != original:
        path.write_text(text, encoding="utf-8")
        changed.add(path)

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
    # Recursive CSS block cleaner:
    # - recurse into media/supports/layer/container blocks
    # - remove only ordinary rules whose selector has a header needle
    # - keep keyframes/font-face and other at-rules untouched
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

page_css_targets = {
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

for path, needles in page_css_targets.items():
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8")
    new = strip_rules(old, needles).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

smart_vault = app / "smart-vault.html"
if smart_vault.exists():
    text = smart_vault.read_text(encoding="utf-8")
    original = text

    def clean_style(m):
        css = m.group(1)
        css = strip_rules(css, [
            ".mf-vault-topbar",
            ".mf-vault-brand",
            ".mf-vault-brand-mark",
            ".mf-vault-brand-copy",
        ])
        return "<style>" + css + "</style>"

    text = re.sub(r'<style>(.*?)</style>', clean_style, text, flags=re.S | re.I)
    text = text.rstrip() + "\n"
    if text != original:
        smart_vault.write_text(text, encoding="utf-8")
        changed.add(smart_vault)

xcanon = app / "memeflow-x-canonical-v186.css"
if xcanon.exists():
    old = xcanon.read_text(encoding="utf-8")
    new = old

    direct_patterns = [
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
    for pattern in direct_patterns:
        new = re.sub(pattern, "", new, flags=re.S)

    new = re.sub(
        r'html\[data-theme="dark"\]\s+body\s+\.mf-site-header,\s*'
        r'html\[data-theme="dark"\]\s+body\s+\.mf-site-header:not\(\.mf-site-header--sticky\),\s*'
        r'html\[data-theme="dark"\]\s+body\s+\.mf-site-header\.mf-site-header--sticky\s*'
        r'\{[^{}]*\}',
        "",
        new,
        flags=re.S,
    )

    new = re.sub(r'\n{4,}', '\n\n\n', new).rstrip() + "\n"
    if new != old:
        xcanon.write_text(new, encoding="utf-8")
        changed.add(xcanon)

for path in legacy_header_files:
    if path.exists():
        path.unlink()
        changed.add(path)

manifest = Path("/tmp/memeflow_header_v215_changed.txt")
manifest.write_text(
    "\n".join(sorted(str(p) for p in changed)) + "\n",
    encoding="utf-8",
)

print("Single-source header cleanup complete.")
print(f"Canonical stylesheet: {canonical_target}")
print("Removed legacy header layers:")
for p in legacy_header_files:
    print(f"  - {p.name}")
print(f"Changed paths: {len(changed)}")
PY

echo
echo "=== V215 validation ==="

python3 - "$APP" <<'PY'
from pathlib import Path
import sys

app = Path(sys.argv[1])
bad = []

legacy_names = (
    "site-header-unify-v213.css",
    "memeflow-header-standard-v37.css",
    "memeflow-header-nav-polish-v59.css",
    "memeflow-nav-interaction-restore-v59b.css",
)

for p in app.rglob("*.html"):
    text = p.read_text(encoding="utf-8")
    if "</head>" not in text:
        continue

    count = text.count('/memeflow-header.css?v=canonical-v215-20260927')
    legacy = [name for name in legacy_names if name in text]

    if count != 1 or legacy:
        bad.append((str(p), count, legacy))

if bad:
    print("ERROR: header stylesheet ownership validation failed:")
    for row in bad:
        print(row)
    raise SystemExit(1)

print("PASS: each HTML page has one canonical header stylesheet and no legacy header layers.")
PY

test -f "$APP/memeflow-header.css"
grep -q 'MEMEFLOW_SITE_HEADER_CANONICAL_V215' "$APP/memeflow-header.css"

for f in \
  "$APP/site-header-unify-v213.css" \
  "$APP/memeflow-header-standard-v37.css" \
  "$APP/memeflow-header-nav-polish-v59.css" \
  "$APP/memeflow-nav-interaction-restore-v59b.css"
do
  if [ -e "$f" ]; then
    echo "ERROR: legacy header file still exists: $f"
    exit 1
  fi
done

while IFS= read -r f; do
  [ -n "$f" ] || continue
  git add -A -- "$f"
done < /tmp/memeflow_header_v215_changed.txt

echo
git diff --cached --stat
echo

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "Remove conflicting header style layers"
  git push
fi

echo
echo "DONE: header now has one stylesheet owner: memeflow-header.css."
echo "Legacy header overlay/standard/polish/restore layers were removed."
echo "No server/process restart was performed."
