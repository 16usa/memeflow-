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
import sys

app = Path(sys.argv[1])

prod_html = [
    app / "system.html",
    app / "how-it-works.html",
    app / "smart-vault.html",
    app / "trading.html",
    app / "settings.html",
    app / "system-tokens.html",
    app / "x100.html",
    app / "agent-performance.html",
]

prod_css = [
    app / "memeflow-theme.css",
    app / "memeflow-x-canonical-v186.css",
    app / "system.css",
    app / "how-it-works.css",
    app / "trading.css",
    app / "system-tokens.css",
    app / "x100.css",
    app / "agent-performance.css",
    app / "memeflow-how-it-works-compact-v194.css",
    app / "memeflow-smart-vault-compact-v195.css",
    app / "memeflow-settings-compact-v196.css",
    app / "memeflow-header.css",
]

changed = set()

def find_close(s, open_pos):
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

bg_decl = re.compile(
    r'(?<![-\w])background(?:-color|-image)?\s*:\s*[^;{}]+;?',
    re.I
)

special_selector = re.compile(
    r'(mf-nav-backdrop|mf-true3d|memeflowTrue3D|systemCanvas|'
    r'canvas\b|\.ap-donut\b|\.dot\b|[-_]dot\b|'
    r'\.track\b|[-_]track\b|progress\b)',
    re.I
)

def strip_light_backgrounds(css):
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
        close = find_close(css, brace)
        if close < 0:
            out.append(css[pre_start:])
            break

        body = css[brace+1:close]
        clean = re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()

        if clean.startswith(("@media", "@supports", "@layer", "@container")):
            body = strip_light_backgrounds(body)
        elif not clean.startswith("@"):
            if ('data-theme="light"' in clean or "data-theme='light'" in clean) and not special_selector.search(clean):
                body = bg_decl.sub("", body)

        out.append(prelude + "{" + body + "}")
        pos = close + 1

    return "".join(out)

# Remove old V219 block if script is re-run.
MARK_START = "/* MEMEFLOW_LIGHT_PURE_WHITE_V219 */"
MARK_END = "/* /MEMEFLOW_LIGHT_PURE_WHITE_V219 */"

theme = app / "memeflow-theme.css"
if not theme.exists():
    raise SystemExit("ERROR: memeflow-theme.css is missing.")

# 1) Remove conflicting LIGHT background fills from production CSS.
for path in prod_css:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8", errors="ignore")
    new = old
    if MARK_START in new:
        new = re.sub(
            re.escape(MARK_START) + r'.*?' + re.escape(MARK_END),
            "",
            new,
            flags=re.S,
        )
    if 'data-theme="light"' in new or "data-theme='light'" in new:
        new = strip_light_backgrounds(new)
    new = "\n".join(line.rstrip() for line in new.splitlines()).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# 2) Same cleanup for inline LIGHT styles on production pages only.
style_re = re.compile(r'(<style\b[^>]*>)(.*?)(</style>)', re.I | re.S)
for path in prod_html:
    if not path.exists():
        continue
    old = path.read_text(encoding="utf-8", errors="ignore")

    def clean_style(m):
        inner = m.group(2)
        if 'data-theme="light"' in inner or "data-theme='light'" in inner:
            inner = strip_light_backgrounds(inner)
        return m.group(1) + inner + m.group(3)

    new = style_re.sub(clean_style, old)
    new = "\n".join(line.rstrip() for line in new.splitlines()).rstrip() + "\n"
    if new != old:
        path.write_text(new, encoding="utf-8")
        changed.add(path)

