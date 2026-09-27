#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: transform.py <memeflow-app-dir>")

APP = Path(sys.argv[1])

PRODUCTION = [
    "index.html","system.html","how-it-works.html","smart-vault.html",
    "trading.html","settings.html","system-tokens.html","x100.html",
    "agent-performance.html","owner-intelligence.html","system-source.html",
]

VISUAL_PROPS = {
    "background","background-color","background-image","background-attachment",
    "background-position","background-size","background-repeat","color",
    "border","border-color","border-top","border-right","border-bottom","border-left",
    "border-top-color","border-right-color","border-bottom-color","border-left-color",
    "border-width","border-style","box-shadow","text-shadow","backdrop-filter",
    "-webkit-backdrop-filter","outline","outline-color",
}

SYSTEM_SETTINGS_MARKERS = (
    "mf-settings-standalone","mf-settings-page-","mf293-settings-","mf293-field",
    "mf293-switch","mf293-dex-filter","mf-theme-appearance","mf-agent-",
)

CANONICAL_SETTINGS_MARKERS = (
    "mf-settings-standalone","body.mf-page-settings","html:has(body.mf-page-settings)",
)

SEMANTIC_MARKERS = (
    "[data-state=","[data-active=",":checked","mf293-primary",
    "mf293-settings-error","mf-settings-page-live","mf293killswitch",
    "mf-agent-status","mf-agent-score",".danger",".error",".success",
    ".saved",".dirty",".busy",".positive",".negative",
)

NEUTRAL_SETTINGS_VARS = re.compile(
    r'^--mf-ui-(?:bg|surface|surface-2|surface-soft|line|line-strong|text|muted|faint)$',
    re.I,
)

def is_semantic_selector(selector):
    s = selector.lower().replace(" ", "")
    return any(marker.replace(" ", "") in s for marker in SEMANTIC_MARKERS)

def target_system_selector(selector):
    s = selector.lower()
    return any(marker in s for marker in SYSTEM_SETTINGS_MARKERS)

def target_canonical_selector(selector):
    s = selector.lower()
    return any(marker in s for marker in CANONICAL_SETTINGS_MARKERS)

def skip_ws_comments(text, i):
    n = len(text)
    while i < n:
        if text[i].isspace():
            i += 1
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                return n
            i = j + 2
            continue
        break
    return i

def find_control(text, i, controls):
    n = len(text)
    quote = None
    esc = False
    par = br = 0
    while i < n:
        if text.startswith("/*", i) and not quote:
            j = text.find("*/", i + 2)
            if j < 0:
                return n, None
            i = j + 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            par += 1
        elif ch == ")":
            par = max(0, par - 1)
        elif ch == "[":
            br += 1
        elif ch == "]":
            br = max(0, br - 1)
        elif par == 0 and br == 0 and ch in controls:
            return i, ch
        i += 1
    return n, None

