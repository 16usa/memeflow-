#!/usr/bin/env python3
from pathlib import Path
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: transform.py <memeflow-app-dir>")

APP = Path(sys.argv[1])

PAGES = [
    ("index.html", "mf-page-index"),
    ("system.html", "mf-page-system"),
    ("how-it-works.html", "mf-page-how-it-works"),
    ("smart-vault.html", "mf-page-smart-vault"),
    ("trading.html", "mf-page-trading"),
    ("settings.html", "mf-page-settings"),
    ("system-tokens.html", "mf-page-system-tokens"),
    ("x100.html", "mf-page-x100"),
    ("agent-performance.html", "mf-page-agent-performance"),
    ("owner-intelligence.html", "mf-page-owner-intelligence"),
    ("system-source.html", "mf-page-system-source"),
]

TYPO_PROPS = {
    "font",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-stretch",
    "font-variant",
    "font-feature-settings",
    "font-variation-settings",
    "font-optical-sizing",
    "font-kerning",
    "line-height",
    "letter-spacing",
    "text-transform",
    "text-rendering",
    "-webkit-font-smoothing",
    "-moz-osx-font-smoothing",
}

TYPO_VAR_RE = re.compile(
    r'^--(?:.*(?:type|font|tracking|leading|letter-spacing|line-height).*)$',
    re.I,
)

PURE_TYPO_HELPERS = {
    "memeflow-typography-rhythm-v51.css",
    "memeflow-type-scale-hierarchy-v52.css",
    "memeflow-optical-balance-v53.css",
    "trading-typography-v66.css",
}

OLD_CANONICALS = {
    "memeflow-x-canonical-v169.css",
    "memeflow-x-canonical-v170.css",
    "memeflow-x-canonical-v171.css",
    "memeflow-x-canonical-v172.css",
    "memeflow-x-canonical-v173.css",
    "memeflow-x-canonical-v174.css",
}

def is_typo_prop(prop):
    p = prop.strip().lower()
    return p in TYPO_PROPS or bool(TYPO_VAR_RE.match(p))

def split_top_level_commas(s):
    parts = []
    start = 0
    par = br = 0
    quote = None
    esc = False
    i = 0
    while i < len(s):
        ch = s[i]
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
        elif ch == "," and par == 0 and br == 0:
            parts.append(s[start:i])
            start = i + 1
        i += 1
    parts.append(s[start:])
    return parts

def scope_selector(selector, page_class):
    out = []
    for raw in split_top_level_commas(selector):
        s = raw.strip()
        if not s:
            continue
        if s == ":root":
            out.append(f"body.{page_class}")
            continue
        if re.search(r'\bbody\b', s):
            if f"body.{page_class}" not in s:
                s = re.sub(r'\bbody\b', f"body.{page_class}", s, count=1)
            out.append(s)
            continue
        if re.match(r'^html\b', s):
            s = re.sub(r'^html\b', f'html:has(body.{page_class})', s, count=1)
            out.append(s)
            continue
        out.append(f"body.{page_class} {s}")
    return ",\n".join(out)

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
    i, colon = find_control(raw, 0, {":"})
    if colon != ":":
        return None
    prop = raw[:i].strip()
    value = raw[i + 1:].strip()
    if not prop:
        return None
    return prop, value

ORDER = 0