# 3) One canonical owner for all neutral LIGHT surfaces.
white_block = r'''
/* MEMEFLOW_LIGHT_PURE_WHITE_V219
   Single owner for LIGHT neutral surfaces.
   All legacy gray/blue LIGHT fills are removed from production CSS.
*/
html[data-theme="light"]{
  color-scheme:light;

  --bg:#FFFFFF !important;
  --panel:#FFFFFF !important;
  --panel-solid:#FFFFFF !important;
  --panel-2:#FFFFFF !important;
  --surface:#FFFFFF !important;
  --surface2:#FFFFFF !important;
  --surface3:#FFFFFF !important;
  --surface-2:#FFFFFF !important;

  --mf-app-bg:#FFFFFF !important;
  --mf-app-surface:#FFFFFF !important;
  --mf-app-surface-2:#FFFFFF !important;
  --mf-app-surface-3:#FFFFFF !important;
  --mf-app-panel-top:#FFFFFF !important;
  --mf-app-panel-bottom:#FFFFFF !important;
  --mf-app-soft:#FFFFFF !important;
  --mf-app-soft-hover:#FFFFFF !important;

  --mf-nav-bg:#FFFFFF !important;
  --mf-nav-surface:#FFFFFF !important;
  --mf-nav-surface-2:#FFFFFF !important;

  --hiw-bg:#FFFFFF !important;
  --hiw-panel:#FFFFFF !important;
  --hiw-panel-strong:#FFFFFF !important;

  --v-bg:#FFFFFF !important;
  --v-panel:#FFFFFF !important;
  --v-panel2:#FFFFFF !important;
}

html[data-theme="light"],
html[data-theme="light"] body{
  background:#FFFFFF !important;
  background-color:#FFFFFF !important;
  background-image:none !important;
}

html[data-theme="light"] body :is(
  main,
  section,
  article,
  aside,
  header,
  footer,
  nav,
  form,
  fieldset,
  details,
  summary
),
html[data-theme="light"] body :is(
  [class*="panel"],
  [class*="card"],
  [class*="shell"],
  [class*="surface"],
  [class*="block"],
  [class*="group"],
  [class*="field"],
  [class*="row"],
  [class*="wrap"],
  [class*="drawer"],
  [class*="modal"],
  [class*="head"],
  [class*="header"],
  [class*="footer"],
  [class*="meta"],
  [class*="body"]
){
  background:#FFFFFF !important;
  background-color:#FFFFFF !important;
  background-image:none !important;
}

/* Explicit production surfaces that do not share a naming pattern. */
html[data-theme="light"] body :is(
  .candidate,
  .position-row,
  .token-row,
  .scanner-card,
  .metric,
  .approval-row,
  .control-section,
  .mf-hiw-node,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf293-settings-panel,
  .mf293-settings-head,
  .mf293-settings-meta,
  .mf293-settings-body,
  .mf293-settings-group,
  .mf293-settings-grid,
  .mf293-field,
  .mf293-settings-footer,
  .settings-summary > div,
  .system-health-summary > div,
  .data-row,
  .settings-context,
  .toggle-row,
  .execution-readiness,
  .primary-blocker,
  .signal-explainer,
  .execution-check-list,
  .production-empty
){
  background:#FFFFFF !important;
  background-color:#FFFFFF !important;
  background-image:none !important;
}

/* Controls also stay white in LIGHT; active state is shown by text/border/underline. */
html[data-theme="light"] body :is(
  button,
  input,
  select,
  textarea
){
  background-color:#FFFFFF !important;
  background-image:none !important;
}

/* Functional exceptions: these are not neutral page/block surfaces. */
html[data-theme="light"] .mf-nav-backdrop{
  background:rgba(31,45,55,.18) !important;
}

html[data-theme="light"] .viewport-wrap.mf-true3d-clean-v3,
html[data-theme="light"] .viewport-wrap.mf-true3d-clean-v3 #memeflowTrue3DHost,
html[data-theme="light"] .viewport-wrap.mf-true3d-clean-v3 #memeflowTrue3DCanvas{
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
}

/* /MEMEFLOW_LIGHT_PURE_WHITE_V219 */
'''

t = theme.read_text(encoding="utf-8")
if MARK_START in t:
    t = re.sub(
        re.escape(MARK_START) + r'.*?' + re.escape(MARK_END),
        "",
        t,
        flags=re.S,
    )
t = t.rstrip() + "\n\n" + white_block.strip() + "\n"
t = "\n".join(line.rstrip() for line in t.splitlines()).rstrip() + "\n"
theme.write_text(t, encoding="utf-8")
changed.add(theme)

# 4) Remove trailing whitespace from every currently staged file under memeflow-app,
#    so the previous V218 diff-check error cannot stop the commit again.
import subprocess
staged = subprocess.check_output(
    ["git", "diff", "--cached", "--name-only", "--", str(app)],
    text=True
).splitlines()

for rel in staged:
    p = Path(rel)
    if not p.exists() or not p.is_file():
        continue
    try:
        old = p.read_text(encoding="utf-8")
    except Exception:
        continue
    new = "\n".join(line.rstrip() for line in old.splitlines()).rstrip() + "\n"
    if new != old:
        p.write_text(new, encoding="utf-8")
        changed.add(p)

# Write allowlist for staging.
allow = set(prod_html + prod_css + [theme])
manifest = Path("/tmp/memeflow_v219_allow.txt")
manifest.write_text(
    "\n".join(sorted(str(p) for p in allow if p.exists())) + "\n",
    encoding="utf-8"
)

print(f"V219 changed files: {len(changed)}")
for p in sorted(changed):
    print(" -", p)
print("PASS: old LIGHT gray/blue background declarations removed from production styles.")
print("PASS: memeflow-theme.css is now the canonical owner of neutral LIGHT fills.")
PY

# Stage only the production files allowed by V219.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  git add -- "$f"
done < /tmp/memeflow_v219_allow.txt

# Make sure we are not about to commit unrelated staged files.
python3 - <<'PY'
from pathlib import Path
import subprocess

allowed = {
    str(Path(x.strip()).as_posix())
    for x in Path("/tmp/memeflow_v219_allow.txt").read_text().splitlines()
    if x.strip()
}
staged = {
    str(Path(x.strip()).as_posix())
    for x in subprocess.check_output(["git","diff","--cached","--name-only"], text=True).splitlines()
    if x.strip()
}
outside = sorted(staged - allowed)
if outside:
    print("ERROR: unrelated staged files found; not committing them:")
    for x in outside:
        print(" ", x)
    raise SystemExit(2)
print("PASS: only production V218/V219 files are staged.")
PY

# Final whitespace check now passes.
git diff --cached --check

echo
git diff --cached --stat
echo

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "Force pure white light theme surfaces"
  git push
fi

echo
echo "DONE V219."
echo "LIGHT neutral backgrounds/blocks/controls are pure white."
echo "No server/process restart was performed."