def find_matching_brace(text, open_i):
    n = len(text)
    depth = 1
    quote = None
    esc = False
    i = open_i + 1
    while i < n:
        if text.startswith("/*", i) and not quote:
            j = text.find("*/", i + 2)
            if j < 0:
                raise ValueError("Unclosed CSS comment")
            i = j + 2
            continue
        ch = text[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("Unclosed CSS block")

def split_declarations(body):
    segs = []
    start = 0
    quote = None
    esc = False
    par = br = 0
    i = 0
    while i < len(body):
        if body.startswith("/*", i) and not quote:
            j = body.find("*/", i + 2)
            if j < 0:
                j = len(body) - 2
            i = j + 2
            continue
        ch = body[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
        elif ch == "(":
            par += 1
        elif ch == ")":
            par = max(0, par - 1)
        elif ch == "[":
            br += 1
        elif ch == "]":
            br = max(0, br - 1)
        elif ch == ";" and par == 0 and br == 0:
            segs.append(body[start:i + 1])
            start = i + 1
        i += 1
    if start < len(body):
        segs.append(body[start:])
    return segs

def parse_decl(segment):
    raw = segment.strip()
    if not raw:
        return None
    if raw.endswith(";"):
        raw = raw[:-1]
    i, ctrl = find_control(raw, 0, {":"})
    if ctrl != ":":
        return None
    prop = raw[:i].strip()
    value = raw[i + 1:].strip()
    return (prop, value) if prop else None

def strip_settings_visuals(css, selector_target):
    out = []
    n = len(css)
    i = 0
    while i < n:
        j = skip_ws_comments(css, i)
        if j > i:
            out.append(css[i:j])
            i = j
        if i >= n:
            break

        if css[i] == "@":
            ctrl_i, ctrl = find_control(css, i, {";", "{"})
            if ctrl is None:
                out.append(css[i:])
                break
            header = css[i:ctrl_i].strip()
            if ctrl == ";":
                out.append(css[i:ctrl_i + 1])
                i = ctrl_i + 1
                continue
            close = find_matching_brace(css, ctrl_i)
            inner = css[ctrl_i + 1:close]
            low = header.lower()
            if low.startswith("@font-face") or low.startswith("@keyframes") or low.startswith("@-webkit-keyframes"):
                out.append(css[i:close + 1])
            else:
                cleaned = strip_settings_visuals(inner, selector_target)
                if cleaned.strip():
                    out.append(header + "{" + cleaned + "}")
            i = close + 1
            continue

        open_i, ctrl = find_control(css, i, {"{"})
        if ctrl != "{":
            out.append(css[i:])
            break

        selector = css[i:open_i].strip()
        close = find_matching_brace(css, open_i)
        body = css[open_i + 1:close]

        nested_i, nested_ctrl = find_control(body, 0, {"{"})
        if nested_ctrl == "{":
            cleaned = strip_settings_visuals(body, selector_target)
            if cleaned.strip():
                out.append(selector + "{" + cleaned + "}")
            i = close + 1
            continue

        target = selector_target(selector)
        semantic = is_semantic_selector(selector)

        if not target or semantic:
            out.append(selector + "{" + body + "}")
            i = close + 1
            continue

        kept = []
        for seg in split_declarations(body):
            parsed = parse_decl(seg)
            if not parsed:
                kept.append(seg)
                continue
            prop, value = parsed
            if prop.lower() in VISUAL_PROPS:
                continue
            if NEUTRAL_SETTINGS_VARS.match(prop):
                continue
            kept.append(seg)

        new_body = "".join(kept)
        if new_body.strip():
            out.append(selector + "{" + new_body + "}")
        i = close + 1

    return "".join(out)

system = APP / "system.css"
if not system.exists():
    raise SystemExit("ERROR: system.css missing")
system.write_text(
    strip_settings_visuals(system.read_text(encoding="utf-8"), target_system_selector),
    encoding="utf-8",
)
print("CLEANED SETTINGS VISUALS:", system)

old_canon = APP / "memeflow-x-canonical-v174.css"
if not old_canon.exists():
    raise SystemExit("ERROR: memeflow-x-canonical-v174.css missing")

canon_text = strip_settings_visuals(
    old_canon.read_text(encoding="utf-8"),
    target_canonical_selector,
)

SETTINGS_CANONICAL = r'''
/* ==========================================================================
   MEMEFLOW SYSTEM SETTINGS CANONICAL V175
   One visual owner for Settings. Geometry remains in component CSS.
   ========================================================================== */

/* DARK */
html:not([data-theme="light"]) body.mf-settings-standalone {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  color: #e7e9ea !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone .mf-settings-page-shell {
  background: transparent !important;
  background-image: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone .mf-settings-page-header {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-bottom: 1px solid #2f3336 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone :where(
  .mf293-settings-panel,
  .mf293-settings-group,
  .mf293-field,
  .mf293-settings-meta > span,
  .mf293-settings-meta > label,
  .mf293-dex-filter-meta,
  .mf-agent-item,
  .mf-agent-events,
  .mf-theme-appearance
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone .mf293-settings-panel {
  border: 1px solid #2f3336 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone :where(
  .mf293-settings-head,
  .mf293-settings-meta,
  .mf293-settings-body,
  .mf293-settings-group > summary,
  .mf293-settings-grid
) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone :where(
  .mf293-settings-head,
  .mf293-settings-meta
) {
  border-bottom-color: #2f3336 !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone .mf293-settings-footer {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  border-top-color: #2f3336 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone :where(
  .mf293-settings-head h2,
  .mf293-settings-group summary strong,
  .mf293-settings-meta strong,
  .mf293-field input:not([type="checkbox"]),
  .mf293-field select,
  .mf293-field textarea,
  .mf-theme-appearance-copy strong
) {
  color: #e7e9ea !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone :where(
  .mf-settings-page-title > strong,
  .mf293-settings-group summary small,
  .mf293-settings-meta span,
  .mf293-field-label,
  .mf293-dex-filter-meta,
  .mf-theme-appearance-copy small,
  .mf-theme-appearance-label,
  .mf-theme-current,
  .mf-agent-note,
  .mf-agent-history
) {
  color: #71767b !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone :where(
  .mf293-field input:not([type="checkbox"]),
  .mf293-field select,
  .mf293-field textarea
) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-settings-standalone .mf293-switch-track {
  background: #000000 !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* LIGHT — same global light language as the rest of MEMEFLOW */
html[data-theme="light"] body.mf-settings-standalone {
  background: var(--mf-app-bg, #f4f6f8) !important;
  background-color: var(--mf-app-bg, #f4f6f8) !important;
  background-image:
    radial-gradient(circle at 52% -8%, rgba(70,150,178,.08), transparent 31%),
    linear-gradient(180deg,#f7f9fb 0%,#f4f6f8 48%,#f1f4f6 100%) !important;
  color: var(--mf-app-text, #17222c) !important;
}

html[data-theme="light"] body.mf-settings-standalone .mf-settings-page-shell {
  background: transparent !important;
  background-image: none !important;
}

html[data-theme="light"] body.mf-settings-standalone .mf-settings-page-header {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-bottom: 1px solid rgba(38,59,74,.09) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html[data-theme="light"] body.mf-settings-standalone .mf293-settings-panel {
  background: linear-gradient(180deg,#ffffff,#f8fafb) !important;
  background-color: #ffffff !important;
  background-image: linear-gradient(180deg,#ffffff,#f8fafb) !important;
  border: 1px solid rgba(38,59,74,.105) !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf293-settings-group,
  .mf293-settings-meta > span,
  .mf293-settings-meta > label,
  .mf-theme-appearance
) {
  background: rgba(255,255,255,.92) !important;
  background-color: rgba(255,255,255,.92) !important;
  background-image: none !important;
  border-color: rgba(38,59,74,.10) !important;
  box-shadow: none !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf293-field,
  .mf293-dex-filter-meta,
  .mf-agent-item,
  .mf-agent-events
) {
  background: rgba(25,45,59,.025) !important;
  background-color: rgba(25,45,59,.025) !important;
  background-image: none !important;
  border-color: rgba(38,59,74,.08) !important;
  box-shadow: none !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf293-settings-head,
  .mf293-settings-meta,
  .mf293-settings-body,
  .mf293-settings-group > summary,
  .mf293-settings-grid
) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf293-settings-head,
  .mf293-settings-meta
) {
  border-bottom-color: rgba(38,59,74,.085) !important;
}

html[data-theme="light"] body.mf-settings-standalone .mf293-settings-footer {
  background: rgba(248,250,252,.97) !important;
  background-color: rgba(248,250,252,.97) !important;
  background-image: none !important;
  border-top-color: rgba(38,59,74,.085) !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf-settings-page-title > span,
  .mf293-settings-head h2,
  .mf293-settings-group summary strong,
  .mf293-settings-meta strong,
  .mf293-field input:not([type="checkbox"]),
  .mf293-field select,
  .mf293-field textarea,
  .mf-theme-appearance-copy strong
) {
  color: #17222c !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf-settings-page-title > strong,
  .mf293-settings-group summary small,
  .mf293-settings-meta span,
  .mf293-field-label,
  .mf293-dex-filter-meta,
  .mf-theme-appearance-copy small,
  .mf-theme-appearance-label,
  .mf-theme-current,
  .mf-agent-note,
  .mf-agent-history
) {
  color: #667782 !important;
}

html[data-theme="light"] body.mf-settings-standalone :where(
  .mf293-field input:not([type="checkbox"]),
  .mf293-field select,
  .mf293-field textarea
) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

html[data-theme="light"] body.mf-settings-standalone .mf293-switch-track {
  background: #eef2f5 !important;
  border-color: rgba(38,59,74,.12) !important;
  box-shadow: none !important;
}

/* Semantic colors/states remain owned by their existing semantic rules. */
/* MEMEFLOW_SYSTEM_SETTINGS_CANONICAL_V175_END */
'''

v175 = APP / "memeflow-x-canonical-v175.css"
v175.write_text(canon_text.rstrip() + "\n\n" + SETTINGS_CANONICAL.strip() + "\n", encoding="utf-8")
print("CREATED:", v175)

settings_html = APP / "settings.html"
text = settings_html.read_text(encoding="utf-8")
lines = []
for line in text.splitlines():
    if "settings-light-polish-v60.css" in line:
        continue
    if "MEMEFLOW_SETTINGS_LIGHT_POLISH_V60" in line:
        continue
    lines.append(line)
settings_html.write_text("\n".join(lines) + "\n", encoding="utf-8")

light_asset = APP / "settings-light-polish-v60.css"
if light_asset.exists():
    light_asset.unlink()
    print("REMOVED:", light_asset)

for name in PRODUCTION:
    p = APP / name
    text = p.read_text(encoding="utf-8")
    text = re.sub(
        r'<link\b[^>]*href=["\']/memeflow-x-canonical-v174\.css[^"\']*["\'][^>]*>',
        '<link rel="stylesheet" href="/memeflow-x-canonical-v175.css?v=x-settings-unified-v175-20260922">',
        text,
        flags=re.I,
    )
    if "memeflow-x-canonical-v175.css" not in text:
        if "</head>" not in text:
            raise SystemExit(f"ERROR: missing </head> in {p}")
        text = text.replace(
            "</head>",
            '  <link rel="stylesheet" href="/memeflow-x-canonical-v175.css?v=x-settings-unified-v175-20260922">\n</head>',
            1,
        )
    p.write_text(text, encoding="utf-8")
    print("V175 LINK:", p)

old_canon.unlink()
print("REMOVED:", old_canon)