def process_css(text, page_class=None, collect=False, contexts=()):
    global ORDER
    out = []
    records = []
    n = len(text)
    i = 0

    while i < n:
        j = skip_ws_comments(text, i)
        if j > i:
            out.append(text[i:j])
            i = j
        if i >= n:
            break

        if text[i] == "@":
            ctrl_i, ctrl = find_control(text, i, {";", "{"})
            if ctrl is None:
                out.append(text[i:])
                break
            header = text[i:ctrl_i].strip()
            if ctrl == ";":
                out.append(text[i:ctrl_i + 1])
                i = ctrl_i + 1
                continue

            close = find_matching_brace(text, ctrl_i)
            inner = text[ctrl_i + 1:close]
            low = header.lower()

            if low.startswith("@font-face") or low.startswith("@keyframes") or low.startswith("@-webkit-keyframes"):
                out.append(text[i:close + 1])
            else:
                stripped_inner, recs = process_css(
                    inner,
                    page_class=page_class,
                    collect=collect,
                    contexts=contexts + (header,),
                )
                if stripped_inner.strip():
                    out.append(header + "{" + stripped_inner + "}")
                records.extend(recs)
            i = close + 1
            continue

        open_i, ctrl = find_control(text, i, {"{"})
        if ctrl != "{":
            out.append(text[i:])
            break

        selector = text[i:open_i].strip()
        close = find_matching_brace(text, open_i)
        body = text[open_i + 1:close]

        nested_i, nested_ctrl = find_control(body, 0, {"{"})
        if nested_ctrl == "{":
            stripped_inner, recs = process_css(
                body,
                page_class=page_class,
                collect=collect,
                contexts=contexts,
            )
            if stripped_inner.strip():
                out.append(selector + "{" + stripped_inner + "}")
            records.extend(recs)
            i = close + 1
            continue

        kept = []
        for seg in split_declarations(body):
            parsed = parse_decl(seg)
            if not parsed:
                kept.append(seg)
                continue
            prop, value = parsed
            if is_typo_prop(prop):
                if collect and prop.strip().lower() != "font-family":
                    ORDER += 1
                    scoped = scope_selector(selector, page_class) if page_class else selector
                    records.append((contexts, scoped, prop.strip(), value, ORDER))
                continue
            kept.append(seg)

        new_body = "".join(kept)
        if new_body.strip():
            out.append(selector + "{" + new_body + "}")

        i = close + 1

    return "".join(out), records

def dedupe_records(records):
    last = {}
    for rec in records:
        contexts, selector, prop, value, order = rec
        key = (tuple(contexts), selector.strip(), prop.strip().lower())
        last[key] = rec
    return sorted(last.values(), key=lambda r: r[4])

def render_records(records):
    chunks = []
    for contexts, selector, prop, value, _order in records:
        rule = f"{selector}{{{prop}:{value};}}"
        for ctx in reversed(contexts):
            rule = f"{ctx}{{{rule}}}"
        chunks.append(rule)
    return "\n".join(chunks)

def css_href_from_link(tag):
    m = re.search(r'href=["\']([^"\']+\.css(?:\?[^"\']*)?)["\']', tag, re.I)
    if not m:
        return None
    href = m.group(1).split("?", 1)[0]
    if href.startswith("http://") or href.startswith("https://"):
        return None
    return href.lstrip("/")

token_re = re.compile(
    r'<link\b[^>]*href=["\'][^"\']+\.css(?:\?[^"\']*)?["\'][^>]*>'
    r'|<style\b[^>]*>[\s\S]*?</style>',
    re.I,
)

page_text = {}
page_tokens = {}
active_css = set()

for page, page_class in PAGES:
    p = APP / page
    if not p.exists():
        raise SystemExit(f"Missing production page: {p}")
    text = p.read_text(encoding="utf-8")
    page_text[page] = text
    toks = list(token_re.finditer(text))
    page_tokens[page] = toks
    for m in toks:
        tag = m.group(0)
        if tag.lower().startswith("<link"):
            href = css_href_from_link(tag)
            if href and (APP / href).exists():
                active_css.add(href)

source_cache = {
    name: (APP / name).read_text(encoding="utf-8")
    for name in sorted(active_css)
    if (APP / name).exists()
}

page_type_sections = []

for page, page_class in PAGES:
    records = []
    for m in page_tokens[page]:
        token = m.group(0)
        if token.lower().startswith("<link"):
            href = css_href_from_link(token)
            if href and href in source_cache:
                _stripped, recs = process_css(
                    source_cache[href],
                    page_class=page_class,
                    collect=True,
                )
                records.extend(recs)
        else:
            sm = re.search(r'<style\b[^>]*>([\s\S]*?)</style>', token, re.I)
            if sm:
                _stripped, recs = process_css(
                    sm.group(1),
                    page_class=page_class,
                    collect=True,
                )
                records.extend(recs)

    records = dedupe_records(records)
    page_type_sections.append(
        f"/* TYPOGRAPHY: {page} */\n" + render_records(records) + "\n"
    )
    print(f"TYPOGRAPHY CAPTURE {page}: {len(records)} declarations")

for name, text in source_cache.items():
    if name == "memeflow-x-canonical-v174.css":
        continue
    stripped, _ = process_css(text, collect=False)
    (APP / name).write_text(stripped, encoding="utf-8")
    print("TYPOGRAPHY STRIPPED", APP / name)

style_tag_re = re.compile(r'(<style\b[^>]*>)([\s\S]*?)(</style>)', re.I)
open_tag_re = re.compile(r'<([A-Za-z][\w:-]*)([^<>]*\sstyle=["\'][^"\']*["\'][^<>]*)>', re.I)

inline_extra = []

for page, page_class in PAGES:
    p = APP / page
    text = p.read_text(encoding="utf-8")

    def style_tag_sub(m):
        stripped, _ = process_css(m.group(2), collect=False)
        return m.group(1) + stripped + m.group(3)

    text = style_tag_re.sub(style_tag_sub, text)

    def tag_sub(m):
        tag = m.group(0)
        sm = re.search(r'\sstyle=(["\'])(.*?)\1', tag, re.I | re.S)
        if not sm:
            return tag

        style = sm.group(2)
        kept = []
        moved = []

        for seg in split_declarations(style):
            parsed = parse_decl(seg)
            if not parsed:
                kept.append(seg)
                continue
            prop, value = parsed
            if is_typo_prop(prop):
                moved.append((prop.strip(), value))
            else:
                kept.append(seg)

        if not moved:
            return tag

        tag_sub.counter += 1
        hook = f"{page_class}-{tag_sub.counter}"

        typedecls = "".join(
            f"{prop}:{value if '!important' in value.lower() else value + ' !important'};"
            for prop, value in moved
            if prop.lower() != "font-family"
        )
        if typedecls:
            inline_extra.append(
                f'body.{page_class} [data-mf-type-v174="{hook}"]'
                + "{" + typedecls + "}"
            )

        kept_style = "".join(kept).strip()
        if kept_style:
            tag = tag[:sm.start()] + f' style="{kept_style}"' + tag[sm.end():]
        else:
            tag = tag[:sm.start()] + tag[sm.end():]

        tag = tag[:-1] + f' data-mf-type-v174="{hook}">'
        return tag

    tag_sub.counter = 0
    text = open_tag_re.sub(tag_sub, text)
    p.write_text(text, encoding="utf-8")

base_candidates = [
    APP / "memeflow-x-canonical-v173.css",
    APP / "memeflow-x-canonical-v172.css",
    APP / "memeflow-x-canonical-v171.css",
]

base_text = ""
for cand in base_candidates:
    if cand.exists():
        raw = cand.read_text(encoding="utf-8")
        base_text, _ = process_css(raw, collect=False)
        break

if not base_text:
    raise SystemExit("ERROR: no current canonical visual file found")

family_rule = """
/* ONE SITE-WIDE FONT FAMILY OWNER */
html,
body,
button,
input,
select,
textarea {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif !important;
}
"""

typography_header = """
/* ==========================================================================
   MEMEFLOW CANONICAL TYPOGRAPHY V174

   ONLY active owner of font family, font sizes, weights, line heights,
   letter spacing, text transform and typography tokens.
   ========================================================================== */
"""

out = APP / "memeflow-x-canonical-v174.css"
out.write_text(
    "/* MEMEFLOW X + TYPOGRAPHY CANONICAL V174 */\n\n"
    + base_text.strip()
    + "\n\n"
    + typography_header
    + "\n"
    + family_rule
    + "\n"
    + "\n".join(page_type_sections)
    + "\n/* INLINE TYPOGRAPHY MOVED FROM STYLE ATTRIBUTES */\n"
    + "\n".join(inline_extra)
    + "\n/* MEMEFLOW_X_TYPOGRAPHY_CANONICAL_V174_END */\n",
    encoding="utf-8",
)

remove_assets = set(OLD_CANONICALS) | PURE_TYPO_HELPERS
new_link = '<link rel="stylesheet" href="/memeflow-x-canonical-v174.css?v=x-typography-canonical-v174-20260922">'

for page, page_class in PAGES:
    p = APP / page
    text = p.read_text(encoding="utf-8")
    lines = []
    for line in text.splitlines():
        if any(asset in line for asset in remove_assets):
            continue
        lines.append(line)
    text = "\n".join(lines)
    if "</head>" not in text:
        raise SystemExit(f"ERROR: </head> missing in {p}")
    text = text.replace("</head>", f"  {new_link}\n</head>", 1)
    p.write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")
    print("V174 LINK", p)

for asset in remove_assets:
    if asset == "memeflow-x-canonical-v174.css":
        continue
    path = APP / asset
    if path.exists():
        path.unlink()
        print("REMOVED", path)
